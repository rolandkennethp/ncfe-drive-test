// POST /api/check/<fileId>/fix   { ruleId, input? }
// Applies ONE quick fix that the admin clicked and confirmed. Never runs automatically.
// It re-reads the latest saved version first, re-checks the rule, and only then changes the file.
import { NextResponse } from "next/server";
import { docs, drive, explainError, sheets } from "@/lib/google";
import { DOC_RULES, SHEET_RULES, apiError, loadFile } from "@/lib/compliance/server";
import type { FixPlan } from "@/lib/compliance/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";
  const input = typeof body.input === "string" ? body.input : undefined;

  // Same security checks as the check route (signed in, type, shared folder, edit access)
  const loaded = await loadFile(req, id);
  if (!loaded.ok) return loaded.response;

  // Find the rule, confirm it still needs fixing, and plan the change from the FRESH document
  let plan: FixPlan | null = null;
  if (loaded.kind === "doc") {
    const rule = DOC_RULES.rules.find((r) => r.id === ruleId);
    if (!rule?.fix) return NextResponse.json({ error: "This warning has no quick fix." }, { status: 400 });
    if (rule.run(loaded.model).status === "pass") return NextResponse.json({ ok: true, alreadyFixed: true });
    plan = rule.fix.plan(loaded.model, input);
  } else {
    const rule = SHEET_RULES.rules.find((r) => r.id === ruleId);
    if (!rule?.fix) return NextResponse.json({ error: "This warning has no quick fix." }, { status: 400 });
    if (rule.run(loaded.model).status === "pass") return NextResponse.json({ ok: true, alreadyFixed: true });
    plan = rule.fix.plan(loaded.model, input);
  }
  if (!plan) return NextResponse.json({ error: "This can't be fixed automatically any more. Run the check again." }, { status: 409 });

  // Apply it
  let res: Response;
  if (plan.type === "rename") {
    const name = plan.name.replace(/[\u0000-\u001f]/g, "").trim();
    if (!name || name.length > 200) return NextResponse.json({ error: "Enter a file name (up to 200 characters)." }, { status: 400 });
    res = await drive(`files/${id}?supportsAllDrives=true&fields=id,name`, loaded.token, { method: "PATCH", body: JSON.stringify({ name }) });
    if (!res.ok) { const e = await explainError(res, "file"); return NextResponse.json({ error: e.error }, { status: e.status }); }
  } else if (plan.type === "docs") {
    if (loaded.kind !== "doc") return NextResponse.json({ error: "Wrong file type." }, { status: 400 });
    res = await docs(`documents/${id}:batchUpdate`, loaded.token, {
      method: "POST",
      // Only apply to the exact version we just read; if someone typed in between, Google rejects it.
      body: JSON.stringify({ requests: plan.requests, writeControl: { requiredRevisionId: loaded.model.revisionId } }),
    });
    if (!res.ok) {
      if (res.status === 400) return NextResponse.json({ error: "The document changed while fixing. Wait for “Saved to Drive”, then try again." }, { status: 409 });
      const e = await apiError(res, "Google Docs API", "document");
      return NextResponse.json({ error: e.error }, { status: e.status });
    }
  } else {
    res = await sheets(`spreadsheets/${id}:batchUpdate`, loaded.token, { method: "POST", body: JSON.stringify({ requests: plan.requests }) });
    if (!res.ok) { const e = await apiError(res, "Google Sheets API", "spreadsheet"); return NextResponse.json({ error: e.error }, { status: e.status }); }
  }

  return NextResponse.json({ ok: true });
}
