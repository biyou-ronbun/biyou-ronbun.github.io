// ---------------------------------------------------------------
//  X（旧Twitter）に自動投稿する
//
//    node auto/post-x.mjs           予定時刻を過ぎた投稿を出す
//    node auto/post-x.mjs --dry     出さずに、何を出すかだけ表示する
//    node auto/post-x.mjs --next    次に出る予定を表示する
//
//  予定表: x/queue.json
//  鍵    : auto/.env（絶対に git に入れないこと。.gitignore 済み）
//
//  ★ X の開発者ポリシー
//    「APIで動くbotアカウントは、それが何であり誰が責任者かを明示すること」
//    プロフィール（bio）に、自動投稿を含む旨を書いてください。
//
//  ★ 重複投稿の禁止
//    同じ内容・実質的に似た内容を繰り返し投稿するのは、Xの自動化ポリシー違反です。
//    このスクリプトは、一度出した投稿を二度と出しません（status で管理）。
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes } from 'node:crypto';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const QUEUE = join(ROOT, 'x', 'queue.json');
const ENV = join(ROOT, 'auto', '.env');

const dry = process.argv.includes('--dry');
const showNext = process.argv.includes('--next');

// ---- 鍵を読む -----------------------------------------------------

function loadEnv() {
  if (!existsSync(ENV)) {
    console.error('');
    console.error('鍵がありません: auto/.env');
    console.error('');
    console.error('X の開発者ポータル（https://developer.x.com/）でアプリを作り、');
    console.error('次の4つを auto/.env に書いてください:');
    console.error('');
    console.error('  X_API_KEY=...');
    console.error('  X_API_SECRET=...');
    console.error('  X_ACCESS_TOKEN=...');
    console.error('  X_ACCESS_TOKEN_SECRET=...');
    console.error('');
    console.error('※ アプリの権限は「Read and write」にすること');
    console.error('※ このファイルは絶対に git に入れないこと（.gitignore 済み）');
    process.exit(1);
  }

  const env = {};
  for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2];
  }

  const need = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
  const missing = need.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`auto/.env に足りない項目があります: ${missing.join(', ')}`);
    process.exit(1);
  }
  return env;
}

// ---- OAuth 1.0a の署名 ---------------------------------------------
//
// X の公式ドキュメントの手順どおり。
// 重要: JSON のボディや multipart のボディは署名に含めない。oauth_* だけ。

const enc = (s) =>
  encodeURIComponent(String(s)).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

function authHeader(method, url, cred) {
  const oauth = {
    oauth_consumer_key: cred.X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: cred.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(oauth)
    .map((k) => [enc(k), enc(oauth[k])])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&');
  const key = `${enc(cred.X_API_SECRET)}&${enc(cred.X_ACCESS_TOKEN_SECRET)}`;

  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64');

  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${enc(k)}="${enc(oauth[k])}"`)
      .join(', ')
  );
}

// ---- 画像をアップロードする ------------------------------------------

async function uploadMedia(path, cred) {
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const bytes = readFileSync(path);

  const form = new FormData();
  form.append('media', new Blob([bytes], { type: 'image/jpeg' }), 'card.jpg');

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url, cred) },
    body: form,
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`画像のアップロードに失敗 (${res.status}): ${body}`);

  const json = JSON.parse(body);
  return json.media_id_string;
}

// ---- 投稿する -------------------------------------------------------

async function postTweet(text, mediaId, replyTo, cred) {
  const url = 'https://api.x.com/2/tweets';

  const payload = { text };
  if (mediaId) payload.media = { media_ids: [mediaId] };
  if (replyTo) payload.reply = { in_reply_to_tweet_id: replyTo };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader('POST', url, cred),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`投稿に失敗 (${res.status}): ${body}`);

  return JSON.parse(body).data.id;
}

// ---- 文字数を数える（Xの数え方） --------------------------------------
//
// 日本語は1文字＝2カウント、URLは長さに関わらず23カウント固定、上限280。

function countX(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, '');
  const urls = (text.match(/https?:\/\/\S+/g) ?? []).length;

  let n = 0;
  for (const ch of withoutUrls) {
    const code = ch.codePointAt(0);
    // 半角英数字・記号は1、それ以外（日本語・絵文字）は2
    n += code >= 0x0000 && code <= 0x10ff ? 1 : 2;
  }
  return n + urls * 23;
}

// ---- 本体 -----------------------------------------------------------

if (!existsSync(QUEUE)) {
  console.error(`予定表がありません: ${QUEUE}`);
  process.exit(1);
}

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));
const now = new Date();

const pending = queue.posts.filter((p) => p.status === 'pending');

// スレッド（連投）の続きは、単独では出さない。
// 親を出した直後に、同じ実行の中で続けて出す。
// そうしないと、1時間おきの実行で連投がバラバラの時刻に散らばってしまう。
const isThreadChild = (p) => Boolean(p.replyToLocalId);
const childOf = (id) => queue.posts.find((p) => p.status === 'pending' && p.replyToLocalId === id);

const due = pending.filter((p) => !isThreadChild(p) && new Date(p.at) <= now);

// スレッドの長さを数える
const threadLen = (p) => {
  let n = 1;
  let cur = p;
  while (n < 13) {
    const c = childOf(cur.id);
    if (!c) break;
    n++;
    cur = c;
  }
  return n;
};

if (showNext) {
  const roots = pending.filter((p) => !isThreadChild(p)).sort((a, b) => (a.at < b.at ? -1 : 1));
  console.log(`未投稿: ${pending.length} 件（うち独立した投稿 ${roots.length} 件）\n`);
  for (const p of roots.slice(0, 8)) {
    const len = threadLen(p);
    const tag = len > 1 ? `[連投${len}] ` : p.image ? '[画像] ' : '';
    console.log(`${p.at}  ${tag}${p.text.split('\n')[0]}`);
  }
  process.exit(0);
}

if (due.length === 0) {
  console.log(`出す予定の投稿はありません（未投稿 ${pending.length} 件）`);
  process.exit(0);
}

// 一度にたくさん出すとスパム判定されるので、1回の実行で最大2件まで。
// ただしスレッドの続きは、この2件には数えない（連投は1つのまとまりとして出す）。
const batch = due.sort((a, b) => (a.at < b.at ? -1 : 1)).slice(0, 2);

if (dry) {
  console.log(`--dry: 実際には投稿しません\n`);
  for (const p of batch) {
    console.log('─'.repeat(50));
    console.log(`予定: ${p.at}`);
    const len = threadLen(p);
    if (len > 1) console.log(`連投: ${len} ポスト`);

    let cur = p;
    let i = 1;
    while (cur) {
      if (len > 1) console.log(`\n  ── ${i}/${len} ──`);
      if (cur.image) console.log(`  画像: ${cur.image}`);
      console.log(`  文字数: ${countX(cur.text)} / 280`);
      console.log('');
      console.log(cur.text.split('\n').map((l) => '  ' + l).join('\n'));
      cur = childOf(cur.id);
      i++;
    }
  }
  console.log('─'.repeat(50));
  process.exit(0);
}

// ---- 関門。ここを通らないものは、1本も出さない ----------------------
//
// 記事は verify.mjs が止められます。X には、その関門がありませんでした。
// そして X の投稿は記事より危ない。取り消せず、短いので「ここまでは言えません」が
// 削られやすく、伸ばそうとすると断定に寄る力が働くからです。
//
// ★ 1本でも落ちたら、その回は何も出しません（落ちた1本だけを飛ばさない）。
//   「悪い1本を黙って飛ばして、良い1本だけ出す」は、問題を見えなくするだけです。

{
  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync(process.execPath, [join(ROOT, 'auto', 'verify-x.mjs')], { stdio: 'inherit' });
  } catch {
    console.error('');
    console.error('検査に落ちたので、この回は1本も投稿しません。');
    process.exit(1);
  }
}

const cred = loadEnv();
let posted = 0;

// 1本出す。スレッドの続きがあれば、そのまま繋げて出す。
async function publish(p, replyToTweetId) {
  const n = countX(p.text);
  if (n > 280) {
    console.error(`✗ ${p.id}: 文字数超過（${n} / 280）。投稿しません`);
    p.status = 'failed';
    p.error = `文字数超過 ${n}`;
    return null;
  }

  let mediaId = null;
  if (p.image) {
    const imgPath = join(ROOT, p.image);
    if (!existsSync(imgPath)) throw new Error(`画像がありません: ${p.image}`);
    mediaId = await uploadMedia(imgPath, cred);
  }

  const id = await postTweet(p.text, mediaId, replyToTweetId ?? p.replyTo ?? null, cred);

  p.status = 'posted';
  p.postedAt = new Date().toISOString();
  p.tweetId = id;

  console.log(`✓ ${replyToTweetId ? '  └ 続き' : '投稿'}: https://x.com/biyouron/status/${id}`);
  console.log(`   ${p.text.split('\n')[0]}`);
  posted++;
  return id;
}

for (const p of batch) {
  try {
    let parentId = await publish(p, null);
    if (!parentId) continue;

    // スレッドの続きを、そのまま繋げて出す
    let parent = p;
    let guard = 0;
    while (guard++ < 12) {
      const child = childOf(parent.id);
      if (!child) break;
      parentId = await publish(child, parentId);
      if (!parentId) break;
      parent = child;
    }
  } catch (e) {
    p.status = 'failed';
    p.error = e.message;
    console.error(`✗ ${p.id}: ${e.message}`);
  }
}

writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + '\n', 'utf8');

console.log('');
console.log(`${posted} 件を投稿しました。未投稿は残り ${queue.posts.filter((p) => p.status === 'pending').length} 件です。`);
