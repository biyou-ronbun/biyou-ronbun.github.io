// ---------------------------------------------------------------
//  記事に「錨」を打つ。
//
//      node site/set-anchors.mjs <slug> <錨1> <錨2> ...
//      node site/set-anchors.mjs <slug> --show     … いまの錨を見る
//      node site/set-anchors.mjs <slug> --suggest  … 候補を、記事から抜粋して出す
//
//  ★ 錨 = 書き換えで、絶対に消してはいけない事実。
//    site/verify.mjs が、1つでも消えたら公開を止める。
//
//  ★★ 錨は、削る本人が決めてはいけない。
//    2026-07-14、削るエージェント自身が錨を作った。
//    **削ってはいけないものを、削る本人が決めていた。意味がない。**
//
//  ★★★ そして、錨そのものを捏造しないこと。
//    私は「独立資金でも確認されている」「ニュートロジーナ」を錨にしようとした。
//    **どちらも記事に無い文字列だった。** 候補を拾うスクリプトが要約を作っていた。
//    **「削ってはいけない事実」の一覧そのものを、捏造しかけた。**
//
//    → このスクリプトは、**記事に一字一句無い錨を、打たせない。**
// ---------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFigures } from './article-metrics.mjs';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, '..');
const P = join(SITE, 'article-baseline.json');

const [slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.log('使い方:');
  console.log('  node site/set-anchors.mjs <slug> <錨1> <錨2> ...');
  console.log('  node site/set-anchors.mjs <slug> --show');
  console.log('  node site/set-anchors.mjs <slug> --suggest');
  process.exit(1);
}

const md = readFileSync(join(ROOT, 'articles', `${slug}.md`), 'utf8');
const hay = withFigures(md).replace(/\s/g, '');
const d = JSON.parse(readFileSync(P, 'utf8'));

if (!d.articles[slug]) {
  console.log(`★ ${slug} が site/article-baseline.json にありません`);
  process.exit(1);
}

// ---- いまの錨を見る --------------------------------------------------
if (rest[0] === '--show') {
  const a = d.articles[slug].mustSurvive ?? [];
  console.log(`${slug} の錨: ${a.length} 本`);
  for (const s of a) console.log(`  ${hay.includes(s.replace(/\s/g, '')) ? '○' : '★ 記事に無い'}  ${s}`);
  process.exit(0);
}

// ---- 候補を、記事から「抜粋」して出す（要約しない） ---------------------
//
//   ★ ここが肝心。**記事の文字列を、そのまま切り出す。**
//     要約すると、記事に無い文字列が生まれる。**それは捏造。**
if (rest[0] === '--suggest') {
  const body = md.replace(/\r\n/g, '\n');
  const out = new Set();

  const pick = (re, len = 22) => {
    for (const m of body.matchAll(re)) {
      const s = m[0].replace(/[\s*_>#`]/g, '').slice(0, len);
      if (s.length >= 3) out.add(s);
    }
  };

  // p値・信頼区間（消えても消えたように見えない）
  pick(/p\s*[=＝<＜]\s*0?\.\d+/gi, 12);
  pick(/P\s*=\s*\.\d+/g, 10);
  pick(/95%\s*CI\s*[\d.–\-〜~]+/g, 20);
  pick(/(?:OR|HR|RR)\s*[\d.]+/g, 10);

  // ★ 味方をする事実（真っ先に削られる）
  pick(/[^\n。]{0,14}(?:しっかりし|一貫し|抑えられました|再現され|裏付けられ|独立資金|有意に良)[^\n。]{0,8}/g, 26);

  // 資金源・所属
  pick(/[^\n。]{0,12}(?:資金提供|資金を出した|利益相反|所属|社員)[^\n。]{0,12}/g, 24);

  // 見つからなかった（唯一の武器）
  pick(/[^\n。]{0,10}(?:見つかりませんでした|見つからなかった|確認できませんでした|1本も|0件)/g, 22);

  // 動物・試験管・モデル（ヒトの話ではない、という指摘）
  pick(/(?:マウス|ラット|ブタ|培養|試験管|数学モデル|ex vivo|in vitro)/g, 12);

  // 固有名詞・地名・年齢層（読者が原典に帰る手がかり）
  pick(/(?:[ぁ-ん]{0,2})?[ァ-ヴー]{3,10}(?:州|大学|社|製薬)/g, 14);
  pick(/\d{1,2}〜\d{1,2}代/g, 8);

  // 強い数字
  pick(/n\s*=\s*\d+/gi, 8);
  pick(/\d+(?:\.\d+)?\s*(?:mg\/cm|%|人|件|本|日|週|年)/g, 12);

  const list = [...out].filter((s) => hay.includes(s.replace(/\s/g, '')));
  console.log(`${slug} の錨の候補: ${list.length} 件（すべて記事に一字一句あるもの）`);
  console.log('');
  for (const s of list) console.log(`  ${s}`);
  console.log('');
  console.log('★ この中から選んで、set-anchors.mjs <slug> <錨> ... で打ってください。');
  console.log('★ 必ず入れること: p値 / 味方をする事実 / 資金源 / 見つからなかった / 動物・試験管');
  process.exit(0);
}

// ---- 錨を打つ（★ 記事に無いものは、打たせない） -------------------------
const anchors = rest;
if (!anchors.length) {
  console.log('★ 錨が1つも渡されていません');
  process.exit(1);
}

const missing = anchors.filter((s) => !hay.includes(s.replace(/\s/g, '')));
if (missing.length) {
  console.log('★★ 記事に無い錨があります。**打ちません。**');
  console.log('');
  for (const s of missing) console.log(`  ・「${s}」`);
  console.log('');
  console.log('  **これは、錨そのものの捏造です。**');
  console.log('  「削ってはいけない事実」の一覧に、記事に無い文を書いてはいけません。');
  console.log('');
  console.log('  記事から一字一句コピーしてください:');
  console.log(`    node site/set-anchors.mjs ${slug} --suggest`);
  process.exit(1);
}

d.articles[slug].mustSurvive = anchors;
writeFileSync(P, JSON.stringify(d, null, 2) + '\n', 'utf8');

console.log(`${slug} に、錨を ${anchors.length} 本 打ちました（すべて記事に実在）`);
for (const s of anchors) console.log(`  ○ ${s}`);
