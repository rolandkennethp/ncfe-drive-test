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

  return (
    <div className="px-12 py-9">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <label className="flex w-full max-w-[480px] items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
          <Search size={18} className="text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources"
            className="w-full bg-transparent outline-none placeholder:text-gray-400"
          />
        </label>

        <div className="relative flex items-center gap-3">
          <button onClick={load} title="Refresh list"
            className="grid h-[52px] w-[52px] place-items-center rounded-xl border border-line bg-white text-gray-600 hover:bg-gray-50">
            <RefreshCw size={18} className={status === "loading" ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3.5 font-semibold text-white shadow-md hover:bg-brand-dark"
          >
            <Plus size={18} /> New document <ChevronDown size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
              <MenuItem icon={<FileText size={18} className="text-blue-600" />} label="New Google Doc"
                onClick={() => { setCreating("doc"); setMenuOpen(false); }} />
              <MenuItem icon={<FileSpreadsheet size={18} className="text-green-600" />} label="New Google Sheet"
                onClick={() => { setCreating("sheet"); setMenuOpen(false); }} />
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-gray-600">
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
        <Notice>Connect Google Drive (bottom-left) to see the files in the shared folder.</Notice>
      )}
      {status === "error" && (
        <Notice tone="error">{error} <button onClick={load} className="ml-2 font-semibold underline">Try again</button></Notice>
      )}

      {/* Table */}
      {(status === "ready" || (status === "loading" && files.length > 0)) && (
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
        <table className="w-full text-left">
          <thead className="border-b border-line text-sm font-semibold tracking-wide text-gray-600">
            <tr>
              <th className="px-6 py-4">NAME</th>
              <th className="px-4 py-4">TYPE</th>
              <th className="px-4 py-4">CREATED BY</th>
              <th className="px-4 py-4">LAST EDITED</th>
              <th className="px-4 py-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f) => (
              <tr key={f.id} className={`border-b border-line last:border-0 ${created?.file.id === f.id ? "bg-green-50" : ""}`}>
                <td className="px-6 py-4">
                  <Link href={`/doc/${f.id}?kind=${f.kind}&name=${encodeURIComponent(f.name)}`}
                    className="flex items-center gap-3 font-semibold text-gray-900 hover:text-brand">
                    {f.kind === "doc" ? <FileText size={18} className="shrink-0 text-blue-600" />
                      : <FileSpreadsheet size={18} className="shrink-0 text-green-600" />}
                    {f.name}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${f.kind === "doc" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                    {f.kind === "doc" ? "Doc" : "Sheet"}
                  </span>
                </td>
                <td className="px-4 py-4 text-gray-700">{f.createdBy}</td>
                <td className="px-4 py-4 text-gray-700">
                  {formatDate(f.modifiedTime)}
                  <span className="block text-sm text-gray-500">by {f.modifiedBy}</span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-2">
                    <Link href={`/doc/${f.id}?kind=${f.kind}&name=${encodeURIComponent(f.name)}`}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">Open</Link>
                    {f.webViewLink ? (
                      <a href={f.webViewLink} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">
                        Open in Google <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span title="No Google link available"
                        className="flex cursor-not-allowed items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-400">
                        Open in Google <ExternalLink size={14} />
                      </span>
                    )}
                    {f.canEdit === false && (
                      <span className="self-center text-xs text-gray-500">View only</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                {query ? <>No documents match “{query}”.</> : "No Google Docs or Sheets in this folder yet."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {status === "loading" && files.length === 0 && (
        <div className="mt-10 flex items-center justify-center gap-2 text-gray-500">
          <Loader2 size={18} className="animate-spin" /> Loading files from Google Drive…
        </div>
      )}

      {creating && <NameDialog kind={creating} onCancel={() => setCreating(null)} onCreate={handleCreate} />}
    </div>
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
    <div className={`mt-5 flex items-start gap-2 rounded-xl border p-4 text-sm ${styles}`}>
      {tone === "error" && <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
      {tone === "success" && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
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
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/30">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New {label}</h2>
          <button type="button" onClick={onCancel} disabled={busy} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="mt-1 text-sm text-gray-500">It will be created in the shared Google Drive folder.</p>
        <label className="mt-5 block text-sm font-medium text-gray-700">Document name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={busy} maxLength={200}
          placeholder={kind === "doc" ? "e.g. Lesson Plan, Science Grade 3" : "e.g. Marks Tracker, Grade 3"}
          className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-brand" />
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-line px-5 py-2.5">Cancel</button>
          <button type="submit" disabled={!name.trim() || busy}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />} {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
