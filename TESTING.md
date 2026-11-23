# Testing Report — NCFE Google Drive Integration Test

**Tested by:** Punith S. · **Date:** 21 Nov 2026 · **Setup:** macOS, Google Chrome, two Chrome profiles, `http://localhost:3000`
**Accounts:** Account 1 = NCFE Google Workspace account · Account 2 = personal Gmail account (both Editors on the shared folder)

## Result

**The main objective is proven in Chrome:** both accounts could create real Google Docs and Sheets from the website, edit them in the genuine Google editor embedded in the NCFE page, and see each other's changes. All changes were saved to the shared Google Drive folder.

## 1. Tested successfully (manual tests by Punith)

| Test | Account 1 (NCFE) | Account 2 (Gmail) |
|---|---|---|
| Connect Google Drive, unverified-app screen, Drive permission | ✅ | ✅ |
| Disconnect / switch account | ✅ | ✅ |
| Real Docs and Sheets from the shared folder listed (name, type, owner, last edited) | ✅ | ✅ |
| Search; Open in Google; rename in Drive shows after refresh | ✅ | ✅ |
| Create a real Google Doc in the shared folder (folder confirmed) | ✅ | ✅ |
| Create a real Google Sheet in the shared folder (folder confirmed) | ✅ | ✅ |
| Docs editor loads inside the page: toolbar, typing, formatting, tables | ✅ | ✅ |
| Sheets editor loads inside the page: formulas (`=SUM`) | ✅ | ✅ |
| Changes save to Drive and remain after page refresh | ✅ | ✅ |
| Changes made by one account visible to the other | ✅ | ✅ |

## 2. Implemented but NOT tested yet

| Feature | Why untested / how to test |
|---|---|
| Automatic token refresh | Needs a session longer than 1 hour. Leave the app open > 1 h, then click ↻. |
| Clear error messages (no folder access, view-only, rate limit, expired session) | Needs those situations. E.g. remove one account's access to the folder, then refresh. |
| "View only" label | Needs a file the account can only view. |
| Slow-load / fallback message in the editor | Only appears if the editor fails to load. |

## 3. Not tested (recommended before any real rollout)

- **Chrome Incognito** — third-party cookies are blocked; the embedded editor may fail.
- **Safari, Brave, Firefox with strict tracking protection** — likely to block the embedded editor.
- **Account mismatch** — app connected with Account A while Chrome is signed into Google with Account B only.
- **Edits made directly in Google Drive** appearing after **Reload editor** (expected to work — same file).
- More than 200 files in the folder; files inside sub-folders.
- **Mobile card on a real phone** — tap **Open in Google Docs/Sheets** and confirm the correct file opens (in the Google app or browser) and edits save to the shared folder.

## 4. Limitations imposed by Google or the browser

1. **Embedding the editor in an iframe is not an officially documented Google feature.** It works in Chrome today, but Google could change this at any time. Keep the **Open in Google** fallback.
2. **The embedded editor uses the browser's Google sign-in, not the app's.** The app adds `?authuser=<email>` to pick the right account, but that account must already be signed into Google in that browser. Google's sign-in page cannot load inside an iframe.
3. **Third-party cookies.** Browsers that block them (Safari, Incognito, Brave) are likely to show a sign-in page or error inside the frame. The app cannot see inside the iframe, so it cannot reliably detect this — users must use the fallback button.
4. **Testing mode:** only listed test users can sign in, the "unverified app" warning appears, and sign-ins expire after about 7 days.
5. **The `drive` scope is a "restricted" scope.** Publishing the app to External users would need Google verification and a security assessment.
6. **File ownership:** in a shared folder in someone's *My Drive*, each new file is owned by the account that created it.
7. **Google API rate limits** apply; the app shows a message but does not retry automatically.

8. **Google features that open their own pop-up frames are blocked inside the embedded editor** (found 23 Nov 2026). Chrome's console shows `Framing 'https://accounts.google.com/' / 'https://contacts.google.com/' / 'https://docs.google.com/' violates … "frame-ancestors https://docs.google.com"`. Google only allows these inner frames when Google Docs is the top page. Likely affected inside the website: the **Share** dialog, **switching Google account** (profile photo menu), **@mentions / contact suggestions** in comments, and some sign-in prompts. Typing, formatting, tables, formulas and autosave are not affected. Workaround: **Open in Google**.
9. **On phones, Google serves a read-only view inside an iframe** (found 23 Nov 2026). In a phone-sized browser, Sheets loads as `…/htmlview/sheet?…` (read-only HTML view) instead of the editor. **Change made:** on screens narrower than 768px the app no longer loads the iframe; it shows a card with the file name and an **Open in Google Docs/Sheets** button that opens the same file (`docs.google.com/{document|spreadsheets}/d/<id>/edit`). The desktop iframe is unchanged.
10. **Harmless console messages from Google's own pages** — not errors in the app, no action needed: `The key "target-densitydpi" is not supported`, `DOCS_timing is not defined`, and `feedback-pa.clients6.google.com … 429` (Google's feedback survey being refused).

## 5. Recommendations for the real Curriculum Hub

- **Make the Google Cloud app "Internal"** (NCFE Workspace accounts only). This removes the unverified-app warning, the 7-day expiry and the verification requirement. Personal Gmail accounts would then not be able to sign in.
- **Use a Shared Drive** instead of a shared My Drive folder, so NCFE (not individual staff) owns all files.
- Standardise on **Google Chrome** for admins and teachers using the in-page editor.
- Keep the **Open in Google** fallback visible at all times, and use it for sharing, comments with @mentions and account switching.
- Treat phones as **open-in-Google only**; in-page editing is a desktop feature.

---

# Two-account testing checklist (repeatable)

Use two Chrome profiles: **Profile 1 = Account 1**, **Profile 2 = Account 2**. Each profile must also be signed into Google with the same account.

### Test A — Account 1 (Profile 1)
- [ ] Open `http://localhost:3000` → Connect Google Drive → choose Account 1
- [ ] Shared folder name and its files appear
- [ ] New document → New Google Doc → "Test Doc A" → green "Confirmed" message
- [ ] Open the Doc → editor loads inside the page
- [ ] Type text, make a heading, insert a table → "Saved to Drive"
- [ ] Refresh the page → changes are still there

### Test B — Account 2 (Profile 2)
- [ ] Connect Google Drive → choose Account 2
- [ ] Click ↻ → "Test Doc A" appears
- [ ] Open it → Account 1's changes are visible
- [ ] Add a new line → "Saved to Drive"

### Test C — Verify in Google Drive (both accounts)
- [ ] "Test Doc A" is inside the shared folder in Google Drive
- [ ] Both accounts can open it in Google Drive
- [ ] Changes made in the website appear in Google Drive
- [ ] Edit it directly in Google Drive → in the website click **Reload editor** → the edit appears

### Repeat with a Google Sheet
- [ ] New Google Sheet → "Test Sheet A"
- [ ] Enter `10` (A1), `20` (A2), `=SUM(A1:A2)` (A3) → shows 30
- [ ] Repeat Tests B and C for the Sheet
