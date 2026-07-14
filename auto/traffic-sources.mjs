// ---------------------------------------------------------------
//  人は、どこから来ているのか
//
//      node auto/traffic-sources.mjs
//
//  auto/demand.ps1（集客の輪・毎週土曜）から呼ばれる。
//
//  ---------------------------------------------------------------
//  ★★ サンプリングの罠（2026-07-14、実際に間違えた）
//
//    Cloudflare は、**クエリの形でサンプリングを変える。**
//
//      ・集計だけ聞く       → 生の表。sampleInterval ≒ 1
//      ・日別・国別に割る   → サンプリングされた表。sampleInterval = 10
//
//    どちらも count は正しく引き伸ばされている。**だが内訳の1行1行は、**
//    **わずか数件の観測から作られている。**
//
//    私はこれを見て「実際には22件しか無い」と報告した。**誤りだった。**
//    集計で見れば264件あった。**同じ数字を、別の経路で引いていた。**
//
//  ★ だから、**内訳には必ず「実際に観測できた件数」を添える。**
//    観測が数件しかない行から、大きな物語を作らないこと。
// ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
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

const TOKEN = env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID;
const SITE_TAG = env.CLOUDFLARE_SITE_TAG;

if (!TOKEN || !ACCOUNT || !SITE_TAG) {
  console.error('');
  console.error('★ 鍵がありません（auto/.env の CLOUDFLARE_*）');
  console.error('  **これは「流入が0」ではありません。「測れなかった」です。**');
  console.error('');
  process.exit(1); // ★ 1 = 取得失敗。0（＝データ無し）と区別する
}

const DAYS = Number(process.argv[2] ?? 7);

async function q(query, variables) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    console.error('★ Cloudflare がエラーを返しました:');
    console.error(JSON.stringify(json.errors, null, 2));
    return null;
  }
  return json.data;
}

const to = new Date();
const from = new Date(to.getTime() - DAYS * 86400_000);
const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');
const V = { a: ACCOUNT, s: SITE_TAG, f: iso(from), t: iso(to) };

async function group(dim, limit = 20) {
  const d = await q(
    `query($a:string!,$s:string!,$f:Time!,$t:Time!){
      viewer { accounts(filter:{accountTag:$a}) {
        rumPageloadEventsAdaptiveGroups(
          limit:${limit},
          filter:{ siteTag:$s, datetime_geq:$f, datetime_leq:$t },
          orderBy:[count_DESC]
        ) { count avg { sampleInterval } sum { visits } dimensions { ${dim} } }
      } }
    }`,
    V
  );
  return d?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? null;
}

// 合計（生の表。ここが最も信頼できる）
const totalRows = await q(
  `query($a:string!,$s:string!,$f:Time!,$t:Time!){
    viewer { accounts(filter:{accountTag:$a}) {
      rumPageloadEventsAdaptiveGroups(limit:1, filter:{siteTag:$s,datetime_geq:$f,datetime_leq:$t})
      { count avg { sampleInterval } sum { visits } }
    } }
  }`,
  V
);

const g = totalRows?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0];
if (!g) {
  console.log('');
  console.log(`過去 ${DAYS} 日、データがありませんでした（＝本当に 0）`);
  console.log('');
  process.exit(0);
}

const si = g.avg?.sampleInterval ?? 1;
const observed = Math.round((g.count ?? 0) / (si > 0 ? si : 1));

console.log('');
console.log('='.repeat(66));
console.log(`  人は、どこから来ているのか（過去 ${DAYS} 日）`);
console.log('='.repeat(66));
console.log('');
console.log(`  PV     ${g.count}` + (si >= 1.5 ? `（推定。実際に観測: ${observed} 件）` : ''));
console.log(`  訪問   ${g.sum?.visits ?? '—'}`);
console.log('');

const show = async (title, dim, key, note = '') => {
  const rows = await group(dim);
  console.log(`── ${title} ${note}`);
  if (!rows) {
    console.log('   ★ 取得できませんでした（「0」ではありません）');
    console.log('');
    return;
  }
  if (!rows.length) {
    console.log('   0 件');
    console.log('');
    return;
  }
  for (const r of rows) {
    const s = r.avg?.sampleInterval ?? 1;
    const obs = Math.round((r.count ?? 0) / (s > 0 ? s : 1));
    const label = String(r.dimensions[key] || '(直接 / 不明)');
    const vis = r.sum?.visits ?? 0;
    const ppv = vis > 0 ? (r.count / vis).toFixed(1) : '—';
    console.log(
      '   ' +
        label.padEnd(40).slice(0, 40) +
        String(r.count).padStart(5) +
        ' PV' +
        `  (観測 ${String(obs).padStart(3)} 件)` +
        `  1訪問あたり ${String(ppv).padStart(4)} ページ`
    );
  }
  console.log('');
};

await show('流入元', 'refererHost', 'refererHost');
await show('ページ', 'requestPath', 'requestPath');
await show('国', 'countryName', 'countryName');

console.log('='.repeat(66));
console.log('  ★★ 「観測 N 件」を必ず見ること。');
console.log('    内訳の1行は、わずか数件の観測から引き伸ばされています。');
console.log('    **観測が数件しかない行から、大きな物語を作らないこと。**');
console.log('');
console.log('  ★ 「(直接 / 不明)」は、ブックマーク・アプリ内ブラウザ・');
console.log('    リファラを送らない環境が混ざっています。**特定できません。**');
console.log('='.repeat(66));
console.log('');
