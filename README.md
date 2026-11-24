# NCFE Google Drive Integration Test

A small, local-only Next.js app that tests whether NCFE admins can **create and edit real Google Docs and Google Sheets from inside the NCFE Curriculum Hub**, with every change saved to a shared Google Drive folder.

- Real Google files, created with the Google Drive API — no mock files.
- The **genuine Google Docs/Sheets editor** loads inside the page (iframe), with the NCFE sidebar and header kept visible.
- Each person connects their **own Google account**; the app only does what that account is allowed to do.
- No database. Not meant for deployment.

See **TESTING.md** for the test results, limitations and the two-account checklist.

---

## 1. Requirements

- macOS with **Node.js 20.9 or newer** (`node -v`)
- **Google Chrome** (the embedded editor was tested in Chrome)
- Two Google accounts with **Editor** access to the same Google Drive folder

## 2. Google Cloud setup (one time)

1. Go to <https://console.cloud.google.com> → create a project (e.g. "NCFE Drive Test").
2. **APIs & Services → Library** → enable **Google Drive API**, **Google Docs API** and **Google Sheets API** (the last two are used by the Document Compliance Checker).
3. **OAuth consent screen / Google Auth Platform**
   - Audience: **External**, status **Testing**
   - **Test users**: add both Google accounts
4. **Clients → Create client → Web application**
   - Authorised JavaScript origin: `http://localhost:3000`
   - Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy the **Client ID** and **Client Secret**.
6. Get the **folder ID** from the folder's URL: `drive.google.com/drive/folders/<FOLDER_ID>`

## 3. Configure `.env.local`

Copy `.env.example` to `.env.local` and fill it in (no quotes, no spaces):

```
AUTH_SECRET=            # any long random string: openssl rand -base64 32
AUTH_GOOGLE_ID=         # Client ID
AUTH_GOOGLE_SECRET=     # Client Secret
GOOGLE_DRIVE_FOLDER_ID= # shared folder ID
```

`.env.local` is ignored by Git. Never share or commit it. Restart the app after changing it.

## 4. Run

```
npm install
npm run dev
```

Open <http://localhost:3000> → **Connect Google Drive** (bottom-left).

The first time, Google shows "Google hasn't verified this app" → **Advanced → Go to … (unsafe)**. This is expected for an app in Testing mode.

## 5. How it works

| Part | File |
|---|---|
| Google sign-in (Auth.js), scopes, token refresh | `auth.ts` |
| Sign-in endpoints | `app/api/auth/[...nextauth]/route.ts` |
| List files (GET) and create Doc/Sheet (POST) in the shared folder | `app/api/files/route.ts` |
| Google token + Drive API helpers, error messages | `lib/google.ts` |
| Resources page: search, list, New Doc/Sheet | `components/ResourcesView.tsx` |
| Sidebar + Connect / Disconnect | `components/Sidebar.tsx`, `components/GoogleAccount.tsx` |
| Document page with the embedded Google editor | `app/doc/[id]/page.tsx`, `components/EditorFrame.tsx` |

**Flow**

1. You connect Google → the app receives an access token and refresh token, stored **only in an encrypted, server-side session cookie**. The browser only sees your name, email and photo.
2. The Resources page calls `/api/files` → the server calls the Drive API **as you** and returns the Docs and Sheets in the shared folder.
3. **New Google Doc / Sheet** → the server creates the file with `parents: [folder]`, then reads it back to **confirm it is inside the folder**.
4. Opening a document loads `https://docs.google.com/{document|spreadsheets}/d/<id>/edit?authuser=<your email>` in an iframe. Google saves edits itself — the app never touches document content.

**Google permission (scope) used:** `openid email profile https://www.googleapis.com/auth/drive`.
The full `drive` scope is needed so one account can see files created by another account. The narrower `drive.file` scope only shows files this app created for *that* user.

---

## 6. Document Compliance Checker

On any open Doc or Sheet, **Check document** reads the **latest saved version** through the Google Docs / Sheets API and checks it against a rule set. Results appear in a popup (the Google editor stays open behind it).

- Every rule returns only **Pass** or **Warning**. Warnings never block the admin.
- The current rules are **SAMPLE rules – not official NCFE guidelines**.
- Some warnings have a **quick fix** (e.g. change font, make header bold). A fix changes the real file **only after the admin clicks it and confirms**. Undo with **File → Version history** in Google.
- The checker only works for files **inside the shared folder** that the signed-in account can **edit**.
- No new OAuth scope is needed: the existing `drive` scope covers the Docs and Sheets APIs.

### Files

| File | Purpose |
|---|---|
| `components/ComplianceCheck.tsx` | Check document button, results popup, Fix / Fix all with confirmation |
| `components/EditorFrame.tsx` | Places the button in the editor toolbar (desktop) and on the mobile card |
| `app/api/check/[id]/route.ts` | `GET` – runs the check (read-only) |
| `app/api/check/[id]/fix/route.ts` | `POST { ruleId, input? }` – applies ONE confirmed quick fix |
| `lib/compliance/server.ts` | Security checks (signed in, file type, in shared folder, edit access), reads the file, chooses the rule sets |
| `lib/compliance/engine.ts` | Runs any rule set; knows nothing about specific rules |
| `lib/compliance/types.ts` | Rule, rule set, result and fix types |
| `lib/compliance/docModel.ts` / `sheetModel.ts` | Turn Google API data into simple models (headings, sections, real fonts / tabs, cells, formatting) |
| `lib/compliance/rules/docRules.ts` / `sheetRules.ts` | Reusable rule templates (with optional quick fixes). They take settings, no hard-coded values |
| `lib/compliance/ruleSets/sample-doc.ts` / `sample-sheet.ts` | The SAMPLE settings |

### Adding or changing rules (e.g. official Lesson Plan guidelines)

1. Copy `lib/compliance/ruleSets/sample-doc.ts` to e.g. `lesson-plan.ts`.
2. Change the settings (headings, font, size, title prefixes…) and set `sample: false`.
3. In `lib/compliance/server.ts`, point `DOC_RULES` (or `SHEET_RULES`) at the new rule set.
4. A completely new kind of check = a new template function in `rules/docRules.ts` or `rules/sheetRules.ts`. The engine does not change.

Choosing between several rule sets (ACP / Lesson Plan / Self Practice) per document is not built yet.

