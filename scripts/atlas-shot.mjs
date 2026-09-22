/*
 * Screenshot a route with headless Edge driven over the DevTools protocol,
 * in real time. Edge's own `--screenshot` cannot capture the atlas: with
 * `--virtual-time-budget` its clock outruns the image decode (the map is
 * still "Drawing the map…" or its textures are black) and without it the
 * frame loop never runs. This waits until the atlas reports ready and the
 * first-visit arrival has finished, lets the fades settle, then captures.
 *
 *   node scripts/atlas-shot.mjs <url> <out.png> [--width 1920] [--height 1080]
 *        [--settle 1600] [--timeout 30000] [--edge <path to msedge.exe>] [--software]
 *
 * By default the real GPU draws; `--software` switches to SwiftShader, which
 * works on a machine without one but is slow enough at 1920 px that the
 * compositor can miss a DOM layer in the capture.
 *
 * Every run uses a fresh profile, so localStorage starts empty: the
 * first-visit flight and the explainer show unless the URL's dev hooks say
 * otherwise (see the dev-only hooks in src/atlas/AtlasView.tsx).
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const VALUED = new Set(['--width', '--height', '--settle', '--timeout', '--edge']);
const positional = args.filter((arg, index) => !arg.startsWith('--') && (index === 0 || !VALUED.has(args[index - 1])));
const [url, out] = positional;
if (!url || !out) {
  console.error('usage: node scripts/atlas-shot.mjs <url> <out.png> [--width W] [--height H] [--settle ms] [--timeout ms]');
  process.exit(2);
}
const width = Number(flag('width', 1920));
const height = Number(flag('height', 1080));
const settle = Number(flag('settle', 1600));
const timeout = Number(flag('timeout', 30000));
const edge = flag('edge', process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const software = args.includes('--software');

const READY = `(() => {
  const view = document.querySelector('[data-atlas-status]');
  if (!view) return document.readyState === 'complete' && !document.querySelector('.animate-pulse');
  return view.dataset.atlasStatus === 'ready' && !view.classList.contains('is-arriving');
})()`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), 'atlas-shot-'));
const child = spawn(
  edge,
  [
    '--headless=new', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    ...(software ? ['--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : []),
    `--window-size=${width},${height}`, `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
const finish = (code) => {
  child.kill();
  setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
  process.exitCode = code;
};

try {
  const browserWs = await new Promise((resolve, reject) => {
    let text = '';
    child.stderr.on('data', (chunk) => {
      text += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(text);
      if (match) resolve(match[1]);
    });
    child.on('exit', (code) => reject(new Error(`Edge exited with ${code} before DevTools was up`)));
    setTimeout(() => reject(new Error('DevTools did not come up in 20 s')), 20000);
  });
  const port = new URL(browserWs).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('could not open the DevTools socket'));
  });
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  const deadline = Date.now() + timeout;
  let ready = false;
  while (Date.now() < deadline) {
    const { result } = await send('Runtime.evaluate', { expression: READY, returnByValue: true });
    if (result?.value === true) {
      ready = true;
      break;
    }
    await sleep(250);
  }
  if (!ready) console.warn(`atlas-shot: not ready after ${timeout} ms; capturing anyway`);
  await sleep(settle);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`wrote ${out} (${ready ? 'ready' : 'timed out'})`);
  ws.close();
  finish(0);
} catch (error) {
  console.error(`atlas-shot: ${error instanceof Error ? error.message : String(error)}`);
  finish(1);
}
