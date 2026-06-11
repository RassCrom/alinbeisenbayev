#!/usr/bin/env node
/**
 * Fetch blog posts from YouTube and Telegram into src/data/blog.json
 *
 * Usage:
 *   node scripts/fetch-blog.mjs
 *
 * Requirements: Node 18+ (uses built-in fetch + fs).
 * No npm packages needed.
 *
 * Edit CONFIG below, then run the script whenever you want to refresh posts.
 * Already-saved entries (same id) are never duplicated.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOG_JSON = resolve(__dirname, '../src/data/blog.json');

// ─── CONFIG — fill these in ───────────────────────────────────────────────────

const CONFIG = {
  youtube: {
    /** Your YouTube channel ID (starts with UC…).
     *  Find it at youtube.com → your channel → About → Share → Copy channel ID */
    channelId: '',
    /** The @handle shown on posts, e.g. "tulparstories" */
    account: 'tulparstories',
    maxItems: 30,
  },
  telegram: {
    /** Public channel username without @, e.g. "tulparmaps" */
    channelName: '',
    /** The label shown on posts */
    account: 'tulparmaps',
    /**
     * RSSHub base URL.  Options:
     *   - Public instance (rate-limited): https://rsshub.app
     *   - Self-hosted:                    http://localhost:1200
     *   - Other public mirrors:           https://rsshub.rssforever.com
     */
    rsshubBase: 'https://rsshub.app',
    maxItems: 30,
  },
};

// ─── XML helpers (no external parser needed) ──────────────────────────────────

function allBlocks(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function firstTag(xml, tag) {
  return allBlocks(xml, tag)[0]?.trim() ?? null;
}

function attr(xml, tag, attribute) {
  const re = new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]*)"`, 'i');
  return xml.match(re)?.[1] ?? null;
}

function stripCdata(s) {
  return s?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() ?? s;
}

function stripHtml(s) {
  return s?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

async function fetchYouTube() {
  const { channelId, account, maxItems } = CONFIG.youtube;
  if (!channelId) {
    console.warn('⚠  YouTube: channelId not set in CONFIG — skipping.');
    return [];
  }

  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  console.log(`▶ YouTube  ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube RSS responded ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const entries = [];
  for (const block of allBlocks(xml, 'entry').slice(0, maxItems)) {
    const rawId   = firstTag(block, 'yt:videoId') ?? firstTag(block, 'id') ?? '';
    const videoId = rawId.replace('yt:video:', '');
    if (!videoId) continue;

    const title       = stripCdata(firstTag(block, 'title') ?? '');
    const published   = firstTag(block, 'published') ?? '';
    const description = stripCdata(firstTag(block, 'media:description') ?? '');
    const thumbnail   = attr(block, 'media:thumbnail', 'url')
                        ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const videoUrl    = `https://www.youtube.com/watch?v=${videoId}`;

    entries.push({
      id: `yt-${videoId}`,
      account,
      platform: 'youtube',
      type: 'video',
      title,
      description: description.slice(0, 400) || undefined,
      thumbnailUrl: thumbnail,
      videoUrl,
      url: videoUrl,
      date: published.slice(0, 10),
    });
  }

  console.log(`  ✓ ${entries.length} videos`);
  return entries;
}

// ─── Telegram (via RSSHub) ────────────────────────────────────────────────────

async function fetchTelegram() {
  const { channelName, account, rsshubBase, maxItems } = CONFIG.telegram;
  if (!channelName) {
    console.warn('⚠  Telegram: channelName not set in CONFIG — skipping.');
    return [];
  }

  const url = `${rsshubBase}/telegram/channel/${channelName}`;
  console.log(`▶ Telegram ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'portfolio-fetch-blog/1.0' },
  });
  if (!res.ok) throw new Error(`Telegram RSSHub responded ${res.status} ${res.statusText}`);
  const xml = await res.text();

  const entries = [];
  for (const block of allBlocks(xml, 'item').slice(0, maxItems)) {
    const link    = stripCdata(firstTag(block, 'link') ?? '');
    const title   = stripCdata(firstTag(block, 'title') ?? 'Telegram post');
    const desc    = stripHtml(stripCdata(firstTag(block, 'description') ?? ''));
    const pubDate = firstTag(block, 'pubDate') ?? '';
    const imgUrl  = attr(block, 'media:content', 'url')
                    ?? attr(block, 'media:thumbnail', 'url')
                    ?? null;

    // Telegram links look like https://t.me/channel/1234
    const msgId = link.split('/').filter(Boolean).pop() ?? String(Date.now());

    entries.push({
      id: `tg-${channelName}-${msgId}`,
      account,
      platform: 'telegram',
      type: 'post',
      title: title.slice(0, 120),
      text: desc.slice(0, 500) || undefined,
      previewImage: imgUrl ?? undefined,
      url: link,
      date: pubDate ? new Date(pubDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
  }

  console.log(`  ✓ ${entries.length} posts`);
  return entries;
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

function mergeById(fetched, existing) {
  const fetchedIds = new Set(fetched.map((e) => e.id));
  const kept = existing.filter((e) => !fetchedIds.has(e.id));
  return [...fetched, ...kept].sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const current = JSON.parse(readFileSync(BLOG_JSON, 'utf8'));

  const [ytNew, tgNew] = await Promise.all([
    fetchYouTube().catch((e) => { console.error('YouTube error:', e.message); return []; }),
    fetchTelegram().catch((e) => { console.error('Telegram error:', e.message); return []; }),
  ]);

  const updated = {
    feeds: {
      youtube:  mergeById(ytNew, current.feeds.youtube  ?? []),
      telegram: mergeById(tgNew, current.feeds.telegram ?? []),
    },
  };

  writeFileSync(BLOG_JSON, JSON.stringify(updated, null, 2) + '\n');

  console.log(
    `\n✓ blog.json updated — ${updated.feeds.youtube.length} YouTube, ${updated.feeds.telegram.length} Telegram`,
  );
}

main().catch((e) => { console.error('\n✗', e.message); process.exit(1); });
