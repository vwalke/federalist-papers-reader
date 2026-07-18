# Posting Setup

## Decision: manual posting in the X app (no tool, no API)

I prep every post; **Vann posts them by hand** in the X app. No third-party
scheduler, no X API. Reasons:

- **Native X is free** and has no post cap.
- **The X API is expensive** for our use — $0.015/post, but **$0.20 for any post
  containing a link**, which is exactly what we do. Automated link outreach would
  run tens of dollars a month for something manual posting does for free.
- **Automation raises bot-reporting risk.** Hand-posting keeps the account
  clearly human-run.
- A scheduler adds nothing at the free tier (see the "when to revisit" note
  below) and the account doesn't need scheduling we can't do in the composer.

**What I cannot do (Vann does):** publishing, replying, reposting — all public
actions, posted manually with Vann's sign-off. I don't post autonomously.

## The non-Premium reach rule (important)

The account is **not X Premium**. X near-totally suppresses the reach of a
non-Premium post that has a link in its **main body**. So:

- **Anchor posts & quote-reposts:** hook + card in the main post (**no link**),
  then the link as the **first self-reply**.
- **Replies to other people:** link goes directly in the reply — replies aren't
  reach-throttled, so no extra step.

This is a *reach* fix (algorithmic), separate from any API billing.

## Workflow

1. **I draft** the week's anchor posts in `content-calendar.md` (main text + card
   + the first-reply link) and a reply/repost watchlist → **Vann approves/edits**.
2. **Vann posts** in the X app: main post + card, then the first-reply link.
3. **Replies/reposts:** I surface candidates with drafted copy; Vann posts the
   approved ones natively.

Our `content-calendar.md` doc is the draft queue. No account to create, no cost.

## When to revisit automation

Only if the manual workload becomes real friction (e.g. many posts/day across
multiple platforms). Even then, the X API's $0.20-per-link charge and bot-report
risk make it a poor fit; a paid scheduler with an approval queue (Typefully Pro
~$8–15/mo, Buffer ~$5–6/mo) would be the first step, not the API. Not needed now.
