// GET /api/check/<fileId>
// Securely reads the latest SAVED version of a Google Doc or Sheet and runs the validation engine.
// Read-only: it never changes the file. (Quick fixes live in ./fix/route.ts and need the admin's confirmation.)
import { NextResponse } from "next/server";
import { runRules } from "@/lib/compliance/engine";
import { DOC_RULES, SHEET_RULES, loadFile } from "@/lib/compliance/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadFile(req, id);
  if (!loaded.ok) return loaded.response;

  const report = loaded.kind === "doc"
    ? runRules(DOC_RULES, loaded.model, loaded.limitations)
    : runRules(SHEET_RULES, loaded.model, loaded.limitations);

  return NextResponse.json({ kind: loaded.kind, file: loaded.file, checkedAt: report.checkedAt, report });
}
