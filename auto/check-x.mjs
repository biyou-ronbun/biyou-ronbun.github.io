// X のキーが有効か、書き込み権限があるかを確認する（投稿はしない）
//
//   node auto/check-x.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes } from 'node:crypto';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENV = join(ROOT, 'auto', '.env');

if (!existsSync(ENV)) {
  console.error('auto/.env がありません');
  process.exit(1);
}

const cred = {};
for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) cred[m[1]] = m[2];
}

const enc = (s) =>
  encodeURIComponent(String(s)).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );

function authHeader(method, url) {
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
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
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

// 1. キーが有効か（自分のアカウント情報を取る。読み取りだけ）
const url = 'https://api.x.com/2/users/me';
const res = await fetch(url, { headers: { Authorization: authHeader('GET', url) } });
const body = await res.text();

if (!res.ok) {
  console.error('');
  console.error(`✗ キーが使えません (HTTP ${res.status})`);
  console.error(body);
  console.error('');
  if (res.status === 401) {
    console.error('  → キーが間違っているか、コピーミスの可能性があります。');
  }
  process.exit(1);
}

const me = JSON.parse(body).data;
console.log('');
console.log(`✓ キーは有効です`);
console.log(`  アカウント: @${me.username}（${me.name}）`);

// 2. 書き込み権限があるか
// OAuth 1.0a の Access Token は、権限を変えた後に再生成しないと書き込めない。
// ここでは実際に投稿せず、権限のヒントだけ確認する。
console.log('');
console.log('  ※ 書き込み権限は、実際に投稿してみるまで確定的には分かりません。');
console.log('     アプリの権限が「Read and write」で、その後に Access Token を');
console.log('     再生成していれば、投稿できます。');
console.log('');
