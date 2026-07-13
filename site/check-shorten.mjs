// ---------------------------------------------------------------
//  記事を短くしたとき、何が消えたかを機械で洗い出す。
//
//      node site/check-shorten.mjs <slug>
//
//  ★ 2026-07-14、9本を同時に短くして、9本とも壊れた。
//    **書き換えた本人は「事実は落としていない」と報告した。全部、嘘だった。**
//
//    この道具は、その5つの壊れ方を全部拾う。
// ---------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, '..');

const slug = process.argv[2];
if (!slug) {
  console.log('使い方: node site/check-shorten.mjs <slug>');
  process.exit(1);
}

const after = readFileSync(join(ROOT, 'articles', `${slug}.md`), 'utf8').replace(/\r\n/g, '\n');

let before;
try {
  before = execSync(`git show HEAD:articles/${slug}.md`, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  }).replace(/\r\n/g, '\n');
} catch {
  console.log(`★ git に ${slug} がありません`);
  process.exit(1);
}

const figs = JSON.parse(readFileSync(join(SITE, 'figures.json'), 'utf8')).figures;

const withFigs = (md) => {
  const ids = [...md.matchAll(/^::figure:([\w-]+)::/gm)].map((m) => m[1]);
  return md + ' ' + ids.map((id) => (figs[id] ? JSON.stringify(figs[id]) : '')).join(' ');
};

const hayAfter = withFigs(after).replace(/\s/g, '');
const problems = [];
const line = '─'.repeat(70);

const nBefore = before.replace(/\s/g, '').length;
const nAfter = after.replace(/\s/g, '').length;

console.log('');
console.log('='.repeat(70));
console.log(`  ${slug} を短くしたとき、何が消えたか`);
console.log('='.repeat(70));
console.log(`  ${nBefore} 字 → ${nAfter} 字（${Math.round((1 - nAfter / nBefore) * 100)}% 減）`);

// ---- ① 図が site/figures.json に統合されているか -------------------------
//
//   ★ 統合を忘れると、build.mjs は ::figure:id:: の行を黙って捨てる。
//     **「文章から消して図に移した」事実が、公開ページのどこにも存在しなくなる。**
//     2026-07-14、47点中18点がこれだった。

console.log('');
console.log('① 図は、site/figures.json に統合されているか');
console.log(line);

const usedIds = [...after.matchAll(/^::figure:([\w-]+)::/gm)].map((m) => m[1]);
const missingFigs = usedIds.filter((id) => !figs[id]);

if (missingFigs.length) {
  for (const id of missingFigs) {
    console.log(`  ★ 図「${id}」が site/figures.json にありません`);
    problems.push(`図「${id}」が未統合。公開ページから、その事実が消えます`);
  }
} else {
  console.log(`  ○ ${usedIds.length} 点すべて統合済み`);
}

// ---- ② 図の数値が、記事本文にあるか（捏造の検出） -------------------------
//
//   ★ 2026-07-14、「剤型で4倍の差がついた」が図に現れた。
//     「4倍」は記事のどこにも無い。1.2 ÷ 0.3 から作られた数字だった。
//     **そして同じファイルに「新しい数字は1つも作っていません」と書いてあった。**

console.log('');
console.log('② 図の数値は、記事本文にあるか（無ければ捏造）');
console.log(line);

const bodyNums = new Set([
  ...[...after.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]),
  ...[...before.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]),
]);
let fabricated = 0;

for (const id of usedIds) {
  const f = figs[id];
  if (!f) continue;
  const pm = new Set((f.sourcePmids ?? []).map(String));
  for (const n of new Set([...JSON.stringify(f).matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]))) {
    if (pm.has(n) || Number(n) <= 3 || bodyNums.has(n)) continue;
    console.log(`  ★ 図「${id}」の数値「${n}」が、記事本文（前・後とも）にありません`);
    problems.push(`図「${id}」の数値「${n}」は捏造の疑い`);
    fabricated++;
  }
}
if (!fabricated) console.log('  ○ 図の数値は、すべて記事にあります');

// ---- ③ ★ 味方をする事実が消えていないか ---------------------------------
//
//   ★★ 2026-07-14、これがいちばん重い壊れ方だった。
//
//     飲むコラーゲン: 「水分量については報告が比較的一貫しています」が消えた
//     飲む日焼け止め: 「設計自体はしっかりしています」が消えた
//
//   **「文字数を減らせ」と命じられた機械は、まず「味方をする事実」を削る。**
//   否定の材料は結論を支えるので残す。**肯定の材料は結論と逆なので、削りやすい。**
//   **そうやって、記事は静かに糾弾リストになる。**

console.log('');
console.log('③ ★ 味方をする事実（肯定・公平な評価）が、消えていないか');
console.log(line);

const FAVOURABLE =
  /一貫し|しっかりし|きちんと|妥当|確かに|有意に(?:良|改善|上)|裏付けられ|再現され|独立資金|信頼でき|質は高|盲検|プラセボ対照|大規模|支持がある|存在します|ではありません|公的資金/g;

const favBefore = [...before.matchAll(FAVOURABLE)].length;
const favAfter = [...withFigs(after).matchAll(FAVOURABLE)].length;

if (favAfter < favBefore) {
  console.log(`  ★ ${favBefore} 箇所 → ${favAfter} 箇所（${favBefore - favAfter} 箇所 減った）`);
  console.log('');
  console.log('     **記事が一方的になっていないか、消えた行を1つずつ確かめてください。**');
  problems.push(`味方をする事実が ${favBefore - favAfter} 箇所 減った（糾弾リストへの傾き）`);
} else {
  console.log(`  ○ ${favBefore} 箇所 → ${favAfter} 箇所（減っていません）`);
}

// ---- ④ p値が消えていないか -----------------------------------------------
//
//   ★ p値は、消えても「消えたように見えない」。
//     数値（+26%）だけが残り、それが偶然かどうかが分からなくなる。
//     **だから真っ先に削られる。**

console.log('');
console.log('④ p値・信頼区間が、消えていないか');
console.log(line);

const PVAL = /p\s*[=＝<＜>＞]\s*0?\.\d+|P\s*=\s*\.\d+|95%\s*(?:CI|信頼区間)|有意差|有意に|OR\s*[\d.]+|HR\s*[\d.]+/gi;
const pBefore = [...before.matchAll(PVAL)].length;
const pAfter = [...withFigs(after).matchAll(PVAL)].length;

if (pAfter < pBefore) {
  console.log(`  ★ ${pBefore} 箇所 → ${pAfter} 箇所（${pBefore - pAfter} 箇所 減った）`);
  problems.push(`p値・信頼区間が ${pBefore - pAfter} 箇所 減った`);
} else {
  console.log(`  ○ ${pBefore} 箇所 → ${pAfter} 箇所`);
}

// ---- ⑤ 消えた「重い行」を、全部出す ---------------------------------------

console.log('');
console.log('⑤ 消えた「重い行」（数値・資金源・所属・見つからなかった、を含む行）');
console.log(line);

const HEAVY =
  /\d|資金|利益相反|COI|所属|社員|見つかりません|見つからな|確認でき|示していません|報告されて|マウス|ラット|ブタ|培養|試験管|プラセボ|盲検|対照群/;

const norm = (s) => s.replace(/[\s*_>#`「」（）()、。]/g, '');
const afterLines = new Set(after.split('\n').map(norm).filter(Boolean));

const gone = before
  .split('\n')
  .filter((l) => l.trim() && HEAVY.test(l))
  .filter((l) => !afterLines.has(norm(l)))
  .filter((l) => {
    const n = norm(l);
    if (n.length < 12) return false;
    return !hayAfter.includes(n.slice(0, Math.min(24, n.length)));
  });

if (gone.length) {
  console.log(`  ★ ${gone.length} 行が、記事からも図からも消えています:`);
  console.log('');
  for (const l of gone.slice(0, 25)) console.log('     ・' + l.trim().slice(0, 88));
  if (gone.length > 25) console.log(`     …ほか ${gone.length - 25} 行`);
  problems.push(`重い行が ${gone.length} 行、記事からも図からも消えた`);
} else {
  console.log('  ○ 消えた重い行はありません（図の中も探しました）');
}

// ---- 判定 -----------------------------------------------------------------

console.log('');
console.log('='.repeat(70));
if (problems.length) {
  console.log(`  ★ ${problems.length} 件の問題`);
  console.log('='.repeat(70));
  for (const p of problems) console.log(`  ・${p}`);
  console.log('');
  console.log('  **記事を短くするのは構いません。事実を落とすことは、できません。**');
  process.exit(1);
}
console.log('  ○ 問題は見つかりませんでした');
console.log('='.repeat(70));
