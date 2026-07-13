// ---------------------------------------------------------------
//  はてなブログに、紹介記事を投稿する（AtomPub）
//
//    node auto/post-hatena.mjs --dry           何を出すかを見るだけ
//    node auto/post-hatena.mjs                 まだ出していないものを1本、**下書き**で出す
//    node auto/post-hatena.mjs --publish       下書きではなく、公開で出す
//    node auto/post-hatena.mjs <slug>          記事を指定する
//
//  鍵: auto/.env（.gitignore 済み）
//    HATENA_ID=biyouron
//    HATENA_BLOG_ID=biyouronbun.hatenablog.com
//    HATENA_API_KEY=（はてなブログ → 設定 → 詳細設定 → AtomPub の「APIキー」）
//
//  ---------------------------------------------------------------
//  ★ 全文を載せません
//
//    同じ本文が2か所にあると、Google はどちらか一方しか検索結果に出しません。
//    **うちのドメインは生まれたばかりで、はてなは巨大です。負けます。**
//    全文を出せば、自分のサイトを、自分で潰すことになります。
//
//    出すのは site/syndicate.mjs が作る紹介記事——
//    「そこにしかない事実」（論文の数字・実際に投げた検索式）と、本文へのリンクだけです。
//
//  ★ 既定は「下書き」です
//
//    いきなり本公開すると、間違いを取り返せません。
//    人間が1本目を読んでから、--publish に切り替えてください。
//
//  ★ 一度に1本だけ出します
//
//    10本を一気に投げると、それ自体が「量産」に見えます。
//    Google の scaled content abuse ポリシーは、うちが最も避けるべきものです。
//  ---------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SYND = join(ROOT, 'output', 'syndicate');
const LEDGER = join(ROOT, 'output', 'syndicate-posted.json');

const DRY = process.argv.includes('--dry');
const PUBLISH = process.argv.includes('--publish');
const slugArg = process.argv.slice(2).find((a) => !a.startsWith('--'));

// ---- 鍵 -------------------------------------------------------------

function loadEnv() {
  const p = join(ROOT, 'auto', '.env');
  if (!existsSync(p)) return {};
  const env = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const { HATENA_ID, HATENA_BLOG_ID, HATENA_API_KEY } = env;

if (!HATENA_ID || !HATENA_BLOG_ID || !HATENA_API_KEY) {
  console.error('');
  console.error('auto/.env に、はてなの鍵がありません。');
  console.error('');
  console.error('  HATENA_ID=biyouron');
  console.error('  HATENA_BLOG_ID=biyouronbun.hatenablog.com');
  console.error('  HATENA_API_KEY=（はてなブログ → 設定 → 詳細設定 → AtomPub の「APIキー」）');
  console.error('');
  process.exit(1);
}

// ---- どれを出すか ---------------------------------------------------

const posted = existsSync(LEDGER)
  ? JSON.parse(readFileSync(LEDGER, 'utf8'))
  : {
      _readme: [
        'はてなブログに投稿済みの記事。auto/post-hatena.mjs が書きます。',
        '同じ記事を二度投稿しないための台帳です。手で消さないこと。',
      ],
      items: [],
    };

const done = new Set(posted.items.map((i) => i.slug));

const all = readdirSync(SYND)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace('.md', ''));

const pending = all.filter((s) => !done.has(s));

if (!all.length) {
  console.error('output/syndicate/ が空です。先に node site/syndicate.mjs を走らせてください。');
  process.exit(1);
}

const slug = slugArg ?? pending[0];

if (!slug) {
  console.log('すべて投稿済みです。');
  console.log(`（投稿済み: ${done.size} 本 / 紹介記事: ${all.length} 本）`);
  process.exit(0);
}

if (done.has(slug) && !slugArg) {
  console.log(`${slug} は投稿済みです。`);
  process.exit(0);
}

const md = readFileSync(join(SYND, `${slug}.md`), 'utf8');

// 1行目の「# タイトル」を取り出し、本文からは外す
const title = md.match(/^#\s+(.+)$/m)?.[1] ?? slug;
const body = md.replace(/^#\s+.+$/m, '').trim();

console.log('');
console.log('==============================================');
console.log(`  ${title}`);
console.log('==============================================');
console.log(`  スラッグ : ${slug}`);
console.log(`  文字数   : ${body.length}`);
console.log(`  状態     : ${PUBLISH ? '★ 公開' : '下書き（--publish で公開になります）'}`);
console.log(`  残り     : ${pending.length - 1} 本`);
console.log('');

if (DRY) {
  console.log(body.slice(0, 400) + '\n...');
  console.log('');
  console.log('--dry なので、投稿しませんでした');
  process.exit(0);
}

// ---- 投稿する -------------------------------------------------------

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const xml = `<?xml version="1.0" encoding="utf-8"?>
<entry xmlns="http://www.w3.org/2005/Atom" xmlns:app="http://www.w3.org/2007/app">
  <title>${esc(title)}</title>
  <author><name>${esc(HATENA_ID)}</name></author>
  <content type="text/x-markdown">${esc(body)}</content>
  <category term="美容" />
  <category term="論文" />
  <app:control>
    <app:draft>${PUBLISH ? 'no' : 'yes'}</app:draft>
  </app:control>
</entry>`;

const url = `https://blog.hatena.ne.jp/${HATENA_ID}/${HATENA_BLOG_ID}/atom/entry`;
const auth = Buffer.from(`${HATENA_ID}:${HATENA_API_KEY}`).toString('base64');

const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/xml; charset=utf-8',
  },
  body: xml,
});

const text = await res.text();

if (!res.ok) {
  console.error(`✗ 投稿できませんでした（HTTP ${res.status}）`);
  console.error(text.slice(0, 500));
  console.error('');
  if (res.status === 401) {
    console.error('  → APIキーが違うか、HATENA_ID / HATENA_BLOG_ID が違います。');
    console.error('     はてなブログ → 設定 → 詳細設定 → AtomPub で確認してください。');
  }
  process.exit(1);
}

const link = text.match(/<link rel="alternate" type="text\/html" href="([^"]+)"/)?.[1] ?? '（URLを取得できませんでした）';

posted.items.push({
  slug,
  title,
  postedAt: new Date().toISOString().slice(0, 10),
  draft: !PUBLISH,
  url: link,
});
writeFileSync(LEDGER, JSON.stringify(posted, null, 2) + '\n', 'utf8');

console.log(`○ ${PUBLISH ? '公開' : '下書きとして保存'}しました`);
console.log(`  ${link}`);
console.log('');

if (!PUBLISH) {
  // ★ 「下書きにした」とだけ言うと、探せません。
  //   はてなの仕様で、**下書きはブログ本体にも、記事一覧のAPIにも出てきません。**
  //   管理画面の「記事の管理」を開かないと、見つかりません。
  //   （実際に「入ってないよ」と言われました。案内不足でした）
  console.log('  ★ まだ下書きです。**ブログを見ても出てきません。** ここで読んでください:');
  console.log('');
  console.log(`     https://blog.hatena.ne.jp/${HATENA_ID}/${HATENA_BLOG_ID}/entries`);
  console.log('');
  console.log('     （管理画面 → 記事の管理 → 「下書き」）');
  console.log('');
  console.log('    読んで問題なければ、その画面から公開してください。');
  console.log('    1本目を確認したら、以降は --publish で自動公開に切り替えられます。');
}
