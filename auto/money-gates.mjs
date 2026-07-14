// ---------------------------------------------------------------
//  金の出口が、勝手に開いていないかを見る
//
//    node auto/money-gates.mjs         いまの状態を出す（開いていたら exit 1）
//
//  auto/money.ps1 が、収益改善の作業の**前と後**に呼びます。
//  作業のあとで開いていたら、その変更は自動で元に戻されます。
//
//  ---------------------------------------------------------------
//  ★ なぜ、これが要るのか
//
//    「収益を改善しろ」と毎週命じられた機械は、**必ず金の出口を開けにいきます。**
//    広告枠をONにする。アフィリのURLを入れる。本のURLを入れる。
//    **どれも収益を増やします。そして、どれもこのブログを殺します。**
//
//    CLAUDE.md ルール6:
//      **金の出口を、勝手に開けない。これらはオーナーだけが行う。**
//      エージェントは器を作るところまで。
//
//    意志では止まりません。**機械で止めます。**
//
//    （Consumer Reports は86年間ずっと広告を断り続けたが、最後は
//      「認証マークの掲示料」を評価した企業から取るようになった。
//      **判定は資産になり、資産は換金圧力を持つ。理念の強度では止まらない。**）
// ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = join(ROOT, 'site');

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);

// ---- オーナーが承認した出口 -------------------------------------------
//
// ★ 「オーナーが開けた」と「機械が勝手に開けた」を区別します。
//
//   これが無いと、オーナーが正当に広告をONにした瞬間、この関門が
//   「金の出口が開いている」と判定して、**収益の輪が二度と動かなくなります。**
//   （実際にその欠陥がありました）
//
// ★ site/money-approved.json は、auto/money.ps1 が作業のたびに git から元に戻します。
//   **エージェントが自分で自分を承認できないようにするためです。**

const approved = new Set(read(join(SITE, 'money-approved.json'))?.approved ?? []);

const open = [];   // 承認されていないのに開いている（＝止める）
const okOpen = []; // 承認されて開いている（＝正常）
const shut = [];

const check = (key, isOpen, label) => {
  if (!isOpen) {
    shut.push(label);
  } else if (approved.has(key)) {
    okOpen.push(label);
  } else {
    open.push(label);
  }
};

// ---- ① 広告枠 --------------------------------------------------------
const cfg = read(join(SITE, 'config.json')) ?? {};

check(
  'ads',
  cfg.ads?.showAdUnits === true,
  cfg.ads?.showAdUnits === true ? '広告枠（showAdUnits: true）' : '広告枠（showAdUnits: false）'
);

// ---- ② アフィリエイトのURL -------------------------------------------
const products = read(join(SITE, 'products.json')) ?? {};
const affiliate = Object.entries(products)
  .filter(([k]) => !k.startsWith('_'))
  .flatMap(([slug, v]) => (v.items ?? []).filter((i) => i.url).map((i) => `${slug}: ${i.url}`));

check(
  'affiliate',
  affiliate.length > 0,
  affiliate.length
    ? `アフィリエイトのURL（${affiliate.length} 件）\n      ${affiliate.join('\n      ')}`
    : 'アフィリエイトのURL（1件も入っていない）'
);

// ---- ③ 本（Kindle）のURL ---------------------------------------------
const books = read(join(SITE, 'books.json')) ?? {};
const amazon = (books.volumes ?? []).filter((v) => v.amazonUrl).map((v) => `${v.id}: ${v.amazonUrl}`);

check(
  'book',
  amazon.length > 0,
  amazon.length
    ? `本の Amazon URL（${amazon.length} 件）\n      ${amazon.join('\n      ')}`
    : '本の Amazon URL（1件も入っていない）'
);

// ---- ④ メンバーシップの支払いリンク ------------------------------------
const plans = (cfg.membership?.plans ?? []).filter((p) => p.url);

check(
  'membership',
  plans.length > 0,
  plans.length
    ? `メンバーシップの支払いリンク（${plans.length} 件）\n      ${plans.map((p) => `${p.name}: ${p.url}`).join('\n      ')}`
    : 'メンバーシップの支払いリンク（1件も入っていない）'
);

// ---- ⑤ 判定 ------------------------------------------------------------
//
// ★★ 2026-07-14、オーナー判断で **判定を持つことを選びました。**
//   スコア・ランキング・認証は、もう止めません。
//
// ★ ただし、代償を書いておきます（CLAUDE.md にも同じことが書いてあります）。
//
//   **Consumer Reports は1936年から広告を断り続けた消費者団体。**
//   その CR が、いま「CR Recommended」の認証マークの掲示料を、**評価した企業から取っています。**
//
//   **「判定を持つ者は、最後に判定を売る」。** 判定は資産になり、資産は換金圧力を持つ。
//   **86年の実績でも止まらなかった。意志では止まりません。**
//
//   うちは判定を持つことを選びました。**だから、いつか売りたくなります。**
//
// ★★ そのときに、1つだけ守ってほしいこと:
//   **判定を売ったなら、読者にそう書くこと。隠さないこと。**
//   （掲示料を取っているのに「独立した評価です」と書けば、それは景表法の問題になります）
//
//   ★ 元に戻したくなったら、git log で `open-doors` ブランチを見ること。
//     ここで消したのは、判定フィールド（score / rating / rank / stars / grade /
//     recommended / verdict）を claims.json・papers.json から検出して止める検査です。

// ---- ⑥ 判定を「売って」いないか ------------------------------------------
//
// ★ 判定を持つことは開けた。**判定を売ることは、開けていない。**
//   売るなら、それを読者に開示すること（景表法）。
//   ここでは「掲載料・掲示料・認証料」を受け取った形跡が、**開示なしに**入っていないかを見る。

const claims = read(join(SITE, 'claims.json'));

const PAID_PLACEMENT = /掲載料|掲示料|認証料|スポンサー料|paidPlacement|sponsoredRank|sponsored/i;

// ★★ 開示は、**その1件ごと**に付いていること。
//
//   最初、ファイル全体を1つの文字列にして「広告」という語があるかを見た。
//   **products.json のどこかに「広告」の2文字があるだけで、全部が開示済みと判定された。**
//   （実際、攻撃したら素通りした）
//
//   **開示は、金を受け取った、その商品に付いていなければ意味がない。**
const DISCLOSED_KEYS = ['pr', 'sponsored', 'disclosure', '開示', 'PR表記'];

const judged = [];

// 商品を1件ずつ見る
for (const [slug, v] of Object.entries(products)) {
  if (slug.startsWith('_')) continue;
  for (const item of v.items ?? []) {
    const raw = JSON.stringify(item);
    if (!PAID_PLACEMENT.test(raw)) continue;
    const disclosed = DISCLOSED_KEYS.some((k) => item[k]);
    if (!disclosed) {
      judged.push(
        `${slug} の「${item.name ?? '?'}」に金銭（掲載料・掲示料等）の形跡があるのに、` +
          `開示のフィールド（${DISCLOSED_KEYS.join(' / ')}）がありません`
      );
    }
  }
}

// 診断の項目も1件ずつ見る
for (const c of claims?.claims ?? []) {
  const raw = JSON.stringify(c);
  if (!PAID_PLACEMENT.test(raw)) continue;
  const disclosed = DISCLOSED_KEYS.some((k) => c[k]);
  if (!disclosed) {
    judged.push(`診断 ${c.id} に金銭の形跡があるのに、開示のフィールドがありません`);
  }
}

if (judged.length) {
  open.push(
    `★★ 判定を、開示せずに売っています【景品表示法】\n      ${judged
      .slice(0, 5)
      .join('\n      ')}`
  );
}

// ---- 結果 ------------------------------------------------------------

console.log('');
console.log('金の出口の状態');
console.log('='.repeat(46));

for (const s of shut) console.log(`  閉    ${s}`);
for (const o of okOpen) console.log(`  開(承認済) ${o}`);
for (const o of open) console.log(`  ★開   ${o}`);

console.log('');

if (open.length) {
  console.error('='.repeat(46));
  console.error(`  承認されていない金の出口が ${open.length} 件、開いています。`);
  console.error('='.repeat(46));
  console.error('');
  console.error('  **これらは、オーナーだけが開けられます。**（CLAUDE.md ルール6）');
  console.error('  エージェントが開けたのなら、その変更は元に戻されます。');
  console.error('');
  console.error('  「収益を改善しろ」と命じられた機械は、必ず金の出口を開けにいきます。');
  console.error('  広告枠をONにする。アフィリのURLを入れる。判定を作る。');
  console.error('  **どれも収益を増やします。そして、どれもこのブログを殺します。**');
  console.error('');
  console.error('  意志では止まりません。だから、機械で止めます。');
  console.error('');
  console.error(`  （承認済みの出口: ${[...approved].join(', ') || 'なし'}）`);
  console.error('   承認は site/money-approved.json にあります。');
  console.error('   **エージェントがそこを書き換えても、money.ps1 が git から元に戻します。**');
  console.error('');
  process.exit(1);
}

if (okOpen.length) {
  console.log(`  承認された出口だけが開いています（${[...approved].join(', ')}）。`);
} else {
  console.log('  すべて閉じています。');
}
console.log('  エージェントは器を作るところまで。');
console.log('');
