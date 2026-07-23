# HTTPS and HSTS Hardening Design

## Goal

Every Federalist Reader request must use HTTPS, including the Cloudflare Worker
routes under `/api/*` and `/manage*`. Browsers must also be instructed to refuse
future plaintext connections to the apex domain and all subdomains.

## Scope

This change addresses only transport security:

- redirect HTTP requests before the Worker parses a body or touches D1;
- enable Cloudflare's zone-wide Always Use HTTPS setting;
- enable strict HSTS for the apex and all subdomains;
- verify production behavior before submitting the domain to the browser preload
  list.

Turnstile, rate limiting, token lifetime, other security headers, and the
remaining audit findings are separate changes.

## Worker behavior

`handleRequest` will inspect the request URL before route dispatch. When the URL
uses `http:` it will:

1. change only the scheme to `https:`;
2. preserve the hostname, path, and query string exactly;
3. return an empty `308 Permanent Redirect` response with the HTTPS URL in
   `Location`;
4. perform no database access, form parsing, email delivery, or webhook
   processing.

HTTPS requests will continue through the existing route dispatcher unchanged.
The guard belongs at the top of `handleRequest` so it is covered by the existing
dependency-injected handler tests and protects every present and future Worker
route.

## Cloudflare configuration

The `federalistreader.org` zone will use:

- **Always Use HTTPS:** On
- **HSTS:** On
- **Max age:** 12 months (`31536000` seconds)
- **Include subdomains:** On
- **Preload directive:** On

Cloudflare will own the HSTS response header for both Pages and Worker responses.
The repository will not add a duplicate `Strict-Transport-Security` header.

The preload directive does not itself place the domain in browser preload lists.
Submission to `hstspreload.org` happens only after the production verification
below succeeds.

## Testing

Worker regression tests will prove that:

- an HTTP subscription POST receives a 308 redirect to the equivalent HTTPS URL;
- the HTTP request performs no database write and sends no email;
- an HTTP management URL preserves its token query string in `Location`;
- representative HTTPS requests retain their existing behavior.

The full Worker unit suite and TypeScript check must pass before deployment.

## Deployment and verification

Roll out in this order:

1. deploy the tested Worker HTTPS guard;
2. enable Always Use HTTPS for the Cloudflare zone;
3. enable the one-year HSTS policy with subdomains and preload;
4. verify the apex, `www`, `/api/*`, and `/manage*` over both HTTP and HTTPS;
5. confirm HTTPS responses include exactly one expected HSTS policy;
6. submit `federalistreader.org` to the browser preload list.

Successful production behavior is:

- every HTTP request redirects to the equivalent HTTPS URL;
- no Worker route returns application content over HTTP;
- HTTPS remains valid on the apex and every active web subdomain;
- HTTPS responses include
  `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.

## Operational commitment and rollback

After HSTS is enabled, Cloudflare proxying and valid HTTPS certificates must
remain available for the apex and every current or future web subdomain.

Before preload submission, HSTS can be withdrawn by serving `max-age=0`, though
browsers that cached the prior policy may require another HTTPS visit to receive
the withdrawal. After preload submission, removal depends on browser preload-list
updates and is not immediate. Always Use HTTPS may remain enabled during any HSTS
rollback.
