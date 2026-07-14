// ---------------------------------------------------------------
//  Threads の鍵を取る（★ オーナーが1回だけ実行する）
//
//      ① node auto/threads-auth.mjs url        ← ブラウザで開くURLを出す
//      ② （ブラウザで承認 → 戻り先のURLに ?code=... が付く）
//      ③ node auto/threads-auth.mjs <code>     ← 鍵を取って auto/.env に書く
//
//  ---------------------------------------------------------------
//  ★★ X との決定的な違い: **Threads の鍵は 60日で死ぬ。**
//
//    X の鍵（OAuth 1.0a）は失効しない。だから「一度置けば回る」で成立している。
//    **Threads はその前提が崩れる。**
//
//    ・長期トークンは 60日 有効
//    ・24時間以上経過してから、失効前に更新できる
//    ・**60日更新しないと失効し、二度と更新できない**（ブラウザで最初からやり直し）
//
//    → auto/threads.mjs が、投稿のたびに更新の要否を見る。**サボると止まる。**
//
//  ★ 一次情報:
//    https://developers.facebook.com/docs/threads/get-started
//    https://developers.facebook.com/docs/threads/get-started/long-lived-tokens
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV = join(ROOT, 'auto', '.env');

const env = {};
if (existsSync(ENV)) {
  for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// ★ Meta アプリの「Threads app ID」と「Threads app secret」を使うこと。
//   （アプリを作ると ID が2つ出る。**Threads 用のほうを使う。** 公式に明記あり）
const APP_ID = env.THREADS_APP_ID;
const APP_SECRET = env.THREADS_APP_SECRET;

// 承認後の戻り先。**https でなければならない。**
// うちのサイトを使う（サーバーは要らない。URL に ?code=... が付いて表示されるだけ）
const REDIRECT = env.THREADS_REDIRECT_URI || 'https://biyou-ronbun.com/';

const SCOPES = ['threads_basic', 'threads_content_publish', 'threads_manage_insights'];

const die = (msg) => {
  console.error('');
  console.error('★ ' + msg);
  console.error('');
  process.exit(1);
};

if (!APP_ID || !APP_SECRET) {
  die(
    'auto/.env に THREADS_APP_ID と THREADS_APP_SECRET がありません。\n' +
      '  Meta アプリの「Threads app ID」と「Threads app secret」を入れてください。\n' +
      '  ★ アプリを作ると ID が2つ出ます。**Threads 用のほう**です。'
  );
}

const arg = process.argv[2];

// ---- ① ブラウザで開く URL を出す -----------------------------------------

if (arg === 'url') {
  const url =
    'https://threads.net/oauth/authorize' +
    `?client_id=${encodeURIComponent(APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&scope=${encodeURIComponent(SCOPES.join(','))}` +
    '&response_type=code';

  console.log('');
  console.log('=== ① このURLを、ブラウザで開いてください ===');
  console.log('');
  console.log(url);
  console.log('');
  console.log('=== ② 承認すると、こういうURLに飛ばされます ===');
  console.log('');
  console.log(`  ${REDIRECT}?code=AQxxxxxxxxxx...#_`);
  console.log('');
  console.log('  ★ ページは「見つかりません」でも構いません。**URL の code= の中身だけが要ります。**');
  console.log('  ★ 末尾の "#_" は含めないでください。');
  console.log('');
  console.log('=== ③ その code を、これで渡してください ===');
  console.log('');
  console.log('  node auto/threads-auth.mjs <code>');
  console.log('');
  process.exit(0);
}

if (!arg) {
  die('使い方:\n  node auto/threads-auth.mjs url      ← まずこれ\n  node auto/threads-auth.mjs <code>   ← 次にこれ');
}

// ---- ③ code → 短期トークン → 長期トークン --------------------------------

const code = arg.replace(/#_$/, '').trim();

console.log('');
console.log('短期トークンを取ります…');

const form = new URLSearchParams({
  client_id: APP_ID,
  client_secret: APP_SECRET,
  grant_type: 'authorization_code',
  redirect_uri: REDIRECT,
  code,
});

const r1 = await fetch('https://graph.threads.net/oauth/access_token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: form,
});
const j1 = await r1.json();

if (!r1.ok || !j1.access_token) {
  die('短期トークンが取れませんでした:\n  ' + JSON.stringify(j1));
}

console.log('  取れました（user_id: ' + j1.user_id + '）');
console.log('');
console.log('長期トークン（60日）に交換します…');

const url2 =
  'https://graph.threads.net/access_token' +
  '?grant_type=th_exchange_token' +
  `&client_secret=${encodeURIComponent(APP_SECRET)}` +
  `&access_token=${encodeURIComponent(j1.access_token)}`;

const r2 = await fetch(url2);
const j2 = await r2.json();

if (!r2.ok || !j2.access_token) {
  die('長期トークンが取れませんでした:\n  ' + JSON.stringify(j2));
}

const days = Math.round((j2.expires_in ?? 0) / 86400);
console.log(`  取れました（${days} 日 有効）`);

// ---- auto/.env に書く ----------------------------------------------------
//
// ★ 秘密は auto/.env にだけ置く（.gitignore 済み）。**リポジトリは公開です。**

const now = new Date().toISOString().slice(0, 10);
let text = existsSync(ENV) ? readFileSync(ENV, 'utf8') : '';

const put = (key, val) => {
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (re.test(text)) text = text.replace(re, `${key}=${val}`);
  else text += (text.endsWith('\n') || !text ? '' : '\n') + `${key}=${val}\n`;
};

put('THREADS_ACCESS_TOKEN', j2.access_token);
put('THREADS_USER_ID', j1.user_id);
put('THREADS_TOKEN_AT', now); // ★ いつ取ったか。更新の要否を判断するのに使う

writeFileSync(ENV, text, 'utf8');

console.log('');
console.log('auto/.env に書きました:');
console.log('  THREADS_ACCESS_TOKEN  （' + days + ' 日 有効）');
console.log('  THREADS_USER_ID       ' + j1.user_id);
console.log('  THREADS_TOKEN_AT      ' + now);
console.log('');
console.log('★★ この鍵は 60日で死にます。');
console.log('   auto/threads.mjs が、投稿のたびに更新します。');
console.log('   **60日、一度も更新しないと失効し、この手順を最初からやり直しになります。**');
console.log('');
