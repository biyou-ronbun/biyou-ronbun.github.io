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

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);

const meta = JSON.parse(readFileSync(join(SITE, 'articles.json'), 'utf8'));
const products = JSON.parse(readFileSync(join(SITE, 'products.json'), 'utf8'));
const papersData = JSON.parse(readFileSync(join(SITE, 'papers.json'), 'utf8'));

// 論文台帳に載っている PMID
const ledger = new Map(papersData.papers.map((p) => [String(p.pmid), p]));

const FUNDING_WORDS = ['industry', 'public', 'independent', 'none', 'unverified'];
const CONFIRMED_WORDS = ['fulltext', 'abstract', 'bibliographic'];

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

// ---- 論文台帳の検査 -------------------------------------------------
//
// 記事が引用した論文は、必ず台帳（site/papers.json）に載っていること。
// 載せ忘れると、その論文の身元調査の記録が失われる。
// 「調査したのに記録していない」は、このブログでは調査していないのと同じ。

for (const [key, p] of ledger) {
  if (!FUNDING_WORDS.includes(p.fundingType)) {
    failures.push(
      `台帳 PMID ${key}: fundingType が「${p.fundingType}」です。` +
        `使えるのは ${FUNDING_WORDS.join(' / ')} のみ（自由記述にすると数えられなくなります）`
    );
  }
  if (!CONFIRMED_WORDS.includes(p.confirmed)) {
    failures.push(
      `台帳 PMID ${key}: confirmed が「${p.confirmed}」です。使えるのは ${CONFIRMED_WORDS.join(' / ')} のみ`
    );
  }
  // 台帳は評価をしない。効く・効かないを書いた時点で、それは台帳ではなく記事です。
  const judgement = ['効果あり', '効果なし', '効かない', '有効', '無効', 'おすすめ'];
  const text = `${p.fundingNote ?? ''} ${p.coiNote ?? ''} ${p.design ?? ''}`;
  for (const w of judgement) {
    if (text.includes(w)) {
      failures.push(`台帳 PMID ${key}: 評価が書かれています →「${w}」。台帳は事実だけを書く場所です`);
    }
  }
}

// ---- 診断（claims.json）の検査 --------------------------------------
//
// この診断は、商品を勧めた瞬間に薬機法66条の射程に入り、
// 肌の状態を判定した瞬間に医師法17条の問題になります。
// 越えないから安全に作れています。機械で越えられないようにします。

{
  const claimsFile = join(SITE, 'claims.json');
  if (existsSync(claimsFile)) {
    const claimsData = JSON.parse(readFileSync(claimsFile, 'utf8'));
    const claims = claimsData.claims ?? [];

    const TRACED_WORDS = [
      'human-trial',
      'industry-only',
      'lab-measure-only',
      'invitro-only',
      'animal-only',
      'no-source',
    ];

    // 診断が「効かない」と言い出したら、それは糾弾リストです
    const JUDGEMENT = [
      '効かない', '効果がない', '効果はない', '無意味です', '意味がない',
      'やめるべき', 'おすすめ', '使うべき', '向いています', '避けるべき',
      '買うべき', '不要です',
    ];

    let humanTrial = 0;
    let asked = 0;

    for (const c of claims) {
      if (!TRACED_WORDS.includes(c.traced)) {
        failures.push(
          `診断 ${c.id}: traced が「${c.traced}」です。使えるのは ${TRACED_WORDS.join(' / ')} のみ`
        );
      }

      // 診断に出す項目は、日常の言葉の質問文と、グループ名が要る
      if (c.ask !== false) {
        asked++;
        if (!c.question) {
          failures.push(
            `診断 ${c.id}: question（日常の言葉の質問文）がありません。\n` +
              `      論文の言葉のままでは、読者に何を聞かれているか分かりません`
          );
        }
        if (!c.topic) {
          failures.push(`診断 ${c.id}: topic（グループ名）がありません`);
        }
        if (c.traced === 'human-trial') humanTrial++;
      }

      const text = `${c.claim ?? ''} ${c.found ?? ''} ${c.note ?? ''}`;
      for (const w of JUDGEMENT) {
        // claim（世間で言われていること）に「効く」等が入るのは正常なので、found と note だけ見る
        const target = `${c.found ?? ''} ${c.note ?? ''}`;
        if (target.includes(w)) {
          failures.push(
            `診断 ${c.id}: 評価・推奨が書かれています →「${w}」\n` +
              `      この診断は、商品も成分も勧めません。書けるのは「どこまで辿れたか」だけです`
          );
        }
      }
    }

    // ヒト試験まで辿れたものが1つも無ければ、それはただの糾弾リストです
    if (asked > 0 && humanTrial === 0) {
      failures.push(
        `診断: 出題する項目に、traced が human-trial のものが1件もありません。\n` +
          `      辿り着けた言説を載せないと、これは「効かないものリスト」にしかなりません`
      );
    }

    // 出題する項目のうち、ヒト試験まで辿れたものが2割を切ったら警告
    if (asked > 0 && humanTrial > 0 && humanTrial / asked < 0.2) {
      warnings.push(
        `診断: 出題 ${asked} 件のうち、ヒト試験まで辿れたものが ${humanTrial} 件` +
          `（${Math.round((humanTrial / asked) * 100)}%）しかありません。糾弾リストに近づいています`
      );
    }
  }
}

// ---- 悩みタグの検査 ---------------------------------------------------
//
// タグは「読者の言葉」だけ。「こちらの判定」をタグにしない。
// 「根拠なし」「動物実験」「メーカー資金」をタグにした瞬間、
// それは記事への入口ではなく、糾弾リストの目次になる。

{
  const TAG_VOCAB = [
    '乾燥', '毛穴', 'シワ', 'シミ', 'ニキビ', '敏感肌', '赤み',
    'ハリ', 'くすみ', '日焼け', 'たるみ', '角質', 'テカリ',
  ];

  for (const a of meta) {
    if (!a.published) continue;
    for (const t of a.tags ?? []) {
      if (!TAG_VOCAB.includes(t)) {
        failures.push(
          `${a.slug}: タグ「${t}」は使えません。\n` +
            `      使えるのは読者の言葉だけです: ${TAG_VOCAB.join(' / ')}\n` +
            `      「根拠なし」「動物実験」のような、こちらの判定をタグにすると、\n` +
            `      記事への入口ではなく、糾弾リストの目次になります`
        );
      }
    }
  }
}

// ---- ニュースの検査 --------------------------------------------------
//
// このコーナーは、他人の発表を扱います。書き方を1つ間違えると、
// 名誉毀損にも、薬機法違反にも、ただの叩き記事にもなります。
// 機械で止められるものは、機械で止めます。

{
  const newsFile = join(SITE, 'news.json');
  if (existsSync(newsFile)) {
    const newsData = JSON.parse(readFileSync(newsFile, 'utf8'));
    const items = (newsData.items ?? []).filter((n) => n.status === 'published');

    const TRACED_WORDS = [
      'human-trial', 'industry-only', 'lab-measure-only',
      'invitro-only', 'animal-only', 'no-source',
    ];

    // 書いた時点で終わる言葉
    const FATAL = [
      '嘘', 'デタラメ', 'でたらめ', '詐欺', 'インチキ', 'ぼったくり',
      '騙して', 'だまして', '悪質', '許せない', 'ひどい',
    ];

    // 断定（根拠が無いことを根拠に、逆方向に断定するのも捏造）
    const OVERREACH = [
      '効かない', '効果はない', '効果がない', '無意味', '意味がない',
      '買うべきではない', 'やめるべき', '避けるべき',
    ];

    for (const n of items) {
      const text = `${n.title ?? ''} ${n.claim ?? ''} ${n.found ?? ''} ${n.note ?? ''}`;

      for (const w of FATAL) {
        if (text.includes(w)) {
          failures.push(
            `ニュース ${n.id}: 書いてはいけない言葉が入っています →「${w}」\n` +
              `      他人の発表を扱うコーナーです。事実だけを書き、断罪しないこと`
          );
        }
      }
      for (const w of OVERREACH) {
        if (text.includes(w)) {
          failures.push(
            `ニュース ${n.id}: 断定が入っています →「${w}」\n` +
              `      「出典が見つからない」は「効かない」ではありません`
          );
        }
      }
      for (const w of FORBIDDEN) {
        if (text.includes(w)) {
          failures.push(`ニュース ${n.id}: 薬機法でアウトな表現 →「${w}」`);
        }
      }

      if (!TRACED_WORDS.includes(n.traced)) {
        failures.push(
          `ニュース ${n.id}: traced が「${n.traced}」です。使えるのは ${TRACED_WORDS.join(' / ')} のみ`
        );
      }
      if (!n.sourceUrl) {
        failures.push(
          `ニュース ${n.id}: sourceUrl がありません。\n` +
            `      出どころを示せないニュースは、このブログでは扱えません`
        );
      }
      if (!n.found) {
        failures.push(`ニュース ${n.id}: found（辿った先で見つかったもの）がありません`);
      }
      // 出典が見つかったと言うなら、PMID を出すこと
      if (n.traced !== 'no-source' && (n.pmids ?? []).length === 0) {
        failures.push(
          `ニュース ${n.id}: traced が「${n.traced}」なのに PMID が1つもありません。\n` +
            `      辿り着いたと言うなら、辿り着いた先を示すこと`
        );
      }
    }
  }
}

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

  // PMID を含む行を全部取り出す。
  //
  // ただし2種類ある:
  //   - 参考文献の行（「1. 著者. タイトル. 誌名. 年.（PMID: xxx）」）
  //     → タイトル・年・著者を PubMed と突き合わせる
  //   - 本文中の言及（「2本目の撤回（PMID: xxx）の理由が分かりませんでした」）
  //     → 実在の確認だけ。タイトル照合はしない（文章なので一致するはずがない）
  //
  // ここを区別しないと、本文で PMID に触れただけで公開が止まる。
  const isReference = (l) => /^\s*\d+\.\s/.test(l);

  const pmids = [];
  for (const line of text.split(/\r?\n/)) {
    if (!/PMID/i.test(line)) continue;
    // 1行に複数の PMID があることもある
    for (const m of line.matchAll(/PMID[:：]?\s*(\d{6,9})/gi)) {
      pmids.push({ pmid: m[1], line, isRef: isReference(line) });
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

  // 5. 引用した論文が、全部 台帳（papers.json）に載っているか
  //    載せ忘れると、その論文の身元調査の記録が失われる
  for (const { pmid } of pmids) {
    const rec = ledger.get(pmid);
    if (!rec) {
      failures.push(
        `${a.slug}: PMID ${pmid} が論文台帳（site/papers.json）にありません。\n` +
          `      調査したのに記録していないのは、このブログでは調査していないのと同じです`
      );
    } else if (!(rec.articles ?? []).includes(a.slug)) {
      failures.push(
        `${a.slug}: PMID ${pmid} は台帳にありますが、articles にこの記事のスラッグが入っていません`
      );
    }
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
  for (const { pmid, line, isRef } of a.pmids) {
    const rec = result[pmid];

    // 1. 実在するか（本文中の言及も、これは必ず検査する）
    if (!rec || rec.error) {
      failures.push(`${a.slug}: PMID ${pmid} は PubMed に存在しません（捏造の疑い）`);
      continue;
    }

    // 1.5 撤回された論文を、撤回と書かずに引いていないか
    //
    // ★ 論文は、あとから撤回されます。
    //   書いた日に正しかった記事が、半年後に「撤回された論文を根拠にした記事」になる。
    //   **これは、書いた本人には気づけません。** 記事はもう書き終わっているからです。
    //
    //   大手の医療メディアは、これを人手の定期監査でやっています。
    //   うちは毎日、全記事の全PMIDを PubMed に問い合わせています。
    //   **だから、この検査は「1行足すだけ」で手に入ります。**
    //
    // ★★ ただし、止めるのは「撤回を隠して引いているとき」だけです。
    //
    //   「撤回された論文が、まだ売り文句の根拠に使われている」——
    //   **これを書くことこそ、このブログの仕事です。**
    //   撤回を明記して引いている記事を関門が止めるなら、間違っているのは関門のほうです。
    //
    //   （2026-07-13、この検査を入れた初日に pdrn-salmon-dna が引っかかった。
    //     そして記事は「※2016年に撤回」「※2026年に撤回」と、すでに正しく書いていた。
    //     撤回通知そのもの（PMID 26839493）まで引用していた。関門を直した。）
    const pubtype = rec.pubtype ?? [];
    const isRetracted = pubtype.includes('Retracted Publication');
    const disclosesRetraction = /撤回|retract/i.test(line);

    if (isRetracted && !disclosesRetraction) {
      failures.push(
        `${a.slug}: PMID ${pmid} は【撤回された論文】ですが、記事にその記載がありません\n` +
          `      ${rec.title ?? ''}\n` +
          `      記事: ${line.trim().slice(0, 90)}\n` +
          `\n` +
          `      引くなとは言いません。**撤回されたと書いてください。**\n` +
          `      「撤回された論文が、いまも売り文句の根拠に使われている」——それを書くのが、このブログの仕事です。\n` +
          `      根拠として使っているなら、その記述ごと取り除いてください。\n` +
          `      （書いた時点では撤回されていなかった可能性があります。それでも、いま黙って出してはいけません）`
      );
      continue;
    }

    if (isRetracted) {
      warnings.push(
        `${a.slug}: PMID ${pmid} は撤回された論文です（記事に撤回の記載あり。通します）`
      );
    }

    // 本文中で PMID に触れているだけの行は、ここまで。
    // タイトルの照合は、参考文献の行だけに対して行う。
    if (!isRef) continue;

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

// ---- 検証レシートを書き出す -----------------------------------------
//
// ★ ここが要点です。
//
//   うちは毎回 PubMed に問い合わせて、論文の実在・タイトル・撤回を確かめています。
//   **それを、読者に1文字も見せていませんでした。**
//   やっている検証を見せない媒体は、やっていない媒体と区別がつきません。
//
//   だから、検証の結果をここに書き出し、build.mjs はこのファイルだけを読みます。
//
// ★★ 偽造できないことが、この仕組みの全てです。
//
//   ・articles.json に「検証済み」という手書きの欄を作らないこと。
//     作った瞬間、それは飾りになります（true と書けば true になるから）。
//   ・レシートの文言を人間（やエージェント）が書けるようにしないこと。
//   ・**レシートを集めたページを作らないこと。** それは「表」であり、却下済みの形です。
//
//   検査が走っていない記事には、レシートが物理的に付きません。
//   これは、このブログのエージェント自身にも偽造できません。

const receipt = {
  _readme: [
    'site/verify.mjs が書き出します。手で編集しないこと。',
    '',
    'build.mjs は、記事に出す「検証レシート」をこのファイルからしか作りません。',
    'articles.json に「検証済み」の欄を作らないでください。作った瞬間、それは飾りになります。',
    '',
    'ここに書いてあるのは「論文が実在し、タイトルが一致し、撤回されていない」ことだけです。',
    '**論文の内容が正しいかどうかは、機械には判定できません。** 医師の監修もありません。',
    'そう書いてあることが、この仕組みの価値です。',
  ],
  verifiedAt: new Date().toISOString(),
  articles: Object.fromEntries(
    articles.map((a) => {
      const pmids = [...new Set(a.pmids.map((p) => p.pmid))];
      return [
        a.slug,
        {
          pmids,
          count: pmids.length,
          retracted: pmids.filter((p) => (result[p]?.pubtype ?? []).includes('Retracted Publication')),
        },
      ];
    })
  ),
};

writeFileSync(join(SITE, 'verified.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');

console.log('=========================================');
console.log(`  検証を通過しました`);
console.log(`  記事 ${articles.length} 本 / PMID ${allPmids.size} 件すべてが PubMed に実在し、`);
console.log(`  タイトルも一致しています。薬機法の禁止表現もありません。`);
console.log('=========================================');
console.log('');
console.log('  site/verified.json に検証レシートを書きました');
