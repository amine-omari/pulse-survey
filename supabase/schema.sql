-- Pulse: anonymous team surveys
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).

create table if not exists public.surveys (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- short code in the QR link
  host_key    text not null,                 -- secret for the host/results page
  title       text not null,
  questions   jsonb not null,                -- [{id, text, type, options?}]
  status      text not null default 'open' check (status in ('open','closed')),
  created_at  timestamptz not null default now()
);

create table if not exists public.responses (
  id          uuid primary key default gen_random_uuid(),
  survey_id   uuid not null references public.surveys(id) on delete cascade,
  answers     jsonb not null,                -- {questionId: value}
  created_at  timestamptz not null default now()
);

create index if not exists responses_survey_idx on public.responses(survey_id);

-- Lock both tables down. Every access goes through the functions below,
-- so the publishable key can never read host keys or list raw responses.
alter table public.surveys   enable row level security;
alter table public.responses enable row level security;

-- Short, unambiguous code (no 0/O/1/I).
create or replace function public.gen_code(len int default 6)
returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random()*32)+1)::int, 1), '')
  from generate_series(1, len);
$$;

-- Host: create a survey. Returns the join code and the host key.
create or replace function public.create_survey(p_title text, p_questions jsonb)
returns table (code text, host_key text)
language plpgsql security definer set search_path = public as $$
declare v_code text; v_key text;
begin
  if p_title is null or length(trim(p_title)) = 0 then raise exception 'title required'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'at least one question required';
  end if;
  if jsonb_array_length(p_questions) > 20 then raise exception 'too many questions'; end if;
  loop
    v_code := gen_code(6);
    exit when not exists (select 1 from surveys s where s.code = v_code);
  end loop;
  v_key := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into surveys (code, host_key, title, questions) values (v_code, v_key, trim(p_title), p_questions);
  return query select v_code, v_key;
end $$;

-- Participant: fetch the survey to answer (no host key, no responses).
create or replace function public.get_survey(p_code text)
returns table (code text, title text, questions jsonb, status text)
language sql security definer set search_path = public stable as $$
  select s.code, s.title, s.questions, s.status from surveys s where s.code = upper(p_code);
$$;

-- Participant: submit an anonymous response. Nothing about the sender is stored.
create or replace function public.submit_response(p_code text, p_answers jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text;
begin
  select id, status into v_id, v_status from surveys where code = upper(p_code);
  if v_id is null then raise exception 'survey not found'; end if;
  if v_status <> 'open' then raise exception 'survey is closed'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'answers must be an object'; end if;
  if length(p_answers::text) > 20000 then raise exception 'response too large'; end if;
  insert into responses (survey_id, answers) values (v_id, p_answers);
end $$;

-- Host: read the survey plus every response. Requires the host key.
create or replace function public.get_results(p_code text, p_key text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_survey surveys%rowtype; v_responses jsonb;
begin
  select * into v_survey from surveys where code = upper(p_code) and host_key = p_key;
  if v_survey.id is null then raise exception 'not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'answers', r.answers, 'created_at', r.created_at) order by r.created_at), '[]'::jsonb)
    into v_responses from responses r where r.survey_id = v_survey.id;
  return jsonb_build_object(
    'code', v_survey.code, 'title', v_survey.title, 'questions', v_survey.questions,
    'status', v_survey.status, 'created_at', v_survey.created_at, 'responses', v_responses);
end $$;

-- Host: open or close the survey.
create or replace function public.set_survey_status(p_code text, p_key text, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('open','closed') then raise exception 'bad status'; end if;
  update surveys set status = p_status where code = upper(p_code) and host_key = p_key;
  if not found then raise exception 'not found'; end if;
end $$;

-- Host: delete the survey and all its responses.
create or replace function public.delete_survey(p_code text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from surveys where code = upper(p_code) and host_key = p_key;
  if not found then raise exception 'not found'; end if;
end $$;

revoke all on function public.gen_code(int) from public, anon, authenticated;
grant execute on function public.create_survey(text, jsonb)                to anon, authenticated;
grant execute on function public.get_survey(text)                          to anon, authenticated;
grant execute on function public.submit_response(text, jsonb)              to anon, authenticated;
grant execute on function public.get_results(text, text)                   to anon, authenticated;
grant execute on function public.set_survey_status(text, text, text)       to anon, authenticated;
grant execute on function public.delete_survey(text, text)                 to anon, authenticated;
