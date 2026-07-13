// うち自身の X 投稿の数字を、公式APIから取る。
//
// ★★ なぜ「他人の投稿の研究」をやめて、これにしたのか
//
//   X の投稿は、この環境から**1ページも読めません**（ログインの壁 / 検索APIは月200ドル）。
//   benchmark/x-playbook.md の冒頭に、そう書いてあります。
//
//   **読めないのに「伸びている型を研究しろ」と毎週命じられた機械は、記憶から捏造します。**
//   そして CLAUDE.md が警告しているとおりになります:
//
//     「伸びている投稿」を毎週取り込み続けると、**必ず煽りに寄る。**
//     **このアカウントは数か月で、うちが批判している側と同じものになる。**
//
//   **だから、研究の対象を「他人の煽り」から「うちの実測値」に変えました。**
//
// ★ そして、数字がすべて 0 なら、Claude を呼びません。
//   **データが無いときに「分析しろ」と言われた機械は、必ず推測でデータを作るからです。**
//   （需要の輪〈auto/demand.ps1〉と、まったく同じ構造です）
//
// 使い方:
//   node auto/x-metrics.mjs
//     終了コード 10 = 分析する材料がある（Claude を呼んでよい）
//     終了コード  0 = 全部ゼロ。**Claude を呼ばずに終わること**
//     終了コード  1 = 取得失敗。**「0だった」ではない**

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomBytes } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const env = {};
try {
  for (const l of readFileSync(join(ROOT, 'auto', '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  console.log('★ auto/.env が読めません');
  process.exit(1);
}

const KEY = env.X_API_KEY ?? env.X_CONSUMER_KEY;
const SECRET = env.X_API_SECRET ?? env.X_CONSUMER_SECRET;
const TOKEN = env.X_ACCESS_TOKEN;
const TOKEN_SECRET = env.X_ACCESS_TOKEN_SECRET;

if (!KEY || !SECRET || !TOKEN || !TOKEN_SECRET) {
  console.log('★ X の鍵が揃っていません（auto/.env）');
  process.exit(1);
}

const enc = (s) =>
  encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method, url, params) {
  const oauth = {
    oauth_consumer_key: KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: TOKEN,
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const base = [
    method.toUpperCase(),
    enc(url),
    enc(
      Object.keys(all)
        .sort()
        .map((k) => `${enc(k)}=${enc(all[k])}`)
        .join('&')
    ),
  ].join('&');
  oauth.oauth_signature = createHmac('sha1', `${enc(SECRET)}&${enc(TOKEN_SECRET)}`)
    .update(base)
    .digest('base64');
  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${enc(k)}="${enc(oauth[k])}"`)
      .join(', ')
  );
}

async function get(url, params = {}) {
  const qs = Object.keys(params)
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join('&');
  const r = await fetch(qs ? `${url}?${qs}` : url, {
    headers: { Authorization: authHeader('GET', url, params) },
  });
  return { status: r.status, text: await r.text() };
}

// ---- 取る --------------------------------------------------------

const meRes = await get('https://api.x.com/2/users/me', { 'user.fields': 'public_metrics' });
if (meRes.status !== 200) {
  // ★ 取れなかったときは「取得失敗」と書く。**0 と書かない。**（CLAUDE.md 第4条）
  console.log(`★ 取得失敗: /2/users/me が ${meRes.status} を返しました`);
  console.log(`   ${meRes.text.slice(0, 200)}`);
  console.log('');
  console.log('   **「取得失敗」です。「0だった」ではありません。**');
  process.exit(1);
}

const me = JSON.parse(meRes.text).data;
const followers = me.public_metrics?.followers_count;

const twRes = await get(`https://api.x.com/2/users/${me.id}/tweets`, {
  max_results: '100',
  'tweet.fields': 'public_metrics,created_at',
});
if (twRes.status !== 200) {
  console.log(`★ 取得失敗: 投稿一覧が ${twRes.status} を返しました`);
  console.log(`   ${twRes.text.slice(0, 200)}`);
  process.exit(1);
}

const tweets = JSON.parse(twRes.text).data ?? [];

// ---- 数える ------------------------------------------------------

const sum = (f) => tweets.reduce((a, t) => a + (t.public_metrics?.[f] ?? 0), 0);
const imp = sum('impression_count');
const likes = sum('like_count');
const rts = sum('retweet_count');
const replies = sum('reply_count');
const total = imp + likes + rts + replies;

const line = '='.repeat(58);
console.log(line);
console.log(`  @${me.username}`);
console.log(line);
console.log(`  フォロワー           : ${followers} 人`);
console.log(`  取れた投稿           : ${tweets.length} 件`);
console.log('');
console.log(`  インプレッション合計 : ${imp}`);
console.log(`  いいね合計           : ${likes}`);
console.log(`  リポスト合計         : ${rts}`);
console.log(`  返信合計             : ${replies}`);
console.log(line);

// ---- 書く --------------------------------------------------------

const top = [...tweets]
  .sort(
    (a, b) => (b.public_metrics?.impression_count ?? 0) - (a.public_metrics?.impression_count ?? 0)
  )
  .slice(0, 10);

const md = [
  '# X の実測値（公式APIから機械が取得）',
  '',
  '**このファイルは機械が毎回まるごと書き直します。手で編集しないでください。**',
  '',
  `- アカウント: @${me.username}`,
  `- **フォロワー: ${followers} 人**`,
  `- 取れた投稿: ${tweets.length} 件`,
  '',
  '| | |',
  '|---|---|',
  `| インプレッション合計 | **${imp}** |`,
  `| いいね合計 | ${likes} |`,
  `| リポスト合計 | ${rts} |`,
  `| 返信合計 | ${replies} |`,
  '',
];

if (total === 0) {
  md.push('---', '', '## ★ すべて 0 です', '');
  md.push('**投稿の仕組みは動いています。届いている人が 0 人です。**', '');
  md.push('**この状態で「伸びる型」を研究しても、材料がありません。**');
  md.push('**材料が無いのに分析させると、機械は推測でデータを作ります。**');
  md.push('**そして「伸びる型」として煽りを学習します。**', '');
  md.push('**だから、この状態では Claude を呼びません。それが正しい動作です。**', '');
  md.push('**ボトルネックは投稿の中身ではありません。誰も見ていないことです。**');
  md.push('投稿を増やしても、0 は 0 のままです。');
} else {
  md.push('---', '', '## インプレッションの多い順', '');
  md.push('| imp | ♥ | RT | 投稿 |');
  md.push('|---:|---:|---:|---|');
  for (const t of top) {
    const m = t.public_metrics ?? {};
    const head = t.text.split('\n')[0].replace(/\|/g, '\\|').slice(0, 44);
    md.push(`| ${m.impression_count ?? 0} | ${m.like_count ?? 0} | ${m.retweet_count ?? 0} | ${head} |`);
  }
}
md.push('');

const opsDir = join(ROOT, 'ops');
if (!existsSync(opsDir)) mkdirSync(opsDir, { recursive: true });
writeFileSync(join(opsDir, 'x-metrics.md'), md.join('\n'), 'utf8');

console.log('');
console.log('  ops/x-metrics.md に書きました');

if (total === 0) {
  console.log('');
  console.log('  ★ すべて 0 です。**Claude を呼ばずに終わります。**');
  console.log('    材料が無いのに分析させると、機械は推測でデータを作ります。');
  console.log('    そして「伸びる型」として煽りを学習します。');
  console.log('');
  console.log('    ボトルネックは投稿の中身ではありません。**誰も見ていないことです。**');
  process.exit(0);
}

console.log('');
console.log('  ★ 分析する材料があります。');
process.exit(10);
