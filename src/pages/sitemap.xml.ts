import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

import { getOrderedPapers } from '../lib/papers';

// Dependency-free sitemap: static pages + every paper. Absolute URLs require
// Astro.site (PUBLIC_SITE_URL) to be set at build time.
export async function GET(context: APIContext): Promise<Response> {
  const origin = context.site ? context.site.href.replace(/\/$/, '') : '';

  const papers = getOrderedPapers(
    (await getCollection('papers')).map((entry) => ({ ...entry, number: entry.data.number }))
  );

  const paths = [
    '/',
    '/about/',
    ...papers.map((paper) => `/papers/${paper.data.number}/`)
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
}
