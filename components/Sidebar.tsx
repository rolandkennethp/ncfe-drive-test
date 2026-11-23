import Link from "next/link";
import { FolderOpen, GraduationCap } from "lucide-react";
import GoogleAccount from "@/components/GoogleAccount";

export default function Sidebar() {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-white px-6 py-7">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 px-2">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy text-white shadow-md">
          <GraduationCap size={24} />
        </span>
        <span>
          <span className="block text-xl font-bold leading-none text-navy">NCFE</span>
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-navy">
            CURRICULUM HUB
          </span>
        </span>
      </Link>

      <p className="mt-12 px-3 text-[11px] font-medium tracking-[0.18em] text-gray-500">
        ADMIN WORKSPACE
      </p>

      <nav className="mt-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg bg-[#eef2fd] px-4 py-3 font-medium text-brand"
        >
          <FolderOpen size={20} />
          Resources
        </Link>
      </nav>

      {/* Google account connection */}
      <div className="mt-auto border-t border-line pt-5">
        <GoogleAccount />
      </div>
    </aside>
  );
}
