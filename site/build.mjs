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
const products = JSON.parse(read(join(SITE, 'products.json')));

// ---- 関連商品（アフィリエイト） --------------------------------------
//
// url が空の商品は出さない（押しても何も起きないリンクは信用を落とす）。
// 商品を1つでも出す記事には、PR表記が自動で付く。
// これは景品表示法（ステマ規制）の義務なので、外せない仕組みにしてある。

const itemsFor = (slug) =>
  (products[slug]?.items ?? []).filter((i) => i.url && i.name);

const prBanner = (slug) =>
  itemsFor(slug).length
    ? `<p class="pr-banner">この記事は広告（アフィリエイトリンク）を含みます。</p>`
    : '';

const productBlock = (slug) => {
  const items = itemsFor(slug);
  if (!items.length) return '';

  const rows = items
    .map(
      (i) => `    <li class="prod">
      <a class="prod-name" href="${escapeAttr(i.url)}" target="_blank" rel="sponsored nofollow noopener">${escapeHtml(i.name)}</a>
      <span class="prod-criterion">${escapeHtml(i.criterion)}</span>
    </li>`
    )
    .join('\n');

  return `<aside class="products">
  <p class="products-title">この記事の基準に合うもの</p>
  <p class="products-lead">下は<strong>広告リンク</strong>です。ここから購入されると、このブログに収益が入ります。<strong>効果を保証するものではありません。</strong>記事で示した「選び方の基準」に合うかどうかだけを書いています。</p>
  <ul class="products-list">
${rows}
  </ul>
</aside>`;
};

const tpl = {
  layout:  read(join(SITE, 'templates', 'layout.html')),
  home:    read(join(SITE, 'templates', 'home.html')),
  card:    read(join(SITE, 'templates', 'card.html')),
  article: read(join(SITE, 'templates', 'article.html')),
  about:   read(join(SITE, 'templates', 'about.html')),
  privacy: read(join(SITE, 'templates', 'privacy.html')),
  membership: read(join(SITE, 'templates', 'membership.html')),
  tokushoho: read(join(SITE, 'templates', 'tokushoho.html')),
  cta:     read(join(SITE, 'templates', 'cta.html')),
};

// ---- メンバーシップ（支援型） ----------------------------------------
//
// Stripe の支払いリンクが1つも入っていなければ、ページも導線も出さない。
// 「メンバーになる」を押しても何も起きない状態が、いちばん信用を落とす。

const mem = cfg.membership ?? {};
const memPlans = (mem.plans ?? []).filter((p) => p.url);
const memOn = memPlans.length > 0 && Boolean(mem.legalName) && Boolean(mem.contactEmail);

if ((mem.plans ?? []).some((p) => p.url) && !memOn) {
  console.error(
    '  !! メンバーシップは出しません: legalName（本名）と contactEmail が必要です（特定商取引法）'
  );
  process.exitCode = 1;
}

const membershipPlansHtml = () => {
  if (!memPlans.length) return '';
  const cards = memPlans
    .map(
      (p) => `    <li class="plan">
      <span class="plan-name">${escapeHtml(p.name)}</span>
      <span class="plan-price">月額 ${Number(p.price).toLocaleString('ja-JP')}円</span>
      <span class="plan-note">${escapeHtml(p.note ?? '')}</span>
      <a class="plan-button" href="${escapeAttr(p.url)}" target="_blank" rel="noopener">メンバーになる</a>
    </li>`
    )
    .join('\n');
  return `<h2>プラン</h2>

<ul class="plans">
${cards}
</ul>

<p class="plans-note">お支払いは Stripe（決済代行）を通して行われます。カード情報がこのブログに渡ることはありません。いつでも解約できます。</p>`;
};

// ---- 広告 ---------------------------------------------------------
//
// adsenseClientId が空のあいだは、広告タグも Cookie の開示文も一切出ない。
// 「審査に通す → 管理画面でブロック設定を全部済ませる → ここにIDを入れる」
// この順番を守ること。逆にすると、検証した業界の広告が検証記事の横に出る。

const ads = cfg.ads ?? {};

// ①審査用のコード。<head> に入る。これだけでは広告は出ない。
const adsCodeOn = Boolean(ads.adsenseClientId);

// ②実際の広告枠。ブロック設定を済ませてから true にする。
const adUnitsOn = adsCodeOn && ads.showAdUnits === true;

const adsenseHead = adsCodeOn
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads.adsenseClientId}" crossorigin="anonymous"></script>`
  : '';

// 記事末尾にだけ置く。本文に差し込む「自動広告」は使わない。
const adSlot = () =>
  adUnitsOn
    ? `<aside class="adbox">
  <p class="adbox-label">広告</p>
  <ins class="adsbygoogle" style="display:block" data-ad-client="${ads.adsenseClientId}" data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</aside>`
    : '';

// プライバシーポリシーの開示文。
// 広告枠がまだ無くても、審査用コードを置いた時点で Cookie は使われる。
// だから adUnitsOn ではなく adsCodeOn で判定する（開示は早いほうに倒す）。
const adsDisclosure = adsCodeOn
  ? `<h2>広告について</h2>

<p>このサイトは、第三者配信の広告サービス <strong>Google AdSense</strong> を利用しています。</p>

<p>Google などの第三者配信事業者は、<strong>Cookie を使用して</strong>、ユーザーがこのサイトや他のサイトに過去にアクセスした際の情報に基づいて広告を配信します。</p>

<p>Google が広告 Cookie を使用することにより、ユーザーは <a href="https://adssettings.google.com/" target="_blank" rel="noopener">広告設定</a> でパーソナライズ広告を無効にできます。また <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener">www.aboutads.info</a> から、第三者配信事業者の Cookie を無効にすることもできます。</p>

<p><strong>なお、このサイトでは化粧品・サプリメント・美容医療・ダイエットの広告カテゴリをブロックしています。</strong> 検証している業界の広告を、その検証記事の横に出さないためです。</p>`
  : `<p>広告配信事業者による Cookie（Google AdSense 等）は、現在このサイトでは使用していません。</p>`;

const baseUrl = cfg.baseUrl.replace(/\/+$/, '');

// 質問箱。フォームのURLが設定されていなければ、枠ごと出さない。
// 押しても何も起きないボタンを置くのが、いちばん信用を落とす。
const ctaFor = (rootPath) => {
  if (!cfg.askUrl) return '';
  return tpl.cta.split('{{ASK_URL}}').join(cfg.askUrl).split('{{ROOT}}').join(rootPath);
};

if (!cfg.askUrl) {
  console.log('  -- 質問箱は非表示（site/config.json の askUrl が空です）');
}

// Cloudflare Web Analytics。Cookie を使わないので同意バナーが要らない。
const analytics = cfg.analyticsToken
  ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${cfg.analyticsToken}"}'></script>`
  : '';

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
    ANALYTICS: analytics,
    ADSENSE: adsenseHead,
    NAV_MEMBERSHIP: memOn
      ? `      <a href="${rootPath}membership.html">メンバーシップ</a>`
      : '',
    FOOTER_MEMBERSHIP: memOn
      ? `      <a href="${rootPath}membership.html">メンバーシップ</a>\n      <a href="${rootPath}tokushoho.html">特定商取引法に基づく表記</a>`
      : '',
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
    PR_BANNER: prBanner(a.slug),
    PRODUCTS: productBlock(a.slug),
    CTA: ctaFor('../'),
    ADSLOT: adSlot(),
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
    content: tpl.home.replace('{{ARTICLE_LIST}}', cards).replace('{{CTA}}', ctaFor('')),
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

// ---- プライバシーポリシー（フォームを出す前に必須） -----------------

write(
  join(DIST, 'privacy.html'),
  renderPage({
    content: tpl.privacy.replace('{{ADS_DISCLOSURE}}', adsDisclosure),
    headTitle: `プライバシーポリシー | ${cfg.title}`,
    metaDesc: 'このサイトが受け取る情報と、その使い道。',
    canonical: `${baseUrl}/privacy.html`,
    ogType: 'website',
    rootPath: '',
  })
);
console.log('  built  privacy.html');

// ---- CNAME（独自ドメインを GitHub Pages に伝えるファイル） ------------
//
// これが dist に無いと、公開のたびに独自ドメインの設定が外れることがある。

if (cfg.customDomain) {
  write(join(DIST, 'CNAME'), `${cfg.customDomain}\n`);
  console.log(`  built  CNAME (${cfg.customDomain})`);
}

// ---- メンバーシップ / 特定商取引法 -----------------------------------

if (memOn) {
  write(
    join(DIST, 'membership.html'),
    renderPage({
      content: tpl.membership.replace('{{MEMBERSHIP_PLANS}}', membershipPlansHtml()),
      headTitle: `この検証を、続けさせてください | ${cfg.title}`,
      metaDesc:
        '記事はこれからも全部無料です。メンバーシップは「この検証を続けてほしい」という支援としていただきます。',
      canonical: `${baseUrl}/membership.html`,
      ogType: 'website',
      rootPath: '',
    })
  );
  console.log('  built  membership.html');

  const priceList = memPlans
    .map((p) => `${escapeHtml(p.name)}: 月額 ${Number(p.price).toLocaleString('ja-JP')}円`)
    .join('<br>');

  write(
    join(DIST, 'tokushoho.html'),
    renderPage({
      content: fill(tpl.tokushoho, {
        LEGAL_NAME: escapeHtml(mem.legalName),
        CONTACT_EMAIL: escapeHtml(mem.contactEmail),
        PRICE_LIST: priceList,
      }),
      headTitle: `特定商取引法に基づく表記 | ${cfg.title}`,
      metaDesc: '特定商取引法に基づく表記',
      canonical: `${baseUrl}/tokushoho.html`,
      ogType: 'website',
      rootPath: '',
    })
  );
  console.log('  built  tokushoho.html');
} else {
  console.log('  -- メンバーシップは非表示（site/config.json の membership が未設定です）');
}

// ---- ads.txt（AdSense が要求する所有証明） --------------------------

if (adsCodeOn) {
  const pub = ads.adsenseClientId.replace(/^ca-/, '');
  write(join(DIST, 'ads.txt'), `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  console.log('  built  ads.txt');
}

// ---- サイトマップ / robots ----------------------------------------

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${baseUrl}/</loc></url>
<url><loc>${baseUrl}/about.html</loc></url>
<url><loc>${baseUrl}/privacy.html</loc></url>
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
