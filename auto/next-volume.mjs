// ---------------------------------------------------------------
//  次の巻を出せるだけ、記事が溜まったか
//
//    node auto/next-volume.mjs
//
//  月・水・金の自動実行（auto/run.ps1）から呼ばれます。
//  手で確認したいときは、そのまま実行してください。
//
//  やること: どの巻にも入っていない「公開済みの記事」を数えるだけ。
//  本を作ること自体はしません（それは Claude と site/book.mjs の仕事）。
//
//  終了コード:
//    0  … まだ足りない（何もしない）
//    10 … 次の巻を出せる（run.ps1 がここで Claude を呼ぶ）
//    1  … 設定がおかしい
//
//  ★ KDP には個人向けの出版APIがありません。
//    原稿（EPUB）まではここから自動で作れますが、
//    **アップロードだけは、オーナーが手でやる必要があります。**
//    「自動で本が売られる」ことはありません。「自動で原稿ができる」だけです。
// ---------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = join(ROOT, 'site');

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

const ledger = read(join(SITE, 'books.json'));
const meta = read(join(SITE, 'articles.json'));

const volumes = ledger.volumes ?? [];
const need = ledger.next?.minArticles ?? 8;

// すでにどこかの巻に入っている記事
const taken = new Set(volumes.flatMap((v) => v.articles ?? []));

// まだどの巻にも入っていない、公開済みの記事（古い順 ＝ 本に並ぶ順）
const fresh = meta
  .filter((a) => a.published && !taken.has(a.slug))
  .sort((a, b) => String(a.date).localeCompare(String(b.date)));

// 原稿はできているが、まだ KDP に出していない巻があるか。
// あるなら、それを先に出してもらう。溜め込むと、どれを出したか分からなくなる。
const drafts = volumes.filter((v) => v.status === 'draft');

console.log(`巻: ${volumes.length}（原稿のまま未提出: ${drafts.length}）`);
console.log(`どの巻にも入っていない公開済み記事: ${fresh.length} / ${need}`);

if (drafts.length) {
  for (const d of drafts) {
    console.log(`  ! ${d.id}「${d.title}」の原稿ができています。KDP にアップロードしてください`);
    console.log(`    site/dist-book/${d.filename}.epub`);
  }
  console.log('  （出し終えたら site/books.json の status を uploaded にしてください）');
  console.log('未提出の巻があるので、次の巻は作りません');
  process.exit(0);
}

if (fresh.length < need) {
  console.log(`あと ${need - fresh.length} 本で、次の巻が出せます`);
  process.exit(0);
}

console.log('');
console.log('次の巻が出せます。収録する記事:');
fresh.forEach((a, i) => console.log(`  ${i + 1}. ${a.slug}  ${a.title}`));

process.exit(10);
