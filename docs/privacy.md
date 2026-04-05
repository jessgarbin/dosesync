---
title: DoseSync — Privacy Policy
---

# DoseSync Privacy Policy

**Last updated:** 2026-04-05

DoseSync is a Chrome extension that turns medical prescriptions into calendar events. This policy explains exactly what happens to your data when you use it.

## Short version

- **We do not run any server.** There is no DoseSync backend, no analytics, no telemetry, no crash reporting.
- **Your prescription data never reaches us.** It is processed directly between your browser and the providers *you* configured (AI provider for photo/PDF parsing, and Google or Microsoft for calendar event creation).
- **Your API keys stay on your device.** They are stored in `chrome.storage.local`, which is sandboxed per extension and never transmitted anywhere except the official API endpoint of the provider they belong to.
- **We cannot read, export, or delete your data**, because we never receive it. You control everything from the browser.

## What DoseSync does with your data

### 1. Prescription content (text, photos, PDFs)

When you paste text, the content is parsed **locally in your browser** using a regex-based parser (`src/lib/parser/text-parser.ts`). **Nothing is sent over the network for text input.**

When you upload a photo or PDF, the file is sent **directly from your browser** to the AI provider you selected in Settings:

- **Google Gemini** → `https://generativelanguage.googleapis.com` (authenticated with your own Gemini key)
- **Anthropic Claude** → `https://api.anthropic.com` (authenticated with your own Claude key)
- **OpenRouter** → `https://openrouter.ai` (authenticated with your own OpenRouter key, forwarded to the model you selected)

DoseSync does not proxy these requests. The traffic flows from your browser straight to the provider's servers, governed by **their** privacy policies:

- [Google AI Studio terms](https://ai.google.dev/gemini-api/terms)
- [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- [OpenRouter Privacy Policy](https://openrouter.ai/privacy)

Once the AI responds with parsed medication data, it is shown in the wizard for your review. If you close the wizard or do nothing for **4 hours**, the draft is automatically erased from `chrome.storage.local`.

### 2. Calendar events

When you confirm the schedule, the extension sends the events **directly from your browser** to the calendar provider you connected:

- **Google Calendar** → `https://www.googleapis.com/calendar/v3/calendars/primary/events` via OAuth2 (`chrome.identity.getAuthToken`), scope `https://www.googleapis.com/auth/calendar.events`.
- **Microsoft Calendar (Outlook)** → `https://graph.microsoft.com/v1.0/me/events` via OAuth2 PKCE (`chrome.identity.launchWebAuthFlow`), scope `Calendars.ReadWrite` + `offline_access`.

Event creation traffic is governed by Google's and Microsoft's privacy policies respectively. DoseSync does not see, store, or log these events outside your device.

### 3. Settings

The following items are stored **locally on your device** in `chrome.storage.local`:

- Selected AI provider and the corresponding API key you pasted
- Selected calendar provider (Google or Microsoft) and, for Microsoft, your Azure AD client ID
- Meal time anchors (breakfast, lunch, dinner, bedtime)
- Default reminder minutes
- Microsoft OAuth tokens (when connected) under the `msTokens` key, including refresh token — so you don't have to re-authenticate every session

`chrome.storage.local` is sandboxed per extension and only accessible to DoseSync itself. It is not synced across devices. Uninstalling the extension deletes all of it.

### 4. Health data statement (LGPD Art. 11 / GDPR Art. 9)

Prescription content includes information about your health and is treated as **sensitive personal data** under both LGPD (Art. 11) and GDPR (Art. 9). DoseSync's design intentionally avoids becoming a controller of this data:

- No health data is transmitted to any server controlled by the extension author.
- No health data is logged or persisted beyond the 4-hour draft TTL inside `chrome.storage.local`.
- No third-party analytics or error reporting SDK is bundled with the extension.
- Any outbound request carrying health data goes **only** to the AI or calendar provider you explicitly configured, using credentials you provided.

If you are uncomfortable sending prescription photos or PDFs to a commercial AI provider, **use the pasted-text path**: it runs entirely offline in your browser and requires no API key.

## What DoseSync does *not* do

- ❌ No account creation, no login to DoseSync itself
- ❌ No analytics, usage tracking, crash reporting, or telemetry
- ❌ No advertising, no ad identifiers, no fingerprinting
- ❌ No sale, sharing, or monetization of your data
- ❌ No cross-device sync of health data
- ❌ No remote code loading — the extension ships with all its logic bundled
- ❌ No access to pages other than `calendar.google.com` (via content script)

## Permissions explained

| Permission | Why it is needed |
|---|---|
| `identity` | OAuth2 flow for Google Calendar and Microsoft 365 — required to create events on your own calendar. |
| `storage` | Save your settings, API key, and OAuth tokens locally. |
| Host `calendar.google.com/*` (content script) | Inject the "Schedule medications" menu item into Google Calendar's "+ Create" dropdown. |
| Host `www.googleapis.com/calendar/*` | Create Google Calendar events. |
| Host `generativelanguage.googleapis.com/v1/*` | Parse photo/PDF prescriptions with Gemini (only if you pick Gemini). |
| Host `api.anthropic.com/v1/*` | Parse photo/PDF prescriptions with Claude (only if you pick Claude). |
| Host `openrouter.ai/api/*` | Parse photo/PDF prescriptions with OpenRouter (only if you pick OpenRouter). |
| Host `oauth2.googleapis.com/*` | Revoke Google OAuth tokens when you disconnect. |
| Host `graph.microsoft.com/v1.0/*` | Create Outlook/Microsoft Calendar events (only if you pick Microsoft). |
| Host `login.microsoftonline.com/*` | Microsoft OAuth2 PKCE authorization and token refresh (only if you pick Microsoft). |

## Your rights

Because nothing is stored on our side, you exercise your rights directly through the providers you connected:

- **Access / delete prescription content:** DoseSync does not retain it. Review and delete AI request history in the dashboard of the provider you chose (Google, Anthropic, OpenRouter).
- **Access / delete calendar events:** Manage them in Google Calendar or Outlook directly.
- **Delete DoseSync settings and tokens:** Open Settings → disconnect Google/Microsoft, clear the API key field, save. For a full wipe, uninstall the extension in `chrome://extensions` — that erases `chrome.storage.local` for this extension entirely.

## Children's privacy

DoseSync is not directed at children under 13. It is a personal health tool meant for adults managing their own medications.

## Changes to this policy

If this policy changes, the "Last updated" date at the top will be bumped and the new version will be shipped in a subsequent extension release. Reviewing the changelog on the extension's Chrome Web Store page is recommended after updates.

## Contact

DoseSync is an open-source project. To report a privacy concern or ask a question:

- Open an issue at the project's GitHub repository
- Or contact the maintainer through the links on the project's GitHub profile

Because there is no DoseSync account and no server logs, the maintainer cannot identify which user submitted a report — please include enough context in your message for the issue to be understandable.
