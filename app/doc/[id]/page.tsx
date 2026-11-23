import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import PageHeader from "@/components/PageHeader";
import EditorFrame from "@/components/EditorFrame";

export default async function DocPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string; kind?: string }>;
}) {
  const { id } = await params;
  const { name = "Document", kind = "doc" } = await searchParams;
  const session = await auth();

  const isSheet = kind === "sheet";
  const label = isSheet ? "Google Sheets" : "Google Docs";
  const base = `https://docs.google.com/${isSheet ? "spreadsheets" : "document"}/d/${encodeURIComponent(id)}/edit`;

  // authuser= asks Google to use the same account you connected in this app,
  // if that account is signed into this Chrome profile.
  const email = session?.user?.email;
  const url = email ? `${base}?authuser=${encodeURIComponent(email)}` : base;

  return (
    <>
      <PageHeader
        eyebrow={isSheet ? "GOOGLE SHEET" : "GOOGLE DOC"}
        title={name}
        right={
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm hover:bg-gray-50">
            <ArrowLeft size={16} /> Back to Resources
          </Link>
        }
      />
      <EditorFrame src={url} openUrl={url} label={label} />
    </>
  );
}
