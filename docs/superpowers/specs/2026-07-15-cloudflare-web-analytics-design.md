# Cloudflare Web Analytics Design

**Date:** July 15, 2026

## Goal

Add free, aggregate traffic analytics to Federalist Reader so its owner can see how often the site and individual papers are visited, where visits broadly originate, which devices and browsers are used, and how pages perform. The feature must not introduce accounts, advertising, individual reader profiles, or paid infrastructure.

## Selected Approach

Use Cloudflare Web Analytics with its manually installed JavaScript beacon. The site will remain hosted on AWS; Cloudflare does not need to manage the domain or proxy site traffic.

Cloudflare Web Analytics was selected over Google Analytics because it is cookie-free and limited to the aggregate information this project needs. It was selected over GoatCounter because Cloudflare provides the desired traffic and performance dimensions in one free service without requiring the site to move its DNS or hosting.

## Analytics Scope

The implementation will collect only Cloudflare Web Analytics' standard aggregate measurements:

- visits and page views;
- requested paths, including individual Federalist paper pages;
- external referring sites;
- country-level geography;
- device type, browser, and operating system; and
- page-load performance and Core Web Vitals.

The site will not add custom events. It will not report mark-as-read activity, Gazette versus Reader mode, scroll depth, discussion prompts, or links clicked. It will not attempt to reconstruct an individual visitor's sequence through the papers.

## Integration

A small analytics component will own the Cloudflare beacon markup. `BaseLayout.astro` will render that component once so every public page is measured consistently.

The Cloudflare site token will be provided as build configuration rather than repeated in page templates. Analytics will render only for production builds with a configured token. Local development and test builds will therefore send no analytics and cannot pollute the production dashboard.

If the token is missing, malformed, or not yet configured in AWS, the site will continue to render normally without the analytics script. Analytics is observational and must never become a runtime dependency for reading or navigating the papers.

## About Page

Remove the complete “No account, no tracking your reading” section from the About page. Do not replace it with a privacy explanation, login explanation, cookie banner, or analytics callout.

The existing local mark-as-read behavior will remain unchanged. Reading progress continues to live only in the visitor's browser, but the About page will no longer volunteer an explanation of that implementation detail.

## Security and Performance

The beacon will load asynchronously or defer execution according to Cloudflare's supported embed format. A failure or blocker affecting the third-party script must not affect page content, navigation, reading preferences, or local progress.

No Cloudflare credentials or account secrets will be committed. The site token embedded in the browser-facing beacon is an identifier, not a secret, but it will still be supplied through configuration to keep deployments flexible.

## Verification

Automated tests will verify that:

- the About page no longer contains the removed section or its heading;
- the shared layout contains the analytics integration point;
- production configuration can render the Cloudflare beacon with the configured token; and
- missing configuration leaves the generated site functional and free of an invalid beacon.

The normal project check suite will run after implementation. A production-like build will also be inspected to confirm the beacon appears once per page and is absent from local development. After deployment, the Cloudflare dashboard will be checked for a live page view without adding any custom tracking.

## Activation

The code can be merged before AWS hosting and `FederalistReader.com` are available. Final activation requires creating the site in Cloudflare Web Analytics, copying its site token into the AWS build environment, and deploying a new production build.
