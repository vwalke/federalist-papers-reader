import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = new URL('../dist/', import.meta.url);
const BEACON_URL = 'https://static.cloudflareinsights.com/beacon.min.js';
const TEST_TOKEN = '0123456789abcdef0123456789abcdef';

function fail(message) {
  throw new Error(message);
}

function findBeaconScripts(document) {
  return [...document.querySelectorAll('script[src]')].filter((script) => {
    const source = script.getAttribute('src');
    return source === BEACON_URL || source?.startsWith(`${BEACON_URL}?`);
  });
}

function buildWith(environment) {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(command, ['build'], {
    cwd: ROOT,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    fail(`pnpm build exited with status ${result.status ?? 'unknown'}`);
  }
}

async function findHtmlFiles(directory) {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);

    if (entry.isDirectory()) {
      url.pathname += '/';
      files.push(...(await findHtmlFiles(url)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(url);
    }
  }

  return files;
}

async function verifyConfiguredOutput() {
  const htmlFiles = await findHtmlFiles(DIST);

  if (htmlFiles.length === 0) {
    fail('Configured build generated no HTML pages');
  }

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const document = new JSDOM(html).window.document;
    const beaconScripts = findBeaconScripts(document);
    const beaconDataElements = document.querySelectorAll('[data-cf-beacon]');
    const name = fileURLToPath(file).slice(ROOT.length);

    if (beaconScripts.length !== 1) {
      fail(`${name} contains ${beaconScripts.length} Cloudflare beacon scripts; expected 1`);
    }

    if (beaconDataElements.length !== 1 || beaconDataElements[0] !== beaconScripts[0]) {
      fail(`${name} does not attach exactly one data-cf-beacon attribute to its beacon script`);
    }

    const beacon = beaconScripts[0];
    if (beacon.getAttribute('src') !== BEACON_URL) {
      fail(`${name} Cloudflare beacon source does not match the manual embed URL`);
    }

    if (beacon.getAttribute('type') !== 'module') {
      fail(`${name} Cloudflare beacon is not type="module"`);
    }

    if (beacon.getAttribute('data-cf-beacon') !== JSON.stringify({ token: TEST_TOKEN })) {
      fail(`${name} Cloudflare beacon does not contain the configured test token`);
    }
  }

  console.log(
    `Configured analytics output: ${htmlFiles.length} HTML pages, exactly one valid module beacon per page.`,
  );
}

async function verifyUnconfiguredOutput() {
  const htmlFiles = await findHtmlFiles(DIST);
  let beaconCount = 0;
  let beaconDataCount = 0;

  if (htmlFiles.length === 0) {
    fail('Unconfigured build generated no HTML pages');
  }

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const document = new JSDOM(html).window.document;
    beaconCount += findBeaconScripts(document).length;
    beaconDataCount += document.querySelectorAll('[data-cf-beacon]').length;
  }

  if (beaconCount !== 0 || beaconDataCount !== 0) {
    fail(
      `Unconfigured build contains ${beaconCount} beacon scripts and ${beaconDataCount} data-cf-beacon attributes`,
    );
  }

  console.log(
    `Unconfigured analytics output: ${htmlFiles.length} HTML pages, ${beaconCount} beacon scripts.`,
  );
}

const configuredEnvironment = {
  ...process.env,
  PUBLIC_SITE_URL: 'https://federalistreader.com',
  PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN: TEST_TOKEN,
};
const unconfiguredEnvironment = { ...process.env };
delete unconfiguredEnvironment.PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;

let configuredError;

try {
  buildWith(configuredEnvironment);
  await verifyConfiguredOutput();
} catch (error) {
  configuredError = error;
} finally {
  buildWith(unconfiguredEnvironment);
  await verifyUnconfiguredOutput();
}

if (configuredError) {
  throw configuredError;
}
