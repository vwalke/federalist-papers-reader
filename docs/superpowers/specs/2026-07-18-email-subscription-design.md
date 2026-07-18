# Publius by Post — Email Subscription Design

**Date:** 2026-07-18
**Status:** Draft for review (designed autonomously; assumptions and decisions flagged inline)
**Scope:** Product design specification only. Implementation plan to follow after review.

## Overview

Let readers receive the Federalist Papers by email, one of two ways:

1. **The Weekly Course** — one paper per week in original order, Paper 1 through Paper 85, starting the week they subscribe. Every subscriber walks the same 85-week road (a year and seven months) on their own start date.
2. **As It Happened** — each paper arrives on the anniversary of its original publication date, mapped onto the current year. The season runs late October through late May, at the original bursty cadence (some weeks bring three or four papers), so readers feel the flood of Publius the way New Yorkers did in 1787–88.

Both programs reuse the site's existing per-paper data (`publicationDate`, `nutshell`, `keyArguments`, `talkItOver` frontmatter) and the Gazette design language, adapted to what email clients can render.

## Goals & non-goals

**Goals**

- A reader can subscribe with just an email address and a program choice — no account, consistent with the site's "reward steady progress without requiring an account" principle.
- Subscribers can pause, resume, switch programs, restart, and unsubscribe from any email, without a password.
- Zero or near-zero cost at launch; a clear, cheap path if the list grows.
- Full compliance: double opt-in, one-click unsubscribe, sender identification.

**Non-goals (YAGNI)**

- No paid subscriptions, no accounts, no reader-to-reader features.
- No open/click tracking beyond delivery health (bounces, complaints). The site's privacy posture is minimal analytics; the email program follows it.
- No mobile app notifications or RSS-to-email.

## Approaches considered

**A. Managed newsletter platform (Buttondown or Kit).** Fastest to ship; deliverability handled for us. But the Weekly Course is a *per-subscriber* 85-step drip — a very long automation — and automations require Buttondown's $9/mo Basic plan even under 100 subscribers, rising to $29/mo at 5,000. Template control is limited, and the As It Happened calendar needs 85 scheduled broadcasts per season managed through their API anyway.

**B. Cloudflare Worker + D1 + Resend (recommended).** The site already deploys to Cloudflare Pages; a Worker with a daily cron trigger, a small D1 database, and Resend's send API adds no new platform. Costs $0 up to roughly 100 subscribers and $20/mo to roughly 10,000. We keep total control of the email template (period-styled), the manage-subscription UX, and the scheduling logic (which is the genuinely custom part of this product). Trade-off: we own deliverability setup (SPF/DKIM/DMARC) and ~1–2 days more build time.

**C. Amazon SES + Worker.** Cheapest at scale ($0.10 per 1,000 emails) but reintroduces AWS, which this project deliberately retired when it moved off Amplify. Kept as the documented scale path if the list ever exceeds Resend's economics (~50k emails/mo).

**Decision: Option B.** The scheduling logic is bespoke either way; the delivery API is the commodity. Resend's free tier covers launch, and the Worker code is small and testable.

## The two programs

### The Weekly Course

- Papers go out **Saturday mornings, 7:00 a.m. Eastern** — Federalist No. 1 first appeared on a Saturday (October 27, 1787), and Saturday suits the kitchen-table reading the brand imagines.
- A new subscriber's first paper is the **first Saturday at least two full days after confirmation** (confirm Thursday → this Saturday; confirm Friday → next Saturday), so the welcome email and first paper never collide.
- One paper per week, in order, for 85 weeks. The final email (Paper 85) closes with a short completion note and invites the reader to the As It Happened season or to share the course.

### As It Happened

- Each paper is sent on its original **month and day**, mapped to the current cycle: October 27 → Paper 1, and so on through the season. Delivery at 7:00 a.m. Eastern.
- **Multiple papers on one date become a single email** — one "issue" listing each paper due that day, matching the newspaper form and avoiding same-morning multiple sends.
- **Papers 78–85** never ran in the 1787–88 newspapers; all eight carry the McLean's Edition date of May 28, 1788. Decision: after the May 28 issue announces "the bound volume is out," papers 78–85 are delivered **one per week for eight weeks (early June through late July)** as a "From McLean's Edition" finale, via explicit date overrides in the schedule data. Alternative rejected: dumping all eight in one email (unreadable) or ending the season abruptly on May 28 (anticlimax for the eight most-read judiciary papers, including 78 and 84).
- **Season boundary:** subscribers who join between seasons (August–October) get a welcome email stating when the season opens. Subscribers who join mid-season **join in progress** by default; the welcome email shows what has already run, with links, and offers a one-click switch to the Weekly Course for those who want to start at Paper 1.
- February 29 has no paper in the source data, but the mapping logic treats any Feb 29 date as Feb 28 in non-leap years, as a guard.

## User experience

### Entry points (site)

1. **End-of-paper coupon (primary).** After the Publius signature at the foot of each essay, a ruled "By Subscription" block: one line of copy, email field, the two program choices as compact radio rows, a Subscribe button. This is the moment of highest intent — the reader just finished a paper.
2. **`/subscribe` page.** The full pitch: what each program is, a sample email, the schedule, privacy note ("your address is used for these papers and nothing else"). All other entry points link here.
3. **Index and About mentions.** A single ledger-style line on the index page and a sentence in About linking to `/subscribe`. No popups, no interstitials — the anti-references forbid SaaS-style capture.

### Signup flow

```
Email + program choice → POST /api/subscribe
  → "Check your post" page (confirms nothing yet — double opt-in)
  → Confirmation email: one button, "Confirm subscription"
  → GET /api/confirm?token=… → "Confirmed" page + welcome email
  → Welcome email states the program, the first delivery date, and the manage link
```

- Works without JavaScript: plain form POST, server-rendered result pages.
- Bot protection: Cloudflare Turnstile (invisible mode) with a honeypot field as the no-JS fallback.
- Unconfirmed signups expire after 7 days; re-subscribing an existing address resends the confirmation (never reveals whether an address is already subscribed).
- A subscriber may hold **one program at a time**; choosing the other program from the manage page switches rather than duplicates.

### The email itself

Single-column "broadside" adapted from the Gazette, built for email-client reality:

- **Masthead:** pre-rendered PNG from the existing masthead pipeline (`scripts/generate-masthead.mjs` gains an email-width export), so the nameplate survives clients that block web fonts. Alt text: "The Fœderalist — Publius."
- **Typography:** Georgia/serif stack (custom fonts are unreliable in email; Georgia is the closest widely-installed Caslon-adjacent face). Ink/newsprint palette from DESIGN.md converted to hex. Dark-mode-safe colors declared.
- **Structure per paper:** dateline (`publicationDateLabel`), paper number and title, recipient line, the **nutshell** as a companion's introduction, the **opening paragraphs** of the original text with a CSS drop cap where supported, then a "Continue reading at the Gazette" button to the paper's page, and the **Talk It Over** question as a closing rule. Progress line for Weekly Course subscribers: "Paper 23 of 85."
- **Why excerpt, not full text:** the papers run 2,000–5,000 words; full text would trip Gmail's ~102KB clipping and cut off the footer (including the unsubscribe link, a compliance risk). The site is the reading room; the email is the paper boy.
- **Footer:** postal address (required by CAN-SPAM — see Compliance), Manage subscription link, one-click Unsubscribe link, and a plain-language line on why the reader is receiving this.

### Manage subscription (no password)

Every email carries an HMAC-signed manage link (`/manage?token=…`). The page shows current program, progress or next delivery, and offers:

| Action | Weekly Course behavior | As It Happened behavior |
|---|---|---|
| **Pause** | Progress freezes; nothing sends. | Sends suppressed; calendar keeps moving. |
| **Resume** | Next unsent paper arrives next Saturday; the 85-week clock simply extends. | Rejoins the live calendar; the manage page and next email list what was missed, with links. |
| **Switch program** | Joins the calendar in progress. | Starts the Weekly Course — at Paper 1 by default, or at a chosen paper. |
| **Restart** | Back to Paper 1, next Saturday. | n/a (the calendar restarts itself each season). |
| **Unsubscribe** | Immediate, one click, no confirmation page trickery. A quiet "resubscribe" link on the goodbye page. | Same. |

Pause options: indefinitely, or "until" a chosen date (auto-resume). Tokens are per-subscriber, revocable, and valid until unsubscribed; unsubscribe links additionally honor RFC 8058 one-click semantics.

## Architecture

```
Astro site (Cloudflare Pages)
  /subscribe page, end-of-paper coupon, /manage page (Worker-rendered)
        │  form POST / GET
        ▼
Cloudflare Worker (same repo, Pages Functions or standalone)
  /api/subscribe  /api/confirm  /api/manage/*  /api/unsubscribe
  /api/webhooks/resend   (bounces & complaints → auto-unsubscribe)
  Cron trigger: daily 11:00 UTC (= 6/7 a.m. Eastern across DST)
        │
        ├── D1 (SQLite): subscribers, deliveries, schedule
        └── Resend API: transactional sends from mail.federalistreader.org
```

- **Cron job (daily):** query due sends — Weekly Course rows where today is the subscriber's send-day and status is active; As It Happened dates matching today's month-day (with the 78–85 overrides). Insert a `deliveries` row *before* sending (idempotency: reruns and retries never double-send), then call Resend. Batched; Resend's batch endpoint sends up to 100 per call.
- **Content at send time** comes from a build-step JSON export of the paper frontmatter + opening paragraphs (the same content pipeline `validate:content` already checks), bundled with the Worker so the cron job never scrapes the live site.
- **Schedule data:** a small YAML/JSON file in-repo mapping month-day → paper numbers, generated from frontmatter with explicit overrides for 78–85. Reviewed like content.

### Data model (D1)

```sql
subscribers(
  id, email UNIQUE, program('weekly'|'calendar'),
  status('pending'|'active'|'paused'|'unsubscribed'),
  progress_index,          -- weekly: last paper sent (0–85)
  send_dow,                -- weekly: delivery day, default Saturday
  paused_until,            -- nullable auto-resume date
  token_secret, created_at, confirmed_at, unsubscribed_at
)
deliveries(
  id, subscriber_id, paper_number, scheduled_for,
  status('queued'|'sent'|'bounced'|'failed'), provider_message_id, created_at
)
```

### Error handling

- Send failures: `deliveries` row marked `failed`; the next day's cron retries anything failed within 48h, then gives up and logs (a missed weekly paper resumes the following week from `progress_index`, so no paper is ever skipped).
- Hard bounces and spam complaints (Resend webhook): mark unsubscribed immediately; complaints are never mailed again.
- Cron overlap/replay: the pre-insert `deliveries` row with a UNIQUE(subscriber_id, paper_number, scheduled_for) constraint makes sends idempotent.
- D1 or Resend outage: cron exits nonzero, Cloudflare alerting (free email notification) pings the operator; next run catches up.

## Compliance & deliverability

- **Double opt-in** (proof of consent stored: timestamp + confirming IP).
- **One-click unsubscribe**: `List-Unsubscribe` + `List-Unsubscribe-Post` headers (RFC 8058) — required by Gmail/Yahoo bulk-sender rules and good practice at any size — plus the visible footer link.
- **CAN-SPAM postal address**: the footer must carry a valid physical address. If the operator prefers not to publish a home address, a PO box or virtual mailbox (~$10–15/mo) is the one recurring non-technical cost. **Open item for the operator.**
- **Sending domain**: `mail.federalistreader.org` subdomain with SPF, DKIM, DMARC (p=quarantine to start) — isolates the root domain's reputation. From: "Publius — The Federalist <papers@mail.federalistreader.org>".
- **Privacy**: address + program + delivery log only; no tracking pixels; deletion on unsubscribe after a 30-day suppression-list hold (so "unsubscribed" is remembered long enough to honor it).

## Costs

**Do we need to pay to send email? Not at launch; modestly if it grows.**

| Component | Launch (≤ ~100 subs) | ~1,000 subs | ~10,000 subs |
|---|---|---|---|
| Cloudflare Pages / Workers / D1 / Turnstile / cron | $0 (free tiers) | $0 | $0–5/mo (Workers paid tier only if request volume demands) |
| Resend | **$0** — free tier: 3,000 emails/mo, 100/day | **$20/mo** Pro (50,000 emails/mo) | **$20/mo** (≈43k emails/mo fits Pro) |
| Domain / DNS | already owned | — | — |
| Postal address (if PO box needed) | $0–15/mo | same | same |
| **Total** | **$0 (+ optional PO box)** | **~$20/mo** | **~$20–25/mo** |

Notes:

- The binding free-tier constraint is Resend's **100 emails/day**: Weekly Course sends cluster on Saturdays, so ~100 active subscribers is the ceiling before the $20/mo Pro plan. (Mitigation if we want to stretch it: assign send-day by signup day-of-week, spreading the load — kept as an option via `send_dow`, default Saturday.)
- Volume math: a subscriber receives ~4.33 emails/mo (weekly) or ~5/mo averaged in-season (calendar). 10,000 subscribers ≈ 43,000 emails/mo — still inside one $20 Resend Pro plan.
- Scale escape hatch: Amazon SES at $0.10 per 1,000 emails (~$4.30/mo for the same 43k) if economics ever matter more than avoiding AWS.
- Managed alternative for reference: Buttondown $0 to 100 subscribers but $9/mo for the automations this design needs, $29/mo at 5,000 subscribers.

## Testing

- Unit: schedule mapping (leap day, DST boundaries, 78–85 overrides, multi-paper dates), token signing/expiry, pause/resume state transitions.
- Integration: cron run against a seeded D1 with a mocked Resend client — assert exactly-once delivery across reruns and failure retries.
- E2E (Playwright, existing harness with `PLAYWRIGHT_PORT`): signup form with and without JS, confirm flow, manage page actions.
- Manual: render the template through Gmail/Outlook/Apple Mail (Litmus one-off or free previews) before launch; verify clipping stays under ~100KB.

## Decisions made autonomously (flag if wrong)

1. Cloudflare Worker + D1 + Resend over a managed newsletter platform.
2. Saturday 7 a.m. ET default delivery for the Weekly Course.
3. Excerpt-plus-link emails rather than full text.
4. Papers 78–85 as a weekly June–July "McLean's Edition" finale in the calendar program.
5. Mid-season calendar signups join in progress (with a switch-to-weekly offer).
6. One program per subscriber at a time.
7. No open/click tracking.

## Open items for the operator

- Postal address for the email footer (PO box vs. existing address).
- Approve the sender name/address wording.
- Season 1 framing: launch the Weekly Course immediately and open As It Happened signups for October 27, 2026?
