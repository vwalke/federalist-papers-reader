# Show HN + Product Hunt Launch Plan

*Drafted 2026-07-18. Status: awaiting Vann's go + date pick.*

The pitch is the subscription: **read all 85 papers the way New Yorkers did —
serially** — inside a crafted period-newspaper edition. We are launching a
reading program, not another hosting of a public-domain text.

## Sequencing

1. **Post the subscription announcement on @ReadPublius first** (drafts in the
   posting queue). The account should look alive before launch traffic checks it,
   and the pinned announcement is our standing "what is this."
2. **Show HN** first (bigger, better-fit audience for craft + history), then
   **Product Hunt** later the same week.
3. Reddit/teacher outreach kits follow the launch (reuse its copy).

## Timing

- **Show HN:** Tuesday or Wednesday, 8–10am ET. Highest weekday attention;
  gives a full day to answer comments. (Weekends have less competition but less
  traffic; this project can compete on a weekday.)
- **Product Hunt:** launch day begins 12:01am PT. Do it Thursday of the same
  week so the two don't split attention. Tue–Thu is busiest; Sat/Sun ranks
  easier but reaches fewer people.
- **Alternative themed date:** October 27 (anniversary of Federalist No. 1;
  the "As It Happened" season opens). Strong hook but three months away —
  better used as a *second* X/press moment, not the launch.

## Show HN

**Submit:** `https://federalistreader.org` — title options (HN style: factual,
no superlatives):

1. `Show HN: The Federalist Papers as an 18th-century newspaper, one a week by email`
2. `Show HN: Read the Federalist Papers the way New Yorkers did in 1787`
3. `Show HN: A Federalist Papers reader set as the newspaper it first ran in`

**Maker's first comment** (post immediately after submitting):

> This started as a gift. I gave my mom a subscription that mails one Federalist
> paper a week on 1780s-style newsprint, and reading along online I couldn't
> find an edition I actually enjoyed reading — just databases and text dumps. So
> I built one.
>
> All 85 papers, original text (grounded in the Library of Congress and Founders
> Online records). Each renders as a period newspaper sheet — self-hosted IM Fell
> and Caslon type, ligatures and the long-œ "FŒDERALIST" heading, and every paper
> gets a stable, unique "wear" fingerprint (edge nicks, a lifted corner) generated
> at build time. There's a clean Reader mode when you just want to read, short
> plain-language companion notes on each paper, and reading progress that lives
> in your browser — no accounts, no tracking beyond Cloudflare's cookieless
> analytics.
>
> New this week: subscribe by email. Two programs — one paper each Saturday in
> order, or "As It Happened," where each paper arrives on the anniversary of its
> original 1787–88 publication date, in fits and starts, the way New Yorkers
> first met them. One-click unsubscribe, no account.
>
> Stack: Astro static build on Cloudflare Pages; the email side is Workers + D1.
> A family footnote that kept me going: my sixth-great-uncle Charles Thomson was
> secretary of the Continental Congress — his name is on the Dunlap broadside.
>
> Happy to answer anything, and I'd genuinely value critique of the typography
> and the reading experience.

**Etiquette / mechanics:**
- Never ask anyone for upvotes, anywhere (HN detects voting rings; it kills
  posts). Don't link the HN thread from @ReadPublius while it's live.
- Be present for the first 3–4 hours; answer every substantive comment.
- If the post doesn't take off, HN allows a repost after some days; second
  attempts are normal and allowed.

**Prepared answers (likely comments):**
- *"Gutenberg/Avalon already has this."* — True, and they're linked as sources.
  This is about the reading experience: typography, pacing, context, and the
  serial email. The text is the same; the invitation is different.
- *"Why no accounts?"* — Progress lives in the browser; the subscription needs
  only an email address. Less to maintain, nothing to breach.
- *"Source available?"* — Repo is currently private. (Vann: decide stance —
  "may open it later" is a fine answer.)
- *"Monetization?"* — None. A family project of WalkeForward, LLC; costs are a
  domain and Cloudflare's free tier.
- *"AI involvement?"* — Be honest, don't lead with it: built with AI-assisted
  tooling; the texts are the originals, sources cited; companion notes are
  editorial for this edition.

## Product Hunt

- **Name:** Federalist Reader
- **Tagline options** (≤60 chars):
  1. `Read the Federalist Papers as 1787 newspapers, by email`
  2. `All 85 Federalist Papers, one per week in your inbox`
  3. `The Federalist Papers, the way New Yorkers first read them`
- **Description (~240 chars):** All 85 Federalist Papers as the newspaper
  serial they originally were: period typography, a clean reader mode, short
  companion notes, and an email subscription that delivers one paper a week —or
  each on the anniversary of its original 1787–88 date.
- **Topics:** Education · Books · Email · Design Tools (history isn't a topic;
  Education carries it)
- **Gallery (1270×760):** (1) homepage masthead + ledger, (2) a Gazette essay
  with drop cap and wear, (3) Reader mode, (4) the subscribe page with both
  programs, (5) where-to-start hub, (6) phone view. Reuse `social-cards/`
  aesthetics; capture fresh screenshots at exact size.
- **Maker's first comment:** compress the Show HN comment (gift → built the
  edition → subscription programs → no accounts; invite feedback).
- Self-hunting is normal now; schedule the launch in PH ahead of time.

## Pre-launch checklist

- [ ] X subscription announcement posted and pinned (@ReadPublius)
- [ ] Subscribe flow smoke-tested end to end (fresh email, both programs,
      confirm + unsubscribe links)
- [ ] Cloudflare: confirm no bot-challenge on crawlers; static pages cached
- [ ] OG/Twitter cards verified (done 2026-07-18)
- [ ] About page reviewed — it will get read; the family story is an asset
- [ ] Decide repo public/private stance for the "source?" question
- [ ] Screenshots captured for PH gallery
- [ ] Launch-day calendar: block the morning for comment replies
