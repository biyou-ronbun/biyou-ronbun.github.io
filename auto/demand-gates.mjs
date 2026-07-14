// ---------------------------------------------------------------
//  「集客しろ」と命じられた機械が、やってはいけないこと
//
//      node auto/demand-gates.mjs
//
//  auto/demand.ps1（集客の輪・毎週土曜）が、作業の前と後に呼びます。
//
//  ---------------------------------------------------------------
//  ★★★ この輪が、いちばんサイトを殺しやすい
//
//    「集客しろ」と毎週命じられた機械は、必ずこうします。
//
//      ・記事を量産する（検索キーワードごとに1本ずつ）
//      ・キーワードを詰め込む
//      ・他サイトの内容を、言い換えて載せる
//      ・論文カード無しで記事を書く
//
//    **Google のスパムポリシーは「AIで価値を加えないページの大量生成」を**
//    **明示的に禁じています**（自動か人力かを問わない）。
//    **AdSense と検索流入を、同時に失います。**
//
//    ★ **このサイトを殺すのは、書かないことではなく、薄いものを書くことです。**
//      （benchmark/ai-scaled-content-penalty.md に、実際に消えたサイトの記録があります）
//
//  ---------------------------------------------------------------
//  ★★ そして、いちばん静かな死に方
//
//    **「この言葉で検索されているから、この結論を書こう」**
//
//    読者が求めているのは「◯◯は効きます」で、うちが書けるのは「見つかりませんでした」。
//    **検索に合わせて結論を変えた瞬間、このブログを読む理由が消えます。**
//
//    需要を見るのは、**読者の言葉を知るため**です。**読者に迎合するためではありません。**
// ---------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = join(ROOT, 'site');

const failures = [];
const warnings = [];

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// ---- ① 論文カードの無い記事を書いていないか ---------------------------------
//
// ★★ **カード無しで書かせると、このブログの唯一の武器が壊れます。**（CLAUDE.md）
//   記事は researcher → research/<slug>.md → writer で作ります。
//   「検索されているから」で記事を1本足すのが、いちばん起きやすい事故です。

{
  const articles = existsSync(join(ROOT, 'articles'))
    ? readdirSync(join(ROOT, 'articles')).filter((f) => f.endsWith('.md'))
    : [];

  for (const f of articles) {
    const slug = f.replace(/\.md$/, '');
    const card = join(ROOT, 'research', `${slug}.md`);
    if (!existsSync(card)) {
      failures.push(
        `articles/${f}: **論文カード（research/${slug}.md）がありません**\n` +
          `      記事は researcher → 論文カード → writer で作ります。\n` +
          `      **カード無しで書かせると、このブログの唯一の武器が壊れます。**\n` +
          `      「検索されているから1本書こう」——それが、いちばん起きやすい事故です。`
      );
    }
  }
}

// ---- ② 薄いページを作っていないか -------------------------------------------
//
// ★ Google のスパムポリシー: 「AIで価値を加えないページの大量生成」
//   **自動か人力かを問わない。**

const MIN_CHARS = 1500; // 公開する記事の下限

{
  const dir = join(ROOT, 'articles');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const n = read(join(dir, f)).replace(/\s+/g, '').length;
      if (n < MIN_CHARS) {
        failures.push(
          `articles/${f}: **薄すぎます（${n} 文字 / 下限 ${MIN_CHARS}）**\n` +
            `      **このサイトを殺すのは、書かないことではなく、薄いものを書くことです。**\n` +
            `      Google のスパムポリシーは「AIで価値を加えないページの大量生成」を禁じています`
        );
      }
    }
  }
}

// ---- ③ この輪は、記事を書かない ---------------------------------------------
//
// ★★ 「集客しろ」と命じられた機械は、**必ず記事を書き始めます。**
//   「この言葉で検索されているから、この記事を1本」——それが量産の始まりです。
//
// ★ 記事は、記事の輪（auto/run.ps1）だけが作ります。平日に1日1本。
//   researcher → 論文カード → writer。**この順番を飛ばさない。**
//
// ★ **この輪が articles/ を触ったら、auto/demand.ps1 が git で元に戻します。**
//   （金曜の輪〈auto/journal.ps1〉と、まったく同じ形です）
//
//   ★ 記事の本数そのものは、ここでは数えません。
//     最初これを数えたら、**立ち上げの11本を「量産」と判定しました。**
//     サイトは生後2日で、11本は全部そのとき作られたものです。
//     **「この輪が触ったか」を見るほうが、正確で、壊れません。**

// ---- ④ キーワードを詰め込んでいないか ---------------------------------------
//
// ★ タイトルと説明文に、同じ語が何度も出てくるのは、詰め込みの兆候。

{
  const meta = JSON.parse(read(join(SITE, 'articles.json')) || '[]');
  for (const a of meta) {
    const text = `${a.title ?? ''} ${a.subtitle ?? ''} ${a.summary ?? ''}`;
    // 2文字以上の語で、5回以上出てくるもの
    const words = {};
    for (const m of text.matchAll(/[ァ-ヴー]{3,}|[一-龠]{2,}/g)) {
      words[m[0]] = (words[m[0]] ?? 0) + 1;
    }
    const stuffed = Object.entries(words).filter(([, n]) => n >= 5);
    if (stuffed.length) {
      warnings.push(
        `${a.slug}: 同じ語が繰り返されています（${stuffed.map(([w, n]) => `${w}×${n}`).join(' / ')}）\n` +
          `      **キーワードの詰め込みに見えます。** 読者の言葉で書いてください`
      );
    }
  }
}

// ---- ⑤ 検索に合わせて、結論を変えていないか ---------------------------------
//
// ★★ **これが、いちばん静かな死に方です。**
//
//   読者が求めているのは「◯◯は効きます」。うちが書けるのは「見つかりませんでした」。
//   **検索に合わせて結論を変えた瞬間、このブログを読む理由が消えます。**
//
//   ★ 機械的には検出できません。**だから、ここに書いて、毎週読ませます。**
//     検出できるのは1つだけ:「出典が見つからなかった」と正直に書いた記事が、
//     **サイトから消えていないか。**

{
  const dir = join(ROOT, 'articles');
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((x) => x.endsWith('.md'));
    const honest = files.filter((f) =>
      /見つかりませんでした|見つからなかった|確認できませんでした|0件でした/.test(read(join(dir, f)))
    );
    if (files.length && honest.length === 0) {
      failures.push(
        `**「見つかりませんでした」と書いた記事が、1本もありません**\n` +
          `      うちの記事は、そもそも「出典が見つからない」ことを書く媒体です。\n` +
          `      **それが1本も無いなら、検索に合わせて結論を変えています。**\n` +
          `      読者が求めているのは「効きます」。うちが書けるのは「見つかりませんでした」。`
      );
    } else if (files.length) {
      console.log(`  ○ 「見つかりませんでした」と書いた記事: ${honest.length} / ${files.length} 本`);
    }
  }
}

// ---- 結果 -------------------------------------------------------------------

const line = '='.repeat(62);

console.log('');
console.log('集客の輪');
console.log(line);

for (const w of warnings) console.log(`  ! ${w}\n`);

if (!failures.length) {
  console.log('  ○ 論文カードの無い記事はありません');
  console.log('  ○ 薄い記事はありません');
  console.log('  ○ 記事を量産していません');
  console.log('');
  console.log('  健全です。');
  console.log('');
  process.exit(0);
}

console.error('');
for (const f of failures) console.error(`  ✗ ${f}\n`);
console.error(line);
console.error(`  ${failures.length} 件、越えています。`);
console.error(line);
console.error('');
console.error('  **このサイトを殺すのは、書かないことではなく、薄いものを書くことです。**');
console.error('  Google のスパムポリシーは「AIで価値を加えないページの大量生成」を');
console.error('  明示的に禁じています（自動か人力かを問わない）。');
console.error('  **AdSense と検索流入を、同時に失います。**');
console.error('');
process.exit(1);
