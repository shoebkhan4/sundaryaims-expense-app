# Multi-user AIMS Expense App — Plan

Status: **proposal, nothing implemented.** Decisions already made with the owner:

| Decision | Choice |
|---|---|
| Sign-in | Microsoft Entra ID (aimsgt.com work accounts), via the MSAL already in the app |
| Profile + signature storage | Each user's own OneDrive (no backend), with a local cache |
| Approver | Prefilled from the user's Microsoft manager (`/me/manager`), editable |
| Azure admin | Owner can administer the app registration / tenant consent |
| Signature input | Upload image **and** draw on screen |

## 0. What is hardcoded to one person today

| What | Where |
|---|---|
| Employee "Shoeb Ali Khan", approver "Leela Venkat", badge `xx` | `src/App.tsx:27-32` (`INITIAL_HEADER_INFO`) |
| Both signature PNGs embedded as base64 | `src/assets/images.ts`, `src/assets/*.png` |
| Signatures stamped on the F2 form | `src/services/pdfGenerator.ts:340`, `:358` (`drawSignature`) |
| Name fallbacks in the PDF | `pdfGenerator.ts:70`, `:330`, `:348` |
| PDF file names `Shoeb_SUNDRY…`, `Shoeb_Bills_…` | `pdfGenerator.ts:18`, `:695`; `OutlookModal.tsx:384`, `:389` |
| Email sign-off `Regards, Shoeb` | `OutlookModal.tsx:71` |
| Email subject `… - Shoeb Ali Khan` and Shoeb's 2026 report history | `outlookService.ts:24-146`, `:252` |
| All data in browser storage, one set per browser | `aims_expenses`, `aims_header_info`, `aims_title_manual`, `aims_last_sent`, the archive keys; IndexedDB `aims-receipts` |
| Sign-in only used to send mail, and only if `VITE_MS_CLIENT_ID` is baked in | `outlookService.ts:174-246` |
| `deploy.yml` never passes `VITE_MS_CLIENT_ID` to the build, so the live site cannot sign in | `.github/workflows/deploy.yml` |

## 1. Findings that shape the design

1. **OneDrive app folder vs. work accounts (risk).** Microsoft's permission table lists
   `Files.ReadWrite.AppFolder` only for *personal* accounts; for work/school accounts the
   lowest listed scope for special folders is `Files.Read`, and writing needs
   `Files.ReadWrite` (access to the user's whole OneDrive). The `approot` folder itself is
   listed for OneDrive for Business. Search results did not settle whether
   `Files.ReadWrite.AppFolder` works in a work tenant, and I could not open the Microsoft
   pages from this session. **So Phase 0 is a 30-minute test in the real aimsgt.com tenant**,
   not an assumption.
   - If it works: use `Files.ReadWrite.AppFolder` (users only consent to the app's own folder).
   - If not: use `Files.ReadWrite` but write only to one folder, `Apps/AIMS Expense/`. The
     consent screen then reads "access all your files". Since you are the admin you can grant
     admin consent once, so users never see the prompt, but it is a broader permission. Say so
     to IT.
2. **Signature clean-up does not exist in the app.** The current signature PNGs were cropped to
   the ink on a transparent background by hand (commit `917efa8`). `documentScanner.ts` only does
   page detection / perspective / enhance (`processDocument`, `enhanceCanvas`) and has no
   background-removal or ink-crop step. Phase 2 needs a new small module for that.
3. **Mobile sign-in.** `loginPopup` is used today (`outlookService.ts:237`). Popups are
   unreliable in iOS Safari and in-app browsers, and this app is used on phones (camera
   scanner). Sign-in becomes mandatory, so use `loginRedirect` on mobile.
4. **Another person's signature.** Today the form stamps the approver's signature. With the
   manager auto-filled, the app must **not** stamp anyone's signature but the signed-in user's.
   The approver box stays blank for them to sign. Please confirm this is acceptable.
5. **Repo visibility.** Shoeb's and Leela's signatures are committed in `images.ts` and
   `src/assets/*.png`. If the repo is public they are already exposed. Removing the files stops
   it going forward but git history keeps them. Check visibility before the multi-user launch.

## 2. Target design

```
Sign in (MSAL, work account only, SPA redirect URI = Pages URL)
   │
   ▼
UserContext { account, displayName, email, manager{name,email}, profile, signature }
   │          ▲
   │          └── profileService: OneDrive  Apps/AIMS Expense/profile.json + signature.png
   │                 ├─ read: local cache first (IndexedDB), then refresh from OneDrive
   │                 └─ write: OneDrive, then update cache; works offline from cache
   ▼
App (per-user storage namespace)  →  F2 PDF / email use UserContext, never constants
```

`profile.json`: `{ version, employeeName, badgeNo, placeSite, approverName, approverEmail,
defaultRecipients: {to, cc}, signature: { file: "signature.png", updatedAt } }`.

Graph calls (all delegated, user-consentable except where noted):
- `GET /me` → displayName, mail, employeeId (`User.Read`, already requested)
- `GET /me/manager` → approver prefill (`User.Read`; confirm in Phase 0, 403/404 means "no manager set")
- `GET/PUT /me/drive/special/approot:/profile.json:/content` and `signature.png`
- `POST /me/sendMail` (already used, `Mail.Send`)

## 3. Phases

### Phase 0 — Azure setup and spike (you, plus me for the test)
Checklist for the app registration in aimsgt.com:
- [ ] Single-tenant (or keep `organizations`; prefer your tenant ID so personal accounts cannot sign in).
- [ ] Platform: **Single-page application**, redirect URI = the GitHub Pages URL (and `http://localhost:5173` for dev).
- [ ] Delegated permissions: `User.Read`, `Mail.Send`, plus the OneDrive scope from finding 1.
- [ ] Optionally grant admin consent, and set *Assignment required* with an AIMS user group.
- [ ] Add `VITE_MS_CLIENT_ID` and `VITE_MS_TENANT_ID` as GitHub repository **variables** (not secret; a SPA client ID is public) and pass them in `deploy.yml`'s Build step.
- [ ] Spike: sign in, `PUT` and `GET` a test file under `approot` in a work account, and `GET /me/manager`. Record the result here.

### Phase 1 — Auth gate and user context
- New `src/services/authService.ts` (split from `outlookService.ts`) and `src/context/UserContext.tsx`.
- Sign-in screen before the app renders; sign-out in the Navbar; `loginRedirect` on mobile.
- Show name/email in the Navbar. Keep `Mail.Send` token logic, but reuse the same account.
- Remove `isGraphConfigured()` as the "optional" switch; missing client ID shows a clear config error.

### Phase 2 — Profile and signature
- `src/services/profileService.ts` (OneDrive read/write + IndexedDB cache) and unit tests.
- `src/services/signatureProcessor.ts`: load image → remove paper background (adaptive threshold on luminance,
  keep ink colour, transparent PNG) → crop to ink bounding box → downscale (~600 px wide) → PNG.
- `src/components/ProfileModal.tsx`: upload (reuse `DocumentCropEditor` for manual trim if needed),
  draw pad (canvas, pointer events, `touch-action: none`), preview on white and on the F2 signature row,
  replace / delete. Warn once that the signature is stored in the user's own OneDrive.
- Prompt a first-run setup when no signature exists; PDF generation without a signature leaves the row blank.

### Phase 3 — Remove the hardcoding
- `INITIAL_HEADER_INFO` built from `UserContext` + profile (name, badge, approver from manager).
- `generatePdf`/`drawSignature` take `signature` and `approver` from arguments; drop `SHOEB_/LEELA_SIGNATURE_BASE64`,
  the PNGs and the fallbacks `|| 'Shoeb Ali Khan'`; file names and email subject/body use the user's name.
- Move `PAST_2026_REPORTS` out of the shipped code (it is Shoeb's private history). Either delete it, or
  seed it only for the matching account in a one-time import.
- `DEFAULT_RECIPIENTS` stays as the org default but becomes editable and saved in the profile.

### Phase 4 — Per-user local data and migration
- Namespace every storage key and the IndexedDB database by `account.homeAccountId`
  (shared phones/laptops must not mix users). Clear the cache on sign-out when the user asks to.
- One-time migration: on the first sign-in in a browser that still has the legacy un-namespaced keys,
  offer to adopt them for the signed-in user (this keeps Shoeb's existing drafts, history and bills).

### Phase 5 — QA, rollout
- Add Vitest for pure logic (`signatureProcessor`, `profileService` with a mocked Graph client, key namespacing,
  PDF header text). No test runner exists in the repo today; adding one is a dev dependency only.
- Manual matrix: two accounts on one browser, desktop + iPhone Safari + Android Chrome, no-manager user,
  user without OneDrive licence, expired token, offline.
- Roll out to a small AIMS group first (Phase 0 assignment-required group), then everyone.

## 4. Risks

| Risk | Mitigation |
|---|---|
| OneDrive scope broader than expected for work accounts | Phase 0 spike; admin consent; folder confined to `Apps/AIMS Expense/` |
| User has no OneDrive (unlicensed / not provisioned) | Detect the Graph error, fall back to local-only with a visible "not backed up" notice |
| Popup blocked on phones | `loginRedirect` on mobile |
| Signature left in browser cache on shared device | Cache keyed per account; sign-out option to wipe |
| Large base64 images in `localStorage` | Already moved to IndexedDB; keep signatures out of `localStorage` too |
| Existing user's data lost on switch | Phase 4 migration, behind a prompt |

## 5. References
- Graph special folders / app folder: https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder and https://learn.microsoft.com/graph/api/drive-get-specialfolder
- Graph manager: https://learn.microsoft.com/en-us/graph/api/user-list-manager
- MSAL.js browser (redirect vs popup): https://learn.microsoft.com/en-us/entra/msal/javascript/browser/login-user
- Entra app registration, SPA platform: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-app-registration
- Restricting an app to assigned users: https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/assign-user-or-group-access-portal

(Microsoft pages could not be opened from this session; the permission-table claim in finding 1 comes from
search-result excerpts of the first two links and is the reason Phase 0 exists. Re-check them directly.)
