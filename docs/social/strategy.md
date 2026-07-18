# Federalist Reader — Social Media Strategy

*Owner: Social. Platform: X (others later). Last updated: 2026-07-18.*

## Mission

Get more people reading the Federalist Papers by meeting curious citizens where
they already are, and always sending them back to the primary source at
**federalistreader.org**.

## The account's character

A knowledgeable, generous librarian — not a pundit. Loves these texts, treats
the founders' disagreements as a feature, and wants readers to think for
themselves. Mirrors the site's own voice: warm, plainspoken, curiosity over
instruction (see `PRODUCT.md`).

## Non-negotiables

1. **Non-partisan by construction.** We quote the papers and let readers draw
   conclusions. We never claim a text "proves" a modern side is right. When a
   news topic maps onto a Federalist theme, we present *the tension the founders
   wrestled with*, not a verdict.
2. **Classical-liberal spirit, honestly sourced.** Liberty, separation of
   powers, checks on faction, rule of law, federalism, free commerce — these are
   the papers' own preoccupations, so the *text* does the arguing, not us.
3. **Every post links to the primary source** on federalistreader.org
   (`/papers/{n}`). The account is **not X Premium**, and X near-totally
   suppresses the reach of non-Premium posts with a link in the main body — so
   the **link goes in the first self-reply, not the main post**. Main post carries
   the hook + the paper's social card (`social-cards/{n}.jpg`); first reply
   carries the link. (This is a *reach* fix, unrelated to any API billing.)
4. **Public actions need sign-off.** Posting, replying, and reposting are public
   actions on the account. Under batch-weekly-review, the anchor posts are
   approved a week ahead; same-day news-hooks, replies, and reposts are flagged
   for a quick yes before they go live.

## Three pillars

### 1. Daily anchor post (native X — free, no cap)
One post/day from a rotating menu: surprising fact · sharp quote · reader
question · "on this day" · myth-buster. A **news-hook** is attempted daily —
most days' news touches a perennial theme the papers already addressed. Formula:
*"Today's debate about ___ is a version of a question Publius took up in No. __ —
here's what he actually argued."* Ride the topic's attention without taking the
topic's side. Timing: mid-morning ET.

**Format (non-Premium reach fix):** main post = the hook + the paper's card
image, **no link**. Then a **first self-reply** with the link
(`/papers/{n}`). Links in a non-Premium main post get buried; a link in the reply
does not. Posted **manually by Vann** in the X app — no third-party tool, no API.

### 2. Replies (growth engine)
Meet people already discussing these ideas. Reply formula: a genuinely helpful,
conversational note + the specific paper + link. Additive and sourced, never a
dunk. **Never** reply to trash-talk, ragebait, or bad-faith threads. Skip any
reply that would require taking a partisan side to be relevant — silence over
spin. See `voice-and-engagement.md`. Reactive, so posted natively on X with your
approval. The link goes **directly in our reply** to their post — replies aren't
reach-throttled, so no first-reply trick needed here.

### 3. Reposts / quote-reposts
Amplify insight about the *ideas and texts*: a scholar's thread, a teacher's
lesson, a sharp observation. Straight repost when it stands alone; quote-repost
with our value-add when we can point to the paper behind it. Same non-partisan
filter, posted natively on X with your approval. A quote-repost is a top-level
post, so if it carries a link, put the **link in a first self-reply** (same reach
fix as anchor posts). Straight reposts carry no link.

## Operating rhythm (batch weekly review)

1. **Monday:** I draft the week's 7 anchor posts (evergreen) + the reply/repost
   watchlist. You approve the batch or edit.
2. **Publish (manual):** Vann posts approved anchor posts in the X app — main
   post + card first, then the link as the first reply. Can be posted live or
   scheduled in the composer. If a day's news gives us a stronger hook, we swap it
   in and push an evergreen down the queue.
3. **Daily:** I surface 2–5 reply/repost candidates with suggested copy; quick
   yes → Vann posts them natively on X.
4. **Friday:** short retro — what landed, what to tune.
5. As trust builds, evergreen categories can go pre-approved to cut review load;
   news-hooks stay reviewed.

**No third-party tool, no API, no cost.** Everything is posted by hand in the X
app. Automation via the X API is deliberately avoided: it's expensive (esp. the
$0.20-per-link charge) and raises bot-reporting risk. Revisit only if the manual
workload ever justifies it (see `x-integration-setup.md`).

## Assets in this folder

- `paper-theme-index.md` — every paper → author, theme, best hook, link. The
  lookup table for drafting and reply-matching.
- `content-calendar.md` — 2-week starter calendar of finished anchor posts.
- `voice-and-engagement.md` — brand voice + do/don't-engage rules.
- `x-integration-setup.md` — what's needed to wire up X API / scheduler.

## Measurement

Watch link clicks to federalistreader.org (referral traffic is the real KPI),
plus reply-driven follows and saves. Engagement (likes) is secondary; **reading
is the goal**.
