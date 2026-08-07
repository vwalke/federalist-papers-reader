import { describe, expect, it } from 'vitest';

import { publiusSignaturePlugin } from '../src/lib/publius-signature-plugin.mjs';

function runVisit(text: string): string[] | undefined {
  let className: string[] | undefined;
  const node = {};
  const ctx = {
    textContent: () => text,
    setProperty: (_node: unknown, key: string, value: string[]) => {
      if (key === 'className') className = value;
    }
  };
  publiusSignaturePlugin.element.visit(node, ctx);
  return className;
}

describe('essay signature plugin', () => {
  it.each(['PUBLIUS', 'BRUTUS', 'CATO'])('tags a standalone %s paragraph', (name) => {
    expect(runVisit(name)).toEqual(['essay-signature']);
    expect(runVisit(`  ${name}  `)).toEqual(['essay-signature']);
  });

  it('leaves ordinary prose mentioning the names untouched', () => {
    expect(runVisit('the consular administration was substituted by Brutus')).toBeUndefined();
    expect(runVisit('CATO, No. IV.')).toBeUndefined();
  });
});
