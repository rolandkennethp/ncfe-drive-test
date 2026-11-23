import { AlertTriangle, LogIn, LogOut, UserRound } from "lucide-react";
import { auth, signIn, signOut } from "@/auth";

export default async function GoogleAccount() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
          <LogIn size={15} /> Connect Google Drive
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-2.5">
      {session.error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Google session expired. Disconnect and connect again.
        </p>
      )}
      <div className="flex items-center gap-2.5 px-2">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <UserRound size={16} />
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-800">{session.user.name}</p>
          <p className="truncate text-[11px] text-gray-500">{session.user.email}</p>
        </div>
      </div>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
        <button className="flex items-center gap-2 px-2 text-xs text-gray-600 hover:text-gray-900">
          <LogOut size={14} /> Disconnect / switch account
        </button>
      </form>
    </div>
  );
}
