// Server-only: loads a file for checking or fixing, after the security checks.
// Used by /api/check/[id] (read) and /api/check/[id]/fix (user-confirmed quick fix).
import { NextResponse } from "next/server";
import { DOC_MIME, SHEET_MIME, docs, drive, explainError, getGoogleAccessToken, sheets } from "@/lib/google";
import { buildDocModel, docLimitations, type DocModel, type GDoc } from "./docModel";
import { SHEET_MAX_ROWS, SHEET_MAX_TABS, buildSheetModel, sheetLimitations, type GSheet, type SheetModel } from "./sheetModel";
import { sampleDocRules } from "./ruleSets/sample-doc";
import { sampleSheetRules } from "./ruleSets/sample-sheet";

// The rule sets in use. Later: choose ACP / Lesson Plan / Self Practice here.
export const DOC_RULES = sampleDocRules;
export const SHEET_RULES = sampleSheetRules;

const SHEET_RANGE = `A1:Z${SHEET_MAX_ROWS}`; // read at most 26 columns × 200 rows per tab

type FileInfo = { id: string; name: string; modifiedTime: string };
export type Loaded =
  | { ok: true; token: string; file: FileInfo; kind: "doc"; model: DocModel; limitations: string[] }
  | { ok: true; token: string; file: FileInfo; kind: "sheet"; model: SheetModel; limitations: string[] }
  | { ok: false; response: NextResponse };

export function fail(status: number, error: string) {
  return { ok: false as const, response: NextResponse.json({ error }, { status }) };
}

/** Like explainError, but also spots "this API is not enabled in Google Cloud". */
export async function apiError(res: Response, apiName: string, what: string) {
  const body = await res.clone().json().catch(() => ({}));
  const text = JSON.stringify(body);
  if (res.status === 403 && (text.includes("SERVICE_DISABLED") || text.includes("accessNotConfigured")))
    return { status: 503, error: `${apiName} is not enabled in Google Cloud. Enable it and try again in a few minutes.` };
  return explainError(res, what);
}

/** Security checks, then reads the latest saved version and builds the document model. */
export async function loadFile(req: Request, id: string): Promise<Loaded> {
  // 1. Signed in?
  const token = await getGoogleAccessToken(req);
  if (!token) return fail(401, "Connect Google Drive first.");

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return fail(500, "GOOGLE_DRIVE_FOLDER_ID is missing.");
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return fail(400, "Invalid file ID.");

  // 2. Look the file up in Drive (as this user)
  const metaRes = await drive(
    `files/${id}?fields=id,name,mimeType,parents,trashed,modifiedTime,capabilities(canEdit)&supportsAllDrives=true`,
    token,
  );
  if (!metaRes.ok) { const e = await explainError(metaRes, "file"); return fail(e.status, e.error); }
  const meta = await metaRes.json();

  // 3. Right type, in the shared folder, editable by this account?
  if (meta.mimeType !== DOC_MIME && meta.mimeType !== SHEET_MIME)
    return fail(400, "Only Google Docs and Google Sheets can be checked.");
  if (meta.trashed || !(meta.parents ?? []).includes(folderId))
    return fail(403, "This file is not in the shared NCFE folder, so it can't be checked.");
  if (!meta.capabilities?.canEdit)
    return fail(403, "You need edit access to this file to check it.");

  const file = { id: meta.id, name: meta.name, modifiedTime: meta.modifiedTime };

  // 4a. Google Doc
  if (meta.mimeType === DOC_MIME) {
    const res = await docs(`documents/${id}`, token);
    if (!res.ok) { const e = await apiError(res, "Google Docs API", "document"); return fail(e.status, e.error); }
    const model = buildDocModel((await res.json()) as GDoc);
    return { ok: true, token, file, kind: "doc", model, limitations: docLimitations(model) };
  }

  // 4b. Google Sheet: first the tab names, then a limited range from each tab
  const tabsRes = await sheets(`spreadsheets/${id}?fields=sheets.properties(title)`, token);
  if (!tabsRes.ok) { const e = await apiError(tabsRes, "Google Sheets API", "spreadsheet"); return fail(e.status, e.error); }
  const allTabs: string[] = ((await tabsRes.json()).sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);

  const query = new URLSearchParams({
    includeGridData: "true",
    fields: "properties(title),sheets(properties(title,sheetId),data(rowData(values(formattedValue,effectiveFormat(textFormat(bold,fontFamily,fontSize))))))",
  });
  for (const t of allTabs.slice(0, SHEET_MAX_TABS)) query.append("ranges", `'${t.replace(/'/g, "''")}'!${SHEET_RANGE}`);
  const dataRes = await sheets(`spreadsheets/${id}?${query}`, token);
  if (!dataRes.ok) { const e = await apiError(dataRes, "Google Sheets API", "spreadsheet"); return fail(e.status, e.error); }

  const model = buildSheetModel((await dataRes.json()) as GSheet, allTabs.length);
  return { ok: true, token, file, kind: "sheet", model, limitations: sheetLimitations(model) };
}
