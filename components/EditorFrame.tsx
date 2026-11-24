"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ExternalLink, FileSpreadsheet, FileText, Loader2, RotateCw } from "lucide-react";
import ComplianceCheck from "@/components/ComplianceCheck";

// Phone-sized screens (below Tailwind's "md" breakpoint).
const MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** true = phone, false = desktop, null = not known yet (server render). */
function useIsMobile(): boolean | null {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => null);
}

type Props = { src: string; openUrl: string; label: string; name: string; fileId: string };

// Desktop: the real Google editor in an iframe.
// Mobile: Google only serves a read-only view inside an iframe, so we skip the iframe
// and show a card that opens the file in Google Docs/Sheets instead.
export default function EditorFrame({ src, openUrl, label, name, fileId }: Props) {
  const isMobile = useIsMobile();
  if (isMobile === null) return <div className="flex-1" />; // decide on the client before loading anything
  if (isMobile) return <MobileOpenCard openUrl={openUrl} label={label} name={name} fileId={fileId} />;
  return <DesktopEditor src={src} openUrl={openUrl} label={label} name={name} fileId={fileId} />;
}

function MobileOpenCard({ openUrl, label, name, fileId }: { openUrl: string; label: string; name: string; fileId: string }) {
  const isSheet = label === "Google Sheets";
  return (
    <div className="flex flex-1 items-start justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-white p-5 text-center">
        <span className={`mx-auto grid h-11 w-11 place-items-center rounded-xl ${isSheet ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>
          {isSheet ? <FileSpreadsheet size={22} /> : <FileText size={22} />}
        </span>
        <p className="mt-3 break-words text-sm font-semibold text-gray-900">{name}</p>
        <p className="mt-1 text-xs text-gray-500">{isSheet ? "Google Sheet" : "Google Doc"}</p>
        <a href={openUrl} target="_blank" rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">
          Open in {label} <ExternalLink size={14} />
        </a>
        <ComplianceCheck fileId={fileId} name={name} fullWidth />
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
          On phones, Google only allows a read-only view inside other websites, so the file opens in {label}.
          Changes save to the shared Google Drive folder.
        </p>
      </div>
    </div>
  );
}

// Shows the REAL Google Docs/Sheets editor in an iframe.
// Note: the page cannot see inside a Google iframe (browser security), so we can only
// detect "never finished loading". If Google shows an error page inside it, use the fallback button.
function DesktopEditor({ src, openUrl, label, name, fileId }: { src: string; openUrl: string; label: string; name: string; fileId: string }) {
  const [key, setKey] = useState(0);        // changing this reloads the iframe
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [key]);

  function reload() {
    setLoaded(false);
    setSlow(false);
    setKey((k) => k + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2 md:px-6 md:pb-6 md:pt-3">
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <p className="hidden text-gray-500 md:block">
          Editing in the real Google editor. Changes save to Google Drive automatically.
        </p>
        <div className="flex w-full shrink-0 justify-end gap-1.5 md:w-auto">
          <ComplianceCheck fileId={fileId} name={name} />
          <button onClick={reload} className="flex items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 hover:bg-gray-50">
            <RotateCw size={12} /> Reload
          </button>
          <a href={openUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 font-medium text-white hover:bg-brand-dark">
            Open in {label} <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Editor */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-line bg-white md:rounded-xl">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center bg-white px-4 text-center text-xs text-gray-500">
            <div>
              <Loader2 size={18} className="mx-auto animate-spin" />
              <p className="mt-2">Loading the Google editor…</p>
              {slow && (
                <p className="mt-2 max-w-xs">
                  This is taking a while. The browser may be blocking the embedded editor.
                  Use <b>Open in {label}</b> above instead.
                </p>
              )}
            </div>
          </div>
        )}
        <iframe
          key={key}
          src={src}
          title={`${label} editor`}
          onLoad={() => setLoaded(true)}
          allow="clipboard-read; clipboard-write; fullscreen"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}
