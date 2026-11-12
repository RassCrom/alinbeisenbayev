/*
 * Load a page of the built site the way a mid-range phone on a slow
 * connection would, and report what the weight budgets ask about.
 *
 *     pnpm build && pnpm preview        (in one terminal)
 *     node scripts/measure-page.mjs . works
 *
 * Phone profile, close to Lighthouse's: 412 x 823 at 1.75x, CPU slowed 4x,
 * 1.6 Mbps down, 750 kbps up, 150 ms latency. Nothing is scrolled.
 *
 * Reports largest contentful paint, layout shift, the bytes transferred
 * before any scroll and the largest image. `vite preview` does not compress,
 * so script, style and HTML sizes are taken as the gzipped size of the file
 * in dist, which is what a host serves; images are counted as transferred.
 *
 * Uses Microsoft Edge over the DevTools protocol and closes it afterwards,
 * child processes included.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BASE = process.env.MEASURE_BASE ?? 'http://localhost:4173';
const EDGE = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
// Routes are given without a leading slash ("." is the home page): Git Bash
// on Windows rewrites an argument like /works into a file path.
const routes = process.argv
  .slice(2)
  .filter((arg) => !arg.startsWith('--'))
  .map((arg) => `/${arg.replace(/^[./]+/, '')}`);
if (routes.length === 0) routes.push('/');

const BUDGET = { lcpMs: 2500, cls: 0.05, totalBytes: 500 * 1024, imageBytes: 150 * 1024 };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

async function measure(route) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const profile = mkdtempSync(join(tmpdir(), 'measure-'));
  const edge = spawn(
    EDGE,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' },
  );
  try {
    let target;
    for (let i = 0; i < 50 && !target; i += 1) {
      await sleep(200);
      try {
        target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
      } catch {
        // Not listening yet.
      }
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => (ws.onopen = resolve));
    let id = 0;
    const pending = new Map();
    const requests = new Map();
    ws.onmessage = (message) => {
      const msg = JSON.parse(message.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result ?? msg);
        pending.delete(msg.id);
      } else if (msg.method === 'Network.responseReceived') {
        requests.set(msg.params.requestId, { url: msg.params.response.url, type: msg.params.type, bytes: 0 });
      } else if (msg.method === 'Network.loadingFinished') {
        const request = requests.get(msg.params.requestId);
        if (request) request.bytes = msg.params.encodedDataLength;
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve) => {
        id += 1;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true });
    await send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    // Before any page script: record paints and shifts from the first frame.
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__lcp = 0; window.__lcpUrl = ''; window.__cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) { window.__lcp = entry.startTime; window.__lcpUrl = entry.url || entry.element?.tagName || ''; }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });`,
    });
    await send('Page.navigate', { url: BASE + route });
    await sleep(14000);
    const read = await send('Runtime.evaluate', {
      expression: 'JSON.stringify({ lcp: window.__lcp, lcpUrl: window.__lcpUrl, cls: window.__cls })',
      returnByValue: true,
    });
    const { lcp, lcpUrl, cls } = JSON.parse(read.result.value);
    ws.close();

    let total = 0;
    let largestImage = { bytes: 0, url: '' };
    for (const request of requests.values()) {
      const path = new URL(request.url).pathname;
      const file = join(DIST, path === '/' || !path.includes('.') ? 'index.html' : decodeURIComponent(path));
      const text = ['Script', 'Stylesheet', 'Document'].includes(request.type);
      const bytes = text && existsSync(file) ? gzipSync(readFileSync(file)).length : request.bytes;
      total += bytes;
      if (request.type === 'Image' && bytes > largestImage.bytes) largestImage = { bytes, url: path };
    }
    return { route, lcp, lcpUrl, cls, total, largestImage, requests: requests.size };
  } finally {
    try {
      execFileSync('taskkill', ['/PID', String(edge.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Already gone.
    }
    try {
      execFileSync(
        'powershell',
        ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${basename(profile)}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`],
        { stdio: 'ignore' },
      );
    } catch {
      // Nothing left to stop.
    }
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // A locked profile folder is not worth failing over.
    }
  }
}

let failed = false;
for (const route of routes) {
  const result = await measure(route);
  const checks = [
    ['largest contentful paint', `${(result.lcp / 1000).toFixed(2)} s`, result.lcp <= BUDGET.lcpMs, `${BUDGET.lcpMs / 1000} s`],
    ['layout shift', result.cls.toFixed(3), result.cls <= BUDGET.cls, String(BUDGET.cls)],
    ['transferred before scrolling', kb(result.total), result.total <= BUDGET.totalBytes, kb(BUDGET.totalBytes)],
    ['largest image', `${kb(result.largestImage.bytes)} ${result.largestImage.url}`, result.largestImage.bytes <= BUDGET.imageBytes, kb(BUDGET.imageBytes)],
  ];
  console.log(`\n${route}  (${result.requests} requests, LCP element: ${result.lcpUrl || 'text'})`);
  for (const [name, value, ok, budget] of checks) {
    console.log(`  ${ok ? 'ok  ' : 'OVER'}  ${name.padEnd(30)} ${value}  (budget ${budget})`);
    if (!ok) failed = true;
  }
}
process.exit(failed ? 1 : 0);
