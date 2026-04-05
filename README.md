# DoseSync

A Chrome extension that turns medical prescriptions into Google Calendar events with reminders. Upload a photo or PDF and AI extracts the medications, or paste the prescription text and a local bilingual (PT + EN) parser handles it — then the extension creates recurring events with the right times, intervals, and meal-based scheduling.

## The problem

Patients leave a doctor's office with a prescription and have to manually figure out when to take each medication. "Every 8 hours" — starting when? "Before meals" — how many minutes before? "3x a day for 7 days" — that's 21 individual reminders to set up by hand.

Most people don't set them up at all.

DoseSync solves this by integrating directly into Google Calendar, the tool people already use for their daily schedules.

## How it works

```
Prescription input
    │
    ├── Photo / PDF ─► AI parsing (Gemini Flash or Claude Vision)
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
                       Google Calendar ── recurring events with
                                           reminders per dose
```

1. User clicks **"+ Create"** in Google Calendar → sees **"Schedule medications"** injected in the dropdown
2. Chooses between uploading a file (photo/PDF) or pasting prescription text
3. Photo/PDF go through AI; pasted text goes through a local regex parser — both produce editable medication cards
4. Extension calculates optimal times based on the user's meal routine
5. One click creates all recurring events with reminders

The extension also works from its popup (click the extension icon) for quick access outside Calendar.

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
┌─ Content Script (calendar.google.com) ─────────────┐
���                                                     │
│  MutationObserver ──► detects "+ Create" dropdown   │
│    └─ injects "Schedule medications" menu item      │
│       └─ opens modal in Shadow DOM (CSS isolated)   │
│          └─ React app (wizard: input → review)      │
│                                                     │
│  Communication: chrome.runtime.sendMessage          │
└───────────────────────┬─────────────────────────────┘
                        │
┌─ Service Worker ──────┴─────────────────────────────┐
│  ├─ AI parsing for photo/PDF (Gemini / Claude)      │
│  ├─ OAuth2 via chrome.identity                      │
│  └─ Google Calendar REST API (event creation)       │
└─────────────────────────────────────────────────────┘
```

Pasted text is parsed locally in the content script via `src/lib/parser/text-parser.ts` — no network round-trip, no AI, no API key required for that path.

**Why the Service Worker handles API calls:** Content scripts on `calendar.google.com` inherit Google's CSP, which blocks fetch to external domains. The service worker runs in the extension context with no CSP restrictions, and API keys stay out of the page.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Chrome Extension Manifest V3 |
| UI | React 19 + Tailwind CSS 4 |
| Build | Vite 8 + CRXJS plugin |
| Language | TypeScript 6 |
| AI (photo/PDF only) | Gemini Flash 2.0 (free tier) / Claude Vision |
| Text parser | Local regex, bilingual PT + EN (no network) |
| Calendar | Google Calendar API via `chrome.identity` OAuth2 |
| Storage | `chrome.storage.local` |

**Zero backend.** Everything runs client-side. The user provides their own AI API key. No server, no hosting, no recurring costs.

## Project structure

```
src/
├── background/
│   └── service-worker.ts        # AI calls, Calendar API, OAuth2
├── content/
│   ├── index.ts                 # Entry point for content script
│   ├── menu-injector.ts         # Detects dropdown, injects menu item
│   └── modal-host.ts            # Shadow DOM + React mount
├── modal/
│   ├── App.tsx                  # Wizard (input → review → done)
│   └── components/
│       ├── StepInput.tsx        # Upload file or paste text
│       ├── StepReview.tsx       # Editable cards + timeline + confirm
│       └── MedicationRow.tsx    # Single medication card
├─�� popup/
│   ├── Settings.tsx             # API keys, meal times, reminders
│   └── main.tsx                 # Popup entry point
├── lib/
│   ├── ai/                      # Gemini + Claude providers
│   ├── calendar/                # OAuth + Calendar API client
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
4. Open [Google Calendar](https://calendar.google.com)
5. Click **"+ Create"** → you should see **"Schedule medications"**

You'll need:
- A **Google Cloud project** with Calendar API enabled and an OAuth2 client ID configured in `manifest.json`
- Optional: a **Gemini API key** (free at [aistudio.google.com](https://aistudio.google.com)) or a **Claude API key** — only required if you want to upload photo/PDF prescriptions. Pasted text works without any AI key.

## Context

I'm a product manager, not a software engineer. I built this using Claude Code as my pair-programming partner — from the initial architecture to the final security audit.

The motivation was real: I wanted something that takes a photo of my prescription and just handles the scheduling. The existing apps either require manual input for every dose or don't integrate with the calendar I already use.

This project is an example of what becomes possible when PMs have access to AI-assisted development: identifying a real problem, designing the solution, and shipping it — including the domain logic, the UX flow, and the technical decisions around security and architecture.

---

Built with [Claude Code](https://claude.ai/code)
