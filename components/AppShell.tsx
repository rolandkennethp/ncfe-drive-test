"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { GraduationCap, Menu } from "lucide-react";

// Desktop: fixed sidebar on the left. Mobile: top bar + slide-in sidebar.
export default function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden md:flex">{sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div
            className="relative flex h-full w-64 shadow-xl"
            onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
          >
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2.5 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-white">
              <GraduationCap size={16} />
            </span>
            <span className="text-sm font-bold text-navy">NCFE <span className="font-medium text-gray-500">Curriculum Hub</span></span>
          </Link>
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-gray-700 hover:bg-gray-100">
            <Menu size={20} />
          </button>
        </div>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
