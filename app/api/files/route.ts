import { NextResponse } from "next/server";
import { DOC_MIME, SHEET_MIME, drive, explainError, getGoogleAccessToken } from "@/lib/google";
import type { DriveFile } from "@/lib/types";

type GoogleUser = { displayName?: string; emailAddress?: string };
type GoogleFile = {
  id: string; name: string; mimeType: string; modifiedTime: string; webViewLink: string;
  owners?: GoogleUser[]; lastModifyingUser?: GoogleUser; capabilities?: { canEdit?: boolean };
};

// GET /api/files → Docs and Sheets in the shared folder, as the signed-in user sees them
export async function GET(req: Request) {
  const token = await getGoogleAccessToken(req);
  if (!token) return NextResponse.json({ error: "not_connected" }, { status: 401 });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID is missing in .env.local" }, { status: 500 });

  // 1. Can this account see the folder at all?
  const folderRes = await drive(`files/${folderId}?fields=id,name,capabilities(canAddChildren)&supportsAllDrives=true`, token);
  if (!folderRes.ok) {
    const { status, error } = await explainError(folderRes, "shared folder");
    return NextResponse.json({ error }, { status });
  }
  const folder = await folderRes.json();

  // 2. List Google Docs and Sheets directly inside it
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false and (mimeType = '${DOC_MIME}' or mimeType = '${SHEET_MIME}')`,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),capabilities(canEdit))",
    orderBy: "modifiedTime desc",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const listRes = await drive(`files?${params}`, token);
  if (!listRes.ok) {
    const { status, error } = await explainError(listRes, "files in the folder");
    return NextResponse.json({ error }, { status });
  }
  const { files = [] } = (await listRes.json()) as { files?: GoogleFile[] };

  const who = (u?: GoogleUser) => u?.emailAddress ?? u?.displayName ?? "Unknown";
  const result: DriveFile[] = files.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.mimeType === SHEET_MIME ? "sheet" : "doc",
    createdBy: f.owners?.length ? who(f.owners[0]) : "Shared drive",
    modifiedTime: f.modifiedTime,
    modifiedBy: who(f.lastModifyingUser),
    webViewLink: f.webViewLink,
    canEdit: f.capabilities?.canEdit ?? false,
  }));

  return NextResponse.json({
    folder: { name: folder.name, canAddFiles: folder.capabilities?.canAddChildren ?? false },
    files: result,
  });
}

// POST /api/files  { name, kind: "doc" | "sheet" } → creates a real Google Doc/Sheet in the shared folder
export async function POST(req: Request) {
  const token = await getGoogleAccessToken(req);
  if (!token) return NextResponse.json({ error: "Connect Google Drive first." }, { status: 401 });

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID is missing in .env.local" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = body.kind === "sheet" ? "sheet" : body.kind === "doc" ? "doc" : null;
  if (!name || name.length > 200) return NextResponse.json({ error: "Enter a name (up to 200 characters)." }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "Unknown document type." }, { status: 400 });

  // 1. Create the real Google file directly inside the shared folder
  const fields = "id,name,mimeType,modifiedTime,webViewLink,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),capabilities(canEdit)";
  const createRes = await drive(`files?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: kind === "sheet" ? SHEET_MIME : DOC_MIME, parents: [folderId] }),
  });
  if (!createRes.ok) {
    const { status, error } = await explainError(createRes, "shared folder");
    return NextResponse.json({ error }, { status });
  }
  const f = (await createRes.json()) as GoogleFile;

  // 2. Read it back from Google and confirm its parent is the shared folder
  const checkRes = await drive(`files/${f.id}?fields=parents&supportsAllDrives=true`, token);
  const parents: string[] = checkRes.ok ? ((await checkRes.json()).parents ?? []) : [];
  const inFolder = parents.includes(folderId);

  const who = (u?: GoogleUser) => u?.emailAddress ?? u?.displayName ?? "Unknown";
  const file: DriveFile = {
    id: f.id,
    name: f.name,
    kind,
    createdBy: f.owners?.length ? who(f.owners[0]) : "Shared drive",
    modifiedTime: f.modifiedTime,
    modifiedBy: who(f.lastModifyingUser),
    webViewLink: f.webViewLink,
    canEdit: f.capabilities?.canEdit ?? true,
  };
  return NextResponse.json({ file, inFolder }, { status: 201 });
}
