// ---------------------------------------------------------------
//  IndexNow —— 検索エンジンに「更新しました」と即時で伝える
//
//    node site/indexnow.mjs         sitemap.xml のURLを全部送る
//    node site/indexnow.mjs --dry   送らずに、何を送るかだけ表示する
//
//  GitHub Actions が、公開のあとに呼びます。
//
//  ---------------------------------------------------------------
//  ★ 正直に書いておくこと
//
//    **Google は IndexNow に対応していません。** 対応しているのは Bing・Yandex・Naver など。
//    日本の検索の大半は Google なので、**これで劇的に人が増えることはありません。**
//
//    それでも入れるのは、無料で、待ち時間がゼロで、失敗しても何も壊れないからです。
//    「やらない理由が無い」以上の期待は、しないこと。
//
//    Google に早く拾わせる方法は、いまのところ存在しません。
//    サイトマップを出し、内部リンクを張り、記事を出し続けて、待つだけです。
//  ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const DIST = join(SITE, 'dist');

const DRY = process.argv.includes('--dry');

const cfg = JSON.parse(readFileSync(join(SITE, 'config.json'), 'utf8'));
const key = cfg.indexNowKey;

if (!key) {
  console.log('site/config.json の indexNowKey が空です。何もしません。');
  process.exit(0);
}

const sitemapPath = join(DIST, 'sitemap.xml');
if (!existsSync(sitemapPath)) {
  console.error('site/dist/sitemap.xml がありません。先に build を走らせてください。');
  process.exit(1);
}

const urls = [...readFileSync(sitemapPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const host = new URL(cfg.baseUrl).host;

console.log(`IndexNow に ${urls.length} 件のURLを送ります（${host}）`);

if (DRY) {
  urls.slice(0, 5).forEach((u) => console.log(`  ${u}`));
  if (urls.length > 5) console.log(`  ...（ほか ${urls.length - 5} 件）`);
  console.log('\n--dry なので、送りませんでした');
  process.exit(0);
}

const res = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${cfg.baseUrl}/${key}.txt`,
    urlList: urls,
  }),
});

// 200/202 が成功。それ以外でも、サイトの公開は止めない（IndexNow は「あれば得」なだけ）
if (res.ok) {
  console.log(`  受け付けられました（HTTP ${res.status}）`);
} else {
  console.log(`  受け付けられませんでした（HTTP ${res.status}）: ${(await res.text()).slice(0, 200)}`);
  console.log('  ※ サイトの公開には影響しません。IndexNow は「あれば得」なだけです。');
}
