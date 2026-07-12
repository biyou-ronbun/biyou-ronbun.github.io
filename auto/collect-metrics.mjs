// ---------------------------------------------------------------
//  PV と収益を、公式APIから取ってくる
//
//    node auto/collect-metrics.mjs           取ってきて ops/auto-metrics.md に書く
//    node auto/collect-metrics.mjs --dry     取ってきて表示するだけ（書かない）
//    node auto/collect-metrics.mjs --discover Cloudflare のスキーマを調べる（下記★）
//
//  月曜の朝、タスクスケジューラから auto/metrics.ps1 経由で呼ばれます。
//
//  鍵: auto/.env（.gitignore 済み。★ リポジトリは public です。絶対に git に入れない）
//  出力: ops/auto-metrics.md（ops/ は .gitignore 済み）
//
//  ---------------------------------------------------------------
//  ★ このファイルで最も大事な決まり
//
//    取得に失敗したら、「取得失敗」と書きます。0 とは書きません。
//    「0だった」と「数えられなかった」は、別の事実です（CLAUDE.md ルール4）。
//
//    このブログは「出典をたどると根拠が無かった」を書くブログです。
//    自分の数字を、取れてもいないのに 0 と書いたら、同じ穴に落ちます。
//  ---------------------------------------------------------------
//
//  取れるもの / 取れないもの:
//
//    Cloudflare Web Analytics … PV・訪問数。取れる（ただし ★注意 を読むこと）
//    Stripe                  … 売上・サブスク数。取れる
//    Google Search Console   … 表示回数・クリック・検索語。取れる（サービスアカウント）
//    Google AdSense          … 取れない。OAuth が要る（人間が管理画面から ops/metrics.md へ）
//    Kindle (KDP)            … 取れない。**KDP には API がありません**（同上）
//
//  ★注意（Cloudflare）:
//    Cloudflare は rumPageloadEventsAdaptiveGroups の中のフィールド名を、
//    公式ドキュメントで文書化していません（「イントロスペクションで自分で調べろ」という方針）。
//    第三者のブログには sum { visits } などの例が出回っていますが、一次情報ではないので、
//    それを根拠に決め打ちすることはしません。
//
//    → このスクリプトは、実行時に Cloudflare 自身に availableFields を問い合わせて、
//      **返ってきたフィールドだけを使ってクエリを組みます。**
//      うまく取れないときは --discover で、Cloudflare が何を持っているかを見てください。
//
//    出典（確認日 2026-07-12）:
//      https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/
//      https://developers.cloudflare.com/analytics/graphql-api/features/discovery/settings/
//      https://developers.cloudflare.com/analytics/graphql-api/features/discovery/introspection/
//      https://docs.stripe.com/api/balance_transactions/list
//      https://docs.stripe.com/api/subscriptions/list
//      https://docs.stripe.com/currencies  （JPY は zero-decimal。amount はそのまま「円」）
// ---------------------------------------------------------------

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'ops', 'auto-metrics.md');

const DRY = process.argv.includes('--dry');
const DISCOVER = process.argv.includes('--discover');

// ---- 鍵を読む -------------------------------------------------------

function loadEnv() {
  const p = join(ROOT, 'auto', '.env');
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID;
const CF_SITE = env.CLOUDFLARE_SITE_TAG;
const STRIPE_KEY = env.STRIPE_SECRET_KEY;

// ---- 期間（直近7日） -------------------------------------------------
// Cloudflare Web Analytics は直近7日ぶんを未サンプリングで保持しているので、
// 7日という窓は、この用途にちょうど合っています。
//   https://developers.cloudflare.com/web-analytics/faq/

const now = new Date();
const from = new Date(now.getTime() - 7 * 86400_000);
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
const day = (d) => d.toISOString().slice(0, 10);

// ---- Cloudflare -----------------------------------------------------

const CF_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

async function cfQuery(query, variables) {
  const res = await fetch(CF_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`HTTP ${res.status}（本文が JSON ではありません）`);
  // Cloudflare は HTTP 200 でもエラーを errors に入れて返してくる。必ず見ること。
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(' / '));
  }
  return json.data;
}

// Cloudflare に「あなたは何を持っているのか」を聞く。
// フィールド名が公式に文書化されていないので、ここが唯一の一次情報になります。
async function cfSettings() {
  const data = await cfQuery(
    `query($accountTag: string!) {
       viewer {
         accounts(filter: { accountTag: $accountTag }) {
           settings {
             rumPageloadEventsAdaptiveGroups {
               enabled
               notOlderThan
               availableFields
             }
           }
         }
       }
     }`,
    { accountTag: CF_ACCOUNT }
  );
  return data?.viewer?.accounts?.[0]?.settings?.rumPageloadEventsAdaptiveGroups ?? null;
}

async function cfPageviews() {
  // まず、Cloudflare が実際に持っているフィールドを聞く。
  // 聞けなかったとしても、それだけで諦めない（settings が account スコープで通るかは未確認のため）。
  let available = null;
  try {
    const s = await cfSettings();
    if (s && s.enabled === false) {
      throw new Error('このアカウントでは rumPageloadEventsAdaptiveGroups が使えません（enabled: false）');
    }
    if (s?.availableFields) available = s.availableFields;
  } catch (e) {
    if (/enabled: false/.test(e.message)) throw e;
    // settings が引けないだけなら、本番クエリを試す価値はある
  }

  // 「訪問数」に相当するフィールドがあるなら足す。無ければ count だけで数える。
  // ★ 決め打ちしないこと。Cloudflare が「持っている」と言ったものだけを聞く。
  //
  // ★★ availableFields は "sum_visits" と返してくるが、クエリに書くときは sum { visits } と書く。
  //    （availableFields は「グループ名_フィールド名」の平たい形で返ってくる）
  //    2026-07-13、実際に問い合わせて確認した。'visits' で探すと永遠に見つからない。
  const hasVisits = Array.isArray(available) && available.includes('sum_visits');
  const visitsPart = hasVisits ? 'sum { visits }' : '';

  const data = await cfQuery(
    `query($accountTag: string!, $siteTag: string!, $from: Time!, $to: Time!) {
       viewer {
         accounts(filter: { accountTag: $accountTag }) {
           rumPageloadEventsAdaptiveGroups(
             filter: { siteTag: $siteTag, datetime_geq: $from, datetime_leq: $to }
             limit: 1
           ) {
             count
             ${visitsPart}
           }
         }
       }
     }`,
    { accountTag: CF_ACCOUNT, siteTag: CF_SITE, from: iso(from), to: iso(now) }
  );

  const g = data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0];
  if (!g) return { pv: 0, visits: null, note: '期間内にデータがありません（＝本当に0）' };

  return {
    pv: g.count ?? null,
    visits: hasVisits ? (g.sum?.visits ?? null) : null,
    note: hasVisits ? '' : '訪問数は取得していません（Cloudflare が visits を持っていると答えなかった）',
  };
}

// ---- Stripe ---------------------------------------------------------
//
// JPY は zero-decimal currency。amount はそのまま「円」です（100 で割らない）。
//   https://docs.stripe.com/currencies

async function stripeList(path, params) {
  const out = [];
  let after = null;
  for (;;) {
    const qs = new URLSearchParams({ ...params, limit: '100' });
    if (after) qs.set('starting_after', after);
    const res = await fetch(`https://api.stripe.com/v1/${path}?${qs}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    out.push(...json.data);
    if (!json.has_more || json.data.length === 0) break;
    after = json.data[json.data.length - 1].id;
  }
  return out;
}

async function stripeRevenue() {
  const since = Math.floor(from.getTime() / 1000);

  const txns = await stripeList('balance_transactions', {
    'created[gte]': String(since),
    type: 'charge',
    currency: 'jpy',
  });

  const subs = await stripeList('subscriptions', { status: 'active' });

  return {
    gross: txns.reduce((s, t) => s + t.amount, 0),
    net: txns.reduce((s, t) => s + t.net, 0),
    count: txns.length,
    activeSubscriptions: subs.length,
  };
}

// ---- Google Search Console -------------------------------------------
//
// 「どんな言葉で検索した人が、このサイトを見つけたか」が取れます。
// **このブログにとって、いちばん大事な数字です。** 読者が実際に使った言葉だからです。
// （こちらが「毛穴」と呼んでいるものを、読者は「いちご鼻」と呼んでいるかもしれない）
//
// 認証: サービスアカウント。外部ライブラリを使わず、JWT を自分で署名します。
//   https://developers.google.com/identity/protocols/oauth2/service-account
//   https://developers.google.com/webmaster-tools/v1/searchanalytics/query
//
// ★ Search Console のデータは 2〜3日遅れて確定します。
//   「昨日のぶん」を聞いても空です。0 ではなく、まだ無いだけです。
//   だから、window は「3日前まで」で切ります。

const GSC_EMAIL = env.GOOGLE_SA_EMAIL;
const GSC_KEY = (env.GOOGLE_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
const GSC_SITE = env.GSC_SITE_URL; // ドメインプロパティなら sc-domain:biyou-ronbun.com

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function gscToken() {
  const { createSign } = await import('node:crypto');
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: GSC_EMAIL,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  );

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(sign.sign(GSC_KEY))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`トークンが取れません: ${json.error_description ?? json.error ?? res.status}`);
  return json.access_token;
}

async function gscQuery(token, body) {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    GSC_SITE
  )}/searchAnalytics/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${json.error?.message ?? ''}`);
  return json.rows ?? [];
}

async function gscSearch() {
  const token = await gscToken();

  // Search Console は 2〜3日遅れる。確定しているところだけを見る。
  const end = new Date(now.getTime() - 3 * 86400_000);
  const start = new Date(end.getTime() - 7 * 86400_000);

  const [totals, queries, pages] = await Promise.all([
    gscQuery(token, { startDate: day(start), endDate: day(end), dimensions: [] }),
    gscQuery(token, {
      startDate: day(start),
      endDate: day(end),
      dimensions: ['query'],
      rowLimit: 15,
    }),
    gscQuery(token, { startDate: day(start), endDate: day(end), dimensions: ['page'], rowLimit: 10 }),
  ]);

  const t = totals[0];

  return {
    from: day(start),
    to: day(end),
    // rows が空なのは「まだデータが無い」。取得は成功している。だから 0 と書いてよい。
    impressions: t?.impressions ?? 0,
    clicks: t?.clicks ?? 0,
    position: t?.position != null ? Math.round(t.position * 10) / 10 : null,
    queries: queries.map((r) => ({
      q: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: Math.round(r.position * 10) / 10,
    })),
    pages: pages.map((r) => ({
      url: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
    })),
    note: t ? '' : 'まだデータがありません（登録直後は数週間かかります。取得は成功しています）',
  };
}

// ---- 実行 -----------------------------------------------------------

if (DISCOVER) {
  if (!CF_TOKEN || !CF_ACCOUNT) {
    console.error('auto/.env に CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID を入れてください');
    process.exit(1);
  }
  console.log('Cloudflare に、何が取れるのかを聞きます\n');
  try {
    const s = await cfSettings();
    console.log(JSON.stringify(s, null, 2));
    console.log('\n↑ availableFields に出た名前だけが、クエリに書ける名前です。');
  } catch (e) {
    console.error(`settings が引けませんでした: ${e.message}\n`);
    console.log('スキーマを直接のぞきます（rum を含む型だけ）\n');
    const data = await cfQuery('{ __schema { types { name fields { name } } } }', {});
    const rum = data.__schema.types.filter((t) => /rum/i.test(t.name ?? ''));
    console.log(JSON.stringify(rum, null, 2));
  }
  process.exit(0);
}

const results = {};

if (CF_TOKEN && CF_ACCOUNT && CF_SITE) {
  try {
    results.cloudflare = await cfPageviews();
  } catch (e) {
    results.cloudflare = { error: e.message };
  }
} else {
  results.cloudflare = { skipped: '鍵がありません（auto/.env の CLOUDFLARE_*）' };
}

if (STRIPE_KEY) {
  try {
    results.stripe = await stripeRevenue();
  } catch (e) {
    results.stripe = { error: e.message };
  }
} else {
  results.stripe = { skipped: '鍵がありません（auto/.env の STRIPE_SECRET_KEY）' };
}

if (GSC_EMAIL && GSC_KEY && GSC_SITE) {
  try {
    results.gsc = await gscSearch();
  } catch (e) {
    results.gsc = { error: e.message };
  }
} else {
  results.gsc = { skipped: '鍵がありません（auto/.env の GOOGLE_SA_* / GSC_SITE_URL）' };
}

// ---- 書く -----------------------------------------------------------
//
// 取れなかったものは「取得失敗」と書く。0 と書かない。

const cell = (r, pick) => {
  if (r.skipped) return '—（鍵なし）';
  if (r.error) return '**取得失敗**';
  const v = pick(r);
  return v === null || v === undefined ? '**取得失敗**' : String(v);
};

const cf = results.cloudflare;
const st = results.stripe;
const gs = results.gsc;

const notes = [];
if (cf.error) notes.push(`- ${day(now)} Cloudflare: 取得失敗 — ${cf.error}`);
if (cf.note) notes.push(`- ${day(now)} Cloudflare: ${cf.note}`);
if (cf.skipped) notes.push(`- ${day(now)} Cloudflare: ${cf.skipped}`);
if (st.error) notes.push(`- ${day(now)} Stripe: 取得失敗 — ${st.error}`);
if (st.skipped) notes.push(`- ${day(now)} Stripe: ${st.skipped}`);
if (gs.error) notes.push(`- ${day(now)} Search Console: 取得失敗 — ${gs.error}`);
if (gs.note) notes.push(`- ${day(now)} Search Console: ${gs.note}`);
if (gs.skipped) notes.push(`- ${day(now)} Search Console: ${gs.skipped}`);

console.log('');
console.log(`  期間: ${day(from)} 〜 ${day(now)}`);
console.log(`  PV        : ${cell(cf, (r) => r.pv)}`);
console.log(`  訪問       : ${cell(cf, (r) => r.visits)}`);
console.log(`  検索の表示回数 : ${cell(gs, (r) => r.impressions)}`);
console.log(`  検索のクリック : ${cell(gs, (r) => r.clicks)}`);
console.log(`  売上(総額)  : ${cell(st, (r) => r.gross)} 円`);
console.log(`  売上(手取り) : ${cell(st, (r) => r.net)} 円`);
console.log(`  サブスク    : ${cell(st, (r) => r.activeSubscriptions)} 件`);
if (gs.queries?.length) {
  console.log('');
  console.log('  読者が実際に使った言葉:');
  gs.queries.slice(0, 10).forEach((q) =>
    console.log(`    ${String(q.impressions).padStart(5)} 回表示 / ${q.clicks} クリック  ${q.q}`)
  );
}
notes.forEach((n) => console.log(`  ${n.replace(/^- /, '')}`));
console.log('');

if (DRY) {
  console.log('--dry なので、ファイルには書きませんでした');
  process.exit(0);
}

// 生の記録は JSON に貯めて、Markdown は毎回そこから作り直す。
// 表に行を追記していく作りにすると、注記が1つ入っただけで表が壊れます。

const DATA = join(ROOT, 'ops', 'auto-metrics.json');

const history = existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : [];
history.push({
  collectedAt: day(now),
  from: day(from),
  to: day(now),
  cloudflare: cf,
  stripe: st,
  gsc: gs,
});
writeFileSync(DATA, JSON.stringify(history, null, 2) + '\n', 'utf8');

const rows = history
  .map(
    (h) =>
      `| ${h.collectedAt} | ${h.from}〜${h.to} ` +
      `| ${cell(h.cloudflare, (r) => r.pv)} ` +
      `| ${cell(h.cloudflare, (r) => r.visits)} ` +
      `| ${cell(h.gsc ?? { skipped: 1 }, (r) => r.impressions)} ` +
      `| ${cell(h.gsc ?? { skipped: 1 }, (r) => r.clicks)} ` +
      `| ${cell(h.stripe, (r) => r.gross)} ` +
      `| ${cell(h.stripe, (r) => r.net)} ` +
      `| ${cell(h.stripe, (r) => r.activeSubscriptions)} |`
  )
  .join('\n');

// 読者が実際に使った言葉。最新の1回ぶんだけを出す（過去ぶんは JSON に残っている）。
const latestGsc = history[history.length - 1]?.gsc ?? {};
const queryBlock = latestGsc.queries?.length
  ? `## 読者が実際に使った言葉（${latestGsc.from}〜${latestGsc.to}）

**この表が、次に何を書くかを決める材料です。**
こちらが「毛穴」と呼んでいるものを、読者は別の言葉で探しているかもしれません。
**こちらの語彙ではなく、この表の語彙に合わせること。**

| 検索した言葉 | 表示回数 | クリック | 平均順位 |
|---|---|---|---|
${latestGsc.queries
  .map((q) => `| ${q.q} | ${q.impressions} | ${q.clicks} | ${q.position} |`)
  .join('\n')}
`
  : '';

const pageBlock = latestGsc.pages?.length
  ? `## 検索から人が来ているページ（${latestGsc.from}〜${latestGsc.to}）

| ページ | 表示回数 | クリック |
|---|---|---|
${latestGsc.pages.map((p) => `| ${p.url} | ${p.impressions} | ${p.clicks} |`).join('\n')}
`
  : '';

const allNotes = history.flatMap((h) => {
  const out = [];
  const c = h.cloudflare ?? {};
  const s = h.stripe ?? {};
  const g = h.gsc ?? {};
  if (c.error) out.push(`- ${h.collectedAt} Cloudflare: **取得失敗** — ${c.error}`);
  if (c.note) out.push(`- ${h.collectedAt} Cloudflare: ${c.note}`);
  if (c.skipped) out.push(`- ${h.collectedAt} Cloudflare: ${c.skipped}`);
  if (s.error) out.push(`- ${h.collectedAt} Stripe: **取得失敗** — ${s.error}`);
  if (s.skipped) out.push(`- ${h.collectedAt} Stripe: ${s.skipped}`);
  if (g.error) out.push(`- ${h.collectedAt} Search Console: **取得失敗** — ${g.error}`);
  if (g.note) out.push(`- ${h.collectedAt} Search Console: ${g.note}`);
  if (g.skipped) out.push(`- ${h.collectedAt} Search Console: ${g.skipped}`);
  return out;
});

const md = `# 数値の記録（機械が取ったもの）

**このファイルは \`auto/collect-metrics.mjs\` が毎回まるごと作り直します。手で編集しても、次回の実行で消えます。**
**数字を直したいときは \`ops/auto-metrics.json\` を直してください。**

- ここに入るのは、**公式APIから機械が取った実測値だけ**です（Cloudflare Web Analytics / Stripe / Google Search Console）。
- 人間が管理画面から持ってきた数値は、\`ops/metrics.md\` のほうに入ります。**混ぜないこと。**
- **取得に失敗したら「取得失敗」と書きます。0 とは書きません。**
  「0だった」と「数えられなかった」は、別の事実です（\`CLAUDE.md\` ルール4）。

**ここから取れないもの:**

| | なぜ |
|---|---|
| **Google AdSense** | OAuth が必要で、無人では通せません。→ 人間が管理画面から \`ops/metrics.md\` へ |
| **Kindle（KDP）** | **KDP には API がありません。** → 同上 |
| **X のインプレッション** | 取得は API の有料枠。→ 同上 |

**売上は円**（JPY は zero-decimal なので、Stripe の \`amount\` がそのまま円です）。
**「手取り」は Stripe の手数料を引いた後**（\`net\`）。振込手数料は、まだ引かれていません。

**Search Console のデータは 2〜3日遅れて確定します。** だから期間は「3日前まで」で切っています。
昨日ぶんが空なのは、0 だからではなく、**まだ存在しないから**です。

| 取得日 | 期間 | PV | 訪問 | 検索表示 | 検索クリック | 売上(総額) | 売上(手取り) | サブスク |
|---|---|---|---|---|---|---|---|---|
${rows}

${queryBlock}
${pageBlock}
${allNotes.length ? '## 注記\n\n' + allNotes.join('\n') + '\n' : ''}`;

writeFileSync(OUT, md, 'utf8');

console.log(`  → ${OUT} に書きました（生データ: ${DATA}）`);
