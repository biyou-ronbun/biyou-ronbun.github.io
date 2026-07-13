// ---------------------------------------------------------------
//  記事の「武器」を数える。**数え方は、このファイル1箇所だけ。**
//
//  ★ 最初、数え方を2箇所に書いた（verify.mjs と、基準線を作るスクリプト）。
//    正規表現がずれて、**関門のほうが甘く数えた。**
//    「見つからなかった」が 19 → 18 に減ったのに、公開が通った。
//
//    CLAUDE.md:「ビルドのロジックを2箇所に書かないこと」——同じ過ちだった。
//
//  使う側:
//    site/verify.mjs           … 基準線を下回っていないか検査する
//    site/record-baseline.mjs  … 基準線を記録する
// ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));

const FIGS = existsSync(join(SITE, 'figures.json'))
  ? JSON.parse(readFileSync(join(SITE, 'figures.json'), 'utf8')).figures ?? {}
  : {};

// ★★ 数えるのは「記事 + その記事が埋め込んでいる図」。
//
//   最初、記事の .md しか数えていなかった。**それは間違いだった。**
//
//   文章を図に畳むと、資金源も「見つかりませんでした」も、**図の中に移る。**
//   **読者には見えているのに、関門は「消えた」と判定した。**
//   （実際に起きた。「8%未満のビタミンC濃度では、生物学的な意義に乏しい」は
//     本文から消え、図 vitc-concentration のセルの中に移っていた）
//
//   **図は記事の一部。** .md しか見ない関門は、正しい書き換えを違反と判定する。
export const withFigures = (md) => {
  const ids = [...md.matchAll(/^::figure:([\w-]+)::/gm)].map((m) => m[1]);
  return md + ' ' + ids.map((id) => (FIGS[id] ? JSON.stringify(FIGS[id]) : '')).join(' ');
};

// ★★ 活用形を、すべて拾う。
//
//   最初、「見つかりませんでした」は数えるのに、**「見つからなかった」は数えなかった。**
//   **同じ事実なのに、活用形が違うだけで見落としていた。**
const RE_FUNDING = /資金|利益相反|COI|スポンサー|所属|社員|出資|提供元/g;

// ★ 「探したが、無かった」の言い方は、たくさんある。
//
//   最初は「見つかりませんでした」しか数えていなかった。
//   書き換えで「示していませんでした」に変わったら、**関門は「消えた」と判定した。**
//   **同じ事実なのに、言い回しが違うだけで見落とす。**
//
//   ★ ただし、足しすぎれば関門は骨抜きになる。**明確に同義のものだけ。**
//     「効かない」「無意味」は入れない。**それは判定であって、「無かった」ではない。**
const RE_NOTFOUND =
  /見つかりませんでした|見つかりません|見つからなかった|見つからず|見つけられませんでした|確認できませんでした|確認できていません|確認できなかった|確認できず|1本もありません|1本も見つ|一本も|0件|0本|存在しません|存在しなかった|示していませんでした|示されていません|示していない|報告されていません|報告はありません|裏付けは|支持していません|支持していなかった/g;

const RE_PMID = /PMID[:：]?\s*(\d{6,9})/gi;

/**
 * 記事1本の「武器の数」を数える。
 *
 *   chars    … 文字数（★ 減ってよい）
 *   pmids    … 引用した論文の数
 *   funding  … 資金源・利益相反・所属・社員への言及
 *   notfound … 「見つからなかった」系  ← ★ うちが他と違う唯一の部分
 *   figures  … 図の数
 *
 * ★ chars 以外の4つは、減らせない。verify.mjs が公開を止める。
 */
export const countWeapons = (md) => {
  const t = withFigures(md);
  return {
    chars: md.replace(/\s/g, '').length,
    pmids: new Set([...md.matchAll(RE_PMID)].map((m) => m[1])).size,
    funding: (t.match(RE_FUNDING) ?? []).length,
    notfound: (t.match(RE_NOTFOUND) ?? []).length,
    figures: (md.match(/^::figure:/gm) ?? []).length,
  };
};

export const WEAPON_KEYS = ['pmids', 'funding', 'notfound', 'figures'];

export const WEAPON_LABEL = {
  pmids: '引用した論文の数',
  funding: '資金源・利益相反・所属への言及',
  notfound: '「見つかりませんでした」',
  figures: '図の数',
};

export const WEAPON_WHY = {
  notfound:
    '**「見つかりませんでした」は、何も言っていないように見えます。だから最初に消されます。**\n' +
    '      **しかし、それが、うちが他のどの美容メディアとも違う、唯一の部分です。**',
  funding:
    '**「著者7人のうち6人がキユーピー社員」は、長い。だから削りたくなります。**\n' +
    '      **その一文が、この記事の結論そのものです。**',
  pmids: '**減らせば記事は短くなります。しかし、根拠が減ります。**',
  figures: '**図を減らして文章に戻すのは、この作業と逆向きです。**',
};
