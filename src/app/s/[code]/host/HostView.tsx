"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { deleteSurvey, forgetHosted, getResults, rememberHosted, setSurveyStatus } from "@/lib/api";
import type { Question, Results } from "@/lib/types";
import { isAnswerable, nameKey, scaleRange } from "@/lib/types";
import { AverageBars, Donut, Histogram, Legend } from "@/components/charts";

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
          {n > 0 && <Summary results={results} />}
          {results.questions.map((q) =>
            q.type === "info" ? (
              <section key={q.id} className="card p-5 bg-surface-2 border-transparent">
                <span className="label">Slide</span>
                <h2 className="mt-1 text-2xl font-semibold">{q.text}</h2>
                {q.body && <p className="mt-2 text-muted whitespace-pre-wrap leading-relaxed max-w-prose">{q.body}</p>}
              </section>
            ) : (
              <QuestionResult key={q.id} index={results.questions.filter(isAnswerable).indexOf(q)} question={q} results={results} />
            ),
          )}
        </section>
      )}
    </div>
  );
}

function scaleAvg(results: Results, q: Question) {
  const { min, max } = scaleRange(q);
  const nums = results.responses.map((r) => Number(r.answers[q.id])).filter((v) => !Number.isNaN(v) && v >= min && v <= max);
  return { avg: nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null, n: nums.length, nums, min, max };
}
function Summary({ results }: { results: Results }) {
  const n = results.responses.length;
  const scales = results.questions.filter((q) => q.type === "scale");
  const choices = results.questions.filter((q) => q.type === "choice");
  const texts = results.questions.filter((q) => q.type === "text" || q.type === "named");
  const textCount = results.responses.reduce(
    (acc, row) => acc + texts.filter((q) => row.answers[q.id] !== undefined && row.answers[q.id] !== "").length,
    0,
  );
  const overall = scales.map((q) => scaleAvg(results, q)).filter((x) => x.avg !== null);
  const overallAvg = overall.length ? overall.reduce((a, x) => a + (x.avg as number) * x.n, 0) / overall.reduce((a, x) => a + x.n, 0) : null;
  const overallMax = scales.length ? Math.max(...scales.map((q) => scaleRange(q).max)) : 10;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat value={String(n)} label={n === 1 ? "response" : "responses"} />
        <Stat value={overallAvg === null ? "–" : overallAvg.toFixed(1)} label={`avg rating of ${overallMax}`} />
        <Stat value={String(textCount)} label="written comments" />
      </div>
      {scales.length > 1 && (
        <article className="card p-5 flex flex-col gap-4">
          <header className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Ratings at a glance</h2>
            <span className="pill">{scales.length} statements</span>
          </header>
          <AverageBars
            rows={scales.map((q) => {
              const a = scaleAvg(results, q);
              return { label: q.text, avg: a.avg, n: a.n };
            })}
            max={overallMax}
          />
        </article>
      )}
      {choices.length > 0 && <span className="label pt-2">By question</span>}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-4">
      <div className="text-3xl font-bold tabular-nums leading-none">{value}</div>
      <div className="label mt-2">{label}</div>
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
            <li key={k} className="rounded-lg bg-surface-2 px-3 py-2 whitespace-pre-wrap leading-relaxed border-l-2 border-accent">{v}</li>
          ))}
        </ul>
      )}

      {q.type === "named" && (
        <ul className="flex flex-col gap-2">
          {count === 0 && <li className="text-muted text-sm">Nothing yet.</li>}
          {results.responses
            .filter((r) => r.answers[q.id] !== undefined && r.answers[q.id] !== "")
            .map((r) => (
              <li key={r.id} className="rounded-lg bg-surface-2 px-3 py-2 leading-relaxed">
                <span className="font-semibold">{String(r.answers[nameKey(q.id)] ?? "Unnamed")}</span>
                <span className="text-muted"> · </span>
                <span className="whitespace-pre-wrap">{String(r.answers[q.id])}</span>
              </li>
            ))}
        </ul>
      )}

      {q.type === "scale" && <ScaleResult values={values as number[]} range={scaleRange(q)} />}

      {q.type === "choice" && (
        <ChoiceResult rows={(q.options ?? []).map((opt) => ({ label: opt, n: values.filter((v) => v === opt).length }))} total={count} />
      )}
    </article>
  );
}

function ChoiceResult({ rows, total }: { rows: { label: string; n: number }[]; total: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] items-center">
      <div className="justify-self-center">
        <Donut rows={rows} total={total} />
      </div>
      <Legend rows={rows} total={total} />
    </div>
  );
}

function ScaleResult({ values, range }: { values: number[]; range: { min: number; max: number } }) {
  const nums = values.map(Number).filter((v) => v >= range.min && v <= range.max);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  const steps = Array.from({ length: range.max - range.min + 1 }, (_, k) => range.min + k).map((s) => ({
    label: String(s),
    n: nums.filter((v) => v === s).length,
  }));
  const spread = nums.length ? `${Math.min(...nums)} to ${Math.max(...nums)}` : "–";
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] items-center">
      <div className="card p-4 min-w-32 text-center">
        <div className="text-4xl font-bold tabular-nums">{avg === null ? "–" : avg.toFixed(1)}</div>
        <div className="label mt-1">Average of {range.max}</div>
        <div className="text-xs text-muted mt-2 tabular-nums">range {spread}</div>
      </div>
      <Histogram steps={steps} avg={avg} />
    </div>
  );
}
