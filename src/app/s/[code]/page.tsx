"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSurvey, submitResponse } from "@/lib/api";
import type { Answers, Survey } from "@/lib/types";
import { isAnswerable, nameKey, scaleRange } from "@/lib/types";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; survey: Survey } | { kind: "done" };

export default function AnswerPage() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSurvey(code)
      .then((s) => alive && setState(s ? { kind: "ready", survey: s } : { kind: "missing" }))
      .catch(() => alive && setState({ kind: "missing" }));
    return () => {
      alive = false;
    };
  }, [code]);

  if (state.kind === "loading") return <p className="text-muted pt-10 text-center">Loading…</p>;
  if (state.kind === "missing")
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-2xl font-bold">No survey at this link</h1>
        <p className="mt-2 text-muted">Check the code with whoever is hosting.</p>
      </div>
    );
  if (state.kind === "done")
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center text-2xl">✓</div>
        <h1 className="mt-4 text-2xl font-bold">Thanks, that&apos;s in.</h1>
        <p className="mt-2 text-muted">Your answer was saved without your name. You can close this tab.</p>
      </div>
    );

  const { survey } = state;

  if (survey.status === "closed")
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-2xl font-bold">{survey.title}</h1>
        <p className="mt-2 text-muted">This survey is closed. Thanks for stopping by.</p>
      </div>
    );

  const answerable = survey.questions.filter(isAnswerable);
  const answered = answerable.filter((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== "";
  }).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean: Answers = {};
    for (const q of survey.questions) {
      const v = answers[q.id];
      if (v === undefined || v === "") continue;
      clean[q.id] = typeof v === "string" ? v.trim().slice(0, 2000) : v;
      if (q.type === "named") {
        const name = String(answers[nameKey(q.id)] ?? "").trim().slice(0, 80);
        if (!name) return setError(`Add your name to "${q.text}" or leave that answer empty.`);
        clean[nameKey(q.id)] = name;
      }
    }
    if (Object.keys(clean).length === 0) return setError("Answer at least one question.");
    setBusy(true);
    try {
      await submitResponse(code, clean);
      setState({ kind: "done" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your answers. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md flex flex-col gap-7 pt-4">
      <div>
        <span className="pill">Anonymous</span>
        <h1 className="mt-3 text-3xl font-bold">{survey.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {answerable.length} question{answerable.length === 1 ? "" : "s"}. Skip any you like.
        </p>
      </div>

      {survey.questions.map((q) => (
        q.type === "info" ? (
          <section key={q.id} className="card p-5 bg-surface-2 border-transparent">
            <span className="label">Note</span>
            <h2 className="mt-1 text-xl font-semibold">{q.text}</h2>
            {q.body && <p className="mt-2 text-muted whitespace-pre-wrap leading-relaxed">{q.body}</p>}
          </section>
        ) : (
        <fieldset key={q.id} className="flex flex-col gap-3">
          <legend className="font-semibold text-lg leading-snug">
            <span className="text-muted font-mono text-sm mr-2">{answerable.indexOf(q) + 1}</span>
            {q.text}
          </legend>

          {q.type === "named" && (
            <>
              <span className="pill self-start" style={{ color: "var(--danger)" }}>Not anonymous</span>
              <input
                id={`a-${q.id}-name`}
                className="field"
                placeholder="Your name"
                value={(answers[nameKey(q.id)] as string) ?? ""}
                onChange={(e) => setAnswers({ ...answers, [nameKey(q.id)]: e.target.value })}
              />
              <textarea
                id={`a-${q.id}`}
                className="field min-h-24"
                placeholder="Your answer"
                value={(answers[q.id] as string) ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
              />
            </>
          )}

          {q.type === "text" && (
            <textarea
              id={`a-${q.id}`}
              className="field min-h-24"
              placeholder="Your answer"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            />
          )}

          {q.type === "scale" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: scaleRange(q).max - scaleRange(q).min + 1 }, (_, k) => scaleRange(q).min + k).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="scale-btn"
                    aria-pressed={answers[q.id] === n}
                    onClick={() => setAnswers({ ...answers, [q.id]: answers[q.id] === n ? "" : n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )}

          {q.type === "choice" && (
            <div className="flex flex-col gap-2">
              {(q.options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className="choice"
                  aria-pressed={answers[q.id] === opt}
                  onClick={() => setAnswers({ ...answers, [q.id]: answers[q.id] === opt ? "" : opt })}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-line shrink-0"
                    style={{ background: answers[q.id] === opt ? "var(--accent)" : "transparent" }}
                  />
                  {opt}
                </button>
              ))}
            </div>
          )}
        </fieldset>
        )
      ))}

      {error && <p className="text-danger text-sm" role="alert">{error}</p>}

      <div className="sticky bottom-4 flex items-center justify-between gap-3 card p-3">
        <span className="text-sm text-muted">
          {answered} of {answerable.length} answered
        </span>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Sending…" : "Send anonymously"}
        </button>
      </div>
    </form>
  );
}
