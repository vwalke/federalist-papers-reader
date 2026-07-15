import { describe, expect, it, vi } from 'vitest';

import {
  periodSpellingPlugin,
  periodizeText
} from '../src/lib/period-spelling-plugin.mjs';

describe('period spelling HAST transform', () => {
  it('annotates standalone federal in lower, title, and uppercase forms', () => {
    const children = periodizeText('federal Federal FEDERAL Federalist confederal');
    const spans = children.filter((node) => node.type === 'element');
    expect(spans.map((node) => node.properties)).toEqual([
      {
        className: ['period-spelling'],
        'data-modern': 'federal',
        'data-gazette': 'fœderal',
        'aria-label': 'federal'
      },
      {
        className: ['period-spelling'],
        'data-modern': 'Federal',
        'data-gazette': 'Fœderal',
        'aria-label': 'Federal'
      },
      {
        className: ['period-spelling'],
        'data-modern': 'FEDERAL',
        'data-gazette': 'FŒDERAL',
        'aria-label': 'FEDERAL'
      }
    ]);
    expect(spans.map((node) => node.children?.[0].value)).toEqual([
      'fœderal',
      'Fœderal',
      'FŒDERAL'
    ]);
    expect(children.map((node) => node.type === 'text' ? node.value : node.children[0].value).join(''))
      .toBe('fœderal Fœderal FŒDERAL Federalist confederal');
  });

  it('leaves links and code untouched', () => {
    for (const tagName of ['a', 'code']) {
      const node = { type: 'text', value: 'federal' } as const;
      const parent = { type: 'element', tagName, properties: {}, children: [node] };
      const insertBefore = vi.fn();
      const removeNode = vi.fn();

      periodSpellingPlugin.text?.(node, {
        parent: (candidate: unknown) => candidate === node ? parent : undefined,
        insertBefore,
        removeNode
      });

      expect(insertBefore).not.toHaveBeenCalled();
      expect(removeNode).not.toHaveBeenCalled();
    }
  });
});
