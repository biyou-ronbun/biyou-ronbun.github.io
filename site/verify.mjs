// ---------------------------------------------------------------
//  公開前の関門
//
//    node site/verify.mjs
//
//  ここを通らない記事は、絶対に公開させない。
//  GitHub Actions のビルドより前に走り、1本でも落ちたら公開を止める。
//
//  自動生成した記事を人間が読まずに公開する以上、
//  「論文を捏造していない」を人ではなく機械が保証する必要がある。
//  これがこのブログの唯一の武器を守る装置。
//
//  検査するもの:
//    1. 参考文献の PMID が PubMed に実在するか
//    2. その PMID の本当のタイトル・年・著者が、記事の記述と一致するか
//    3. 薬機法で明確にアウトな表現が混ざっていないか
//    4. 「日常への生かし方」と参考文献のセクションがあるか
// ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);

const meta = JSON.parse(readFileSync(join(SITE, 'articles.json'), 'utf8'));

const failures = [];
const warnings = [];

// ---- 薬機法: 書いた時点でアウトな表現 ----------------------------
//
// 誤検知を出さないため、確実に黒のものだけを並べる。
// 「効く」「効かない」単体は、記事タイトルや引用で正当に出てくるので入れない。

const FORBIDDEN = [
  'シミが消える', 'シミが取れる', 'シワが消える', 'シワがなくなる',
  '肌が若返る', '若返り効果', 'アンチエイジング効果',
  '細胞が生まれ変わる', '肌が再生する',
  'デトックス', '毒素を排出',
  '副作用はありません', '副作用がない', '100%安全', '絶対に安全',
  '必ず効きます', '絶対に効く', '誰にでも効く',
  'ニキビが治る', 'アトピーが治る',
  '医師も推奨', '医師が推奨',
];

// ---- PubMed に問い合わせる ---------------------------------------

async function fetchPubmed(pmids) {
  if (pmids.length === 0) return {};
  const url =
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi' +
    `?db=pubmed&retmode=json&id=${pmids.join(',')}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'biyou-ronbun-verify/1.0' } });
  if (!res.ok) throw new Error(`PubMed への問い合わせが失敗しました (HTTP ${res.status})`);

  const json = await res.json();
  return json.result ?? {};
}

// 比較用に、記号と大文字小文字の差を落とす
const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// ---- 記事を1本ずつ検査する ---------------------------------------

const allPmids = new Set();
const articles = [];

for (const a of meta) {
  if (!a.published) continue;

  const path = join(ROOT, 'articles', `${a.slug}.md`);
  if (!existsSync(path)) {
    failures.push(`${a.slug}: 記事ファイルがありません（articles.json には published: true と書かれています）`);
    continue;
  }

  const text = readFileSync(path, 'utf8');

  // 参考文献の行だけを取り出す（PMID を含む行）
  const refLines = text
    .split(/\r?\n/)
    .filter((l) => /PMID/i.test(l));

  const pmids = [];
  for (const line of refLines) {
    const m = line.match(/PMID[:：]?\s*(\d{6,9})/i);
    if (m) {
      pmids.push({ pmid: m[1], line });
      allPmids.add(m[1]);
    }
  }

  articles.push({ ...a, text, pmids });

  // --- 構造の検査 ---
  if (!/##\s*日常への生かし方/.test(text)) {
    failures.push(`${a.slug}: 「日常への生かし方」のセクションがありません（全記事で必須）`);
  }
  if (!/参考文献/.test(text)) {
    failures.push(`${a.slug}: 参考文献のセクションがありません`);
  }
  if (pmids.length === 0) {
    failures.push(`${a.slug}: PMID 付きの参考文献が1つもありません（論文カードに基づいていない疑い）`);
  }

  // --- 薬機法の検査 ---
  for (const ng of FORBIDDEN) {
    if (text.includes(ng)) {
      failures.push(`${a.slug}: 薬機法でアウトな表現が入っています → 「${ng}」`);
    }
  }
}

// ---- PubMed で実在とタイトルを突き合わせる -------------------------

console.log(`PubMed に ${allPmids.size} 件の PMID を問い合わせます...`);

let result = {};
try {
  result = await fetchPubmed([...allPmids]);
} catch (e) {
  console.error(`\n！ ${e.message}`);
  console.error('  PubMed に届かないときは、公開を止めます（検証できない記事は出さない）。');
  process.exit(1);
}

for (const a of articles) {
  for (const { pmid, line } of a.pmids) {
    const rec = result[pmid];

    // 1. 実在するか
    if (!rec || rec.error) {
      failures.push(`${a.slug}: PMID ${pmid} は PubMed に存在しません（捏造の疑い）`);
      continue;
    }

    const refNorm = normalize(line);

    // 2. タイトルが一致するか（これが捏造をいちばん確実に捕まえる）
    //
    // 参考文献では副題（コロン以降。"…: a double-blind study" など）を
    // 省くのが普通なので、コロンより前の主題で突き合わせる。
    // 主題がまるごと違えば、それは別の論文の番号を書いている＝捏造。
    const mainTitle = normalize((rec.title ?? '').split(/[:：]/)[0]);

    if (mainTitle && !refNorm.includes(mainTitle)) {
      const words = mainTitle.split(' ').filter((w) => w.length > 3);
      const hit = words.filter((w) => refNorm.includes(w)).length;
      const ratio = words.length ? hit / words.length : 0;
      if (ratio < 0.8) {
        failures.push(
          `${a.slug}: PMID ${pmid} のタイトルが一致しません（別の論文の番号を書いている疑い）\n` +
            `      記事: ${line.trim().slice(0, 90)}\n` +
            `      実際: ${rec.title}`
        );
        continue;
      }
    }

    // 3. 発行年が一致するか
    const year = (rec.pubdate ?? '').match(/\d{4}/)?.[0];
    if (year && !line.includes(year)) {
      warnings.push(`${a.slug}: PMID ${pmid} の年（${year}）が参考文献の行に見当たりません`);
    }

    // 4. 第一著者の姓が入っているか
    const firstAuthor = rec.sortfirstauthor ?? rec.authors?.[0]?.name ?? '';
    const surname = firstAuthor.split(' ')[0];
    if (surname && !refNorm.includes(normalize(surname))) {
      warnings.push(`${a.slug}: PMID ${pmid} の第一著者（${surname}）が参考文献の行に見当たりません`);
    }
  }
}

// ---- 結果 ---------------------------------------------------------

console.log('');

if (warnings.length) {
  console.log('--- 注意（公開は止めません） ---');
  warnings.forEach((w) => console.log(`  ・${w}`));
  console.log('');
}

if (failures.length) {
  console.error('=========================================');
  console.error(`  公開を中止します。${failures.length} 件の問題があります。`);
  console.error('=========================================');
  failures.forEach((f) => console.error(`\n  ✗ ${f}`));
  console.error('\n記事を直すまで、このサイトは公開されません。');
  process.exit(1);
}

console.log('=========================================');
console.log(`  検証を通過しました`);
console.log(`  記事 ${articles.length} 本 / PMID ${allPmids.size} 件すべてが PubMed に実在し、`);
console.log(`  タイトルも一致しています。薬機法の禁止表現もありません。`);
console.log('=========================================');
