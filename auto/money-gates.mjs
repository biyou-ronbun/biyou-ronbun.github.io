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

const open = [];
const shut = [];

// ---- ① 広告枠 --------------------------------------------------------
const cfg = read(join(SITE, 'config.json')) ?? {};

if (cfg.ads?.showAdUnits === true) {
  open.push('広告枠（config.json の ads.showAdUnits が true）');
} else {
  shut.push('広告枠（showAdUnits: false）');
}

// ---- ② アフィリエイトのURL -------------------------------------------
const products = read(join(SITE, 'products.json')) ?? {};
const affiliate = Object.entries(products)
  .filter(([k]) => !k.startsWith('_'))
  .flatMap(([slug, v]) => (v.items ?? []).filter((i) => i.url).map((i) => `${slug}: ${i.url}`));

if (affiliate.length) {
  open.push(`アフィリエイトのURL（${affiliate.length} 件）\n      ${affiliate.join('\n      ')}`);
} else {
  shut.push('アフィリエイトのURL（1件も入っていない）');
}

// ---- ③ 本（Kindle）のURL ---------------------------------------------
const books = read(join(SITE, 'books.json')) ?? {};
const amazon = (books.volumes ?? []).filter((v) => v.amazonUrl).map((v) => `${v.id}: ${v.amazonUrl}`);

if (amazon.length) {
  open.push(`本の Amazon URL（${amazon.length} 件）\n      ${amazon.join('\n      ')}`);
} else {
  shut.push('本の Amazon URL（1件も入っていない）');
}

// ---- ④ メンバーシップの支払いリンク ------------------------------------
const plans = (cfg.membership?.plans ?? []).filter((p) => p.url);

if (plans.length) {
  open.push(`メンバーシップの支払いリンク（${plans.length} 件）\n      ${plans.map((p) => `${p.name}: ${p.url}`).join('\n      ')}`);
} else {
  shut.push('メンバーシップの支払いリンク（1件も入っていない）');
}

// ---- ⑤ 判定を作っていないか ------------------------------------------
//
// スコア・ランキング・認証・お墨付き——**判定は資産になり、資産は換金圧力を持つ。**
// うちが判定を1つも持たない理由は、意志ではなく構造です。
// **持たなければ、売る対象が存在しません。**

const claims = read(join(SITE, 'claims.json'));
const JUDGEMENT_FIELDS = ['score', 'rating', 'rank', 'stars', 'grade', 'recommended', 'verdict'];

const judged = [];
for (const c of claims?.claims ?? []) {
  for (const f of JUDGEMENT_FIELDS) {
    if (f in c) judged.push(`claims.json の ${c.id} に「${f}」があります`);
  }
}
for (const p of read(join(SITE, 'papers.json'))?.papers ?? []) {
  for (const f of JUDGEMENT_FIELDS) {
    if (f in p) judged.push(`papers.json の PMID ${p.pmid} に「${f}」があります`);
  }
}

if (judged.length) {
  open.push(`判定（スコア・ランキング・お墨付き）が作られています\n      ${judged.slice(0, 5).join('\n      ')}`);
}

// ---- 結果 ------------------------------------------------------------

console.log('');
console.log('金の出口の状態');
console.log('='.repeat(46));

for (const s of shut) console.log(`  閉  ${s}`);
for (const o of open) console.log(`  ★開 ${o}`);

console.log('');

if (open.length) {
  console.error('='.repeat(46));
  console.error(`  金の出口が ${open.length} 件、開いています。`);
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
  process.exit(1);
}

console.log('  すべて閉じています。エージェントは器を作るところまで。');
console.log('');
