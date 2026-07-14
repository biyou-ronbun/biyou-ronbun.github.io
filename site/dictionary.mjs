// ---------------------------------------------------------------
//  成分辞典（2026-07-14、オーナー判断で開けた）
//
//  ---------------------------------------------------------------
//  ★★ なぜ、これが危ないのか
//
//    却下されていた理由は「辞典」という名前ではありません。**中身でした。**
//
//      ✗ **解説を書くこと** … うちの言葉で成分を語れば、それは論文ではなく「意見」
//      ✗ **薄いページの大量生成** … Google のスパムポリシーが明示的に禁じている
//         （「AIで価値を加えないページの大量生成」。自動か人力かを問わない）
//         **このサイトを殺すのは、書かないことではなく、薄いものを書くこと。**
//
//  ★ だから、この辞典は **解説を1行も書きません。**
//
//    載せるのは、**すでに検証済みのデータだけ**です:
//      ・ランキング（重みの開示つき）
//      ・診断（claims.json）の 効果 / 副作用 / 使い方
//      ・論文の表（evidence sheet）へのリンク
//      ・商品（ランキングつき・広告の開示つき）
//      ・記事へのリンク
//
//    **1文字も、新しく書きません。** 書きたいことがあるなら、それは記事に書いてください。
//
//  ★★ そして、材料が足りない成分の辞典は、**作りません。**
//
//    項目が1〜2件しかない成分でページを作れば、それが「薄いページ」です。
//    **作らなかったものは、ログに出します。黙って落とさないこと。**
// ---------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));

// ★★ 辞典を作る条件。**これを緩めたくなったら、それが危険信号。**
//
//   緩めれば、ページ数は増えます。**そして、薄くなります。**
export const MIN_CLAIMS = 5; // 診断の項目が、これ未満なら作らない
export const MIN_KINDS = 2; // 効果 / 副作用 / 使い方 のうち、2種類以上に触れていること

// ★ URL の語彙。**成分名を機械にローマ字化させない。**
//   （させると、表記ゆれで URL が勝手に変わり、リンクが切れる）
//   ★ 語を増やすときは、ここに手で足すこと。site/verify.mjs が語彙を検査します。
export const SLUG_OF = {
  レチノール: 'retinol',
  ビタミンC: 'vitamin-c',
  日焼け止め: 'sunscreen',
  ヒアルロン酸: 'hyaluronic-acid',
  飲むもの: 'oral',
  肌断食: 'skin-fasting',
  お風呂と保湿: 'bathing',
  ターンオーバー: 'turnover',
  PDRN: 'pdrn',
};

export function buildEntries() {
  const claims = JSON.parse(readFileSync(join(SITE, 'claims.json'), 'utf8')).claims;

  const byTopic = {};
  for (const c of claims) {
    if (!c.topic) continue;
    (byTopic[c.topic] ??= []).push(c);
  }

  const made = [];
  const skipped = [];

  for (const [topic, items] of Object.entries(byTopic)) {
    const kinds = new Set(items.map((c) => c.kind).filter(Boolean));
    const slug = SLUG_OF[topic];

    if (!slug) {
      skipped.push({ topic, n: items.length, why: 'URL の語彙（SLUG_OF）に無い。手で足すこと' });
      continue;
    }
    if (items.length < MIN_CLAIMS) {
      skipped.push({ topic, n: items.length, why: `診断の項目が ${items.length} 件（${MIN_CLAIMS} 件未満）。**薄いページになる**` });
      continue;
    }
    if (kinds.size < MIN_KINDS) {
      skipped.push({ topic, n: items.length, why: `触れているのが「${[...kinds].join('・')}」だけ（${MIN_KINDS} 種類未満）。**薄いページになる**` });
      continue;
    }

    // その成分が、どの記事に紐づいているか
    const articles = [...new Set(items.map((c) => c.article).filter(Boolean))];

    made.push({
      topic,
      slug,
      articles,
      byKind: {
        効果: items.filter((c) => c.kind === '効果'),
        副作用: items.filter((c) => c.kind === '副作用'),
        使い方: items.filter((c) => c.kind === '使い方'),
      },
      n: items.length,
    });
  }

  made.sort((a, b) => b.n - a.n);
  return { made, skipped };
}

// traced のラベル。**「効かない」とは書かない。「どこまで辿れたか」だけ。**
export const TRACED_LABEL = {
  'human-trial': 'ヒト試験まで辿れた',
  'industry-only': '企業資金の試験だけ',
  'lab-measure-only': '機器の測定値だけ',
  'invitro-only': '試験管・培養細胞だけ',
  'animal-only': '動物実験だけ',
  'source-mismatch': '出典はあるが、その論文はそう言っていない',
  'no-source': '出典が見つからなかった',
};
