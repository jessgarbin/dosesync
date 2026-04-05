# Chrome Web Store Listing — Copy & Asset Pack

Everything you need to submit DoseSync to the Chrome Web Store. Copy-paste ready.

**Status:** draft — fill in URLs marked `TODO` before submission.

---

## 1. Basic info

| Field | Value |
|---|---|
| **Name** (store) | DoseSync |
| **Name** (manifest i18n key) | `extensionName` (already set in `public/_locales/{en,pt_BR}/messages.json`) |
| **Category** | Productivity |
| **Language** | English (primary); Portuguese (Brazil) |
| **Website / Homepage URL** | `https://github.com/jessgarbin/dosesync` |
| **Support URL** | `https://github.com/jessgarbin/dosesync/issues` |
| **Privacy Policy URL** | `https://jessgarbin.github.io/dosesync/privacy` *(TODO: publish `docs/privacy.md` on GitHub Pages)* |

### Single purpose statement (required field)

> DoseSync has a single purpose: converting a medical prescription (photo, PDF, or pasted text) into recurring events on the user's Google Calendar or Microsoft Outlook Calendar, with reminders for each dose.

### Short description — pick one (≤132 chars, shown in search results)

**Option A (benefit-led, recommended):**
> Turn any prescription into scheduled calendar reminders. Upload a photo or paste the text — dosage, timing, and all.
> *(125 chars)*

**Option B (feature-led):**
> Create recurring Google or Outlook calendar events from prescriptions. Photo, PDF or text. Meal-based scheduling built in.
> *(124 chars)*

**Option C (problem-led):**
> Never miss a dose again. DoseSync reads your prescription and schedules every reminder on your calendar automatically.
> *(118 chars)*

### Long description (detailed; shown on the store page)

```markdown
DoseSync turns the prescription your doctor handed you into calendar events you actually follow.

Upload a photo, PDF, or paste the text. DoseSync reads it, identifies every medication, calculates dose times based on *your* meal schedule, and creates recurring events with reminders on Google Calendar or Microsoft Outlook — in one click.

## How it works

1. Open Google Calendar and click "+ Create" — DoseSync adds a "Schedule medications" option.
2. Upload a photo/PDF of your prescription, or paste the text directly.
3. Review editable cards with each medication, dosage, frequency, and food condition.
4. DoseSync generates the exact times based on your breakfast/lunch/dinner/bedtime anchors.
5. Confirm — every dose becomes a recurring calendar event with a reminder.

## What it understands

- Frequencies: 1x, 2x, 3x, 4x a day, every 6/8/12 hours, as needed (PRN)
- Food conditions: fasting, before meal, with meal, after meal, before bed
- Durations: "for 7 days", "by 14 days", indefinite
- Bilingual parser (Portuguese + English) for pasted text — no AI key required
- Photo/PDF parsing via your own Gemini, Claude, or OpenRouter key

## Privacy first, zero backend

- No DoseSync server. Nothing is collected, logged, or analyzed on our side.
- Prescription content goes directly from your browser to the AI provider *you* picked, using *your* API key.
- Calendar events go directly from your browser to Google Calendar or Microsoft Graph, via OAuth2.
- All settings (meal times, API keys, OAuth tokens) live in `chrome.storage.local`, sandboxed to this extension only.
- Health data auto-expires: any draft you leave unfinished is erased after 4 hours.

Read the full privacy policy at https://jessgarbin.github.io/dosesync/privacy

## Supported calendars

- **Google Calendar** — connect with one click via Google sign-in
- **Microsoft Outlook / 365 Calendar** — connect via Microsoft sign-in

## Supported AI providers (photo & PDF only)

- **Google Gemini** (free tier, no credit card) — recommended
- **Anthropic Claude** (paid, cents per parse)
- **OpenRouter** (free and paid models; pick any vision-capable model)

Pasted text is parsed locally in your browser with no AI key required.

## Who it's for

- Anyone managing one or more prescriptions at home
- Caregivers scheduling meds for a family member
- Chronic-condition patients who lose track of complex regimens

DoseSync is an open-source project built by a product manager as a personal tool and published for anyone who might need it. Source code, roadmap, and issue tracker at https://github.com/jessgarbin/dosesync
```

---

## 2. Permission justifications

The Chrome Web Store submission form asks you to justify each permission in a separate text box. These are the exact strings to paste.

### `identity`

> Required for OAuth2 sign-in flows that authorize the extension to create events on the user's own Google Calendar or Microsoft Outlook Calendar. Without `identity`, the extension cannot ask the user to grant calendar access.

### `storage`

> Stores the user's local settings (meal time anchors, default reminder offset, chosen AI provider) and their own API key (if they use photo/PDF parsing). Also stores Microsoft refresh tokens so users don't have to sign in every session. All stored values live in `chrome.storage.local`, which is sandboxed per extension and never transmitted.

### Host permission: `https://calendar.google.com/*`

> The extension's content script injects a "Schedule medications" menu item into the "+ Create" dropdown on Google Calendar's web UI, which is where users start the flow.

### Host permission: `https://www.googleapis.com/calendar/*`

> Called from the service worker to create recurring events on the user's Google Calendar via the Google Calendar REST API, using the OAuth2 token obtained through `chrome.identity`.

### Host permission: `https://generativelanguage.googleapis.com/v1/*`

> Called from the service worker to parse photo/PDF prescriptions with Google Gemini, using the user's own Gemini API key. Only invoked if the user selects Gemini as their AI provider.

### Host permission: `https://api.anthropic.com/v1/*`

> Called from the service worker to parse photo/PDF prescriptions with Anthropic Claude, using the user's own Claude API key. Only invoked if the user selects Claude as their AI provider.

### Host permission: `https://openrouter.ai/api/*`

> Called from the service worker to parse photo/PDF prescriptions with OpenRouter (a meta-provider proxying 150+ vision models), using the user's own OpenRouter API key. Only invoked if the user selects OpenRouter as their AI provider.

### Host permission: `https://oauth2.googleapis.com/*`

> Used to revoke the user's Google OAuth token when they click "Disconnect" in Settings (RFC 7009 revocation endpoint).

### Host permission: `https://graph.microsoft.com/v1.0/*`

> Called from the service worker to create calendar events on Microsoft Outlook / 365 Calendar via the Microsoft Graph API, using the OAuth2 token obtained through Microsoft identity platform. Only invoked if the user selects Microsoft Calendar as their provider.

### Host permission: `https://login.microsoftonline.com/*`

> Used during the Microsoft OAuth2 PKCE authorization flow and subsequent refresh token exchanges, so users can connect their Microsoft account and stay signed in.

---

## 3. Data usage disclosures (required)

Chrome Web Store asks three yes/no questions under "Data usage". Expected answers:

| Question | Answer | Explanation to paste |
|---|---|---|
| Is the extension being sold, traded, or transferred? | **No** | DoseSync is open-source and free. No data is collected for sale. |
| Is this extension used to track user activity (analytics, telemetry)? | **No** | DoseSync has no analytics, no telemetry, no crash reporting. |
| Does this extension collect any personally identifiable information? | **No** (from DoseSync's side) | All health / prescription data is processed between the user's browser and providers the user explicitly configured; none of it is sent to or logged by the extension author. |

Certify:
- ✓ "I do not sell or transfer user data to third parties, outside of the approved use cases"
- ✓ "I do not use or transfer user data for purposes unrelated to my item's single purpose"
- ✓ "I do not use or transfer user data to determine creditworthiness or for lending purposes"

---

## 4. Asset specifications & capture guide

### Required assets

| Asset | Dimensions | Format | Quantity | Source file |
|---|---|---|---|---|
| Store icon | 128×128 | PNG | 1 | `public/icons/icon128.png` ✓ already exists |
| Small promo tile | 440×280 | PNG or JPEG | 1 (recommended) | *TODO — create* |
| Screenshots | 1280×800 **or** 640×400 | PNG or JPEG (no alpha) | 1–5 | *TODO — capture* |
| Marquee promo tile | 1400×560 | PNG or JPEG | optional | *TODO if featured* |

### Screenshot capture guide

Use the same aspect ratio for all screenshots (don't mix 1280×800 and 640×400). Recommended: **1280×800** for crispness.

Scenes to capture, in order:

1. **"+ Create" dropdown with DoseSync item visible**
   Caption: *"One click from Google Calendar"*
   How: open `calendar.google.com`, click "+ Create", take the screenshot before the menu closes.

2. **Modal open, StepInput screen showing upload + paste options**
   Caption: *"Upload a photo, a PDF, or just paste the text"*
   How: in the modal, the initial step. Use realistic placeholder text visible in the textarea.

3. **Modal on StepReview with 2–3 medication cards + timeline**
   Caption: *"Editable cards with meal-based timing"*
   How: parse a fake prescription ("Amoxicilina 500mg 8/8h 7 dias; Omeprazol 20mg 1x dia jejum; Dipirona 500mg 6/6h SOS"), land on review step.

4. **Google Calendar showing the created recurring events**
   Caption: *"Reminders on the calendar you already use"*
   How: after confirming, close the modal, show the calendar with 3–5 events lined up.

5. **Popup Settings with provider pickers and "Test key" button**
   Caption: *"Bring your own AI key or skip AI entirely for pasted text"*
   How: click the extension icon in the toolbar.

### Capture commands (macOS)

```bash
# Full screen PNG (will include menu bar — crop afterwards)
# Cmd + Shift + 3  — whole screen
# Cmd + Shift + 4  — rectangle selection (recommended for 1280x800)
# Cmd + Shift + 5  — screenshot UI with window/selection options

# To resize a capture to exact 1280x800 with sips (stock macOS):
sips -z 800 1280 screenshot.png --out screenshot-1280x800.png
```

Avoid:
- Personal data (real names, real medications, real appointments on Calendar)
- Browser chrome with identifiable tabs open
- Notifications, toast messages, debug panels
- Dark mode if your primary audience is on light mode (keep it consistent)

### Promo tile design brief (440×280)

Contents:
- DoseSync logo (use `public/icons/icon128.png`)
- Product name "DoseSync"
- Tagline: *"Prescriptions → Calendar reminders"*
- Background: solid or subtle gradient matching the brand blue (`#1a73e8`)
- No screenshots — too small to be legible at 440×280

You can use Figma, Canva, or even HTML + screenshot for this.

---

## 5. Pre-submission checklist

- [ ] Privacy policy published at a public URL (GitHub Pages recommended)
- [ ] Support URL set (GitHub issues works)
- [ ] `VITE_MICROSOFT_CLIENT_ID` set in `.env.local` **OR** accept that Microsoft will work only in dev mode for the first release
- [ ] Google OAuth client ID in `manifest.json` matches a verified Google Cloud project you own
- [ ] 1–5 screenshots captured at 1280×800
- [ ] Small promo tile at 440×280
- [ ] Store listing copy (short + long description) finalized
- [ ] Permission justifications pasted into submission form
- [ ] Data usage disclosures filled out
- [ ] Single purpose statement pasted
- [ ] Developer account created (one-time $5 fee)
- [ ] `npm run build` produces a clean `dist/`
- [ ] `dist/` zipped for upload
- [ ] Test the zipped package in a fresh Chrome profile before submitting

---

## 6. Post-submission

After uploading, select **Unlisted** for the first release. This means only people with the direct Web Store URL can find and install it — perfect for sharing with 5–10 beta testers before going public.

Google OAuth verification for the `calendar.events` scope runs in parallel and is required for promoting to **Listed** status without the "unverified app" warning screen. Start that process immediately after the initial store submission:

1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Fill out the app info with the **same** homepage, privacy policy, and logo as the Chrome Web Store listing
3. Add the `https://www.googleapis.com/auth/calendar.events` scope
4. Submit for verification (expect 2–6 weeks)
5. Once approved, switch the store listing from Unlisted to Public

---

**Last updated:** 2026-04-05
