# DoseSync

A Chrome extension that turns medical prescriptions into Google Calendar or Microsoft (Outlook) Calendar events with reminders. Upload a photo or PDF and AI extracts the medications, or paste the prescription text and a local bilingual (PT + EN) parser handles it — then the extension creates recurring events with the right times, intervals, and meal-based scheduling.

## The problem

Patients leave a doctor's office with a prescription and have to manually figure out when to take each medication. "Every 8 hours" — starting when? "Before meals" — how many minutes before? "3x a day for 7 days" — that's 21 individual reminders to set up by hand.

Most people don't set them up at all.

DoseSync solves this in a single click from the Chrome toolbar.

## How it works

```
Prescription input
    │
    ├── Photo / PDF ─► AI parsing (Gemini Flash, Claude Vision, or OpenRouter)
    │                   extracts medications, dosages, frequencies
    │
    └── Pasted text ─► Local regex parser (bilingual PT + EN)
                        matches dose, frequency, food condition
                              │
                              ▼
                       Editable cards ── review, adjust, fix
                              │
                              ▼
                       Smart scheduling ── meal-based time slots,
                              │              interval calculations,
                              ▼              food condition offsets
                    Google or Microsoft ── recurring events with
                       Calendar             reminders per dose
```

1. User clicks the **DoseSync icon** in the Chrome toolbar
2. Chooses between uploading a file (photo/PDF) or pasting prescription text
3. Photo/PDF go through AI; pasted text goes through a local regex parser — both produce editable medication cards
4. Extension calculates optimal times based on the user's meal routine
5. One click creates all recurring events with reminders on the chosen calendar (Google or Microsoft)

## Scheduling logic

This is where the domain knowledge lives. Brazilian prescriptions use specific patterns:

| Prescription says | Interpretation | Example (breakfast 07:00) |
|---|---|---|
| 1x ao dia | 1 dose anchored to breakfast | 07:00 |
| 2x ao dia | Anchored to breakfast + dinner | 07:00, 19:00 |
| 3x ao dia | Breakfast + lunch + dinner | 07:00, 12:00, 19:00 |
| De 8 em 8 horas | Fixed interval, 3 doses/day | 07:00, 15:00, 23:00 |
| De 12 em 12 horas | Fixed interval, 2 doses/day | 07:00, 19:00 |

**Food condition offsets:**

| Condition | Offset |
|---|---|
| Fasting (em jejum) | 60 min before meal |
| Before meal | 30 min before |
| With meal | At meal time |
| After meal | 30 min after |
| Before bed | At bedtime |

Anchor times are user-configurable (default: breakfast 07:00, lunch 12:00, dinner 19:00, bedtime 22:00).

Each dose of each medication becomes a separate recurring Google Calendar event with `RRULE:FREQ=DAILY;COUNT=N`, so "Amoxicillin 3x/day for 7 days" = 3 events, each repeating 7 times.

## Architecture

```
┌─ Popup (extension icon click) ─────────────────────┐
│                                                     │
│  React app (wizard: input → review → done)          │
│    ├─ Upload photo/PDF or paste text                │
│    ├─ Editable medication cards                     │
│    └─ Confirm → create calendar events              │
│                                                     │
│  Communication: chrome.runtime.sendMessage          │
└───────────────────────┬─────────────────────────────┘
                        │
┌─ Service Worker ──────┴─────────────────────────────┐
│  ├─ AI provider factory (Gemini / Claude / OpenRouter)
│  │    → photo/PDF parsing only                      │
│  ├─ OAuth2: chrome.identity (Google) or             │
│  │          PKCE launchWebAuthFlow (Microsoft)      │
│  └─ Calendar provider factory                       │
│       ├─ Google Calendar REST API                   │
│       └─ Microsoft Graph API (/me/events)           │
└─────────────────────────────────────────────────────┘
```

Pasted text is parsed locally via `src/lib/parser/text-parser.ts` — no network round-trip, no AI, no API key required for that path.

**Why the Service Worker handles API calls:** The popup communicates with the service worker via `chrome.runtime.sendMessage`. The service worker runs in the extension context with no CSP restrictions, and API keys stay out of the page.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Chrome Extension Manifest V3 |
| UI | React 19 + Tailwind CSS 4 |
| Build | Vite 8 + CRXJS plugin |
| Language | TypeScript 6 |
| AI (photo/PDF only) | Gemini Flash 2.0 (free tier) / Claude Vision / OpenRouter (user-chosen model) |
| Text parser | Local regex, bilingual PT + EN (no network) |
| Calendar | Google Calendar API (`chrome.identity`) or Microsoft Graph API (PKCE OAuth2) |
| Storage | `chrome.storage.local` |

**Zero backend.** Everything runs client-side. The user provides their own AI API key. No server, no hosting, no recurring costs.

## Project structure

```
src/
├── background/
│   └── service-worker.ts        # AI calls, Calendar API, OAuth2
├── modal/
│   ├── App.tsx                  # Wizard (input → review → done)
│   └── components/
│       ├── StepInput.tsx        # Upload file or paste text
│       ├── StepReview.tsx       # Editable cards + timeline + confirm
│       └── MedicationRow.tsx    # Single medication card
├── popup/
│   ├── Settings.tsx             # API keys, meal times, reminders
│   └── main.tsx                 # Popup entry point
├── lib/
│   ├── ai/                      # AIProviderModule interface
│   │   ├── gemini.ts            # Gemini Flash adapter
│   │   ├── claude.ts            # Claude Vision adapter
│   │   └── openrouter.ts        # OpenRouter (user-chosen model)
│   ├── calendar/                # CalendarProviderModule interface
│   │   ├── google/              # chrome.identity OAuth + Calendar API
│   │   └── microsoft/           # PKCE OAuth + Graph API + RRULE→MS translator
│   ├── parser/                  # Text-based prescription parser
│   ├── storage/                 # chrome.storage wrapper
│   └── schedule-utils.ts        # Core scheduling logic
└── types/                       # TypeScript interfaces
```

## Security decisions

- **API keys sent via headers**, not URL query params (Gemini uses `x-goog-api-key`)
- **Sender validation** on the service worker message listener — only accepts messages from the extension itself
- **OAuth token revocation** via POST to `oauth2.googleapis.com/revoke` (not GET)
- **File upload validation** — max 10MB, MIME type whitelist
- **AI response validation** — JSON.parse wrapped in try/catch with user-friendly errors
- **Rate limiting** — 3-second cooldown between AI parsing requests
- **Scoped permissions** — `host_permissions` restricted to specific API paths, not wildcard domains
- **Health data TTL** — wizard state auto-expires after 4 hours, cleared on success
- **No `eval`, no `innerHTML`** — React JSX + `textContent` only

## Setup

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production build
npm run build
```

Load the extension:
1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `dist/` folder
4. Click the DoseSync icon in the toolbar to open the popup

### End users

If you install the extension from the Chrome Web Store, you just click **Connect** for Google or Microsoft in Settings — no developer account required. Both the Google OAuth client and the Microsoft Azure AD app ship bundled with the extension.

### Developers building from source

If you're building the extension yourself:
- **Google Calendar**: replace the `client_id` in `manifest.json` with an OAuth2 client ID from your own Google Cloud project (Calendar API enabled).
- **Microsoft Calendar (Outlook)**: copy `.env.example` to `.env.local` and set `VITE_MICROSOFT_CLIENT_ID` to your Azure AD application (client) ID. See `.env.example` for step-by-step Azure registration instructions. If you leave the env var empty, the Settings screen will expose a manual "paste your client ID" field for local testing.

And, **optionally**, one AI key — only if you want to upload photo/PDF prescriptions (pasted text works without any AI key). The extension's Settings screen links directly to the signup page for each provider and has a **Test key** button that validates your key before the first real parse:
- **Gemini** — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no credit card
- **Claude** — paid, [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **OpenRouter** — free and paid models, [openrouter.ai/keys](https://openrouter.ai/keys); also needs a vision-capable model slug (e.g. `google/gemini-2.0-flash-exp:free`)

## Privacy

DoseSync runs entirely in your browser. No backend, no analytics, no telemetry. Prescription content is sent only to the AI provider *you* configured (using *your* key), and calendar events only to Google or Microsoft. See [docs/privacy.md](docs/privacy.md) for the full policy, including an explanation of every permission the extension requests.

## Context

I'm a product manager, not a software engineer. I built this using Claude Code as my pair-programming partner — from the initial architecture to the final security audit.

The motivation was real: I wanted something that takes a photo of my prescription and just handles the scheduling. The existing apps either require manual input for every dose or don't integrate with the calendar I already use.

This project is an example of what becomes possible when PMs have access to AI-assisted development: identifying a real problem, designing the solution, and shipping it — including the domain logic, the UX flow, and the technical decisions around security and architecture.

---

Built with [Claude Code](https://claude.ai/code)
