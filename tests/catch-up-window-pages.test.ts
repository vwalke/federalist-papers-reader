import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('the built pages', () => {
  const built = (path: string) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
  const lines = (html: string) => html.match(/<p[^>]*data-catch-up-window[^>]*>/g) ?? [];

  it('render the line hidden on the home page, the subscribe page and its signup box', async () => {
    const home = lines(await built('index.html'));
    const subscribe = lines(await built('subscribe/index.html'));
    expect(home).toHaveLength(1);
    expect(subscribe).toHaveLength(2);
    expect(subscribe.some((tag) => tag.includes('subscribe-coupon__pitch'))).toBe(true);
    for (const tag of [...home, ...subscribe]) {
      expect(tag).toMatch(/\shidden(\s|>)/);
      expect(tag).toContain('data-days=');
    }
  });

  it('render the As It Happened notice hidden, under a new storage id', async () => {
    const home = await built('index.html');
    const notice = home.match(/<aside[^>]*data-site-notice[^>]*>/)?.[0] ?? '';
    expect(notice).toContain('data-catch-up-window');
    expect(notice).toMatch(/\shidden(\s|>)/);
    expect(home).toContain('publius:notice-dismissed:aih-underway-2026');
    expect(home).not.toContain('publius:notice-dismissed:antifederalist-2026');
  });
});
