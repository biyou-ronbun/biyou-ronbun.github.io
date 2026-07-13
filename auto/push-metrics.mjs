// ---------------------------------------------------------------
//  配信の購読者数を測る（X / note / はてな）
//
//    node auto/push-metrics.mjs
//
//  ---------------------------------------------------------------
//  ★★ なぜ「再訪率」ではなく「購読者数」を測るのか
//
//    **再訪率は、原理的に測れません。**
//
//    うちの解析（Cloudflare Web Analytics）は Cookie を使いません。
//    同意バナーを出さないために、そう選びました。
//    **Cookie が無ければ、「同じ人が戻ってきた」ことは分かりません。**
//
//    **測れない数字を改善目標にすると、機械は必ず数字を捏造します。**
//
//  ★ そして、調査の結論はこうでした
//
//    商品を勧めない媒体を4つ実際に開いて調べた結果——
//    **再訪の理由が、コンテンツの中にあった例はゼロ。**
//    観測できたのは ①配信（push） ②読者自身の次の疑問 の2つだけ。
//
//    **「読者が喜ぶページを1枚足す」は、再訪の打ち手ではありません。**
//
//  ★★ 測れるものと、効くものが、一致しています
//
//    効くのは push。そして push の購読者数は、測れます。
//    **だから、目標を「再訪」ではなく「購読者」にします。**
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes } from 'node:crypto';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'ops', 'push-metrics.json');

const DRY = process.argv.includes('--dry');

const env = {};
if (existsSync(join(ROOT, 'auto', '.env'))) {
  for (const l of readFileSync(join(ROOT, 'auto', '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
}

const enc = (s) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function oauth(method, url, extra = {}) {
  const p = {
    oauth_consumer_key: env.X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
    ...extra,
  };
  const base = [
    method,
    enc(url),
    enc(Object.keys(p).sort().map((k) => `${enc(k)}=${enc(p[k])}`).join('&')),
  ].join('&');
  const key = `${enc(env.X_API_SECRET)}&${enc(env.X_ACCESS_TOKEN_SECRET)}`;
  p.oauth_signature = createHmac('sha1', key).update(base).digest('base64');
  return (
    'OAuth ' +
    Object.keys(p)
      .filter((k) => k.startsWith('oauth_'))
      .sort()
      .map((k) => `${enc(k)}="${enc(p[k])}"`)
      .join(', ')
  );
}

// ★ 取れなかったものは null。**0 と書かない。**
//   「0人だった」と「数えられなかった」は、別の事実です（CLAUDE.md ルール4）。
const result = { date: new Date().toISOString().slice(0, 10), x: null, note: null, hatena: null };

// ---- X ---------------------------------------------------------------
if (env.X_API_KEY) {
  try {
    const url = 'https://api.twitter.com/2/users/me';
    const q = 'user.fields=public_metrics';
    const r = await fetch(`${url}?${q}`, {
      headers: { Authorization: oauth('GET', url, Object.fromEntries(new URLSearchParams(q))) },
    }).then((r) => r.json());
    const m = r.data?.public_metrics;
    if (m) result.x = { followers: m.followers_count, posts: m.tweet_count };
  } catch {
    /* null のまま */
  }
}

// ---- note ------------------------------------------------------------
try {
  const r = await fetch('https://note.com/api/v2/creators/biyouron_1056', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then((r) => r.json());
  const d = r.data;
  if (d && typeof d.followerCount === 'number') {
    result.note = { followers: d.followerCount, posts: d.noteCount ?? null };
  }
} catch {
  /* null のまま */
}

// ---- はてな -----------------------------------------------------------
//
// ★ 最初の実装は「2026人が読者」と出しました。**西暦の 2026 を拾っただけでした。**
//   実際は 0 人です。
//   **ゆるい正規表現は、平気で嘘の数字を作ります。**
//   だから「◯人が読者」という**厳密な形**でしか取りません。取れなければ null。
try {
  const html = await fetch('https://biyouronbun.hatenablog.com/', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then((r) => r.text());
  const m = html.match(/([\d,]+)\s*人が読者/);
  if (m) result.hatena = { readers: Number(m[1].replace(/,/g, '')) };
} catch {
  /* null のまま */
}

// ---- 結果 -------------------------------------------------------------

const show = (v, label) =>
  v === null ? `**取得失敗**` : `${v} ${label}`;

console.log('');
console.log('配信の購読者（★ 再訪率は、Cookie を使っていないので原理的に測れません）');
console.log('='.repeat(56));
console.log(`  X       : ${result.x ? `${result.x.followers} フォロワー（投稿 ${result.x.posts}）` : '**取得失敗**'}`);
console.log(`  note    : ${result.note ? `${result.note.followers} フォロワー（記事 ${result.note.posts}）` : '**取得失敗**'}`);
console.log(`  はてな   : ${result.hatena ? `${result.hatena.readers} 読者` : '**取得失敗**（読者0のときは表示が出ないため）'}`);
console.log('');

if (DRY) {
  console.log('--dry なので、記録しませんでした');
  process.exit(0);
}

const history = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : [];
history.push(result);
writeFileSync(OUT, JSON.stringify(history, null, 2) + '\n', 'utf8');

console.log(`  → ${OUT} に記録しました`);
console.log('');
