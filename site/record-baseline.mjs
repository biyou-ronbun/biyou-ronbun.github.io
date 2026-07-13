// ---------------------------------------------------------------
//  記事の「武器の数」を、基準線として記録する。
//
//      node site/record-baseline.mjs          … いまの記事から記録
//      node site/record-baseline.mjs --head   … git HEAD の記事から記録（書き換え前）
//
//  ★ 数え方は site/article-metrics.mjs の1箇所だけ。ここには書かない。
//    **2箇所に書いたら、必ずずれる。** 実際にずれて、関門が甘くなった。
//
//  ★ 記事を新しく書いたら、これを走らせて台帳に足すこと。
//  ★ **本当に不要だとオーナーが判断したときだけ、基準線を下げること。**
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { countWeapons } from './article-metrics.mjs';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SITE, '..');
const fromHead = process.argv.includes('--head');

const slugs = readdirSync(join(ROOT, 'articles'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace('.md', ''));

const articles = {};

console.log(fromHead ? '基準線を記録します（git HEAD = 書き換え前）' : '基準線を記録します（いまの記事）');
console.log('');
console.log('記事                     字数   論文  資金  見つからず  図');
console.log('─'.repeat(62));

for (const slug of slugs) {
  let md;
  if (fromHead) {
    try {
      md = execSync(`git show HEAD:articles/${slug}.md`, {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch {
      md = readFileSync(join(ROOT, 'articles', `${slug}.md`), 'utf8');
    }
  } else {
    md = readFileSync(join(ROOT, 'articles', `${slug}.md`), 'utf8');
  }

  const v = countWeapons(md);
  articles[slug] = v;
  console.log(
    '  ' +
      slug.padEnd(22) +
      String(v.chars).padStart(6) +
      String(v.pmids).padStart(5) +
      String(v.funding).padStart(6) +
      String(v.notfound).padStart(9) +
      String(v.figures).padStart(5)
  );
}

writeFileSync(
  join(SITE, 'article-baseline.json'),
  JSON.stringify(
    {
      _readme: [
        '★ 記事を短くするときの、下限の基準線。site/verify.mjs が使う。',
        '',
        '「長文は読まれない」は正しい。だから記事を短くする。',
        '**しかし、文字数のために事実を落とすことは、できない。**',
        '',
        '★ 数え方は site/article-metrics.mjs の1箇所だけ。',
        '  **2箇所に書いたら、必ずずれる。** 実際にずれて、関門が甘くなった。',
        '',
        '★★ 数えているのは「記事 + その記事が埋め込んでいる図」の合計。',
        '  文章を図に畳むと、資金源も「見つかりませんでした」も図の中に移る。',
        '  **読者には見えているのに、.md しか見ない関門は「消えた」と判定する。**',
        '',
        '  chars    … 文字数（★ 減ってよい）',
        '  pmids    … 引用した論文の数',
        '  funding  … 資金源・利益相反・所属・社員への言及',
        '  notfound … 「見つからなかった」系  ← ★ うちが他と違う唯一の部分',
        '  figures  … 図の数',
        '',
        '**chars 以外の4つを下回ると、verify.mjs が公開を止める。**',
        '',
        '★ 何が最初に消えるかは、分かっている:',
        '  ・資金源の記述 …「著者7人のうち6人がキユーピー社員」は長い。削りたくなる',
        '  ・「見つかりませんでした」… 何も言っていないように見える。**うちの唯一の武器なのに**',
        '  ・引用した論文 … 減らせば、記事は短くなる',
        '',
        '★ 記事を新しく書いたら: node site/record-baseline.mjs',
        '★ **本当に不要だとオーナーが判断したときだけ、基準線を下げること。**',
      ],
      recordedAt: new Date().toISOString().slice(0, 10),
      articles,
    },
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('');
console.log('site/article-baseline.json に記録しました');
