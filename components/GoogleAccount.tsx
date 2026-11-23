import { AlertTriangle, LogIn, LogOut, UserRound } from "lucide-react";
import { auth, signIn, signOut } from "@/auth";

export default async function GoogleAccount() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark">
          <LogIn size={18} /> Connect Google Drive
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {session.error && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Google session expired. Disconnect and connect again.
        </p>
      )}
      <div className="flex items-center gap-3 px-2">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <UserRound size={20} />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-800">{session.user.name}</p>
          <p className="truncate text-xs text-gray-500">{session.user.email}</p>
        </div>
      </div>
      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
        <button className="flex items-center gap-2 px-2 text-sm text-gray-600 hover:text-gray-900">
          <LogOut size={18} /> Disconnect / switch account
        </button>
      </form>
    </div>
  );
}
