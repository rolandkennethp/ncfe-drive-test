import type { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between border-b border-line bg-white px-12 pb-6 pt-9">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-[0.2em] text-gray-500">{eyebrow}</p>
        <h1 className="mt-2 truncate text-3xl font-semibold text-gray-900">{title}</h1>
      </div>
      {right}
    </header>
  );
}
