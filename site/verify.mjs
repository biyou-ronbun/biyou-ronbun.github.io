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

import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnglish, EN_AFFILIATE_DISCLOSURE } from './tone-en.mjs';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);

const meta = JSON.parse(readFileSync(join(SITE, 'articles.json'), 'utf8'));
const products = JSON.parse(readFileSync(join(SITE, 'products.json'), 'utf8'));

// ★ 記事を短くするときの、下限の基準線。
//   **文字数は減ってよい。資金源・「見つかりませんでした」・論文・図は、減らせない。**
const baseline = existsSync(join(SITE, 'article-baseline.json'))
  ? JSON.parse(readFileSync(join(SITE, 'article-baseline.json'), 'utf8')).articles ?? {}
  : {};

// ★ 数え方は article-metrics.mjs の1箇所だけ。**2箇所に書いたら、必ずずれる。**
const { countWeapons, withFigures, WEAPON_KEYS, WEAPON_LABEL, WEAPON_WHY } = await import(
  './article-metrics.mjs'
);
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

  // ★★★ ここが、証拠シートの核心の関門です。
  //
  //   **「副作用の記載がない」を「副作用がない」に書き換えさせない。**
  //
  //   86本のうち62本が、副作用について一言も書いていません。
  //   **ページを作る機械は、この 62 を「安全」と書きたがります。**
  //   そのほうがページが完成して見えるからです。
  //
  //   しかし、
  //
  //     **「副作用が0件だった」と「副作用について何も書いていない」は、別の事実です。**
  //
  //   これは CLAUDE.md の第4条（取得に失敗したときは「取得失敗」と書く。0 と書かない）と
  //   まったく同じ構造です。**数えられなかったことを、0 と書かない。**
  //
  //   ★ しかも、これは机上の心配ではありません。実際に見つかっています:
  //
  //     PMID 31797305（ISDIN社員が著者6名中5名）は、こう書いています。
  //       "no adverse events were **attributed by the investigators** to the use of the product"
  //     → **「研究者が製品のせいだと判断しなかった」**のであって、**有害事象が0件だったとは書いていない。**
  //
  //     PMID 10522500 は、聴取した副作用の項目まで列挙しておきながら（灼熱感・刺すような感覚・
  //     発赤・落屑・乾燥・色調変化・かゆみ・発疹）、**結果を一文字も書いていません。**
  //     → 「測っていない」でも「0件だった」でもない、**第三の状態**です。

  if (p.adverse != null) {
    const a = String(p.adverse).trim();

    // 「なし」「0」だけの記述は、どちらの意味か分からない。分からないものは書けない。
    const AMBIGUOUS = ['なし', 'ない', '無し', '0', '0件', '無', '特になし', '報告なし'];
    if (AMBIGUOUS.includes(a)) {
      failures.push(
        `台帳 PMID ${key}: adverse が「${a}」です。**どちらの意味か分かりません。**\n` +
          `\n` +
          `      **「副作用が0件だった」と「副作用について何も書いていない」は、別の事実です。**\n` +
          `\n` +
          `      論文が何も書いていないなら → 「記載なし」\n` +
          `      著者が「有害事象なし」と明言しているなら → 「著者は有害事象なしと報告」\n` +
          `      全文が有料で読めないなら → 「全文が有料のため確認できていない」\n` +
          `\n` +
          `      （CLAUDE.md 第4条と同じ構造です。**数えられなかったことを、0 と書かない**）`
      );
    }

    // 台帳が「安全です」と言い出したら、それは台帳ではなく推奨です。
    const SAFETY_CLAIM = ['安全です', '安全である', '副作用はありません', '問題ありません', '心配ありません'];
    for (const w of SAFETY_CLAIM) {
      if (a.includes(w)) {
        failures.push(
          `台帳 PMID ${key}: adverse に「${w}」と書かれています。\n` +
            `      台帳が書けるのは「その論文が報告したこと」だけです。安全性の判定はしません`
        );
      }
    }
  }

  // 濃度も同じ。「無い」のか「書いていない」のかを、区別できる形で。
  if (p.concentration != null) {
    const c = String(p.concentration).trim();
    if (['なし', 'ない', '無し', '0', '不明'].includes(c)) {
      failures.push(
        `台帳 PMID ${key}: concentration が「${c}」です。\n` +
          `      論文に書いていないなら「記載なし」、濃度の概念が無い研究なら\n` +
          `      「該当なし（濃度の概念がない研究）」と書いてください`
      );
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

    // ★ source-mismatch について（2026-07-13 追加・オーナー承認済み）
    //
    //   「出典はある。論文も実在する。だが、その論文は、その主張を言っていない。」
    //
    //   これは、うちが最も多く遭遇している状態です。
    //   例:「飲んだヒアルロン酸が肌に届く」の出典を辿ると、論文は実在する。
    //      だがそれはラットの実験で、測っていたのは「呼気」だった。
    //
    //   これまでは animal-only で処理していましたが、それは**論文の種類**を言っているだけで、
    //   **「引用が主張を支えていない」という核心を落としていました。**
    //
    //   （Wikipedia には、これ専用のタグがあります: {{Failed verification}}）
    const TRACED_WORDS = [
      'human-trial',
      'industry-only',
      'lab-measure-only',
      'invitro-only',
      'animal-only',
      'source-mismatch',
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

// ---- 連載 -------------------------------------------------------------
//
// 単発の記事より、連載の1回のほうが読まれます（検索1位も連載でした）。
// ただし **新しいページは1枚も作りません。** articles.json に2つの欄を足すだけです。
//
// ★ 越えたら別物になる線が2本
//   1. 連載の一覧ページを作らない → それは「表」。却下済みの形
//   2. 連載名に判定語を入れない  → それは糾弾リストの目次

{
  const SERIES_VOCAB = [
    '出典をたどる',       // 世間の常識の出典を辿ると、何が出てくるか
    '誰が資金を出したか', // 研究の資金源と利益相反
    '数字の出どころ',     // 「28日」「3分」「2リットル」などの数字を辿る
  ];

  for (const a of meta) {
    if (!a.published || !a.series) continue;

    if (!SERIES_VOCAB.includes(a.series)) {
      failures.push(
        `${a.slug}: 連載名「${a.series}」は使えません。\n` +
          `      使えるのは: ${SERIES_VOCAB.join(' / ')}\n` +
          `      連載名に判定語（ウソ・ホント・危険・根拠なし）を入れると、\n` +
          `      それは連載ではなく、糾弾リストの目次になります`
      );
    }

    if (!a.vol || !Number.isInteger(a.vol)) {
      failures.push(`${a.slug}: 連載「${a.series}」に vol（何回目か）がありません`);
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
      'invitro-only', 'animal-only', 'source-mismatch', 'no-source',
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

    // ★★ ニュースの「出どころ」。**語彙はここに固定する。**
    //
    //   読者は「ニュース」を探して来ない。「FDAが何か言った」「韓国で何かあった」で来る。
    //   だから入口を分ける。**ただし、分けた瞬間に危険が生まれる。**
    //
    //   ★ 「新発売」というコーナーを作ると、それは**新商品の宣伝コーナー**になります。
    //     広報が喜んで送ってくるようになり、うちは**無料の宣伝媒体**になります。
    //
    //     だから「新発売」というコーナーは作りません。**あるのは「企業の発表」です。**
    //     企業が何かを発表した、という**事実**を扱い、**その出典を辿ります。**
    //     （実例: 「飲むPDRNが相次いで発売。飲んだPDRNで肌を測ったヒト試験は、1本も見つかりませんでした」）
    //
    //   ★ 「韓国」は国ではなく、**規制当局（MFDS）**です。
    //     国をコーナーにすると、それは**トレンド追跡**になります。うちは流行を追いません。
    //     FDA・厚労省と同じ「規制当局が何をしたか」の並びに置きます。
    //   ★ 「厚労省・消費者庁」は、語彙ごと外しました（オーナー判断・2026-07-13）。
    //     該当する2件（国民生活センターのGLP-1注意喚起 / 東京都の美白美容液への措置命令）も
    //     記事ごと削除しています。**git の履歴には残っています。**
    //
    //     **行政の発表は、もう追いません。追うのは「企業の発表」（新発売・新成分）です。**
    const SOURCE_VOCAB = [
      '企業の発表',  // ★ 新発売・新成分・広告。ここが最優先（オーナー判断・2026-07-13）
      '新しい研究',  // PubMed に新しく載った論文
      'FDA（米国）', // 米国の規制当局
      '韓国 MFDS',   // 韓国の規制当局（食品医薬品安全処）
    ];

    for (const n of items) {
      if (!n.source) {
        failures.push(
          `ニュース ${n.id}: source（出どころ）がありません。\n` +
            `      使えるのは ${SOURCE_VOCAB.join(' / ')} のみ`
        );
      } else if (!SOURCE_VOCAB.includes(n.source)) {
        failures.push(
          `ニュース ${n.id}: source が「${n.source}」です。\n` +
            `      使えるのは ${SOURCE_VOCAB.join(' / ')} のみ。\n` +
            `\n` +
            `      **「新発売」というコーナーは作りません。** 作れば、それは新商品の宣伝コーナーです。\n` +
            `      企業が発表したという事実は「企業の発表」として扱い、**出典を辿ってください。**\n` +
            `\n` +
            `      **「韓国」も国ではありません。「韓国 MFDS」= 規制当局です。**\n` +
            `      国をコーナーにした瞬間、それはトレンド追跡になります。\n` +
            `\n` +
            `      語彙を増やしたくなったら、勝手に足さずオーナーに聞いてください。`
        );
      }
    }

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

    // ★★★ 新発売を追いかけるニュース欄が、必ず落ちる穴。
    //
    //   **新商品を毎回「根拠が見つかりませんでした」で終わらせると、**
    //   **それは新商品の糾弾リストになります。**
    //
    //   ★ 問題は「根拠の無い商品ばかりだから」ではありません。
    //     **「叩ける商品を選んでいる」可能性があるからです。**
    //     **選んだ時点で結論が決まっているなら、それは検証ではありません。**
    //
    //   これは claims.json（診断）に、すでに同じ関門があります。
    //   「ヒト試験まで辿れたものが1件も無ければ、それはただの糾弾リストです」
    //   **ニュースにも、同じ線を引きます。**
    //
    //   ★ ただし「根拠があったことにしろ」という関門ではありません。**それは捏造です。**
    //     **「辿れた例が1つも無いまま件数だけ増える」ことを止める関門です。**
    //     辿れる例が本当に見つからないなら、**件数を増やさないでください。**

    const humanTrial = items.filter((n) => n.traced === 'human-trial').length;

    if (items.length >= 6 && humanTrial === 0) {
      failures.push(
        `ニュース: 公開中の ${items.length} 件に、traced が human-trial のものが1件もありません。\n` +
          `\n` +
          `      **これは、新商品の糾弾リストです。**\n` +
          `\n` +
          `      毎回「根拠が見つかりませんでした」で終わるニュース欄は、\n` +
          `      **うちが批判している側と、鏡合わせです。**\n` +
          `\n` +
          `      ★ 問題は「根拠の無い商品ばかりだから」ではありません。\n` +
          `        **「叩ける商品を選んでいる」可能性があるからです。**\n` +
          `        **選んだ時点で結論が決まっているなら、それは検証ではありません。**\n` +
          `\n` +
          `      ★ これは「根拠があったことにしろ」という意味ではありません。**それは捏造です。**\n` +
          `        **辿れる例が見つからないなら、件数を増やさないでください。**\n` +
          `        「今週は無し」が、正しい動作です。`
      );
    }

    // 6件まではまだ止めないが、偏りは早めに言う
    if (items.length >= 3 && items.length < 6 && humanTrial === 0) {
      warnings.push(
        `ニュース: ${items.length} 件すべてが「辿れなかった」側です（human-trial が 0 件）。\n` +
          `      **叩ける商品を選んでいないか、確かめてください。**\n` +
          `      6件を超えて human-trial が 0 件のままだと、公開が止まります`
      );
    }
  }
}

// ---- 商品（アフィリエイト）の検査 ---------------------------------
//
// 薬機法66条は「何人も」が対象。効能を書いた瞬間、罰せられるのは
// 広告主ではなく、書いた側です。商品説明にも同じ検査をかけます。

// 商品リンクが生きているかを、あとでまとめて確かめる
const productUrls = [];

// ★ 価格を取り直す対象。**products.json には価格を書かない。**
//   価格は変わる。書けば、いつか嘘になる。
const priceTargets = [];
// ★ キーは「スラッグ + 商品名」。**スラッグだけにすると、同じ記事の2点目が1点目を上書きする。**
//   商品を1点ずつしか置いていなかったので、長いあいだ表に出なかったバグ。
const prices = {}; // `${slug}::${name}` → { price, volume, perMl, at } または { failed: true }
const priceKey = (slug, name) => `${slug}::${name}`;

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

    // ★★★ ここが、商品紹介の核心の関門です。
    //
    //   **基準の根拠（basis）は、記事の中に一字一句存在しなければなりません。**
    //
    //   なぜか。**基準を勝手に作れば、それは「推薦」だからです。**
    //
    //     ✗ 「あなたの肌質にはこれ」        … 根拠0件（PubMed で確認。質問票→成分推奨のRCTは0本）
    //     ✗ 「これが一番効きます」          … 判定。薬機法66条
    //     ○ 「記事の結論は『量』でした。だから量を塗れるものを」
    //
    //   **読者は商品に辿り着く。しかし、辿り着く道が論文から通っている。**
    //   その「道」を機械で保証するのが、この検査です。
    //
    //   basis が記事に無ければ、その基準は**誰かが勝手に作ったもの**です。
    //   **記事から引用できないなら、商品を置けません。**
    //
    // ★ そして、これは自動化の暴走を止める最後の砦でもあります。
    //   毎週の収益タスクが「商品を増やせば儲かる」と考えたとき、
    //   **記事に無い基準を作れないので、勝手に商品を増やせません。**

    // ★ basis は、文字列でも配列でもよい。
    //   基準が2つのことを言っているなら（例:「10〜20%」かつ「誘導体ではない」）、
    //   **根拠の引用も2本必要です。** 1本で2つの主張を担保させないこと。
    const bases = item.basis == null ? [] : [].concat(item.basis).filter((b) => b);

    if (!bases.length) {
      failures.push(
        `${slug}: 商品「${item.name}」に basis がありません。\n` +
          `      **basis = その基準の根拠を、記事から一字一句コピーした文。**\n` +
          `      基準を勝手に作れば、それは推薦です。記事から引用できないなら、商品を置けません。`
      );
    } else {
      const mdPath = join(ROOT, 'articles', `${slug}.md`);
      const rawMd = existsSync(mdPath) ? readFileSync(mdPath, 'utf8').replace(/\r\n/g, '\n') : '';

      // ★★ 記事が埋め込んでいる図の中も探す。
      //
      //   文章を図に畳むと、基準の根拠になっている一文が、**図の中に移ります。**
      //   （実際に起きました。「8%未満のビタミンC濃度では、生物学的な意義に乏しい」は
      //     本文から消え、図 vitc-concentration のセルの中に移りました）
      //
      //   **読者には、記事の中で見えています。** 図は記事の一部です。
      //   .md しか見ない関門は、**正しい書き換えを違反と判定します。**
      //
      //   ★ ただし「記事のどこかにある」ことは、変わらず必須です。
      //     **記事から辿れない基準は、誰かが勝手に作ったものです。**
      const figIdsForBasis = [...rawMd.matchAll(/^::figure:([\w-]+)::/gm)].map((m) => m[1]);
      const figsForBasis = existsSync(join(SITE, 'figures.json'))
        ? JSON.parse(readFileSync(join(SITE, 'figures.json'), 'utf8')).figures ?? {}
        : {};
      const md =
        rawMd +
        ' ' +
        figIdsForBasis.map((id) => (figsForBasis[id] ? JSON.stringify(figsForBasis[id]) : '')).join(' ');

      for (const basis of bases) {
      if (!md.includes(basis)) {
        failures.push(
          `${slug}: 商品「${item.name}」の basis が、記事の中に見つかりません。\n` +
            `      basis: 「${basis}」\n` +
            `\n` +
            `      **基準の根拠は、記事から一字一句コピーできなければいけません。**\n` +
            `      コピーできないということは、**その基準は誰かが勝手に作ったもの**です。\n` +
            `      それは「おすすめ」であって、このブログの商品紹介ではありません。\n` +
            `\n` +
            `      （「肌質診断 → おすすめ成分」を検証した試験は、PubMed に 0件でした。\n` +
            `        根拠のない推薦アルゴリズムを発明することは、うちが毎日\n` +
            `        他社に対して指摘していることを、自分でやることです）`
        );
      }
      }
    }

    if (!/^https?:\/\//.test(item.url)) {
      failures.push(`${slug}: 商品「${item.name}」の url が不正です`);
    }

    // ★ 商品名に、期間限定の煽りが入っていないか
    //
    //   楽天の商品名には、こういうものが平気で入っています。
    //     「7/19 19:59までまとめ買いで最大1000円OFF!」
    //     「≪15日はジェットの日！全商品P2倍！≫」
    //
    //   **その日を過ぎたら、記事に嘘が残ります。**
    //   人が見ていない自動運転のブログでは、必ず腐ります。
    //
    //   そして、うちは「急がせない」ことを商品にしています。
    //   **「今だけ」「残りわずか」は、判断を急がせる技術です。**
    //   うちが読者に渡したいのは、急がずに自分で確かめる目です。
    const PROMO = [
      /\d+\/\d+.{0,12}まで/,   // 「7/19 19:59まで」
      /\d+%?\s*OFF/i,
      /\d+円OFF/,
      /P\d+倍/i,
      /ポイント\d+倍/,
      /期間限定/,
      /タイムセール/,
      /クーポン/,
      /今だけ/,
      /残りわずか/,
    ];
    for (const re of PROMO) {
      const m = item.name.match(re);
      if (m) {
        failures.push(
          `${slug}: 商品名に期間限定の煽りが入っています →「${m[0]}」\n` +
            `      商品名: ${item.name.slice(0, 60)}\n` +
            `\n` +
            `      **その日を過ぎたら、記事に嘘が残ります。**\n` +
            `      人が見ていない自動運転のブログでは、必ず腐ります。\n` +
            `\n` +
            `      そして、うちは「急がせない」ことを商品にしています。\n` +
            `      **「今だけ」「◯円OFF」は、判断を急がせる技術です。**\n` +
            `      楽天の商品名から、その部分を取り除いてください。`
        );
        break;
      }
    }

    // ★ 商品画像は、楽天の CDN から直接読むものだけ許す。
    //   hbb.afl.rakuten.co.jp はアフィリエイトの「インプレッション計測ビーコン」。
    //   **読者がページを開いただけで1件ずつ数えられる仕組みを、記事に埋めない。**
    //   （うちの解析は Cookie を使わない。そう決めた以上、裏口を作らない）
    if (item.image) {
      if (/hbb\.afl\.rakuten\.co\.jp/.test(item.image)) {
        failures.push(
          `${slug}: 商品「${item.name}」の image が、アフィリエイトの計測ビーコンです。\n` +
            `      **読者がページを開いただけで数えられる画像を、記事に埋めないでください。**\n` +
            `      商品ページの画像（shop.r10s.jp / thumbnail.image.rakuten.co.jp）を使ってください。`
        );
      } else if (!/^https:\/\/(shop\.r10s\.jp|thumbnail\.image\.rakuten\.co\.jp)\//.test(item.image)) {
        failures.push(`${slug}: 商品「${item.name}」の image が、楽天の画像CDNではありません: ${item.image}`);
      }
    }

    // 商品リンクが生きているか（後でまとめて確かめる）
    productUrls.push({ slug, name: item.name, url: item.url });
    if (item.image) productUrls.push({ slug, name: `${item.name}（画像）`, url: item.image });

    // ★★ 価格は products.json に**書かない。** 公開のたびに機械が取る。
    //
    //   楽天の価格は変わります。**記事に古い価格が残れば、それは嘘です。**
    //   （同じ理由で「7/19まで」「20%OFF」を商品名から弾いています）
    //
    //   ★ 取れなかったら「取得失敗」と記録し、**0 とは書きません。**
    //     「0円だった」と「値段を数えられなかった」は、別の事実です（CLAUDE.md 第4条）。
    if (item.volume) {
      // アフィリエイトURLの ?pc= に、商品ページのURLが入っている
      const m = item.url.match(/[?&]pc=([^&]+)/);
      if (m) {
        priceTargets.push({
          slug,
          name: item.name,
          volume: item.volume,
          itemUrl: decodeURIComponent(m[1]),
        });
      }
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

  // ★★★ 3. 記事を短くするときの、下限の基準線
  //
  //   **「長文は読まれない」は正しい。だから記事を短くする。**
  //   **しかし、文字数のために事実を落とすことは、できない。**
  //
  //   ★ 上の SIGNATURE の検査は「1つでもあれば通る」。
  //     **書き換えで大半が消えても、止まりません。**
  //     9,000字を6,000字にする作業を始めるところで、この穴に気づきました。
  //
  //   ★ 何が最初に消えるかは、分かっています。
  //
  //     ・**資金源の記述**          … 「著者7人のうち6人がキユーピー社員」は、長い。削りたくなる
  //     ・**「見つかりませんでした」** … 何も言っていないように見える。
  //                                    **それが、うちが他と違う唯一の部分なのに**
  //     ・**引用した論文**          … 減らせば、記事は短くなる
  //
  //   **だから、書き換え前の数を基準線として固定し、下回ったら公開を止めます。**
  //   **文字数は減ってよい。上の3つは減らせない。**

  const base = baseline[a.slug];
  if (base) {
    // ★ 数え方は site/article-metrics.mjs の1箇所だけ。
    //   **2箇所に書いたら、必ずずれます。** 実際にずれて、関門が甘くなりました。
    const now = countWeapons(text);

    // ★ 論文の数・図の数は、重複を畳んでも減りません。**1つでも減ったら、止めます。**
    for (const k of ['pmids', 'figures']) {
      if (now[k] < base[k]) {
        failures.push(
          `${a.slug}: ${WEAPON_LABEL[k]}が減っています（${base[k]} → ${now[k]}）。\n` +
            `\n` +
            `      **記事を短くするのは構いません。文字数のために事実を落とすことは、できません。**\n` +
            `\n` +
            `      ${WEAPON_WHY[k]}\n` +
            `\n` +
            `      基準線: site/article-baseline.json`
        );
      }
    }

    // ★★★ ここが、この関門のいちばん難しいところ。
    //
    //   **「資金源への言及」と「見つかりませんでした」は、数だけでは判定できません。**
    //
    //   同じ事実を3回繰り返していた部分を1回に畳むと、**数は減ります。**
    //   **しかし、事実は1つも失われていません。** それは、まさに頼まれた作業です。
    //
    //   ★ 実際に起きました。ビタミンCの記事で 23 → 20。
    //     消えたのは重複だけで、**6つの「見つからなかった」の事実は全部残っていました**
    //     （記事か、図の中に）。
    //
    //   ★ **ここで関門を緩めるのは、いちばん危険な動きです。**
    //     「自分の作業を通すために、歯止めを外す」——**最悪の形です。**
    //
    //   ★ だから、数の代わりに**錨（mustSurvive）**を持ちます。
    //
    //     **「この事実は、書き換え後も必ず残っていること」を、記事ごとに列挙する。**
    //     数ではなく、**事実そのもの**を守ります。
    //     （商品の basis と同じ考え方。**記事から辿れないものは、無い**）
    //
    //   ★ mustSurvive が無い記事では、**数が減ったら止めます。**
    //     **錨を書くまで、その記事は短くできません。それでいい。**

    const HALF_JUDGED = ['funding', 'notfound'];
    const anchors = base.mustSurvive ?? null;

    if (anchors) {
      const haystack = withFigures(text).replace(/\s/g, '');
      const lost = anchors.filter((s) => !haystack.includes(s.replace(/\s/g, '')));
      if (lost.length) {
        failures.push(
          `${a.slug}: 書き換えで、**残すと決めた事実が消えています**（${lost.length} 件）。\n` +
            lost.map((s) => `        ・「${s}」`).join('\n') +
            `\n\n` +
            `      **記事を短くするのは構いません。事実を落とすことは、できません。**\n` +
            `      錨は site/article-baseline.json の mustSurvive にあります。`
        );
      }
      // 錨があっても、半分以下まで削られたら、それは畳んだのではなく捨てています
      for (const k of HALF_JUDGED) {
        if (now[k] < base[k] * 0.5) {
          failures.push(
            `${a.slug}: ${WEAPON_LABEL[k]}が半分以下になりました（${base[k]} → ${now[k]}）。\n` +
              `      **重複を畳んだのではなく、捨てています。**\n` +
              `\n      ${WEAPON_WHY[k]}`
          );
        }
      }
    } else {
      // 錨が無い記事は、数で守る（＝短くする前に、錨を書くこと）
      for (const k of HALF_JUDGED) {
        if (now[k] < base[k]) {
          failures.push(
            `${a.slug}: ${WEAPON_LABEL[k]}が減っています（${base[k]} → ${now[k]}）。\n` +
              `\n` +
              `      **記事を短くするのは構いません。文字数のために事実を落とすことは、できません。**\n` +
              `\n` +
              `      ${WEAPON_WHY[k]}\n` +
              `\n` +
              `      ★ 重複を畳んだだけで、事実は残っている——という場合は、\n` +
              `        site/article-baseline.json の この記事の mustSurvive に、\n` +
              `        **「必ず残す事実」を列挙してください。** 数ではなく、事実で守ります。\n` +
              `        **錨を書くまで、この記事は短くできません。**`
          );
        }
      }
    }
  }

  // 4. 根拠の厚み。PMID が3件未満の記事は、調べ切れていない
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

// ---- 訂正台帳（追記だけ。消さない） ---------------------------------
//
// ★ この台帳の存在理由は、たった1つです。
//
//   撤回された論文を引いていた記事から、その引用を「そっと消す」ことを、できなくするため。
//
//   引用を消せば PMID が消え、照会対象から外れ、verified.json からも消える。
//   **「うちが撤回論文を根拠にしていた」という事実が、こちらの都合で歴史から消える。**
//   読者からは、その記事は最初から正しかったようにしか見えない。
//
//   だから、**一度でも撤回論文を見たら、ここに書く。そして二度と消さない。**
//   引用を消しても、記事には訂正ログが出続けます。
//
//   （Retraction Watch が10年やっているのは、まさにこれをやらせないことです）
//
// ★ このファイルを手で編集しないこと。消さないこと。
//   消したくなったときが、いちばん消してはいけないときです。

const CORRECTIONS = join(SITE, 'corrections.json');

const corrections = existsSync(CORRECTIONS)
  ? JSON.parse(readFileSync(CORRECTIONS, 'utf8'))
  : {
      _readme: [
        'site/verify.mjs が追記します。**手で編集しないこと。行を消さないこと。**',
        '',
        'ここに記録されるのは「この記事は、撤回された論文を引いていた」という事実です。',
        '記事から引用を消しても、この記録は残り、記事に訂正ログが出続けます。',
        '',
        '★ そうしないと、「引用をそっと消す」だけで、こちらに都合の悪い歴史が消せてしまう。',
        '  それは、黙って書き換えることです。このブログの唯一の武器と、正面から矛盾します。',
      ],
      items: [],
    };

const today = new Date().toISOString().slice(0, 10);
let correctionsChanged = false;

function seenRetraction(slug, pmid, title) {
  const already = corrections.items.find((i) => i.slug === slug && i.pmid === String(pmid));
  if (already) return;
  corrections.items.push({
    slug,
    pmid: String(pmid),
    title,
    noticedOn: today,
    kind: 'retracted',
  });
  correctionsChanged = true;
}

// ---- 商品リンクが生きているか ----------------------------------------
//
// ★ 商品リンクは、放っておくと腐ります。
//
//   商品が売り切れる → リンクが 404 になる → **読者が壊れたリンクを踏む。**
//
//   人が見ていない自動運転のブログでは、これは必ず起きます。
//   **「機械が検証している」と看板を掲げているブログが、死んだリンクを出し続けたら、
//     その看板が嘘になります。**
//
// ★ 取得できなかったときは、公開を止めません（ネットワークの一時的な問題かもしれない）。
//   **ただし「取得できなかった」と警告します。0 とも「生きている」とも書きません。**

if (productUrls.length) {
  console.log(`商品リンク ${productUrls.length} 本が生きているか、確かめます...`);

  for (const p of productUrls) {
    try {
      const res = await fetch(p.url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (biyou-ronbun link check)' },
      });
      if (res.status === 404 || res.status === 410) {
        failures.push(
          `${p.slug}: 商品「${p.name}」のリンクが死んでいます（HTTP ${res.status}）\n` +
            `      ${p.url}\n` +
            `      **読者が壊れたリンクを踏みます。** 商品を差し替えるか、外してください。`
        );
      } else if (!res.ok) {
        warnings.push(
          `${p.slug}: 商品「${p.name}」のリンクが HTTP ${res.status} を返しました（公開は止めません）`
        );
      }
    } catch (e) {
      warnings.push(
        `${p.slug}: 商品「${p.name}」のリンクを確かめられませんでした — ${e.message}\n` +
          `      （「死んでいる」ではなく「確かめられなかった」です。混同しないこと）`
      );
    }
  }
}

// ---- 商品の価格を、公開のたびに取り直す --------------------------------
//
// ★ products.json に価格を書かない。**書けば、いつか嘘になる。**
//
// ★ 「1mLあたりいくらか」は判定ではありません。**算数です。**
//   だから、これで並べても「うちの順位」は生まれません。
//   企業が上位に来る方法は「値下げする」ことだけ。**掲載料では買えません。**
//
// ★ 取れなかったら「取得失敗」。**0 と書かない。**（CLAUDE.md 第4条）

// ★★ 取れなかったときは、**前回取れた価格を残す。**
//
//   GitHub Actions の上では、楽天が価格を返しません（IPで弾かれています）。
//   そこで毎回「取得失敗」にすると、**手元では単価が出て、公開では消える**という
//   気味の悪い状態になります（実際になりました）。
//
//   ★ 前回の値を残し、**その値を取った日付を、そのまま読者に見せます。**
//     「2026-07-13 に機械が取得。価格は変わります」と書いてあれば、嘘ではありません。
//
//   ★ 値が無いのに 0 を書くことは、しません。**「取得失敗」と「0円」は別の事実です。**
const prevPrices = (() => {
  try {
    return JSON.parse(readFileSync(join(SITE, 'verified.json'), 'utf8')).prices ?? {};
  } catch {
    return {};
  }
})();

// 取れなかったとき。**前回の値があれば残す。無ければ「取得失敗」。0 とは書かない。**
const keepPrev = (t, why) => {
  const key = priceKey(t.slug, t.name);
  const prev = prevPrices[key];
  if (prev && !prev.failed) {
    prices[key] = prev;
    warnings.push(
      `${t.slug}: 商品「${t.name}」の価格を取得できませんでした（${why}）。\n` +
        `      **前回の値（${prev.at} 時点、${prev.perMl} 円/mL）を残します。**\n` +
        `      読者には取得日も出しているので、嘘にはなりません。`
    );
  } else {
    prices[key] = { name: t.name, failed: true };
    warnings.push(
      `${t.slug}: 商品「${t.name}」の価格を**取得できませんでした**（${why}）。前回の値もありません。\n` +
        `      （「0円」ではありません。**数えられなかった**のです。混同しないこと）`
    );
  }
};

if (priceTargets.length) {
  console.log(`商品 ${priceTargets.length} 点の価格を、いま取り直します...`);

  for (const t of priceTargets) {
    try {
      const res = await fetch(t.itemUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
          'Accept-Language': 'ja',
        },
      });
      const buf = Buffer.from(await res.arrayBuffer());

      // ★★ 楽天の商品ページは EUC-JP のことがある。
      //   UTF-8 として読むと日本語が壊れ、**「0件」という嘘の結果が出る。**
      //   （実際に一度、それで「該当0件」と誤報した）
      let cs =
        (res.headers.get('content-type') ?? '').match(/charset=([\w-]+)/i)?.[1] ??
        buf.toString('latin1', 0, 3000).match(/charset=["']?([\w-]+)/i)?.[1] ??
        'utf-8';
      let html;
      try {
        html = new TextDecoder(cs).decode(buf);
      } catch {
        html = buf.toString('utf8');
      }

      // ★ 楽天の価格は "price": には入っていない。**順番が大事。**
      //   （"price":{"minPrice":2100.0} という形なので、"price"\s*:\s*\d は必ず外す）
      //   実際に、この間違いで「基準に合う商品 0 件」と5回誤報した。
      //   **「0件」と「読めていない」は、別の事実。**
      const pm =
        html.match(/"taxIncludedPrice"\s*:\s*(\d{2,7})/) ??
        html.match(/itemprop="price"[^>]*content="(\d+)"/) ??
        html.match(/"minPrice"\s*:\s*(\d{2,7})/) ??
        html.match(/data-price="(\d+)"/);

      if (!pm) {
        keepPrev(t, '価格の欄が見つかりませんでした');
        continue;
      }

      const price = Number(pm[1]);
      prices[priceKey(t.slug, t.name)] = {
        name: t.name,
        price,
        volume: t.volume,
        perMl: Math.round((price / t.volume) * 10) / 10,
        at: new Date().toISOString().slice(0, 10),
      };
      console.log(`  ${String(price).padStart(6)}円 / ${String(t.volume).padStart(4)}mL = ${prices[priceKey(t.slug, t.name)].perMl} 円/mL  ${t.name.slice(0, 30)}`);
    } catch (e) {
      keepPrev(t, e.message);
    }
  }
}

console.log(`PubMed に ${allPmids.size} 件の PMID を問い合わせます...`);

let result = {};
try {
  result = await fetchPubmed([...allPmids]);
} catch (e) {
  console.error(`\n！ ${e.message}`);
  console.error('  PubMed に届かないときは、公開を止めます（検証できない記事は出さない）。');
  process.exit(1);
}

// ---- 答えの見出し -----------------------------------------------------
//
// 記事の2番目の見出しは、答えそのものであること。
//
// 「結論から言うと」は、答えを1文字も言っていません。読者は見出しを読んで、
// 本文を読むかどうかを決めます。検索1位の記事は、見出しに答えを置いています。
//
// ★ ただし、答えを二値（ウソ／ホント）に丸めないこと。
//   うちが言えるのは「どこまで辿れて、どこから分からないか」だけです。
//   二値に丸めた瞬間、うちは「根拠が無いことを根拠に、逆へ断定する」側に回ります。
//
// （検索1位の美的.com の連載名は【美容の常識ウソ？ホント？】です。
//   構造は持ち帰り、名前と二値は置いてきました。ここが分水嶺です）

{
  const VAGUE = ['結論から言うと', '結論', 'まとめ', 'はじめに', 'この記事の結論', '答え'];
  const BINARY = ['ウソ？', 'ホント？', 'ウソかホント', '嘘か本当'];
  const SAYS_TOO_MUCH = ['効かない', '効果がない', '無意味', 'やめるべき', '避けるべき', '買ってはいけない'];

  for (const a of articles) {
    const heads = [...a.text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
    const second = heads[1];
    if (!second) continue; // 見出しが1つ以下の記事は、別の検査（文字数）で落ちる

    if (VAGUE.includes(second)) {
      failures.push(
        `${a.slug}: 2番目の見出しが「${second}」です。答えそのものを書いてください。\n` +
          `      読者は見出しを読んで、本文を読むかどうかを決めます。\n` +
          `      「結論から言うと」は、答えを1文字も言っていません。\n` +
          `      例:「「28日周期」を実測で裏付けた論文は、1本も見つかりませんでした」`
      );
    }

    for (const w of BINARY) {
      if (second.includes(w)) {
        failures.push(
          `${a.slug}: 2番目の見出しに「${w}」があります。答えを二値に丸めないでください。\n` +
            `      うちが言えるのは「どこまで辿れて、どこから分からないか」だけです。\n` +
            `      ウソ／ホントに丸めた瞬間、根拠が無いことを根拠に、逆へ断定する側に回ります。`
        );
      }
    }

    for (const w of SAYS_TOO_MUCH) {
      // 「『効かない』とは書けません」「『効果がない』とも言えません」のように、
      // **言い過ぎを断っている見出しは通す。**
      // （「とも」を入れ忘れていて、実際に正しい記述を止めかけた。2026-07-13）
      if (second.includes(w) && !/と[はも]|ではあり|わけでは/.test(second)) {
        failures.push(`${a.slug}: 2番目の見出しに「${w}」があります（言い過ぎ）\n      見出し: ${second}`);
      }
    }
  }
}

// ---- 「証拠が無い」と「効果が無い」を、混ぜていないか -------------------
//
// ★ うちの記事の大半は「ヒト試験が見つかりませんでした」で終わります。
//   **つまり、うちの記事は全部、この地雷の上に立っています。**
//
// Cochrane Handbook が明示的に警告しています（実物）:
//
//   **"confuse 'no evidence of an effect' with 'evidence of no effect'"** —— これを混同するな。
//   信頼区間が広いとき、"no effect" や "no different" と主張するのは **"wrong"**。
//
// そして世界で最も厳格なエビデンス評価機関が「確実性が低い」と書いたら、
// **読者には「効かない」と読まれました。**
//
//   EWG      : データ不足 → 「危険」
//   Cochrane : データ不足 → 「効かない」（読者が勝手に翻訳する）
//
// Cochrane の対処は、スコアの廃止ではなく **文の型の固定** でした。
// 確実性が最低のとき、彼らはこう書きます:
//
//   **"The evidence is very uncertain about the effect of X."**
//
// **"no effect"（効果がない）とは1文字も書いていません。**
// 主語が「X」から「the evidence」に入れ替わっています。
// **対象について語ることをやめ、自分の知識について語っている。**
//
//   （方法論の一次情報: GRADE guidelines 26. J Clin Epidemiol. 2020;119:126-135. PMID 31711912）
//
// ★ ここで止めるのは「無かった」を「無い」に変換している文だけです。
//   「有意差はありませんでした」は事実の報告なので、通します。

{
  const ABSENCE_TO_NONEXISTENCE = [
    // 「効果がない」＋「分かった/示された/結論」の形。＝ 証拠の不在を、効果の不在に変換している
    /効果が(ない|無い)(こと|と)(が|は)?(分か|わか|示され|判明|結論|証明)/,
    /(効かない|効果がない|効果はない)(ことが|ことは)(分か|わか|示され|判明|証明)/,
    /(意味がない|無意味だ)(ことが|と)(分か|わか|示され|判明|結論)/,
    // 「根拠が無い」＝「効果が無い」と直結させる形
    /根拠が(ない|無い)(ので|から|ため)[^。]{0,12}(効かない|効果はない|意味がない)/,
  ];

  for (const a of articles) {
    for (const re of ABSENCE_TO_NONEXISTENCE) {
      const m = a.text.match(re);
      if (!m) continue;
      failures.push(
        `${a.slug}: 「証拠が無い」を「効果が無い」に変換しています\n` +
          `      該当: ${m[0]}\n` +
          `\n` +
          `      **"no evidence of an effect"（効果の証拠が無い）と\n` +
          `        "evidence of no effect"（効果が無いという証拠）は、別のことです。**\n` +
          `      前者しか持っていないのに後者を書くのは、Cochrane が "wrong" と明言している誤りです。\n` +
          `\n` +
          `      書けるのはここまでです:\n` +
          `        「この主張の出典を辿りましたが、ヒトで確かめた研究は見つかりませんでした」\n` +
          `        「効果があるともないとも、いまのデータでは言えません」\n` +
          `      （主語を「対象」から「証拠」に移すこと。対象を裁くのではなく、自分の知識の範囲を語る）`
      );
      break;
    }
  }
}

// ---- 要約が、本文より古くなっていないか -------------------------------
//
// ★ 記事本文を直したのに、articles.json の summary が古いまま残る——これが起きました。
//
//   turnover-28days の本文を「検索は6件返るが、6本とも皮膚の話ですらない」に直したのに、
//   **要約には「PubMed で『28日』を裏付ける論文は0件でした」が残っていました。**
//   そしてそれは、トップページに出ていました。
//
//   **本文で誤りを直しても、要約が嘘をついていたら、直したことになりません。**
//
//   要約が「0件」と言っているなら、検索ログにも 0 件の検索が無ければおかしい。
//   機械に照合させます。

{
  const searchFile = join(SITE, 'searches.json');
  const searches = existsSync(searchFile)
    ? JSON.parse(readFileSync(searchFile, 'utf8')).searches ?? {}
    : {};

  for (const a of meta) {
    if (!a.published) continue;
    const s = a.summary ?? '';

    // 要約が「0件」と言い切っているなら、実際に 0 件を返した検索が記録されていること
    if (/0件|ゼロ件|1本も見つかりません/.test(s)) {
      const logged = searches[a.slug] ?? [];
      const hasZero = logged.some((x) => x.count === 0);
      if (!hasZero) {
        failures.push(
          `${a.slug}: 要約が「0件」と言っていますが、0 件を返した検索が記録されていません\n` +
            `      要約: ${s.slice(0, 60)}\n` +
            `      記録されている検索の件数: ${logged.map((x) => x.count).join(', ') || '（なし）'}\n` +
            `\n` +
            `      **本文で誤りを直しても、要約が嘘をついていたら、直したことになりません。**\n` +
            `      要約はトップページに出ます。読者が最初に読むのは、そこです。`
        );
      }
    }
  }
}

// ---- 英語の記事の検査 -------------------------------------------------
//
// ★ **うちの商品は記事ではなく「関門」です。そして、その関門は英語を読めませんでした。**
//
//   verify.mjs が止めているのは、日本語の禁止表現だけです。
//   英語で書いた瞬間、"This ingredient doesn't work." と書いても、機械は止めません。
//
//   **関門を通していない記事を公開することは、うちが批判してきた形そのものです。**
//
//   だから、**英語記事を1本も出さないうちに、関門を先に作りました。**
//   作っておけば、英語をやると決めた日に安全に始められます。
//   作っていなければ、その日に事故を起こします。
//
// ★ 英語の記事が1本も無ければ、この検査は何もしません。
//   articles.json の lang: "en" が目印です。

{
  const english = meta.filter((a) => a.published && a.lang === 'en');

  for (const a of english) {
    const mdPath = join(ROOT, 'articles', `${a.slug}.md`);
    if (!existsSync(mdPath)) continue;

    const text = readFileSync(mdPath, 'utf8');
    const problems = checkEnglish(text);

    for (const p of problems) {
      failures.push(`${a.slug} [英語]: ${p}`);
    }

    // アフィリエイトを入れたら、開示を必須にする
    //   16 CFR §255.5 Example 11 = **アフィリエイトリンクを貼るブロガーそのもの**が対象。
    //   日本語では薬機法66条が「何人も」なので最初から縛られていましたが、
    //   英語圏では**アフィリエイトを1本入れた瞬間に、FTC の射程が開きます。**
    const prod = existsSync(join(SITE, 'products.json'))
      ? JSON.parse(readFileSync(join(SITE, 'products.json'), 'utf8'))
      : {};
    const hasAffiliate = (prod[a.slug]?.items ?? []).some((i) => i.url);

    if (hasAffiliate && !EN_AFFILIATE_DISCLOSURE.test(text)) {
      failures.push(
        `${a.slug} [英語]: アフィリエイトのリンクがあるのに、開示文がありません\n` +
          `      16 CFR §255.5: "such connection must be disclosed clearly and conspicuously"\n` +
          `      **アフィリエイトを1本入れた瞬間、FTC の射程が開きます。**\n` +
          `      （日本語では薬機法66条が「何人も」なので、最初から縛られていました）\n` +
          `      ★ 開示はフッターではなく、読者が判断する場所に置くこと。**開示は、集計を救いません。**`
      );
    }
  }

  if (english.length) {
    console.log(`  英語の記事 ${english.length} 本を検査しました`);
  }
}

// ---- 「探した」ことの、裏付け -------------------------------------------
//
// ★ このブログの芯は「探したが、無かった」です。
//   ところが、論文の実在・撤回・タイトル一致は機械で証明しているのに、
//   **「探した」だけが、ずっと自己申告でした。**
//   サイトで唯一、裏付けの無い部分が、いちばん大事な部分になっていました。
//
//   だから、「見つかりませんでした」と書いた記事には、
//   **機械が実際に投げた検索のログが無ければ、公開を止めます。**
//
//   ログは site/searches.json にあり、**site/pubmed.mjs だけが書きます**
//   （検索を実行した副作用として。エージェントには書かせません）。
//   書かせた瞬間、それは「検索した証拠」ではなく「検索したという主張」に戻ります。
//
//   記事のレシートには、そのログが**読者がクリックできるリンク**として出ます。
//   **読者は30秒で、うちの検索を自分の画面で再実行できます。**

{
  const searchFile = join(SITE, 'searches.json');
  const searches = existsSync(searchFile)
    ? JSON.parse(readFileSync(searchFile, 'utf8')).searches ?? {}
    : {};

  // 「探したが無かった」と主張している記事だけを対象にする
  const CLAIMS_ABSENCE = /(見つかりませんでした|見つからなかった|ありませんでした|1本も|0件|存在しません)/;

  for (const a of articles) {
    if (!CLAIMS_ABSENCE.test(a.text)) continue;

    const logged = searches[a.slug] ?? [];
    if (!logged.length) {
      failures.push(
        `${a.slug}: 「見つかりませんでした」と書いていますが、検索のログがありません\n` +
          `\n` +
          `      **このブログの芯は「探したが、無かった」です。**\n` +
          `      論文の実在も撤回もタイトルも機械で証明しているのに、\n` +
          `      **「探した」だけが自己申告のままでは、いちばん大事な部分に裏付けが無いことになります。**\n` +
          `\n` +
          `      次のように検索してください。機械が site/searches.json に記録します:\n` +
          `        node site/pubmed.mjs search "<検索式>" --for ${a.slug}\n` +
          `\n` +
          `      記録された検索は、記事の末尾に「読者がクリックして再実行できるリンク」として出ます。\n` +
          `      （searches.json を手で書かないこと。書いた瞬間、それは証拠ではなく主張に戻ります）`
      );
    }
  }
}

// ---- 図の来歴（provenance） -------------------------------------------
//
// ★ うちの図は、記事の中で最も強く記憶される部分です。
//   そして今まで、そこだけが検証機構の外にありました。
//   verify.mjs は figures.json を1行も読んでいませんでした。
//   source が自由記述だったので、何を書いてもビルドが通っていました
//   （実際、「出典: 記事末尾の参考文献を参照」と書かれた図がありました。それは出典ではありません）。
//
//   Our World in Data の本体は「データを落とせるボタン」ではありません。
//   **「来歴は、必ずデータに随伴する」という規律**です。移植するのは、そちらです。
//
// 決まり:
//   ・記事で使う図には sourcePmids（配列）を必ず書く
//   ・そこに書いた PMID は、PubMed に実在し、**その記事の参考文献にも載っていること**
//   ・PubMed に無い出典（日本語誌など）を使うときは sourceOther に書く。
//     **「無い」と言うだけでは通りません。何なのかを書いてください**

{
  const figFile = join(SITE, 'figures.json');
  if (existsSync(figFile)) {
    const figs = JSON.parse(readFileSync(figFile, 'utf8')).figures ?? {};

    for (const a of articles) {
      const used = [...a.text.matchAll(/^::figure:([\w-]+)::/gm)].map((m) => m[1]);
      const cited = new Set(a.pmids.map((p) => String(p.pmid)));

      for (const id of used) {
        const f = figs[id];

        // ★★ 図が site/figures.json に無ければ、**公開を止めます。**
        //
        //   前は `continue` で見逃していました（「build.mjs 側が検出する」と書いて）。
        //   **その結果、「検証を通過しました」と言いながら、事実が消えたページを通しました。**
        //
        //   2026-07-14、記事を短くする作業で、実際に起きました。
        //   **47点の図のうち18点が統合されておらず、build.mjs は該当行を黙って捨てました。**
        //   「文章から消して図に移した」と報告された事実の多くが、
        //   **公開ページのどこにも存在しませんでした。**
        //
        //   ★ 文章を図に畳むとき、**図の統合を忘れると、事実がこの世から消えます。**
        //     関門で止めます。
        if (!f) {
          failures.push(
            `${a.slug}: 図「${id}」が site/figures.json にありません。\n` +
              `\n` +
              `      **記事は ::figure:${id}:: と書いているのに、図の中身がありません。**\n` +
              `      build.mjs は、この行を**黙って捨てます。**\n` +
              `      **文章から消して図に移した事実が、公開ページのどこにも存在しなくなります。**\n` +
              `\n` +
              `      research/figures-*.json に書いたなら、site/figures.json に統合してください。`
          );
          continue;
        }

        const pmids = (f.sourcePmids ?? []).map(String);
        const other = f.sourceOther;

        if (!pmids.length && !other) {
          failures.push(
            `${a.slug}: 図「${id}」に出典がありません（sourcePmids または sourceOther が要ります）\n` +
              `      図は、記事の中で最も強く記憶される部分です。そこだけを検証の外に置かないでください。\n` +
              `      いまの source: ${String(f.source ?? '(なし)').slice(0, 60)}`
          );
          continue;
        }

        for (const p of pmids) {
          // 図の出典は「記事の参考文献にも載っていること」を必須にしているので、
          // PubMed への実在照会・撤回確認は、参考文献の側ですでに済んでいる。
          if (!cited.has(p)) {
            failures.push(
              `${a.slug}: 図「${id}」の出典 PMID ${p} が、記事の参考文献にありません\n` +
                `      図だけが引いている論文があってはいけません。読者は図から原典に帰れなくなります。`
            );
          }
        }

        if (!pmids.length && other && !/\d{4}/.test(JSON.stringify(other))) {
          failures.push(
            `${a.slug}: 図「${id}」の sourceOther に年がありません（著者・年・掲載誌・DOI を書いてください）`
          );
        }
      }
    }
  }
}

// ---- 開示の位置 -------------------------------------------------------
//
// **開示は、集計を救わない。**
//
// The Derm Review は提携を開示しています。それでも信頼されていません。
// 開示がフッタにあり、ランキングが本文にあるからです。
// **判断が下される場所に開示が無ければ、開示していないのと同じです。**
//
// だから、企業資金の論文を根拠にしている記事は、資金の話を
// 参考文献より前（＝読者が判断する場所）に書くこと。

{
  const papersFile = join(SITE, 'papers.json');
  if (existsSync(papersFile)) {
    const papers = JSON.parse(readFileSync(papersFile, 'utf8')).papers ?? [];
    const industry = new Set(
      papers.filter((p) => p.fundingType === 'industry').map((p) => String(p.pmid))
    );

    for (const a of articles) {
      const cited = [...new Set(a.pmids.map((p) => String(p.pmid)))].filter((p) => industry.has(p));
      if (!cited.length) continue;

      const refIdx = a.text.search(/^##\s*(参考文献|根拠)/m);
      const body = refIdx > 0 ? a.text.slice(0, refIdx) : a.text;

      if (!/資金|利益相反|スポンサー|メーカー社員|出資|COI/.test(body)) {
        failures.push(
          `${a.slug}: 企業資金の論文（PMID ${cited.join(', ')}）を引いているのに、\n` +
            `      本文で資金源に触れていません（参考文献の中に書くだけでは足りません）。\n` +
            `      開示は、集計を救いません。読者が判断する場所——本文——に書いてください。`
        );
      }
    }
  }
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

    if (isRetracted) {
      // ★ 撤回を「見た」という事実を、記事から消せない場所に記録する。
      //
      //   この記録が無いと、関門を通す道が2つできてしまう。
      //     (a) 参考文献に「※撤回」と書く  → 撤回が読者に見える
      //     (b) その引用を、記事から消す    → 撤回が読者から見えなくなる。そしてビルドは通る
      //
      //   (b) を選ぶと、PMID が消え、次回から照会対象から外れ、verified.json からも消える。
      //   **「うちが撤回論文を根拠にしていた」という事実が、こちらの都合で歴史から消える。**
      //   読者からは、その記事は最初から正しかったようにしか見えない。
      //
      //   **それは、黙って書き換えることです。** うちの唯一の武器と正面から矛盾します。
      //   だから、引用を消しても、この記録は残ります（corrections.json は追記だけ）。
      seenRetraction(a.slug, pmid, rec.title ?? '');
    }

    if (isRetracted && !disclosesRetraction) {
      failures.push(
        `${a.slug}: PMID ${pmid} は【撤回された論文】ですが、記事にその記載がありません\n` +
          `      ${rec.title ?? ''}\n` +
          `      記事: ${line.trim().slice(0, 90)}\n` +
          `\n` +
          `      引くなとは言いません。「撤回された」と書いてください。\n` +
          `      「撤回された論文が、いまも売り文句の根拠に使われている」——それを書くのが、このブログの仕事です。\n` +
          `\n` +
          `      ★ 引用を消して黙らせることは、してはいけません。\n` +
          `        消してもビルドは通りますが、「うちが撤回論文を根拠にしていた」という事実が、\n` +
          `        こちらの都合で歴史から消えます。それは、黙って書き換えることです。\n` +
          `        （消しても site/corrections.json には記録が残り、記事に訂正ログが出ます）`
      );
      continue;
    }

    if (isRetracted) {
      warnings.push(`${a.slug}: PMID ${pmid} は撤回された論文です（記事に撤回の記載あり。通します）`);
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

// ---- 記事・図・論文カード・台帳のあいだで、数字が食い違っていないか --------
//
// ★★ 2026-07-14、実際に食い違っていた。**そして公開されていた。**
//
//    記事      「著者7人のうち6人がキユーピー」   ← 一次情報どおり
//    図        「著者7人のうち5人がキユーピー」   ← 誤り
//    論文カード「著者7名のうち5名。残る1名は東邦大学」 ← 5+1=6 ≠ 7。算数が合わない
//
//  **誰も気づかなかった。**
//  記事を短くする担当が「記事と図で数が違う」と報告して、初めて見つかった。
//  **図を作らせなければ、気づいていない。偶然だった。**
//
//  ★ 偶然に頼るのをやめる。**公開のたびに、機械が数える。**
//
//  ★ 別のCIステップにすると、忘れられる。**関門の中に入れる。**
//
//  ★★ この検査は、記事を読み込んだ後（`articles` が埋まった後）でなければ動きません。
//     最初これを台帳の検査の隣（500行目あたり）に置きました。**関門が起動時に落ちました。**
//     `articles` は 800 行目で作られるからです。**関門が落ちている間、検査は 1 件も走りません。**
//     置き場所を間違えると、検査は「甘くなる」のではなく「全部止まる」。ここから動かさないこと。

{
  const numSources = [];
  for (const a of articles) numSources.push([`記事 ${a.slug}`, a.text]);
  const researchDir = join(ROOT, 'research');
  if (existsSync(researchDir)) {
    for (const f of readdirSync(researchDir).filter((x) => x.endsWith('.md'))) {
      numSources.push([`カード ${f.replace('.md', '')}`, readFileSync(join(researchDir, f), 'utf8')]);
    }
  }
  if (existsSync(join(SITE, 'figures.json'))) {
    numSources.push(['図', readFileSync(join(SITE, 'figures.json'), 'utf8')]);
  }
  numSources.push(['台帳', readFileSync(join(SITE, 'papers.json'), 'utf8')]);

  // ① 算数（部分 > 全体 / 内訳の合計が全体と合わない）
  for (const [where, txt] of numSources) {
    for (const m of txt.matchAll(/(\d+)\s*[人名](?:の)?(?:うち|中)\s*(\d+)\s*[人名]/g)) {
      if (Number(m[2]) > Number(m[1])) {
        failures.push(
          `${where}: 「${m[0].replace(/\s+/g, '')}」 ← **部分が全体より多い**\n` +
            `      一次情報（PubMed）を開いて、正しい数を確かめてください。`
        );
      }
    }
    for (const m of txt.matchAll(
      /(\d+)\s*[人名]のうち(\d+)\s*[人名][^。]{0,80}。[^。]{0,20}残る\s*(\d+)\s*[人名]/g
    )) {
      const [tot, a, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      if (a + b !== tot) {
        failures.push(
          `${where}: **内訳の合計が合いません**（${a} + ${b} = ${a + b} ≠ ${tot}）\n` +
            `      「${m[0].replace(/\s+/g, '').slice(0, 56)}…」\n` +
            `      一次情報（PubMed）を開いて、正しい数を確かめてください。`
        );
      }
    }
  }

  // ② 同じ論文について、記事・図・カード・台帳で数が一致しているか
  //
  //   ★ 「企業名」だけでまとめてはいけない。同じ企業でも、論文が違えば著者数は違う。
  //     キユーピーの論文は「7名中6名」と「8名中7名」の2本ある。**どちらも正しい。**
  //     最初これを食い違いと判定した。**関門が、正しい記述を違反と判定した。**
  //   → 「企業名 + 著者の総数」でまとめ、**総数が同じなのに内訳が違う**ときだけ止める。
  const RE_COMPANY =
    /(\d+)\s*[人名](?:の)?(?:うち|中)\s*(\d+)\s*[人名][^。]{0,24}?([ァ-ヴー]{3,12}|Kewpie|Contipro|Pharmarese|ISDIN|Monteloeder|Tosla|Bionap)/g;

  const byPaper = {};
  for (const [where, txt] of numSources) {
    for (const m of txt.matchAll(RE_COMPANY)) {
      (byPaper[`${m[3]}／著者${m[1]}名`] ??= []).push({ where, part: m[2], raw: m[0].replace(/\s+/g, '') });
    }
  }
  for (const [key, list] of Object.entries(byPaper)) {
    const parts = new Set(list.map((x) => x.part));
    if (parts.size > 1) {
      failures.push(
        `${key}: **記事・図・カード・台帳で、内訳が食い違っています**\n` +
          list.map((x) => `        ${x.where.padEnd(24)} ${x.raw}`).join('\n') +
          `\n\n      **一次情報（PubMed）を開いて、どれが正しいかを確かめてください。**\n` +
          `      **食い違っている全部を直すこと。** 1箇所だけ直すと、また食い違います。`
      );
    }
  }
}

// ---- 訂正台帳を書き出す ---------------------------------------------
//
// ★ 検査に落ちても、ここは書きます。
//   「撤回論文を引いていた」という事実は、検査の結果とは関係なく、起きた事実だからです。
//   落ちたから記録しない、では、落ちるたびに歴史が消えます。

if (correctionsChanged) {
  writeFileSync(CORRECTIONS, JSON.stringify(corrections, null, 2) + '\n', 'utf8');
  console.log(`  site/corrections.json に訂正の記録を追記しました`);
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

  // ★ 商品の価格。**公開のたびに機械が取り直したもの。**
  //
  //   products.json には価格を書きません。**書けば、いつか嘘になります。**
  //   build.mjs は、このファイルを**読むだけ**です。書けません。
  //
  //   failed: true は「取得できなかった」。**「0円だった」ではありません。**
  prices,

  articles: Object.fromEntries(
    articles.map((a) => {
      const pmids = [...new Set(a.pmids.map((p) => p.pmid))];
      const typeOf = (p) => result[p]?.pubtype ?? [];

      // ★ 「総説を探したか」を、機械が数える（WP:MEDRS）
      //
      //   Wikipedia の医学分野の出典基準は、こう言っています。
      //   **「一次研究を、二次情報（総説・メタアナリシス）の結論を覆すために引くな」**
      //
      //   これは、うちのやり方を名指しで否定しています。
      //   衝突は部分的です——うちが辿っているのは総説ではなく「出典の無い売り文句」だからです。
      //   **しかし、うちは「総説を探したか」を、どこにも書いていませんでした。**
      //
      //   「28日を測った論文は見つかりませんでした」と書くとき、
      //   総説をちゃんと探したうえで無かったのか、探していないだけなのか、
      //   **読者には区別がつきません。** だから、数を出します。
      //
      //   ★ ただし、これは「総説を探した」ことの証明にはなりません。
      //     機械に分かるのは「引いた論文のうち何本が総説だったか」だけです。
      //     **探したかどうかは、機械には確認できません。** レシートにもそう書きます。
      const isReview = (p) =>
        typeOf(p).some((t) => ['Review', 'Systematic Review', 'Meta-Analysis'].includes(t));
      const isHuman = (p) =>
        typeOf(p).some((t) =>
          ['Randomized Controlled Trial', 'Clinical Trial', 'Controlled Clinical Trial'].includes(t)
        );

      return [
        a.slug,
        {
          pmids,
          count: pmids.length,
          reviews: pmids.filter(isReview).length,
          humanTrials: pmids.filter(isHuman).length,
          retracted: pmids.filter((p) => typeOf(p).includes('Retracted Publication')),
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
