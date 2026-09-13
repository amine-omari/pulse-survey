"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { deleteSurvey, forgetHosted, getResults, rememberHosted, setSurveyStatus } from "@/lib/api";
import type { Question, Results } from "@/lib/types";
import { SCALE_MAX } from "@/lib/types";

const POLL_MS = 3000;

export default function HostView() {
  const { code } = useParams<{ code: string }>();
  const key = useSearchParams().get("k") ?? "";
  const router = useRouter();

  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"share" | "results">("share");
  const [copied, setCopied] = useState(false);

  const answerUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/s/${code}`),
    [code],
  );

  const refresh = useCallback(async () => {
    try {
      const r = await getResults(code, key);
      setResults(r);
      setError(null);
      rememberHosted({ code: r.code, key, title: r.title, createdAt: r.created_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results.");
    }
  }, [code, key]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  if (error && !results)
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-2xl font-bold">Can&apos;t open this survey</h1>
        <p className="mt-2 text-muted">The link needs the host key that was created with the survey.</p>
      </div>
    );
  if (!results) return <p className="text-muted pt-10 text-center">Loading…</p>;

  const n = results.responses.length;
  const open = results.status === "open";

  async function toggleStatus() {
    await setSurveyStatus(code, key, open ? "closed" : "open");
    refresh();
  }
  async function destroy() {
    if (!confirm("Delete this survey and every answer? This cannot be undone.")) return;
    await deleteSurvey(code, key);
    forgetHosted(code);
    router.push("/");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(answerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`pill ${open ? "pill-live" : ""}`}>{open ? "Live" : "Closed"}</span>
            <span className="pill font-mono">{results.code}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold">{results.title}</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={toggleStatus}>{open ? "Close survey" : "Reopen"}</button>
          <button className="btn btn-ghost btn-danger" onClick={destroy}>Delete</button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line">
        {(["share", "results"] as const).map((t) => (
          <button
            key={t}
            className="px-4 py-2 font-semibold text-sm -mb-px border-b-2"
            style={{ borderColor: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "var(--ink)" : "var(--muted)" }}
            onClick={() => setTab(t)}
          >
            {t === "share" ? "Share" : `Results (${n})`}
          </button>
        ))}
      </div>

      {tab === "share" ? (
        <section className="grid gap-8 md:grid-cols-[auto_1fr] items-center">
          <div className="card p-5 bg-white justify-self-center" style={{ background: "#fff" }}>
            {answerUrl && <QRCodeSVG value={answerUrl} size={280} level="M" marginSize={1} />}
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <span className="label">Scan to answer</span>
              <p className="mt-1 text-2xl font-[family-name:var(--font-display)] font-semibold break-all">
                {answerUrl.replace(/^https?:\/\//, "")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              <a className="btn" href={answerUrl} target="_blank" rel="noreferrer">Open answer page</a>
            </div>
            <div className="card p-4 flex items-baseline gap-3">
              <span className="text-5xl font-[family-name:var(--font-display)] font-bold tabular-nums">{n}</span>
              <span className="text-muted">{n === 1 ? "response" : "responses"} so far</span>
            </div>
            <p className="text-sm text-muted max-w-prose">
              Keep this tab on the screen. Answers count up live. Switch to Results when you&apos;re ready to review
              together, then close the survey so nothing new arrives mid-discussion.
            </p>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-6">
          {n === 0 && <p className="text-muted">No answers yet. The results refresh every few seconds.</p>}
          {results.questions.map((q, i) => (
            <QuestionResult key={q.id} index={i} question={q} results={results} />
          ))}
        </section>
      )}
    </div>
  );
}

function QuestionResult({ index, question: q, results }: { index: number; question: Question; results: Results }) {
  const values = results.responses.map((r) => r.answers[q.id]).filter((v) => v !== undefined && v !== "");
  const count = values.length;

  return (
    <article className="card p-5 flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold leading-snug">
          <span className="text-muted font-mono text-sm mr-2">{index + 1}</span>
          {q.text}
        </h2>
        <span className="pill shrink-0">{count} answered</span>
      </header>

      {q.type === "text" && (
        <ul className="flex flex-col gap-2">
          {count === 0 && <li className="text-muted text-sm">Nothing yet.</li>}
          {(values as string[]).map((v, k) => (
            <li key={k} className="rounded-lg bg-surface-2 px-3 py-2 whitespace-pre-wrap leading-relaxed">{v}</li>
          ))}
        </ul>
      )}

      {q.type === "scale" && <ScaleResult values={values as number[]} />}

      {q.type === "choice" && (
        <Bars
          rows={(q.options ?? []).map((opt) => ({ label: opt, n: values.filter((v) => v === opt).length }))}
          total={count}
        />
      )}
    </article>
  );
}

function ScaleResult({ values }: { values: number[] }) {
  const nums = values.map(Number).filter((v) => v >= 1 && v <= SCALE_MAX);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] items-start">
      <div className="card p-4 min-w-28 text-center">
        <div className="text-4xl font-[family-name:var(--font-display)] font-bold tabular-nums">
          {avg === null ? "–" : avg.toFixed(1)}
        </div>
        <div className="label mt-1">Average of {SCALE_MAX}</div>
      </div>
      <Bars
        rows={Array.from({ length: SCALE_MAX }, (_, k) => k + 1).map((s) => ({
          label: String(s),
          n: nums.filter((v) => v === s).length,
        }))}
        total={nums.length}
      />
    </div>
  );
}

function Bars({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "minmax(2rem, auto) 1fr auto" }}>
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <span className="text-sm font-medium truncate">{r.label}</span>
          <div className="bar self-center">
            <span style={{ width: total ? `${(r.n / total) * 100}%` : "0%" }} />
          </div>
          <span className="text-sm text-muted tabular-nums text-right">
            {r.n}{total ? ` · ${Math.round((r.n / total) * 100)}%` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
