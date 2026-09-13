"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSurvey, forgetHosted, listHosted, rememberHosted, type Hosted } from "@/lib/api";
import type { Question, QuestionType } from "@/lib/types";

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Open answer",
  scale: "Scale 1 to 5",
  choice: "Pick one",
};

const STARTER: Question[] = [
  { id: "q1", text: "How are you feeling about the team right now?", type: "scale" },
  { id: "q2", text: "What is one thing we should stop doing?", type: "text" },
  { id: "q3", text: "What is one thing we should start doing?", type: "text" },
];

let seq = 10;
const newId = () => `q${seq++}`;

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("Team meetup check-in");
  const [questions, setQuestions] = useState<Question[]>(STARTER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosted, setHosted] = useState<Hosted[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setHosted(listHosted()), 0);
    return () => clearTimeout(t);
  }, []);

  const update = (i: number, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const remove = (i: number) => setQuestions((qs) => qs.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) =>
    setQuestions((qs) => {
      const j = i + dir;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const add = (type: QuestionType) =>
    setQuestions((qs) => [
      ...qs,
      { id: newId(), text: "", type, ...(type === "choice" ? { options: ["Yes", "No"] } : {}) },
    ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = questions
      .map((q) => ({
        ...q,
        text: q.text.trim(),
        options: q.type === "choice" ? q.options?.map((o) => o.trim()).filter(Boolean) : undefined,
      }))
      .filter((q) => q.text);
    if (!title.trim()) return setError("Give the survey a title.");
    if (cleaned.length === 0) return setError("Add at least one question.");
    if (cleaned.some((q) => q.type === "choice" && (q.options?.length ?? 0) < 2))
      return setError("Every pick-one question needs at least two options.");
    setBusy(true);
    try {
      const { code, host_key } = await createSurvey(title.trim(), cleaned);
      rememberHosted({ code, key: host_key, title: title.trim(), createdAt: new Date().toISOString() });
      router.push(`/s/${code}/host?k=${host_key}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the survey.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-10 pt-6">
      <section>
        <h1 className="text-4xl font-bold">Ask the room, anonymously.</h1>
        <p className="mt-3 text-muted max-w-prose">
          Write a few questions, put the QR code on the screen, and watch answers arrive live. Nobody&apos;s name,
          device, or address is stored with a response.
        </p>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="label">Survey title</label>
          <input id="title" className="field text-lg" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="flex flex-col gap-3">
          <span className="label">Questions</span>
          {questions.map((q, i) => (
            <div key={q.id} className="card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="pill">{TYPE_LABEL[q.type]}</span>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost px-2 py-1" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>↑</button>
                  <button type="button" className="btn btn-ghost px-2 py-1" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === questions.length - 1}>↓</button>
                  <button type="button" className="btn btn-ghost btn-danger px-2 py-1" onClick={() => remove(i)}>Remove</button>
                </div>
              </div>
              <input
                id={`q-${q.id}`}
                className="field"
                placeholder="Type your question"
                value={q.text}
                onChange={(e) => update(i, { text: e.target.value })}
              />
              {q.type === "choice" && (
                <div className="flex flex-col gap-2">
                  {(q.options ?? []).map((opt, k) => (
                    <div key={k} className="flex gap-2">
                      <input
                        id={`q-${q.id}-opt-${k}`}
                        className="field"
                        placeholder={`Option ${k + 1}`}
                        value={opt}
                        onChange={(e) =>
                          update(i, { options: q.options!.map((o, m) => (m === k ? e.target.value : o)) })
                        }
                      />
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label="Remove option"
                        disabled={(q.options?.length ?? 0) <= 2}
                        onClick={() => update(i, { options: q.options!.filter((_, m) => m !== k) })}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost self-start"
                    disabled={(q.options?.length ?? 0) >= 8}
                    onClick={() => update(i, { options: [...(q.options ?? []), ""] })}
                  >
                    + Add option
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => add("text")}>+ Open answer</button>
            <button type="button" className="btn" onClick={() => add("scale")}>+ Scale 1 to 5</button>
            <button type="button" className="btn" onClick={() => add("choice")}>+ Pick one</button>
          </div>
        </div>

        {error && <p className="text-danger text-sm" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary self-start text-base px-6" disabled={busy}>
          {busy ? "Creating…" : "Create survey and show QR"}
        </button>
      </form>

      {hosted.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="label">Your surveys on this device</span>
          <ul className="card divide-y divide-line">
            {hosted.map((h) => (
              <li key={h.code} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/s/${h.code}/host?k=${h.key}`} className="font-semibold hover:underline">
                    {h.title}
                  </Link>
                  <div className="text-xs text-muted font-mono">
                    {h.code} · {new Date(h.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-ghost text-xs"
                  onClick={() => {
                    forgetHosted(h.code);
                    setHosted(listHosted());
                  }}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
