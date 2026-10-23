// scripts/ts-worker-loader.mjs
//
// Module hooks that let plain Node (22.18+, which strips TypeScript types
// natively) import the Worker's source: extensionless relative specifiers
// resolve to .ts, and .json imports load as JSON without import attributes.
// Registered by scripts that render the Worker's emails outside the Worker.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$|\.json$/.test(specifier)) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) {
      return { url: candidate.href, format: 'module-typescript', shortCircuit: true };
    }
  }
  if (specifier.endsWith('.json')) {
    const resolved = await nextResolve(specifier, { ...context, importAttributes: { type: 'json' } });
    return { ...resolved, importAttributes: { type: 'json' } };
  }
  return nextResolve(specifier, context);
}
