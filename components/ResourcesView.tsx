"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, FileSpreadsheet, FileText, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { DriveFile, formatDate } from "@/lib/types";

type Kind = DriveFile["kind"];

export default function ResourcesView() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folderName, setFolderName] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "not_connected" | "error">("loading");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ file: DriveFile; inFolder: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState<Kind | null>(null);

  const visible = useMemo(
    () => files.filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase())),
    [files, query],
  );

  // Load the real files from the shared Google Drive folder (via our server route)
  const apply = useCallback((res: Response, data: { error?: string; files?: DriveFile[]; folder?: { name: string } }) => {
    if (res.status === 401 && data.error === "not_connected") return setStatus("not_connected");
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return setStatus("error"); }
    setFiles(data.files ?? []);
    setFolderName(data.folder?.name ?? "");
    setStatus("ready");
  }, []);

  useEffect(() => {
    let active = true;
    fetchFiles().then(({ res, data }) => { if (active) apply(res, data); });
    return () => { active = false; };
  }, [apply]);

  async function load() {
    setStatus("loading");
    const { res, data } = await fetchFiles();
    apply(res, data);
  }

  // Creates a REAL Google Doc/Sheet in the shared folder. Returns an error message, or null on success.
  async function handleCreate(name: string, kind: Kind): Promise<string | null> {
    const res = await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Could not create the file.";
    setCreating(null);
    setQuery("");
    setCreated(data);
    await load(); // refresh from Google so the list shows exactly what is in Drive
    return null;
  }

  const docHref = (f: DriveFile) => `/doc/${f.id}?kind=${f.kind}&name=${encodeURIComponent(f.name)}`;
  const showList = status === "ready" || (status === "loading" && files.length > 0);
  const emptyText = query ? <>No documents match “{query}”.</> : "No Google Docs or Sheets in this folder yet.";

  return (
    <div className="px-4 py-4 md:px-8 md:py-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex w-full items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 sm:max-w-sm">
          <Search size={15} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
        </label>

        <div className="relative flex items-center gap-2">
          <button onClick={load} title="Refresh list" aria-label="Refresh list"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-white text-gray-600 hover:bg-gray-50">
            <RefreshCw size={15} className={status === "loading" ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark sm:flex-none"
          >
            <Plus size={15} /> New document <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1.5 w-48 overflow-hidden rounded-lg border border-line bg-white shadow-lg">
              <MenuItem icon={<FileText size={15} className="text-blue-600" />} label="New Google Doc"
                onClick={() => { setCreating("doc"); setMenuOpen(false); }} />
              <MenuItem icon={<FileSpreadsheet size={15} className="text-green-600" />} label="New Google Sheet"
                onClick={() => { setCreating("sheet"); setMenuOpen(false); }} />
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-xs text-gray-600 md:text-sm">
        {status === "ready"
          ? <>Google Docs and Sheets in the shared folder <span className="font-semibold text-gray-800">“{folderName}”</span> · {files.length} file(s)</>
          : "Google Docs and Sheets in the shared NCFE Google Drive folder."}
      </p>

      {created && (
        <Notice tone={created.inFolder ? "success" : "error"}>
          {created.inFolder
            ? <>Created <b>{created.file.name}</b> as a real Google {created.file.kind === "sheet" ? "Sheet" : "Doc"}. Confirmed: it is inside the shared folder.</>
            : <>Created <b>{created.file.name}</b>, but Google did not confirm it is inside the shared folder. Check Google Drive.</>}
          {" "}<a href={created.file.webViewLink} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Open in Google</a>
          <button onClick={() => setCreated(null)} className="ml-3 text-gray-500 hover:text-gray-700">Dismiss</button>
        </Notice>
      )}

      {status === "not_connected" && (
        <Notice>Connect Google Drive (in the menu) to see the files in the shared folder.</Notice>
      )}
      {status === "error" && (
        <Notice tone="error">{error} <button onClick={load} className="ml-2 font-semibold underline">Try again</button></Notice>
      )}

      {/* Mobile: cards */}
      {showList && (
        <div className="mt-3 space-y-2 md:hidden">
          {visible.map((f) => (
            <div key={f.id} className={`rounded-xl border border-line p-3 ${created?.file.id === f.id ? "bg-green-50" : "bg-white"}`}>
              <Link href={docHref(f)} className="flex items-start gap-2 text-sm font-semibold text-gray-900">
                <FileIcon kind={f.kind} />
                <span className="min-w-0 break-words">{f.name}</span>
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
                <TypeBadge kind={f.kind} />
                <span>Edited {formatDate(f.modifiedTime)}</span>
                <span className="truncate">by {f.modifiedBy}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <Actions f={f} href={docHref(f)} />
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="rounded-xl border border-line bg-white p-6 text-center text-xs text-gray-500">{emptyText}</p>
          )}
        </div>
      )}

      {/* Desktop: table */}
      {showList && (
      <div className="mt-3 hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] font-semibold tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-3">NAME</th>
              <th className="px-3 py-3">TYPE</th>
              <th className="px-3 py-3">CREATED BY</th>
              <th className="px-3 py-3">LAST EDITED</th>
              <th className="px-3 py-3">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => (
              <tr key={f.id} className={`border-b border-line last:border-0 ${created?.file.id === f.id ? "bg-green-50" : ""}`}>
                <td className="px-4 py-3">
                  <Link href={docHref(f)} className="flex items-center gap-2 font-semibold text-gray-900 hover:text-brand">
                    <FileIcon kind={f.kind} />
                    {f.name}
                  </Link>
                </td>
                <td className="px-3 py-3"><TypeBadge kind={f.kind} /></td>
                <td className="px-3 py-3 text-xs text-gray-700">{f.createdBy}</td>
                <td className="px-3 py-3 text-xs text-gray-700">
                  {formatDate(f.modifiedTime)}
                  <span className="block text-[11px] text-gray-500">by {f.modifiedBy}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5"><Actions f={f} href={docHref(f)} /></div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-500">{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {status === "loading" && files.length === 0 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Loader2 size={15} className="animate-spin" /> Loading files from Google Drive…
        </div>
      )}

      {creating && <NameDialog kind={creating} onCancel={() => setCreating(null)} onCreate={handleCreate} />}
    </div>
  );
}

function FileIcon({ kind }: { kind: Kind }) {
  return kind === "doc"
    ? <FileText size={15} className="mt-0.5 shrink-0 text-blue-600 md:mt-0" />
    : <FileSpreadsheet size={15} className="mt-0.5 shrink-0 text-green-600 md:mt-0" />;
}

function TypeBadge({ kind }: { kind: Kind }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind === "doc" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
      {kind === "doc" ? "Doc" : "Sheet"}
    </span>
  );
}

function Actions({ f, href }: { f: DriveFile; href: string }) {
  const btn = "flex items-center gap-1 rounded-md bg-gray-100 px-2.5 py-1 text-xs";
  return (
    <>
      <Link href={href} className={`${btn} hover:bg-gray-200`}>Open</Link>
      {f.webViewLink ? (
        <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className={`${btn} hover:bg-gray-200`}>
          Open in Google <ExternalLink size={11} />
        </a>
      ) : (
        <span title="No Google link available" className={`${btn} cursor-not-allowed text-gray-400`}>
          Open in Google <ExternalLink size={11} />
        </span>
      )}
      {f.canEdit === false && <span className="text-[11px] text-gray-500">View only</span>}
    </>
  );
}

async function fetchFiles() {
  const res = await fetch("/api/files", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "error" | "success" }) {
  const styles = {
    info: "border-line bg-white text-gray-700",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
  }[tone];
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-lg border p-3 text-xs ${styles}`}>
      {tone === "error" && <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
      {tone === "success" && <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50">
      {icon} {label}
    </button>
  );
}

function NameDialog({ kind, onCancel, onCreate }: { kind: Kind; onCancel: () => void; onCreate: (name: string, kind: Kind) => Promise<string | null> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "doc" ? "Google Doc" : "Google Sheet";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    const err = await onCreate(name.trim(), kind);
    if (err) { setError(err); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New {label}</h2>
          <button type="button" onClick={onCancel} disabled={busy} className="text-gray-400 hover:text-gray-600"><X size={17} /></button>
        </div>
        <p className="mt-1 text-xs text-gray-500">It will be created in the shared Google Drive folder.</p>
        <label className="mt-4 block text-xs font-medium text-gray-700">Document name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={200}
          placeholder={kind === "doc" ? "e.g. Lesson Plan, Science Grade 3" : "e.g. Marks Tracker, Grade 3"}
          className="mt-1.5 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-line px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={!name.trim() || busy}
            className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
