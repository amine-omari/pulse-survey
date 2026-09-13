"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSurvey, submitResponse } from "@/lib/api";
import type { Answers, Question, Survey } from "@/lib/types";
import { isAnswerable, nameKey, scaleRange } from "@/lib/types";

type Load = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; survey: Survey };
type Screen = "intro" | "step" | "review" | "done";

const AUTO_ADVANCE_MS = 260;
const draftKey = (code: string) => `pulse:draft:${code}`;

export default function AnswerPage() {
  const { code } = useParams<{ code: string }>();
  const [load, setLoad] = useState<Load>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    getSurvey(code)
      .then((s) => alive && setLoad(s ? { kind: "ready", survey: s } : { kind: "missing" }))
      .catch(() => alive && setLoad({ kind: "missing" }));
    return () => {
      alive = false;
    };
  }, [code]);

  return (
    <div className="theme-dark flex-1 flex flex-col min-h-dvh">
      <header className="px-5 py-4 flex items-center justify-between">
        <Logo className="h-5 w-auto text-ink" />
        <span className="pill">Anonymous</span>
      </header>
      <main className="flex-1 flex flex-col px-5 pb-8">
        {load.kind === "loading" && <Center><p className="text-muted">Loading…</p></Center>}
        {load.kind === "missing" && (
          <Center>
            <h1 className="text-2xl font-bold">No survey at this link</h1>
            <p className="mt-2 text-muted">Check the code with whoever is hosting.</p>
          </Center>
        )}
        {load.kind === "ready" && load.survey.status === "closed" && (
          <Center>
            <h1 className="text-2xl font-bold">{load.survey.title}</h1>
            <p className="mt-2 text-muted">This survey is closed. Thanks for stopping by.</p>
          </Center>
        )}
        {load.kind === "ready" && load.survey.status === "open" && <Flow code={code} survey={load.survey} />}
      </main>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="m-auto max-w-md text-center py-16">{children}</div>;
}

function Flow({ code, survey }: { code: string; survey: Survey }) {
  const steps = survey.questions;
  const answerable = useMemo(() => steps.filter(isAnswerable), [steps]);
  const [screen, setScreen] = useState<Screen>("intro");
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  // Keep a draft so an accidental reload doesn't lose answers.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey(code));
      if (raw) {
        const d = JSON.parse(raw);
        const t = setTimeout(() => {
          setAnswers(d.answers ?? {});
          if (typeof d.i === "number" && d.screen === "step") {
            setI(Math.min(d.i, steps.length - 1));
            setScreen("step");
          }
        }, 0);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [code, steps.length]);

  useEffect(() => {
    if (screen === "done") return;
    try {
      sessionStorage.setItem(draftKey(code), JSON.stringify({ answers, i, screen }));
    } catch {}
  }, [answers, i, screen, code]);

  const q = steps[i];
  const answeredCount = answerable.filter((x) => answers[x.id] !== undefined && answers[x.id] !== "").length;
  const numberOf = (x: Question) => answerable.indexOf(x) + 1;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (timer.current) window.clearTimeout(timer.current);
      const next = i + dir;
      if (next < 0) return setScreen("intro");
      if (next >= steps.length) return setScreen("review");
      setI(next);
      window.scrollTo({ top: 0 });
    },
    [i, steps.length],
  );

  const set = (id: string, v: string | number) => setAnswers((a) => ({ ...a, [id]: v }));
  const pick = (id: string, v: string | number) => {
    const same = answers[id] === v;
    set(id, same ? "" : v);
    if (!same) {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => go(1), AUTO_ADVANCE_MS);
    }
  };

  // Keyboard: number keys pick options / scale values, Enter continues, Esc goes back.
  useEffect(() => {
    if (screen !== "step") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go(1);
        return;
      }
      if (e.key === "Enter") go(1);
      if (e.key === "Escape") go(-1);
      if (q.type === "choice" && /^[1-9]$/.test(e.key)) {
        const opt = q.options?.[Number(e.key) - 1];
        if (opt) pick(q.id, opt);
      }
      if (q.type === "scale" && /^[0-9]$/.test(e.key)) {
        const { min, max } = scaleRange(q);
        const n = Number(e.key);
        if (n >= min && n <= max) pick(q.id, n);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, q, answers]);

  async function submit() {
    setError(null);
    const clean: Answers = {};
    for (const x of answerable) {
      const v = answers[x.id];
      if (v === undefined || v === "") continue;
      clean[x.id] = typeof v === "string" ? v.trim().slice(0, 2000) : v;
      if (x.type === "named") {
        const name = String(answers[nameKey(x.id)] ?? "").trim().slice(0, 80);
        if (!name) return setError(`Add your name to "${x.text}" or leave that answer empty.`);
        clean[nameKey(x.id)] = name;
      }
    }
    if (Object.keys(clean).length === 0) return setError("Answer at least one question before sending.");
    setBusy(true);
    try {
      await submitResponse(code, clean);
      try {
        sessionStorage.removeItem(draftKey(code));
      } catch {}
      setScreen("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your answers. Try again.");
      setBusy(false);
    }
  }

  if (screen === "intro")
    return (
      <div className="m-auto w-full max-w-md flex flex-col gap-8 step-enter py-10">
        <div>
          <span className="label">Team survey</span>
          <h1 className="mt-2 text-4xl font-bold leading-tight">{survey.title}</h1>
        </div>
        <ul className="flex flex-col gap-3 text-muted">
          <li className="flex gap-3"><Dot />{answerable.length} questions, about {Math.max(1, Math.round(answerable.length / 5))} min.</li>
          <li className="flex gap-3"><Dot />Answers are anonymous. No name, email, or device is saved.</li>
          <li className="flex gap-3"><Dot />Skip anything you don&apos;t want to answer.</li>
        </ul>
        <button
          className="btn btn-primary text-lg py-4"
          onClick={() => {
            setI(0);
            setScreen("step");
          }}
        >
          {answeredCount > 0 ? "Continue" : "Start"}
        </button>
      </div>
    );

  if (screen === "done")
    return (
      <div className="m-auto max-w-md text-center step-enter py-16">
        <div className="mx-auto w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center text-3xl">✓</div>
        <h1 className="mt-5 text-3xl font-bold">Sent. Thank you.</h1>
        <p className="mt-2 text-muted">Your answers were saved without your name. You can close this tab.</p>
      </div>
    );

  if (screen === "review")
    return (
      <div className="mx-auto w-full max-w-md flex flex-col gap-6 step-enter py-6">
        <div>
          <span className="label">Review</span>
          <h1 className="mt-2 text-3xl font-bold">
            {answeredCount} of {answerable.length} answered
          </h1>
          <p className="mt-1 text-muted">Tap any answer to change it.</p>
        </div>
        <ul className="flex flex-col divide-y divide-line card">
          {answerable.map((x) => {
            const v = answers[x.id];
            const has = v !== undefined && v !== "";
            return (
              <li key={x.id}>
                <button
                  className="w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-surface-2"
                  onClick={() => {
                    setI(steps.indexOf(x));
                    setScreen("step");
                  }}
                >
                  <span className="font-mono text-xs text-muted pt-1 w-5 shrink-0">{numberOf(x)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-muted leading-snug">{x.text}</span>
                    <span className={`block mt-0.5 truncate ${has ? "" : "text-muted italic"}`}>
                      {has ? String(v) : "Skipped"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {error && <p className="text-danger text-sm" role="alert">{error}</p>}
        <div className="flex flex-col gap-2">
          <button className="btn btn-primary text-lg py-4" onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Send anonymously"}
          </button>
          <button className="btn btn-ghost" onClick={() => { setI(steps.length - 1); setScreen("step"); }}>
            Back
          </button>
        </div>
      </div>
    );

  // step
  const isInfo = q.type === "info";
  const value = answers[q.id];
  const hasValue = value !== undefined && value !== "";

  return (
    <div className="mx-auto w-full max-w-md flex-1 flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-muted tabular-nums">
          <span>{isInfo ? "Note" : `Question ${numberOf(q)} of ${answerable.length}`}</span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="progress">
          <span style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div key={q.id} className="step-enter flex-1 flex flex-col gap-6">
        <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{q.text}</h1>

        {isInfo && q.body && <p className="text-lg text-muted leading-relaxed whitespace-pre-wrap">{q.body}</p>}

        {q.type === "choice" && (
          <div className="flex flex-col gap-2.5">
            {(q.options ?? []).map((opt, k) => (
              <button key={opt} type="button" className="option" aria-pressed={value === opt} onClick={() => pick(q.id, opt)}>
                <span className="key">{k + 1}</span>
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.type === "scale" && (
          <div className="flex flex-col gap-2">
            <div className="scale-grid" style={{ gridTemplateColumns: `repeat(${Math.min(6, scaleRange(q).max - scaleRange(q).min + 1)}, 1fr)` }}>
              {Array.from({ length: scaleRange(q).max - scaleRange(q).min + 1 }, (_, k) => scaleRange(q).min + k).map((n) => (
                <button key={n} type="button" className="scale-btn" aria-pressed={value === n} onClick={() => pick(q.id, n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>Not at all</span>
              <span>Completely</span>
            </div>
          </div>
        )}

        {(q.type === "text" || q.type === "named") && (
          <div className="flex flex-col gap-3">
            {q.type === "named" && (
              <>
                <span className="pill self-start" style={{ color: "var(--danger)" }}>Not anonymous</span>
                <input
                  id={`a-${q.id}-name`}
                  className="field"
                  placeholder="Your name"
                  value={(answers[nameKey(q.id)] as string) ?? ""}
                  onChange={(e) => set(nameKey(q.id), e.target.value)}
                />
              </>
            )}
            <textarea
              id={`a-${q.id}`}
              className="field min-h-36 text-lg"
              placeholder="Type here"
              autoFocus
              value={(value as string) ?? ""}
              onChange={(e) => set(q.id, e.target.value)}
            />
            <span className="text-xs text-muted">⌘ + Enter to continue</span>
          </div>
        )}
      </div>

      <div className="sticky bottom-4 flex items-center gap-2">
        <button className="btn" onClick={() => go(-1)} aria-label="Back">←</button>
        <button className="btn btn-primary flex-1 py-3.5" onClick={() => go(1)}>
          {i === steps.length - 1 ? "Review answers" : isInfo ? "Continue" : hasValue ? "Next" : "Skip"}
        </button>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />;
}
