import { supabase } from "./supabase";
import type { Answers, Question, Results, Survey } from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function createSurvey(title: string, questions: Question[]) {
  const rows = unwrap<{ code: string; host_key: string }[]>(
    await supabase().rpc("create_survey", { p_title: title, p_questions: questions }),
  );
  return rows[0];
}

export async function getSurvey(code: string): Promise<Survey | null> {
  const rows = unwrap<Survey[]>(await supabase().rpc("get_survey", { p_code: code }));
  return rows[0] ?? null;
}

export async function submitResponse(code: string, answers: Answers) {
  unwrap(await supabase().rpc("submit_response", { p_code: code, p_answers: answers }));
}

export async function getResults(code: string, key: string): Promise<Results> {
  return unwrap<Results>(await supabase().rpc("get_results", { p_code: code, p_key: key }));
}

export async function setSurveyStatus(code: string, key: string, status: "open" | "closed") {
  unwrap(await supabase().rpc("set_survey_status", { p_code: code, p_key: key, p_status: status }));
}

export async function deleteSurvey(code: string, key: string) {
  unwrap(await supabase().rpc("delete_survey", { p_code: code, p_key: key }));
}

/** Host keys live only in this browser so the host can get back to results. */
const STORE = "pulse:hosted";

export type Hosted = { code: string; key: string; title: string; createdAt: string };

export function rememberHosted(h: Hosted) {
  try {
    const list = listHosted().filter((x) => x.code !== h.code);
    localStorage.setItem(STORE, JSON.stringify([h, ...list].slice(0, 30)));
  } catch {}
}

export function listHosted(): Hosted[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}

export function forgetHosted(code: string) {
  try {
    localStorage.setItem(STORE, JSON.stringify(listHosted().filter((x) => x.code !== code)));
  } catch {}
}
