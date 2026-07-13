// ---------------------------------------------------------------
//  記事・図・論文カード・台帳のあいだで、同じ事実の数字が食い違っていないか。
//
//      node site/check-numbers.mjs
//
//  ★ 2026-07-14、実際に食い違っていた。
//
//    記事      「著者7人のうち6人がキユーピー」   ← 一次情報どおり
//    図        「著者7人のうち5人がキユーピー」   ← 誤り。公開されていた
//    論文カード「著者7名のうち5名。残る1名は東邦大学」 ← 5+1=6 ≠ 7。算数が合わない
//
//    **誰も気づかなかった。**
//    記事を短くする担当が「記事と図で数が違う」と報告して、初めて見つかった。
//    **図を作らせなければ、気づいていない。**
//
//  この道具は、2つを見る:
//    ① 算数（部分 > 全体 / 内訳の合計が全体と合わない）
//    ② 同じ企業について、記事・図・カード・台帳で数が食い違っていないか
// ---------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, '..');

const sources = [];
const add = (label, path) => {
  if (existsSync(path)) sources.push([label, readFileSync(path, 'utf8')]);
};

for (const f of readdirSync(join(ROOT, 'articles')).filter((x) => x.endsWith('.md'))) {
  add('記事 ' + f.replace('.md', ''), join(ROOT, 'articles', f));
}
if (existsSync(join(ROOT, 'research'))) {
  for (const f of readdirSync(join(ROOT, 'research')).filter((x) => x.endsWith('.md'))) {
    add('カード ' + f.replace('.md', ''), join(ROOT, 'research', f));
  }
}
add('図', join(SITE, 'figures.json'));
add('台帳', join(SITE, 'papers.json'));

const problems = [];

console.log('');
console.log('='.repeat(68));
console.log('  記事・図・論文カード・台帳の数字が、食い違っていないか');
console.log('='.repeat(68));

// ---- ① 算数 -------------------------------------------------------------

console.log('');
console.log('① 算数（部分 > 全体 / 内訳の合計が合わない）');
console.log('─'.repeat(68));

let arith = 0;

for (const [where, txt] of sources) {
  for (const m of txt.matchAll(/(\d+)\s*[人名](?:の)?(?:うち|中)\s*(\d+)\s*[人名]/g)) {
    if (Number(m[2]) > Number(m[1])) {
      console.log(`  ★ ${where}: 「${m[0].replace(/\s+/g, '')}」 ← 部分が全体より多い`);
      problems.push(`${where}: ${m[0].replace(/\s+/g, '')}（部分 > 全体）`);
      arith++;
    }
  }
  for (const m of txt.matchAll(
    /(\d+)\s*[人名]のうち(\d+)\s*[人名][^。]{0,80}。[^。]{0,20}残る\s*(\d+)\s*[人名]/g
  )) {
    const tot = Number(m[1]);
    const a = Number(m[2]);
    const b = Number(m[3]);
    if (a + b !== tot) {
      console.log(`  ★ ${where}: ${a} + ${b} = ${a + b} ≠ ${tot}`);
      console.log(`       「${m[0].replace(/\s+/g, '').slice(0, 56)}…」`);
      problems.push(`${where}: 内訳の合計が合わない（${a}+${b}≠${tot}）`);
      arith++;
    }
  }
}
if (!arith) console.log('  ○ 算数の食い違いはありません');

// ---- ② 同じ企業について、数が食い違っていないか --------------------------

console.log('');
console.log('② 同じ企業について、記事・図・カード・台帳で数が一致しているか');
console.log('─'.repeat(68));

const RE =
  /(\d+)\s*[人名](?:の)?(?:うち|中)\s*(\d+)\s*[人名][^。、]{0,24}?([ァ-ヴー]{3,12}|Kewpie|Contipro|Pharmarese|ISDIN|Monteloeder|Tosla|Bionap)/g;

// ★★ 「企業名」だけでまとめてはいけない。
//
//   同じ企業でも、**論文が違えば著者数は違う。**
//   キユーピーの論文は「7名中6名」と「8名中7名」の2本ある。**どちらも正しい。**
//
//   最初、私はこれを「食い違い」と判定した。**関門が、正しい記述を違反と判定した。**
//
//   ★ だから「企業名 + 著者の総数」でまとめる。
//     **総数が同じなのに、内訳が違う** ときだけ、食い違い。
//     （キユーピーの「7名中6名」と「7名中5名」——これが本物の食い違いだった）

const by = {};
for (const [where, txt] of sources) {
  for (const m of txt.matchAll(RE)) {
    const company = m[3];
    const total = m[1];
    (by[`${company}／著者${total}名`] ??= []).push({
      where,
      part: m[2],
      raw: m[0].replace(/\s+/g, ''),
    });
  }
}

let mismatch = 0;
for (const [key, list] of Object.entries(by)) {
  const parts = new Set(list.map((x) => x.part));
  if (parts.size > 1) {
    mismatch++;
    console.log(`  ★ ${key}: 食い違い`);
    for (const x of list) console.log(`       ${x.where.padEnd(26)} ${x.raw}`);
    problems.push(`${key}: 記事・図・カード・台帳で内訳が食い違っている`);
  } else if (list.length > 1) {
    console.log(`  ○ ${key.padEnd(22)} 内訳 ${[...parts][0]}名  （${list.length}箇所で一致）`);
  }
}
if (!Object.keys(by).length) console.log('  （比較対象がありません）');
else if (!mismatch) console.log('  ○ 食い違いはありません');

// ---- 判定 ---------------------------------------------------------------

console.log('');
console.log('='.repeat(68));
if (problems.length) {
  console.log(`  ★ ${problems.length} 件の食い違い`);
  console.log('='.repeat(68));
  for (const p of problems) console.log(`  ・${p}`);
  console.log('');
  console.log('  **一次情報（PubMed）を開いて、どれが正しいかを確かめてください。**');
  console.log('  **記事・図・論文カード・台帳の、食い違っている全部を直すこと。**');
  process.exit(1);
}
console.log('  ○ 食い違いはありません');
console.log('='.repeat(68));
