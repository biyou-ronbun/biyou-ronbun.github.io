// 他メディアの研究が、他メディアの型を持ち帰っていないかを検査する。
//
// ★★★ なぜ、この関門が要るのか
//
//   「他メディアを研究してサイトを更新しろ」と毎週命じられた機械は、
//   **必ず他メディアの型を取り込みます。**
//
//   他の美容メディア（@cosme / LIPS / MimiTV / 美的…）で最も伸びている機能は、これです。
//
//     ・ランキング          … @cosme と LIPS の中核
//     ・成分辞典            … 検索流入の柱
//     ・商品データベース    … 回遊の柱
//     ・肌診断 → おすすめ成分 → おすすめ商品
//     ・点数・星・グレード
//     ・メール会員登録
//
//   **6つとも、うちがすでに却下したものです。**
//   **そして、他メディアで最も伸びている機能です。**
//
//   毎週それを見せられた機械は、必ず「これを入れれば伸びる」と考えます。
//   **理念では止まりません。だから機械で止めます。**
//
//   ★ Consumer Reports は1936年から広告を断り続けた消費者団体です。
//     その CR が、いま認証マークの掲示料を、評価した企業から取っています。
//     **判定は資産になる。資産は換金圧力を持つ。86年の実績でも止まらなかった。**
//
// 使い方:
//   node auto/benchmark-gates.mjs
//     終了コード 0  = 問題なし
//     終了コード 1  = 他メディアの型を持ち帰っている。**呼び出し側が git で戻すこと**

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');

const failures = [];

// ---- ① 却下済みの「型」が、サイトに入り込んでいないか ------------------
//
// ★ 「却下したことを説明する文」に引っかからないよう、
//   打ち消しの言い回しがある行は除外する。
//   （関門は、自分の善行を違反と判定しがち。実際に何度も起きた）

const DENIAL = [
  '持ちません', '持たない', '作りません', '作らない', '却下', '書きません', '書かない',
  'ありません', '入れません', '出しません', 'しないこと', 'ではありません', '禁止',
  '止めます', '戻します', '違います', '避け',
];

const hasDenial = (line) => DENIAL.some((d) => line.includes(d));

// ★★ 2026-07-14、オーナー判断で **5つの扉を開けました**。
//
//   ランキング / 点数・認証 / 成分辞典 / タイアップ / 肌診断→おすすめ成分→商品
//
//   理由（オーナーの言葉）:
//     「断り続けるのは将来的に利益が減ると思う」
//     「ランキング・成分辞典・タイアップ・肌診断を開けなければ、読者がファン化しない」
//
//   うちの実測も、それを支持していた:
//     benchmark/general-beauty-media.md 「占いは4社が持つ最強の再訪装置」
//
//   **だから、この関門は、もうランキングも点数も止めません。**
//
// ★★ ただし、**開けていない扉がある**。オーナーが頼んでいないものは、開けない。
//
//   ・ゲーミフィケーション（バッジ・レベル・連続記録） … 読者を採点する装置
//   ・通知をねだる                                  … 追跡の入口
//   ・**読者数の捏造**                              … ★ これは詐欺。永久に開けない
//   ・メール登録                                    … **届ける手段が無い。**
//                                                     作るなら、先に送る仕組みを作ること
//
// ★ そして、法律の関門は site/verify.mjs に残っている。**外さないこと。**
//   薬機法 / ステマ規制の開示 / 論文と数値の捏造 / 医師法（肌の医学的判定）
const REJECTED = [
  // --- 以下は、2026-07-14 に**解除**した（オーナー判断）-------------------
  //
  //   { re: /ランキング|人気順|おすすめ順|総合評価|ベスト\d|第\d+位/ }   ← 解除
  //   { re: /この成分は(効き|おすすめ|向いて)/ }                        ← 解除
  //   { re: /総合スコア|評価点|星\d つ|\d+点満点|グレード[A-E]|5段階評価/ } ← 解除
  //
  //   ★ 元に戻したくなったら、git log で `open-doors` ブランチを見ること。
  //     判定を持つことの代償は、CLAUDE.md に書いてある（Consumer Reports の話）。
  // ------------------------------------------------------------------

  { re: /バッジ|レベルアップ|連続記録|ログインボーナス|ポイントを獲得/, why: 'ゲーミフィケーション。読者を採点する装置。**オーナーは、これは頼んでいない**' },
  { re: /メールでお届け|メールマガジン|メールで受け取|メール会員/, why: 'メール登録。**届ける手段が無い。** 続かない約束を置いた時点で、信用が壊れる。作るなら先に送る仕組みを' },
  { re: /通知を(許可|オン|受け取)/, why: '通知をねだる。通知は追跡の入口。**オーナーは、これは頼んでいない**' },
  { re: /[\d,]+\s*人が(読者|購読|支援|登録)/, why: '★★ 読者数の捏造。**これは詐欺。永久に開けない。** 購読者は実測で 0 人' },
];

// テンプレートと、生成の本体を見る
const targets = [];
const tplDir = join(SITE, 'templates');
if (existsSync(tplDir)) {
  for (const f of readdirSync(tplDir).filter((x) => x.endsWith('.html'))) {
    targets.push(join(tplDir, f));
  }
}
for (const f of ['build.mjs', 'articles.json', 'config.json', 'claims.json', 'news.json']) {
  const p = join(SITE, f);
  if (existsSync(p)) targets.push(p);
}

for (const p of targets) {
  const rel = p.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
  const lines = readFileSync(p, 'utf8').split(/\r?\n/);

  lines.forEach((line, i) => {
    // コメント行と、打ち消しの文は見逃す（却下の説明そのものを違反にしない）
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('#') || t.startsWith('*')) return;
    if (t.startsWith('"_') || /^"[^"]*_readme/.test(t)) return;
    if (hasDenial(line)) return;

    for (const r of REJECTED) {
      if (r.re.test(line)) {
        failures.push(
          `${rel}:${i + 1}  ${r.why}\n` +
            `      → ${t.slice(0, 90)}`
        );
      }
    }
  });
}

// ---- ② テンプレートが増えていないか ------------------------------------
//
//   新しいページの「型」を作ることが、いちばん危ない。
//   ランキングページ・成分辞典ページは、1枚のテンプレートから生まれる。
//
//   ★ 増やすこと自体は禁止しない。**オーナーに気づかせる。**

const KNOWN_TEMPLATES = [
  '404.html', 'about.html', 'article.html', 'card.html', 'check.html',
  'contact.html', 'cta.html', 'home.html', 'layout.html', 'membership.html',
  'news.html', 'privacy.html', 'tokushoho.html', 'verified-en.html',
];

// ★ ランキング・点数・診断→おすすめ・メール登録・読者数の捏造は、
//   **却下のままです。** 上の REJECTED が、いまも止めます。
//   （2026-07-13 オーナー判断で解除されたのは「成分辞典」と「商品一覧」の2つだけ）

if (existsSync(tplDir)) {
  const now = readdirSync(tplDir).filter((x) => x.endsWith('.html'));
  const added = now.filter((f) => !KNOWN_TEMPLATES.includes(f));
  if (added.length) {
    failures.push(
      `site/templates/ に新しいページの型が増えています: ${added.join(' / ')}\n` +
        `\n` +
        `      **新しいページの型を作ることが、いちばん危険です。**\n` +
        `      ランキングページも、成分辞典も、1枚のテンプレートから生まれます。\n` +
        `\n` +
        `      正当な追加なら、auto/benchmark-gates.mjs の KNOWN_TEMPLATES に足してください。\n` +
        `      **ただし、足す前にオーナーに聞くこと。**`
    );
  }
}

// ---- 結果 ---------------------------------------------------------------

const line = '='.repeat(62);

if (!failures.length) {
  console.log('  ✓ 他メディアの型は、持ち帰られていません');
  process.exit(0);
}

console.log(line);
console.log('  ★★ 他メディアの型を、持ち帰っています');
console.log(line);
console.log('');
for (const f of failures) console.log(`  ✗ ${f}\n`);
console.log(line);
console.log('  他の美容メディアで最も伸びている機能は、うちが却下したものです。');
console.log('  **毎週それを見せられた機械は、必ず「これを入れれば伸びる」と考えます。**');
console.log('  **理念では止まりません。だから機械で止めます。**');
console.log(line);
process.exit(1);
