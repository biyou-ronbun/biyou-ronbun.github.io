// ---------------------------------------------------------------
//  ランキング（成分の段 / 商品の段）
//
//      node site/ranking.mjs        ← 順位を表示する（確認用）
//
//  build.mjs / verify.mjs から呼ばれる。**重みの定義は、ここ1箇所だけ。**
//
//  ---------------------------------------------------------------
//  ★★ 読む人へ。いちばん大事なことを先に書きます。
//
//    **この順位は、論文が決めたものではありません。**
//    **私たちが決めた重みで計算したものです。**
//
//    ・なぜ「独立資金の試験」に +1 なのか  → **私たちがそう決めたから**
//    ・なぜ「価格」が最大 2点 なのか        → **私たちがそう決めたから**
//    ・なぜ「撤回された論文」が −1 なのか    → **私たちがそう決めたから**
//
//    重みは下に全部書いてあります。**納得できなければ、自分の重みで並べ替えてください。**
//
//  ★★ そして、この重みを表示せずに順位だけを出すことは、禁止しています。
//    表示しなければ、読者は「科学が1位だと言っている」と読みます。**それは嘘です。**
//    site/verify.mjs が、重みの表示が無いページに順位が出ていたら、公開を止めます。
//
//  ★ 2026-07-14、オーナー判断でランキングを開けました。
//    それまで、うちはスコアも順位も1つも持っていませんでした。理由は CLAUDE.md にあります
//    （「判定を持つ者は、最後に判定を売る」。Consumer Reports は86年かけてそうなりました）。
// ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);

// ================================================================
//  重み（★ ここが「私たちの判断」。サイトに、そのまま表示する）
// ================================================================

// ---- ① 成分の段: 研究デザインの強さ -------------------------------------
//
// ★ これは論文の**種別**であって、うちの意見ではない。
//   台帳（papers.json）の evidenceType を、そのまま使う。
export const DESIGN_WEIGHT = {
  'meta-analysis': 5,
  'systematic-review': 5,
  rct: 4,
  'clinical-trial': 3,
  'human-other': 2,
  'human-case-report': 1,
  animal: 0,
  invitro: 0,
  review: 0,
};

export const DESIGN_LABEL = {
  'meta-analysis': 'メタ解析',
  'systematic-review': 'システマティックレビュー',
  rct: 'ランダム化比較試験（RCT）',
  'clinical-trial': '臨床試験',
  'human-other': 'その他のヒト試験',
  'human-case-report': '症例報告',
  animal: '動物実験',
  invitro: '試験管・培養細胞',
  review: '総説（一次研究ではない）',
};

// ★ 独立資金のヒト試験は、1本につき +1（上限3）
//   「企業が自社製品を試して効いたと報告した」ことと、「無関係な第三者が確かめた」ことを、
//   同じ重さで扱わない、という**私たちの判断**です。
export const INDEPENDENT_BONUS = 1;
export const INDEPENDENT_CAP = 3;
export const INDEPENDENT_FUNDING = ['independent', 'public'];
export const INDEPENDENT_MIN_DESIGN = 3; // 臨床試験以上

// ★ 撤回された論文は、1本につき −1
//   撤回はデータ捏造とは限りません。ですが、**その結果はもう根拠に使えません。**
export const RETRACTION_PENALTY = -1;

// ---- ② 商品の段: 価格と濃度 ---------------------------------------------
//
// ★ 価格: 円/mL が安いほど高得点。**記事の中で正規化する**（0〜2点）。
//   ★ 「安いほど良い」は、私たちの判断です。**効果とは関係ありません。**
export const PRICE_MAX = 2;

// ★ 濃度: 記事が定めた範囲に入っていれば 2点、外れていれば 0点。
//   ★ **濃度の概念がない商品（日焼け止め・化粧水・ワセリン）には、点をつけません。**
//     無理に点数化すると、そこから作り話が始まります。
export const CONC_MAX = 2;

// ================================================================
//  計算
// ================================================================

const load = (f) => JSON.parse(readFileSync(join(SITE, f), 'utf8'));

const isRetracted = (p) => /撤回/.test(JSON.stringify(p));

/** 成分（記事）の段。その成分を試した論文の質で並べる。 */
export function rankIngredients() {
  const papers = load('papers.json').papers;
  const articles = load('articles.json');

  const rows = [];
  for (const a of articles) {
    if (a.published === false) continue;
    const mine = papers.filter((p) => Array.isArray(p.articles) && p.articles.includes(a.slug));
    if (!mine.length) continue;

    const retracted = mine.filter(isRetracted);
    const live = mine.filter((p) => !isRetracted(p));

    const scoreOf = (p) => DESIGN_WEIGHT[p.evidenceType] ?? 0;

    const best = live.length ? Math.max(...live.map(scoreOf)) : 0;
    const bestPaper = live.find((p) => scoreOf(p) === best) ?? null;

    const independent = live.filter(
      (p) => scoreOf(p) >= INDEPENDENT_MIN_DESIGN && INDEPENDENT_FUNDING.includes(p.fundingType)
    );
    const industry = live.filter(
      (p) => scoreOf(p) >= INDEPENDENT_MIN_DESIGN && p.fundingType === 'industry'
    );

    const indBonus = Math.min(INDEPENDENT_CAP, independent.length) * INDEPENDENT_BONUS;
    const retPenalty = retracted.length * RETRACTION_PENALTY;

    rows.push({
      slug: a.slug,
      title: a.title,
      total: best + indBonus + retPenalty,
      best,
      bestType: bestPaper?.evidenceType ?? null,
      independent: independent.length,
      industry: industry.length,
      retracted: retracted.length,
      papers: mine.length,
    });
  }

  rows.sort((x, y) => y.total - x.total || x.slug.localeCompare(y.slug));
  return rows;
}

/** 商品の段。記事の中で、価格と濃度で並べる。 */
export function rankProducts(slug) {
  const products = load('products.json');
  const verified = existsSync(join(SITE, 'verified.json')) ? load('verified.json') : {};
  const prices = verified.prices ?? {};

  const entry = products[slug];
  if (!entry || !(entry.items ?? []).length) return null;

  const range = entry.concentrationRange ?? null;

  const rows = entry.items.map((it) => {
    const p = prices[`${slug}::${it.name}`];
    return {
      name: it.name,
      url: it.url,
      image: it.image,
      criterion: it.criterion,
      basis: it.basis,
      perMl: p && !p.failed ? p.perMl : null,
      priceAt: p && !p.failed ? p.at : null,
      conc: it.concentration ?? null,
    };
  });

  const seen = rows.map((r) => r.perMl).filter((v) => v != null);
  const lo = seen.length ? Math.min(...seen) : null;
  const hi = seen.length ? Math.max(...seen) : null;

  for (const r of rows) {
    // 価格（安いほど高い）
    r.priceScore =
      r.perMl == null || lo == null ? null : hi === lo ? PRICE_MAX : (PRICE_MAX * (hi - r.perMl)) / (hi - lo);

    // 濃度（記事の範囲内なら満点。濃度の概念が無い記事では null ＝ 該当なし）
    r.concScore =
      !range || r.conc == null ? null : r.conc >= range.min && r.conc <= range.max ? CONC_MAX : 0;

    r.total = (r.priceScore ?? 0) + (r.concScore ?? 0);
  }

  rows.sort((x, y) => y.total - x.total);
  return { range, rows };
}

// ================================================================
//  確認用
// ================================================================

const isMain = process.argv[1] && process.argv[1].endsWith('ranking.mjs');

if (isMain) {
  console.log('');
  console.log('★ この順位は、論文が決めたものではありません。**私たちが決めた重みで計算したものです。**');
  console.log('');
  console.log('① 成分（記事）');
  console.log('');
  console.log('  順位 合計 | 最強 独立 企業 撤回 | 成分');
  rankIngredients().forEach((r, i) => {
    console.log(
      `  ${String(i + 1).padStart(3)}  ${String(r.total).padStart(3)}  | ` +
        `${String(r.best).padStart(3)} ${String(r.independent).padStart(4)} ` +
        `${String(r.industry).padStart(4)} ${String(r.retracted).padStart(4)}  | ${r.slug}`
    );
  });

  console.log('');
  console.log('② 商品');
  const products = load('products.json');
  for (const slug of Object.keys(products)) {
    if (slug.startsWith('_')) continue;
    const r = rankProducts(slug);
    if (!r) continue;
    console.log('');
    console.log(
      `  ■ ${slug}` +
        (r.range ? `  （記事の濃度基準: ${r.range.min}〜${r.range.max}%）` : '  （濃度の概念なし）')
    );
    r.rows.forEach((x, i) =>
      console.log(
        `     ${i + 1}位  合計 ${x.total.toFixed(1)}  = 価格 ${x.priceScore == null ? '—' : x.priceScore.toFixed(1)}` +
          ` + 濃度 ${x.concScore == null ? '該当なし' : x.concScore}` +
          `   (${x.perMl ?? '?'} 円/mL${x.conc ? ', ' + x.conc + '%' : ''})  ${x.name.slice(0, 34)}`
      )
    );
  }
  console.log('');
}
