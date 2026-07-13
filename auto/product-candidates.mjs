// リンクを付けられる記事を、毎回オーナーに知らせる。
//
// ★ なぜ機械が要るのか
//
//   アフィリエイトリンクの発行は、**オーナーにしかできない**（CLAUDE.md「金の出口を、勝手に開けない」）。
//   だから機械が「基準に合う商品」を見つけても、**報告しなければ、その記事は永久に収益ゼロ**になる。
//
//   記事は自動で週5本増える。**報告を人の記憶に頼れば、必ず漏れる。**
//
// ★ この機械が絶対にやらないこと
//
//   ・url を自分で埋める        … 金の出口を開ける行為。money-gates.mjs が git で戻す
//   ・criterion を自分で作る    … 記事から導けない基準は「推薦」。verify.mjs が公開を止める
//   ・報酬額を見る              … 見た瞬間、このブログは終わる
//
//   **やるのは「知らせる」ことだけ。**

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(p, 'utf8');

const products = JSON.parse(read(join(ROOT, 'site', 'products.json')));
const articles = JSON.parse(read(join(ROOT, 'site', 'articles.json')));

const list = Array.isArray(articles) ? articles : (articles.articles ?? []);

const ready = [];   // criterion も basis もある。url が空。→ ★ リンクを付けられる
const noEntry = []; // products.json に項目が無い。→ 基準を作れるか、まだ誰も見ていない
const decided = []; // 「商品を置かない」と決めた記事
const live = [];    // すでにリンクが入っている

for (const a of list) {
  const slug = a.slug;
  if (!slug) continue;
  if (a.published === false) continue;

  const entry = products[slug];
  if (!entry) {
    noEntry.push({ slug, title: a.title });
    continue;
  }

  const items = entry.items ?? [];
  if (!items.length) {
    decided.push({ slug, title: a.title });
    continue;
  }

  for (const i of items) {
    if (i.url) {
      live.push({ slug, name: i.name });
    } else if (i.criterion && i.basis) {
      ready.push({ slug, title: a.title, criterion: i.criterion, name: i.name });
    } else {
      noEntry.push({ slug, title: a.title });
    }
  }
}

const line = '='.repeat(66);

console.log('');
console.log(line);
console.log('  アフィリエイトリンクを付けられる記事');
console.log(line);

if (ready.length) {
  console.log('');
  console.log(`★ ${ready.length} 本あります。リンクの発行は、オーナーにしかできません。`);
  for (const r of ready) {
    console.log('');
    console.log(`  ● ${r.title}`);
    console.log(`     articles/${r.slug}.md`);
    console.log(`     選び方の基準: ${r.criterion}`);
    if (r.name) console.log(`     候補: ${r.name}`);
  }
} else {
  console.log('');
  console.log('  ありません。（基準はあるのに url が空、という記事はゼロ）');
}

if (noEntry.length) {
  console.log('');
  console.log(line);
  console.log(`  まだ誰も「基準を作れるか」を見ていない記事: ${noEntry.length} 本`);
  console.log(line);
  console.log('');
  console.log('  ★ 記事は自動で増えます。ここに溜まった分だけ、収益の機会が消えています。');
  console.log('  ★ ただし「基準が導けない」なら、置かないのが正解です。無理に作らないこと。');
  console.log('');
  for (const n of noEntry) console.log(`  ・${n.title}  (articles/${n.slug}.md)`);
}

console.log('');
console.log(line);
console.log(`  すでにリンクが入っている: ${live.length} 本`);
console.log(`  「商品を置かない」と決めた: ${decided.length} 本（基準そのものが記事から導けない）`);
console.log(line);
console.log('');

// ---- ★ ログに埋もれさせない。オーナーが読む場所に、毎回書き出す ----
//
//   ops/ は .gitignore 済み（public リポジトリに出ない）。

const md = [
  '# アフィリエイトリンクを付けられる記事',
  '',
  '**このファイルは機械が毎回まるごと書き直します。手で編集しないでください。**',
  '',
  '**リンクの発行は、オーナーにしかできません。**（CLAUDE.md「金の出口を、勝手に開けない」）',
  '機械は候補を出すところまでです。',
  '',
  '---',
  '',
  `## ★ いま、リンクを付けられる記事: ${ready.length} 本`,
  '',
];

if (ready.length) {
  for (const r of ready) {
    md.push(`### ${r.title}`);
    md.push('');
    md.push(`- 記事: \`articles/${r.slug}.md\``);
    md.push(`- **この記事が示した選び方の基準**: ${r.criterion}`);
    if (r.name) md.push(`- 候補: ${r.name}`);
    md.push('');
  }
} else {
  md.push('ありません。');
  md.push('');
}

if (noEntry.length) {
  md.push('---');
  md.push('');
  md.push(`## まだ「基準を作れるか」を見ていない記事: ${noEntry.length} 本`);
  md.push('');
  md.push('**記事は自動で増えます。ここに溜まった分だけ、収益の機会が消えています。**');
  md.push('');
  md.push('**ただし「基準が導けない」なら、置かないのが正解です。無理に作らないこと。**');
  md.push('');
  for (const n of noEntry) md.push(`- ${n.title}  \`articles/${n.slug}.md\``);
  md.push('');
}

md.push('---');
md.push('');
md.push(`- すでにリンクが入っている: ${live.length} 本`);
md.push(`- 「商品を置かない」と決めた: ${decided.length} 本（基準そのものが記事から導けない）`);
md.push('');

const opsDir = join(ROOT, 'ops');
if (!existsSync(opsDir)) mkdirSync(opsDir, { recursive: true });
writeFileSync(join(opsDir, 'product-candidates.md'), md.join('\n'), 'utf8');
console.log('  ops/product-candidates.md に書きました');
console.log('');

// 呼び出し側（money.ps1 など）が「報告すべきものがあるか」で分岐できるように
process.exit(ready.length || noEntry.length ? 10 : 0);
