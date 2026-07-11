// ---------------------------------------------------------------
//  静的サイトジェネレータ（外部ライブラリ ゼロ）
//
//  読む : site/config.json, site/articles.json, articles/<slug>.md
//  作る : site/dist/  （そのままアップロードできる完成品のサイト）
//
//  使い方: node site/build.mjs
//
//  このスクリプトは Windows でも、GitHub Actions の Linux サーバー上でも
//  まったく同じように動きます。だから「push すれば自動で公開」ができます。
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURES } from './figures.mjs';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);
const DIST = join(SITE, 'dist');

const read = (p) => readFileSync(p, 'utf8');

function write(p, content) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
}

const escapeHtml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (s = '') => escapeHtml(s).replace(/"/g, '&quot;');

// ---- インライン記法: `code` [text](url) **bold** *em* -----------

function inline(text) {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(?<![*\w])\*([^*\s][^*]*)\*(?!\*)/g, '<em>$1</em>');
  return t;
}

// ---- ブロック記法 ----------------------------------------------

function markdownToHtml(md) {
  md = md.replace(/<!--[\s\S]*?-->/g, ''); // 冒頭のタイトル案コメントを落とす

  const out = [];
  let para = [];
  let list = [];
  let quote = [];
  let table = [];
  let listType = 'ul';

  const flushPara = () => {
    if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = []; }
  };
  const flushList = () => {
    if (list.length) {
      out.push(`<${listType}>`);
      list.forEach((i) => out.push(`  <li>${i}</li>`));
      out.push(`</${listType}>`);
      list = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push('<blockquote>');
      quote.forEach((q) => out.push(`  <p>${q}</p>`));
      out.push('</blockquote>');
      quote = [];
    }
  };
  const flushTable = () => {
    if (table.length) {
      out.push('<div class="table-scroll"><table>');
      out.push('<thead><tr>');
      table[0].forEach((c) => out.push(`  <th>${c}</th>`));
      out.push('</tr></thead>');
      if (table.length > 1) {
        out.push('<tbody>');
        for (let r = 1; r < table.length; r++) {
          out.push('<tr>');
          table[r].forEach((c) => out.push(`  <td>${c}</td>`));
          out.push('</tr>');
        }
        out.push('</tbody>');
      }
      out.push('</table></div>');
      table = [];
    }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');

    if (/^\s*$/.test(line)) { flushAll(); continue; }

    // 図版:  ::figure:retinol-dropout::
    const fig = line.match(/^::figure:([a-z0-9-]+)::$/);
    if (fig) {
      flushAll();
      const svg = FIGURES[fig[1]];
      if (svg) {
        out.push(svg);
      } else {
        console.error(`  !! 図版が見つかりません: ${fig[1]}（site/figures.mjs に定義してください）`);
        process.exitCode = 1;
      }
      continue;
    }

    // 表
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      const cells = line.trim().replace(/^\||\|$/g, '').split('|');
      const isSeparator = cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
      if (!isSeparator) table.push(cells.map((c) => inline(c.trim())));
      continue;
    }
    flushTable();

    // 区切り線
    if (/^\s*---+\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }

    // 見出し
    let m;
    if ((m = line.match(/^###\s+(.*)$/))) { flushAll(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = line.match(/^##\s+(.*)$/)))  { flushAll(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = line.match(/^#\s+(.*)$/)))   { flushAll(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }

    // 引用
    if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara(); flushList();
      quote.push(inline(m[1]));
      continue;
    }
    flushQuote();

    // 番号付きリスト
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      list.push(inline(m[1]));
      continue;
    }

    // 箇条書き
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushPara();
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      list.push(inline(m[1]));
      continue;
    }

    flushList();
    para.push(inline(line));
  }

  flushAll();
  return out.join('\n');
}

// ---- 設定・テンプレートを読む -----------------------------------

const cfg = JSON.parse(read(join(SITE, 'config.json')));
const meta = JSON.parse(read(join(SITE, 'articles.json')));

const tpl = {
  layout:  read(join(SITE, 'templates', 'layout.html')),
  home:    read(join(SITE, 'templates', 'home.html')),
  card:    read(join(SITE, 'templates', 'card.html')),
  article: read(join(SITE, 'templates', 'article.html')),
  about:   read(join(SITE, 'templates', 'about.html')),
};

const baseUrl = cfg.baseUrl.replace(/\/+$/, '');

const fill = (tplText, vars) =>
  Object.entries(vars).reduce(
    (acc, [k, v]) => acc.split(`{{${k}}}`).join(v ?? ''),
    tplText
  );

const renderPage = ({ content, headTitle, metaDesc, canonical, ogType, rootPath }) =>
  fill(tpl.layout, {
    CONTENT: content,
    HEAD_TITLE: escapeAttr(headTitle),
    META_DESC: escapeAttr(metaDesc),
    CANONICAL: escapeAttr(canonical),
    OG_TYPE: ogType,
    SITE_TITLE: escapeHtml(cfg.title),
    TAGLINE: escapeHtml(cfg.tagline),
    FOOTER_NOTE: escapeHtml(cfg.footerNote),
    YEAR: String(new Date().getFullYear()),
    ROOT: rootPath,
  });

// ---- 出力先を作り直す -------------------------------------------

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ---- 記事ページ --------------------------------------------------

const published = [];
const heldBack = [];

for (const a of meta) {
  const mdPath = join(ROOT, 'articles', `${a.slug}.md`);

  if (!existsSync(mdPath)) {
    console.error(`  !! 記事が見つかりません: articles/${a.slug}.md （articles.json に書かれているのに）`);
    process.exitCode = 1;
    continue;
  }
  if (!a.published) { heldBack.push(a.slug); continue; }

  const page = fill(tpl.article, {
    BODY: markdownToHtml(read(mdPath)),
    TITLE: escapeHtml(a.title),
    SUBTITLE: escapeHtml(a.subtitle),
    CATEGORY: escapeHtml(a.category),
    DATE: a.date,
    DATE_LABEL: a.date.replace(/-/g, '.'),
    ROOT: '../',
  });

  write(
    join(DIST, 'articles', `${a.slug}.html`),
    renderPage({
      content: page,
      headTitle: `${a.title} | ${cfg.title}`,
      metaDesc: a.summary,
      canonical: `${baseUrl}/articles/${a.slug}.html`,
      ogType: 'article',
      rootPath: '../',
    })
  );

  published.push(a);
  console.log(`  built  articles/${a.slug}.html`);
}

if (published.length === 0) {
  console.error('公開できる記事が1本もありません。site/articles.json の published を確認してください。');
  process.exit(1);
}

// ---- トップページ ------------------------------------------------

const cards = published
  .map((a) =>
    fill(tpl.card, {
      SLUG: a.slug,
      TITLE: escapeHtml(a.title),
      SUBTITLE: escapeHtml(a.subtitle),
      SUMMARY: escapeHtml(a.summary),
      CATEGORY: escapeHtml(a.category),
      DATE: a.date,
      DATE_LABEL: a.date.replace(/-/g, '.'),
      ROOT: '',
    })
  )
  .join('');

write(
  join(DIST, 'index.html'),
  renderPage({
    content: tpl.home.replace('{{ARTICLE_LIST}}', cards),
    headTitle: cfg.title,
    metaDesc: cfg.description,
    canonical: `${baseUrl}/`,
    ogType: 'website',
    rootPath: '',
  })
);
console.log('  built  index.html');

// ---- このブログについて -------------------------------------------

write(
  join(DIST, 'about.html'),
  renderPage({
    content: tpl.about,
    headTitle: `このブログについて | ${cfg.title}`,
    metaDesc: cfg.description,
    canonical: `${baseUrl}/about.html`,
    ogType: 'website',
    rootPath: '',
  })
);
console.log('  built  about.html');

// ---- RSS ---------------------------------------------------------

const escapeXml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const rfc822 = (d) => new Date(`${d}T00:00:00Z`).toUTCString();
const newest = [...published].sort((a, b) => (a.date < b.date ? 1 : -1))[0].date;

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${escapeXml(cfg.title)}</title>
<link>${baseUrl}/</link>
<description>${escapeXml(cfg.description)}</description>
<language>ja</language>
<lastBuildDate>${rfc822(newest)}</lastBuildDate>
${published
  .map(
    (a) => `<item>
  <title>${escapeXml(a.title)}</title>
  <link>${baseUrl}/articles/${a.slug}.html</link>
  <guid>${baseUrl}/articles/${a.slug}.html</guid>
  <pubDate>${rfc822(a.date)}</pubDate>
  <description>${escapeXml(a.summary)}</description>
</item>`
  )
  .join('\n')}
</channel></rss>
`;
write(join(DIST, 'feed.xml'), rss);
console.log('  built  feed.xml');

// ---- サイトマップ / robots ----------------------------------------

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${baseUrl}/</loc></url>
<url><loc>${baseUrl}/about.html</loc></url>
${published
  .map((a) => `<url><loc>${baseUrl}/articles/${a.slug}.html</loc><lastmod>${a.date}</lastmod></url>`)
  .join('\n')}
</urlset>
`;
write(join(DIST, 'sitemap.xml'), sitemap);
write(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`);
console.log('  built  sitemap.xml, robots.txt');

// ---- CSS など ------------------------------------------------------

cpSync(join(SITE, 'assets'), join(DIST, 'assets'), { recursive: true });
console.log('  built  assets/');

// ---- 結果 ----------------------------------------------------------

console.log('');
console.log(`DONE. ${published.length} 本を公開 -> site/dist`);
if (heldBack.length) {
  console.log(`寝かせ中（articles.json の published:false）: ${heldBack.join(', ')}`);
}
