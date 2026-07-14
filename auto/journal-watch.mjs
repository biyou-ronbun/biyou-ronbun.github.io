// ---------------------------------------------------------------
//  海外の学術誌の「新着」を監視する。
//
//      node auto/journal-watch.mjs [--days 14]
//
//  ★★ この機械が絶対にやらないこと
//
//    ✗ **翻訳して、要約して、記事にする**
//
//      それは「他人の情報を、右から左に流す」こと。
//      Google のスパムポリシーは「**AIで価値を加えないページの大量生成**」を
//      明示的に禁じている（自動か人力かを問わない）。
//      **このサイトを殺すのは、書かないことではなく、薄いものを書くこと。**
//
//    ✗ **化粧品メーカーのプレスリリースを、記事にする**
//
//      翻訳して記事にすれば、**うちは無料の宣伝媒体**になる。
//      （ニュースの関門が「新発売コーナーは作らない」と決めているのと、同じ理由）
//
//  ★ この機械がやること
//
//      **「この論文が出た」を知らせるだけ。**
//
//      記事にするかどうかは、いつもの流れを通す:
//
//        researcher → research/<slug>.md（論文カード）→ writer → 記事
//
//      **カード無しで書かせると、このブログの唯一の武器が壊れる**（CLAUDE.md）。
//
//  出力: ops/journal-watch.md（.gitignore 済み。公開されない）
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const argDays = process.argv.indexOf('--days');
const DAYS = argDays >= 0 ? Number(process.argv[argDays + 1]) : 14;

// ★ 見る雑誌。**皮膚科学・化粧品科学の一次情報が載るところだけ。**
//   ここに「業界誌」「ニュースサイト」を足さないこと。**それは一次情報ではない。**
const JOURNALS = [
  'J Am Acad Dermatol',
  'Br J Dermatol',
  'JAMA Dermatol',
  'J Invest Dermatol',
  'Int J Cosmet Sci',
  'J Cosmet Dermatol',
  'Clin Cosmet Investig Dermatol',
  'Skin Res Technol',
  'Dermatol Ther',
  'J Dermatol Sci',
];

// ★ うちが扱っているテーマ。**新着のうち、ここに関わるものだけを見る。**
const TOPICS = [
  'retinol',
  'retinoid',
  'ascorbic acid',
  'hyaluronic acid',
  'sunscreen',
  'photoprotection',
  'collagen',
  'niacinamide',
  'ceramide',
  'exosome',
  'polydeoxyribonucleotide',
  'moisturizer',
  'emollient',
  'skin barrier',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ★ 二重報告を避ける（もう見た PMID は、また出さない）
const SEEN = join(ROOT, 'ops', 'journal-watch-seen.json');
const seen = new Set(existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : []);

// すでに記事で引いている論文も、除く
const ledger = new Set(
  JSON.parse(readFileSync(join(ROOT, 'site', 'papers.json'), 'utf8')).papers.map((p) => String(p.pmid))
);

const jq = JOURNALS.map((j) => `"${j}"[ta]`).join(' OR ');
const tq = TOPICS.map((t) => `"${t}"[tiab]`).join(' OR ');

// ★★ ここに罠がある。**MeSH（humans[mh]）で絞ってはいけない。**
//
//   MeSH は、PubMed の司書が後から付ける索引語。
//   **索引付けは数週間〜数か月遅れる。**
//
//   つまり「新着」を humans[mh] で絞ると、**新着が消える。**
//
//   実測（2026-07-14、過去30日）:
//     humans[mh] あり →  1 件
//     humans[mh] なし → 38 件   ← **37件を、索引の遅れで見落としていた**
//
//   ★ だから、絞るのは検索ではなく、**結果の側（pubtype）**で行う。
//     pubtype は出版時に付くので、遅れない。
const query = `(${jq}) AND (${tq})`;

console.log('');
console.log('='.repeat(66));
console.log(`  海外の学術誌の新着（過去 ${DAYS} 日）`);
console.log('='.repeat(66));
console.log('');
console.log(`  雑誌 ${JOURNALS.length} 誌 / テーマ ${TOPICS.length} 語`);
console.log('  ★ MeSH（humans[mh]）では絞っていません。**索引が遅れて、新着が消えるからです。**');
console.log('    動物・試験管は、タイトルから「疑い」の印を付けるだけ。**断定はしません。**');
console.log('');

const searchUrl =
  `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=60` +
  `&datetype=edat&reldate=${DAYS}` +
  `&term=${encodeURIComponent(query)}`;

const res = await fetch(searchUrl);
if (!res.ok) {
  console.log(`★ 取得失敗: PubMed が HTTP ${res.status} を返しました`);
  console.log('  **「0件」ではありません。取得できなかったのです。**');
  process.exit(1);
}

const json = await res.json();
const ids = json.esearchresult?.idlist ?? [];
const total = Number(json.esearchresult?.count ?? 0);

console.log(`  PubMed が返した件数: ${total} 件`);

// ★ 検索語が壊れていないか（PubMed は知らない語を黙って無視する）
if (json.esearchresult?.errorlist || json.esearchresult?.warninglist) {
  const e = json.esearchresult.errorlist ?? {};
  const w = json.esearchresult.warninglist ?? {};
  const bad = [...(e.phrasesnotfound ?? []), ...(w.phrasesignored ?? [])];
  if (bad.length) {
    console.log('');
    console.log('  ★ PubMed が検索語の一部を無視しました。**この検索を信用しないこと:**');
    console.log('    ' + bad.join(', '));
  }
}

const fresh = ids.filter((id) => !seen.has(id) && !ledger.has(id));
console.log(`  うち、まだ見ていないもの: ${fresh.length} 件`);
console.log('');

if (!fresh.length) {
  console.log('  ★ 新しいものはありませんでした。');
  console.log('    **これは正常です。** 美容の一次研究が、毎週たくさん出ることはありません。');
  console.log('    **無いのに探し続けると、無理やり何かを記事に仕立てることになります。**');
  process.exit(0);
}

await sleep(400);
const sumUrl = `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${fresh.join(',')}`;
const sres = await fetch(sumUrl);
const sjson = await sres.json();
const result = sjson.result ?? {};

// ★ 動物・試験管を、タイトルで落とす。
//   （MeSH で絞れないので、ここで落とす。**MeSH は索引が遅れて、新着が消える**）
const NOT_HUMAN =
  /\bmice\b|\bmouse\b|\brats?\b|murine|in vitro|in-vitro|zebrafish|porcine|\bpigs?\b|cell line|keratinocyte culture|fibroblast culture|ex vivo/i;

const rows = [];
for (const id of fresh) {
  const r = result[id];
  if (!r) continue;
  const pubtype = r.pubtype ?? [];
  const title = r.title ?? '';

  rows.push({
    pmid: id,
    title,
    journal: r.source ?? '',
    date: r.pubdate ?? '',
    types: pubtype,
    retracted: pubtype.includes('Retracted Publication'),
    // ★ 強い設計（記事の材料になりうる）
    strong:
      pubtype.includes('Randomized Controlled Trial') ||
      pubtype.includes('Meta-Analysis') ||
      pubtype.includes('Systematic Review'),
    // ★ タイトルから、動物・試験管と分かるもの
    //   （断定はしない。**「疑い」として印を付けるだけ。** 一次情報を開くのは人間）
    maybeNotHuman: NOT_HUMAN.test(title),
  });
}

// 強い設計 → その他 → 動物・試験管の疑い、の順
rows.sort(
  (a, b) =>
    Number(b.strong) - Number(a.strong) ||
    Number(a.maybeNotHuman) - Number(b.maybeNotHuman)
);

for (const r of rows) {
  const mark = r.retracted ? '★撤回 ' : r.strong ? '★強い ' : '      ';
  console.log(`  ${mark} PMID ${r.pmid}  ${r.journal} ${r.date}`);
  console.log(`         ${r.title.slice(0, 64)}`);
  console.log('');
}

// ---- ops に書く（.gitignore 済み。公開されない） ------------------------

const md = [
  '# 海外の学術誌の新着',
  '',
  '**このファイルは機械が毎回まるごと書き直します。手で編集しないでください。**',
  '',
  '## ★★ これは「記事の材料」であって、「記事」ではありません',
  '',
  '**翻訳して要約して記事にすることは、できません。**',
  '',
  'それは「他人の情報を、右から左に流す」ことです。',
  'Google のスパムポリシーは「**AIで価値を加えないページの大量生成**」を明示的に禁じています。',
  '**このサイトを殺すのは、書かないことではなく、薄いものを書くことです。**',
  '',
  '**記事にするなら、いつもの流れを通してください:**',
  '',
  '```',
  'researcher → research/<slug>.md（論文カード）→ writer → 記事',
  '```',
  '',
  '**カード無しで書かせると、このブログの唯一の武器が壊れます。**',
  '',
  '---',
  '',
  `- 過去 ${DAYS} 日 / 雑誌 ${JOURNALS.length} 誌 / テーマ ${TOPICS.length} 語`,
  '',
  '★ **MeSH（humans[mh]）では絞っていません。** MeSH の索引付けは数週間〜数か月遅れるため、',
  '  新着を MeSH で絞ると、**新着が消えます**（実測: 過去30日で 1件 vs 38件）。',
  '  動物・試験管は、タイトルから「疑い」の印を付けるだけです。**断定はしません。**',
  '',
  '★ **検索語のノイズは、そのまま出します。**',
  '  「hyaluronic acid」は「hyaluronidase（ヒアルロン酸を溶かす酵素）」にも引っかかります。',
  '  **除かずに出すのは、こちらで勝手に間引くと、見落としが起きるからです。**',
  `- PubMed が返した件数: **${total} 件**`,
  `- まだ見ていないもの: **${rows.length} 件**`,
  '',
  '## 新着',
  '',
];

for (const r of rows) {
  const mark = r.retracted ? '**★ 撤回済み**' : r.strong ? '**★ RCT / メタ解析 / システマティックレビュー**' : '';
  md.push(`### ${r.title}`);
  md.push('');
  md.push(`- PMID [${r.pmid}](https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/) ${mark}`);
  md.push(`- ${r.journal} ${r.date}`);
  md.push(`- 種別: ${r.types.join(' / ')}`);
  md.push('');
}

md.push('---');
md.push('');
md.push('## ★ この一覧の使い方');
md.push('');
md.push('1. **RCT / メタ解析だけを見る。** 動物・試験管の新着は、記事にできません');
md.push('2. **「うちの記事が扱っているテーマ」と重なるものを探す**');
md.push('3. **重なったら、researcher に論文カードを作らせる**');
md.push('   （`node site/pubmed.mjs get <PMID>` で一次情報を開く）');
md.push('4. **既存の記事を更新するなら、その記事の錨を確認してから**');
md.push('   （`node site/set-anchors.mjs <slug> --show`）');
md.push('');
md.push('**★ 「今週は何も無かった」が、最も多い正解です。**');
md.push('**美容の一次研究が、毎週たくさん出ることはありません。**');
md.push('**無いのに探し続けると、無理やり何かを記事に仕立てることになります。**');
md.push('');

const opsDir = join(ROOT, 'ops');
if (!existsSync(opsDir)) mkdirSync(opsDir, { recursive: true });
writeFileSync(join(opsDir, 'journal-watch.md'), md.join('\n'), 'utf8');

for (const r of rows) seen.add(r.pmid);
writeFileSync(SEEN, JSON.stringify([...seen], null, 2) + '\n', 'utf8');

console.log('='.repeat(66));
console.log('  ops/journal-watch.md に書きました');
console.log('');
console.log('  ★ これは「記事の材料」です。「記事」ではありません。');
console.log('  ★ 記事にするなら researcher → 論文カード → writer を通すこと。');
console.log('='.repeat(66));

// ---- ★★ 終了コードで、呼び出し側に合図する ------------------------------
//
//   ★ 「新着を分析しろ」と毎週命じられた機械は、**新着が無い週に、推測でデータを作る。**
//     （需要の輪〈auto/demand.ps1〉と、まったく同じ構造）
//
//   **強い設計（RCT / メタ解析 / システマティックレビュー / 撤回）が1本も無ければ、
//     Claude を呼ばずに終わらせる。**
//
//   ★ 「今週は何も無かった」が、最も多い正解。
//     美容の一次研究が、毎週たくさん出ることはない。
//
//   終了コード:
//     10 = 見るべき新着がある（Claude を呼んでよい）
//      0 = 無い。**Claude を呼ばずに終わること**
//      1 = 取得失敗。**「0件」ではない**

const worth = rows.filter((r) => r.strong || r.retracted);

console.log('');
if (!worth.length) {
  console.log('  ★ RCT・メタ解析・撤回は、1本もありませんでした。');
  console.log('    **これは正常です。** Claude を呼ばずに終わります。');
  console.log('    **無いのに探し続けると、無理やり何かを記事に仕立てることになります。**');
  process.exit(0);
}

console.log(`  ★ 見るべき新着: ${worth.length} 本（RCT / メタ解析 / 撤回）`);
for (const r of worth) {
  console.log(`      ${r.retracted ? '撤回' : '強い'}  PMID ${r.pmid}  ${r.title.slice(0, 52)}`);
}
process.exit(10);
