import type { ReactNode } from "react";

export default function PageHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 border-b border-line bg-white px-4 pb-3 pt-4 md:px-8 md:pb-4 md:pt-6">
      <div className="min-w-0">
        <p className="text-[10px] font-medium tracking-[0.2em] text-gray-500">{eyebrow}</p>
        <h1 className="mt-1 truncate text-lg font-semibold text-gray-900 md:text-xl">{title}</h1>
      </div>
      {right}
    </header>
  );
}
