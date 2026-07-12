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
const products = JSON.parse(readFileSync(join(SITE, 'products.json'), 'utf8'));

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

// ---- 商品（アフィリエイト）の検査 ---------------------------------
//
// 薬機法66条は「何人も」が対象。効能を書いた瞬間、罰せられるのは
// 広告主ではなく、書いた側です。商品説明にも同じ検査をかけます。

for (const [slug, entry] of Object.entries(products)) {
  if (slug.startsWith('_')) continue;
  for (const item of entry.items ?? []) {
    if (!item.url || !item.name) continue;

    for (const ng of FORBIDDEN) {
      if ((item.criterion ?? '').includes(ng) || (item.name ?? '').includes(ng)) {
        failures.push(
          `${slug}: 商品「${item.name}」の説明に薬機法でアウトな表現があります → 「${ng}」`
        );
      }
    }
    if (!item.criterion) {
      failures.push(
        `${slug}: 商品「${item.name}」に criterion（記事のどの基準に合うか）がありません。` +
          `基準なしで商品を並べるのは、このブログでは単なる宣伝です`
      );
    }
    if (!/^https?:\/\//.test(item.url)) {
      failures.push(`${slug}: 商品「${item.name}」の url が不正です`);
    }
  }
}

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

  // --- 質の関門 ---
  //
  // Google のスパムポリシーは「AIで価値を加えないページを大量生成すること」を
  // 明示的に禁じている（自動か人力かを問わない）。
  // 論文が実在するだけでは足りない。「他所では読めない一段」が無い記事は、
  // 量産された無価値なページと判定され、サイトごと沈む。
  //
  // ここは機械にできる範囲の代理指標。完璧ではないが、
  // 「薄い記事を1本も通さない」ための最低ラインとして機能する。

  const body = text.replace(/<!--[\s\S]*?-->/g, '');

  // 1. 「ここまでは言えません」——限界を書いていない記事は、このブログの記事ではない
  if (!/ここまでは言えません|ここまでは言えない/.test(body)) {
    failures.push(
      `${a.slug}: 「ここまでは言えません」のセクションがありません。` +
        `根拠の限界を書かない記事は、このブログの武器を捨てています`
    );
  }

  // 2. 独自の一段があるか（資金提供元 / 動物実験 / 出典が無いことの指摘）
  const SIGNATURE = [
    '資金', '利益相反', 'COI', 'スポンサー',
    'マウス', 'ラット', 'ブタ', '動物実験', '培養', 'in vitro', '試験管',
    '見つかりませんでした', '見つかりません', '確認できませんでした', '確認できていません',
    '根拠は見当たりません', '裏付けは', '出典',
  ];
  if (!SIGNATURE.some((s) => body.includes(s))) {
    failures.push(
      `${a.slug}: このブログ固有の一段（資金提供元・動物実験・出典が無いことの指摘）が1つもありません。\n` +
        `      他所のまとめ記事と区別がつかない記事は、Google に価値なしと判定されます`
    );
  }

  // 3. 根拠の厚み。PMID が3件未満の記事は、調べ切れていない
  const unique = new Set(pmids.map((p) => p.pmid));
  if (unique.size > 0 && unique.size < 3) {
    failures.push(
      `${a.slug}: 引用している論文が ${unique.size} 件しかありません（最低3件）。` +
        `1〜2本の論文で結論を出すのは、このブログのやり方ではありません`
    );
  }

  // 4. 薄さの検出
  const chars = body.replace(/\s/g, '').length;
  if (chars < 2000) {
    failures.push(`${a.slug}: 本文が ${chars} 字しかありません（最低2,000字）`);
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
