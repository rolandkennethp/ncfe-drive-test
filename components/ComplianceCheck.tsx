"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Info, Loader2, RotateCw, Wand2, X } from "lucide-react";
import type { CheckReport, RuleResult } from "@/lib/compliance/types";
import { formatDate } from "@/lib/types";

type CheckResponse = { file: { name: string }; report: CheckReport };
type ApplyFix = (ruleId: string, input?: string) => Promise<string | null>; // returns an error message, or null

const UNDO_NOTE = "This changes the real file in Google Drive. To undo, use File → Version history in Google (Cmd + Z won’t undo it).";

/**
 * "Check document" button + results popup.
 * Reads the latest SAVED version through /api/check/<id>.
 * Quick fixes change the file ONLY after the admin clicks "Fix" and confirms.
 * Only the latest result is kept (no history). Warnings never block the admin.
 */
export default function ComplianceCheck({ fileId, name, fullWidth = false }: { fileId: string; name: string; fullWidth?: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CheckResponse | null>(null);
  const [error, setError] = useState("");

  async function runCheck() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/check/${encodeURIComponent(fileId)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "The check could not be completed."); setData(null); }
      else setData(json);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setData(null);
    }
    setLoading(false);
  }

  // Calls the fix route. Returns an error message, or null on success.
  async function callFix(ruleId: string, input?: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/check/${encodeURIComponent(fileId)}/fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, input }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok ? null : (json.error ?? "The fix could not be applied.");
    } catch {
      return "Could not reach the server. Check your connection and try again.";
    }
  }

  // One fix, then re-check so the results show the new state
  const applyFix: ApplyFix = async (ruleId, input) => {
    const err = await callFix(ruleId, input);
    if (!err) await runCheck();
    return err;
  };

  // All fixes that need no typing, one after another, then re-check
  async function applyAll(ruleIds: string[]): Promise<string | null> {
    const errors: string[] = [];
    for (const id of ruleIds) {
      const err = await callFix(id);
      if (err) errors.push(err);
    }
    await runCheck();
    return errors.length ? `${errors.length} fix(es) could not be applied: ${errors[0]}` : null;
  }

  // Close with the Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button onClick={runCheck} disabled={loading}
        className={`flex items-center justify-center gap-1 rounded-md border border-brand bg-white font-medium text-brand hover:bg-[#eef2fd] disabled:opacity-60 ${
          fullWidth ? "mt-2 w-full rounded-lg px-4 py-2.5 text-sm" : "px-2.5 py-1.5"}`}>
        {loading ? <Loader2 size={fullWidth ? 14 : 12} className="animate-spin" /> : <ClipboardCheck size={fullWidth ? 14 : 12} />}
        {loading ? "Checking…" : "Check document"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center md:p-6" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Document check results"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:max-w-xl md:rounded-2xl">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-[0.2em] text-gray-500">DOCUMENT CHECK</p>
                <h2 className="mt-0.5 break-words text-sm font-semibold text-gray-900">{data?.file.name ?? name}</h2>
                <p className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  Sample rules – not official NCFE guidelines
                </p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X size={17} />
              </button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-xs md:px-5">
              {loading && !data && (
                <div className="flex flex-col items-center py-10 text-gray-500">
                  <Loader2 size={18} className="animate-spin" />
                  <p className="mt-2">Checking the latest saved version…</p>
                </div>
              )}

              {error && !loading && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              {data && <Results report={data.report} dimmed={loading} applyFix={applyFix} applyAll={applyAll} busy={loading} />}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 md:px-5">
              <p className="text-[11px] text-gray-500">
                {data && !loading ? <>Checked {formatDate(data.report.checkedAt)}</> : loading ? "Checking…" : ""}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setOpen(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs">Close</button>
                <button onClick={runCheck} disabled={loading}
                  className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />} Run again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Results({ report, dimmed, applyFix, applyAll, busy }: {
  report: CheckReport; dimmed: boolean; applyFix: ApplyFix; applyAll: (ids: string[]) => Promise<string | null>; busy: boolean;
}) {
  const warnings = report.results.filter((r) => r.status === "warning");
  const passed = report.results.filter((r) => r.status === "pass");
  const autoFixable = warnings.filter((r) => r.fix && !r.fix.input); // "Fix all" skips fixes that need typing

  return (
    <div className={dimmed ? "opacity-50" : ""}>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Rules checked" value={report.total} />
        <Stat label="Passed" value={report.passed} tone="green" />
        <Stat label="Warnings" value={report.warnings} tone={report.warnings ? "amber" : "gray"} />
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-500">
        <Info size={12} className="mt-0.5 shrink-0" />
        This checks the last saved version. If you just made changes, wait until Google shows “Saved to Drive”, then click Run again. Warnings don’t block you. Nothing is changed unless you click a fix and confirm it.
      </p>

      {/* Fix all */}
      {autoFixable.length > 1 && <FixAll rules={autoFixable} applyAll={applyAll} disabled={busy} />}

      {/* Warnings */}
      {warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {warnings.map((r) => <WarningCard key={r.ruleId} r={r} applyFix={applyFix} disabled={busy} />)}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">
          <CheckCircle2 size={14} className="shrink-0" /> All {report.total} rules passed.
        </div>
      )}

      {/* Passed rules (collapsed) */}
      {passed.length > 0 && (
        <details className="group mt-4 rounded-lg border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium text-gray-700">
            Passed rules ({passed.length})
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="space-y-2 border-t border-line px-3 py-2">
            {passed.map((r) => (
              <li key={r.ruleId} className="flex items-start gap-2">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-green-600" />
                <div>
                  <p className="font-medium text-gray-800">{r.ruleName}</p>
                  <p className="text-[11px] text-gray-500">{r.checked}</p>
                  {r.note && <p className="text-[11px] text-gray-500">{r.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* What was not checked */}
      {report.limitations.length > 0 && (
        <div className="mt-4 text-[11px] text-gray-500">
          <p className="font-medium text-gray-600">Not checked</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {report.limitations.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function WarningCard({ r, applyFix, disabled }: { r: RuleResult; applyFix: ApplyFix; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(r.fix?.input?.defaultValue ?? "");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    setApplying(true);
    setError("");
    const err = await applyFix(r.ruleId, r.fix?.input ? value : undefined);
    if (err) { setError(err); setApplying(false); }
    // on success the popup re-checks and this card is replaced
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle size={13} className="shrink-0" /> {r.ruleName}
        </p>
        {r.fix && !confirming && (
          <button onClick={() => setConfirming(true)} disabled={disabled}
            className="flex shrink-0 items-center gap-1 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
            <Wand2 size={11} /> {r.fix.label}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-amber-800/80">Checked: {r.checked}</p>
      {r.issue && <p className="mt-1.5"><span className="font-semibold">Issue: </span>{r.issue}</p>}
      {r.suggestion && <p className="mt-1"><span className="font-semibold">How to fix: </span>{r.suggestion}</p>}
      {r.note && <p className="mt-1 text-[11px] text-amber-800/80">{r.note}</p>}
      {!r.fix && <p className="mt-1 text-[11px] text-amber-800/80">This one needs your input — fix it in the Google editor.</p>}

      {r.fix && confirming && (
        <div className="mt-2 rounded-md border border-line bg-white p-2.5 text-gray-700">
          <p className="font-medium">{r.fix.description}</p>
          {r.fix.input && (
            <label className="mt-2 block">
              <span className="text-[11px] text-gray-500">{r.fix.input.label}</span>
              <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={200} disabled={applying}
                className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-brand" />
            </label>
          )}
          <p className="mt-2 text-[11px] text-gray-500">{UNDO_NOTE}</p>
          {error && <p className="mt-2 text-[11px] text-red-700">{error}</p>}
          <div className="mt-2 flex justify-end gap-1.5">
            <button onClick={() => { setConfirming(false); setError(""); }} disabled={applying}
              className="rounded-md border border-line px-2.5 py-1 text-[11px]">Cancel</button>
            <button onClick={apply} disabled={applying || disabled || (!!r.fix.input && !value.trim())}
              className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              {applying && <Loader2 size={11} className="animate-spin" />} {applying ? "Applying…" : "Apply fix"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FixAll({ rules, applyAll, disabled }: { rules: RuleResult[]; applyAll: (ids: string[]) => Promise<string | null>; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    setApplying(true);
    setError("");
    const err = await applyAll(rules.map((r) => r.ruleId));
    setApplying(false);
    setConfirming(false);
    if (err) setError(err);
  }

  return (
    <div className="mt-3 rounded-lg border border-[#d6defa] bg-[#eef2fd] p-2.5 text-gray-700">
      {!confirming ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px]">{rules.length} warnings can be fixed automatically.</p>
          <button onClick={() => setConfirming(true)} disabled={disabled}
            className="flex shrink-0 items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
            <Wand2 size={11} /> Fix all ({rules.length})
          </button>
        </div>
      ) : (
        <div>
          <p className="font-medium">These changes will be made:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px]">
            {rules.map((r) => <li key={r.ruleId}>{r.fix?.description}</li>)}
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">{UNDO_NOTE}</p>
          <div className="mt-2 flex justify-end gap-1.5">
            <button onClick={() => setConfirming(false)} disabled={applying} className="rounded-md border border-line bg-white px-2.5 py-1 text-[11px]">Cancel</button>
            <button onClick={apply} disabled={applying || disabled}
              className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
              {applying && <Loader2 size={11} className="animate-spin" />} {applying ? "Applying…" : "Apply all"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}

function Stat({ label, value, tone = "gray" }: { label: string; value: number; tone?: "gray" | "green" | "amber" }) {
  const color = { gray: "text-gray-900", green: "text-green-700", amber: "text-amber-700" }[tone];
  return (
    <div className="rounded-lg border border-line px-2 py-2">
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
