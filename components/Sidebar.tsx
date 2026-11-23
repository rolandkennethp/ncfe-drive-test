import Link from "next/link";
import { FolderOpen, GraduationCap } from "lucide-react";
import GoogleAccount from "@/components/GoogleAccount";

export default function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-white px-4 py-5 md:w-60">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-white shadow-md">
          <GraduationCap size={18} />
        </span>
        <span>
          <span className="block text-base font-bold leading-none text-navy">NCFE</span>
          <span className="mt-1 block text-[9px] font-semibold tracking-[0.18em] text-navy">CURRICULUM HUB</span>
        </span>
      </Link>

      <p className="mt-8 px-2 text-[10px] font-medium tracking-[0.18em] text-gray-500">ADMIN WORKSPACE</p>

      <nav className="mt-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg bg-[#eef2fd] px-3 py-2 text-sm font-medium text-brand">
          <FolderOpen size={16} />
          Resources
        </Link>
      </nav>

      {/* Google account connection */}
      <div className="mt-auto border-t border-line pt-4">
        <GoogleAccount />
      </div>
    </aside>
  );
}
