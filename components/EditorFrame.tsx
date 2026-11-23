"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, RotateCw } from "lucide-react";

// Shows the REAL Google Docs/Sheets editor in an iframe.
// Note: the page cannot see inside a Google iframe (browser security), so we can only
// detect "never finished loading". If Google shows an error page inside it, use the fallback button.
export default function EditorFrame({ src, openUrl, label }: { src: string; openUrl: string; label: string }) {
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
    <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-4">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <p className="text-gray-500">
          Editing in the real Google editor. Changes save to Google Drive automatically.
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={reload} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 hover:bg-gray-50">
            <RotateCw size={15} /> Reload editor
          </button>
          <a href={openUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 font-medium text-white hover:bg-brand-dark">
            Open in {label} <ExternalLink size={15} />
          </a>
        </div>
      </div>

      {/* Editor */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-white">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center bg-white text-center text-gray-500">
            <div>
              <Loader2 size={22} className="mx-auto animate-spin" />
              <p className="mt-2">Loading the Google editor…</p>
              {slow && (
                <p className="mt-3 max-w-sm text-sm">
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
