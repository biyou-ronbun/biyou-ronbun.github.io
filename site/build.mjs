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
  contact: read(join(SITE, 'templates', 'contact.html')),
  membership: read(join(SITE, 'templates', 'membership.html')),
  tokushoho: read(join(SITE, 'templates', 'tokushoho.html')),
  cta:     read(join(SITE, 'templates', 'cta.html')),
};

// カテゴリ名 → URL に使える名前。
// 記事ループでもカテゴリページでも使うので、先に定義しておく。
const catSlug = (name) =>
  ({ '塗る': 'nuru', '飲む': 'nomu', '習慣': 'shukan', '塗る / 飲む': 'nuru-nomu' }[name] ??
    encodeURIComponent(name));

// ---- 目次 -------------------------------------------------------------
//
// 記事は3,000〜6,000字ある。目次が無いと、読者はどこに何があるか分からない。
// 見出し（h2）から自動で作る。記事が自動生成されても、目次は自動で付く。

const slugifyHeading = (text, i) =>
  'h-' +
  (text
    .replace(/<[^>]+>/g, '')
    .replace(/[^0-9A-Za-z぀-ヿ一-龯]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || String(i));

// 本文の h2 に id を振り、目次を組み立てる
const withToc = (bodyHtml) => {
  const items = [];
  let i = 0;

  const body = bodyHtml.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, inner) => {
    i++;
    const id = slugifyHeading(inner, i);
    const label = inner.replace(/<[^>]+>/g, '');
    items.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });

  // 見出しが少ない記事に目次は要らない
  if (items.length < 4) return { body, toc: '' };

  const toc = `<nav class="toc" aria-label="目次">
  <p class="toc-title">この記事の中身</p>
  <ol class="toc-list">
${items.map((it) => `    <li><a href="#${it.id}">${escapeHtml(it.label)}</a></li>`).join('\n')}
  </ol>
</nav>`;

  return { body, toc };
};

// ---- 論文台帳 ---------------------------------------------------------
//
// このブログの資産は記事ではなく、「論文の身元調査の記録」です。
// しかし今まで、その記録は research/ に置いたきりで、読者には結論しか渡していませんでした。
//
// 誰が金を出していたか。どこまでしか確認できなかったか。
// それを渡すのが、この台帳です。
//
// ★ 効く・効かないは1文字も書きません。事実だけを並べます。

// 論文台帳（site/papers.json）は、サイトには出しません（オーナーの判断）。
// ただしデータは残しています。site/verify.mjs が、記事の引用論文が
// 台帳に載っているかを検査するのに使っています（記録の抜けを防ぐため）。

const FUNDING_LABEL = {
  industry: '企業',
  public: '公的資金',
  independent: '独立',
  none: '資金提供なし',
  unverified: '確認できず',
};

const CONFIRMED_LABEL = {
  fulltext: '全文を確認',
  abstract: '要旨のみ',
  bibliographic: '書誌のみ',
};


// ---- 関連記事 ---------------------------------------------------------
//
// 記事は自動で増えるので、関連記事も自動で選ぶ。
// 同じカテゴリ（塗る / 飲む / 習慣）を優先し、足りなければ新しい順で埋める。
// 「読者が次に読むもの」を用意しないと、1記事読んで帰ってしまう。

const relatedFor = (slug, all) => {
  const me = all.find((a) => a.slug === slug);
  if (!me) return [];

  const others = all.filter((a) => a.slug !== slug);
  const sameCat = others.filter((a) => a.category === me.category);
  const rest = others.filter((a) => a.category !== me.category);

  // 同じカテゴリを先に、そのあと新しい順
  const byDate = (a, b) => (a.date < b.date ? 1 : -1);
  return [...sameCat.sort(byDate), ...rest.sort(byDate)].slice(0, 3);
};

const relatedBlock = (slug, all) => {
  const items = relatedFor(slug, all);
  if (!items.length) return '';

  const rows = items
    .map(
      (a) => `    <li class="rel">
      <a class="rel-link" href="../articles/${a.slug}.html">
        <span class="rel-cat">${escapeHtml(a.category)}</span>
        <span class="rel-title">${escapeHtml(a.title)}</span>
        <span class="rel-sub">${escapeHtml(a.subtitle ?? '')}</span>
      </a>
    </li>`
    )
    .join('\n');

  return `<aside class="related">
  <p class="related-title">この記事のあとに読むなら</p>
  <ul class="related-list">
${rows}
  </ul>
</aside>`;
};

// ---- 本（Kindle） -----------------------------------------------------
//
// 巻は site/books.json（台帳）に並んでいる。EPUB を作る site/book.mjs と同じファイルを読む。
// Amazon のURLが入っている巻だけを出す。空の巻は、まだ発売されていないので出さない。
// 「記事は無料で読める」ことを紹介文に必ず書く。隠して売らない。

const ledger = JSON.parse(read(join(SITE, 'books.json')));
const onSale = (ledger.volumes ?? []).filter((v) => v.amazonUrl);
const bookDefaults = ledger.defaults ?? {};

const bookBlock = () =>
  onSale.length === 0
    ? ''
    : `<aside class="bookbox">
  <p class="bookbox-label">本になりました</p>
${onSale
  .map((v) => {
    const price = v.price ?? bookDefaults.price ?? '';
    return `  <p class="bookbox-title">${escapeHtml(v.title)}</p>
  <p class="bookbox-sub">${escapeHtml(v.subtitle ?? '')}</p>
  <p class="bookbox-action"><a class="bookbox-button" href="${escapeAttr(v.amazonUrl)}" target="_blank" rel="noopener">Kindle で読む（${escapeHtml(price)}）</a></p>`;
  })
  .join('\n')}
  <p class="bookbox-note"><strong>本に収めた記事は、すべてこのサイトで無料で読めます。</strong>それでも本にしたのは、まとめて読みたい方のためと、この検証を続けるための費用にするためです。無料で読める場所があることを、隠さずに書いておきます。</p>
</aside>`;

if (onSale.length === 0) {
  console.log('  -- 本の紹介は非表示（site/books.json に amazonUrl の入った巻がありません）');
} else {
  console.log(`  -- 本の紹介: ${onSale.length} 冊`);
}

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

// X やはてブに貼ったときのリンクカードの画像。
// これが無いと、テキストだけの弱いカードになる。
// 画像は site/ogp.ps1 が作り、リポジトリに入っている（Linux 上のビルドでも使える）。
const ogImage = (slug) => {
  const file = slug
    ? existsSync(join(SITE, 'assets', 'ogp', `${slug}.jpg`))
      ? `${baseUrl}/assets/ogp/${slug}.jpg`
      : ''
    : '';
  if (!file) return '';
  return `<meta property="og:image" content="${escapeAttr(file)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">`;
};

// 構造化データ。Google に「誰がいつ書いた記事で、何を根拠にしているか」を機械可読で渡す。
// このブログの武器は出典なので、それを検索エンジンにも伝わる形にしておく。
const jsonLd = (a) => {
  if (!a) return '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.summary,
    datePublished: a.date,
    dateModified: a.date,
    inLanguage: 'ja',
    image: `${baseUrl}/assets/ogp/${a.slug}.jpg`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/articles/${a.slug}.html` },
    author: { '@type': 'Organization', name: cfg.title, url: `${baseUrl}/` },
    publisher: { '@type': 'Organization', name: cfg.title, url: `${baseUrl}/` },
    isAccessibleForFree: true,
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
};

const renderPage = ({ content, headTitle, metaDesc, canonical, ogType, rootPath, ogSlug, article }) =>
  fill(tpl.layout, {
    OG_IMAGE: ogImage(ogSlug),
    JSONLD: jsonLd(article),
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

  const { body, toc } = withToc(markdownToHtml(read(mdPath)));

  const page = fill(tpl.article, {
    BODY: body,
    TOC: toc,
    TITLE: escapeHtml(a.title),
    SUBTITLE: escapeHtml(a.subtitle),
    CATEGORY: escapeHtml(a.category),
    CATEGORY_SLUG: catSlug(a.category),
    DATE: a.date,
    DATE_LABEL: a.date.replace(/-/g, '.'),
    PR_BANNER: prBanner(a.slug),
    PRODUCTS: productBlock(a.slug),
    RELATED: relatedBlock(a.slug, meta.filter((m) => m.published)),
    BOOK: bookBlock(),
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
      ogSlug: a.slug,
      article: a,
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
    content: tpl.home
      .replace('{{ARTICLE_LIST}}', cards)
      .replace('{{BOOK}}', bookBlock())
      .replace('{{CTA}}', ctaFor('')),
    headTitle: cfg.title,
    metaDesc: cfg.description,
    canonical: `${baseUrl}/`,
    ogType: 'website',
    rootPath: '',
    ogSlug: '_home',
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

// ---- カテゴリ別のページ -------------------------------------------------
//
// 記事は平日毎日1本増える。1ヶ月で28本、3ヶ月で70本。
// トップに全部並べると読めなくなるので、カテゴリで切る。
// カテゴリは articles.json の category から自動で作る（増えても手を入れない）。

const categories = [...new Set(published.map((a) => a.category))];

for (const cat of categories) {
  const items = published.filter((a) => a.category === cat);

  const cards = items
    .map((a) =>
      fill(tpl.card, {
        SLUG: a.slug,
        TITLE: escapeHtml(a.title),
        SUBTITLE: escapeHtml(a.subtitle),
        SUMMARY: escapeHtml(a.summary),
        CATEGORY: escapeHtml(a.category),
        DATE: a.date,
        DATE_LABEL: a.date.replace(/-/g, '.'),
        ROOT: '../',
      })
    )
    .join('');

  const content = `<section class="hero is-narrow">
  <p class="hero-lead">「${escapeHtml(cat)}」の記事</p>
  <p class="hero-body">${items.length} 本あります。すべて、論文の一次情報まで辿って書いたものです。</p>
</section>

<ul class="article-list">
${cards}
</ul>

<p class="back-to-index"><a class="back-link" href="../index.html">すべての記事へ</a></p>`;

  write(
    join(DIST, 'category', `${catSlug(cat)}.html`),
    renderPage({
      content,
      headTitle: `「${cat}」の記事 | ${cfg.title}`,
      metaDesc: `${cfg.title}の「${cat}」に関する記事の一覧です。`,
      canonical: `${baseUrl}/category/${catSlug(cat)}.html`,
      ogType: 'website',
      rootPath: '../',
      ogSlug: '_home',
    })
  );
}
console.log(`  built  category/ (${categories.length} 個)`);

// ---- サイト内検索用のデータ ---------------------------------------------
//
// サーバーが無いので、検索は読者のブラウザの中で行う。
// そのためのデータをここで書き出す（記事が増えても自動で入る）。

write(
  join(DIST, 'search.json'),
  JSON.stringify(
    published.map((a) => ({
      slug: a.slug,
      title: a.title,
      subtitle: a.subtitle,
      summary: a.summary,
      category: a.category,
      date: a.date,
    }))
  )
);
console.log('  built  search.json');

// ---- 根拠を確かめる（スキンケア診断） -----------------------------------
//
// 商品を1つも勧めません。成分の推奨もしません。肌の状態も判定しません。
// 返すのは「あなたが今やっていることの、出典をどこまで辿れたか」だけです。
//
// ★ 商品を勧めた瞬間、薬機法66条の射程に入り、書き手が処罰対象になります。
// ★ 肌の状態を判定した瞬間、医師法17条の問題になります。
//   ここは絶対に越えないこと。越えないから、これは安全に作れています。

{
  const claimsData = JSON.parse(read(join(SITE, 'claims.json')));

  // ask: false のものは診断に出さない（読者が「自分のこと」として答えられない項目）
  // ただしデータは残す
  const claims = claimsData.claims.filter((c) => c.ask !== false && c.question);

  // topic（日焼け止め / お風呂と保湿 …）でまとめる。
  // 記事のタイトルは長すぎて、質問の見出しにならない。
  const byTopic = new Map();
  for (const c of claims) {
    const t = c.topic ?? 'その他';
    if (!byTopic.has(t)) byTopic.set(t, []);
    byTopic.get(t).push(c);
  }

  // 「辿り着けた話」が先に来るように並べる。糾弾リストに見せないため。
  const TOPIC_ORDER = [
    '日焼け止め',
    'お風呂と保湿',
    'ビタミンC',
    'レチノール',
    'ヒアルロン酸',
    '飲むもの',
    'ターンオーバー',
    '肌断食',
  ];
  const groups = [...byTopic.entries()]
    .map(([topic, items]) => ({ topic, items }))
    .sort((a, b) => {
      const ia = TOPIC_ORDER.indexOf(a.topic);
      const ib = TOPIC_ORDER.indexOf(b.topic);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

  const itemsHtml = groups
    .map(
      (g) => `  <fieldset class="check-group">
    <legend>${escapeHtml(g.topic)}</legend>
${g.items
  .map(
    (c) => `    <label class="check-row">
      <input type="checkbox" value="${escapeAttr(c.id)}">
      <span>${escapeHtml(c.question)}</span>
    </label>`
  )
  .join('\n')}
  </fieldset>`
    )
    .join('\n');

  // JS に渡すデータ
  const payload = claims.map((c) => ({
    key: c.id,
    question: c.question,
    claim: c.claim,
    traced: c.traced,
    found: c.found,
    note: c.note ?? '',
    article: c.article,
  }));

  write(
    join(DIST, 'check.html'),
    renderPage({
      content: fill(read(join(SITE, 'templates', 'check.html')), {
        CHECK_ITEMS: itemsHtml,
        CLAIMS_JSON: JSON.stringify(payload).replace(/</g, '\\u003c'),
      }),
      headTitle: `あなたのスキンケア、根拠を確かめる | ${cfg.title}`,
      metaDesc:
        '商品は勧めません。あなたが今やっているスキンケアについて、私たちが論文をどこまで辿れたかだけを返します。「出典が見つからなかった」は「効かない」ではありません。',
      canonical: `${baseUrl}/check.html`,
      ogType: 'website',
      rootPath: '',
      ogSlug: '_home',
    })
  );
  console.log(`  built  check.html (${payload.length} 件の言説)`);
}

// ---- ニュースを、論文で確かめる -------------------------------------------
//
// ニュースを「紹介」するのではなく、ニュースで主張されていることの出典を辿る。
// ニュースそのものは他所のほうが速い。うちが出せるのは「確かめた」だけ。
//
// ★ 商品名・会社名は事実として書いてよいが、叩かない。
//   「嘘」「デタラメ」と書いた時点で、このブログは終わる。

{
  const newsData = JSON.parse(read(join(SITE, 'news.json')));
  const items = (newsData.items ?? [])
    .filter((n) => n.status === 'published')
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const TRACED_LABEL = {
    'human-trial': 'ヒトの臨床試験まで辿れました',
    'industry-only': 'ヒト試験はありますが、メーカー資金のものしか見つかりませんでした',
    'lab-measure-only': 'ヒトで測ってはいますが、肌の見た目や症状は測っていません',
    'invitro-only': '培養細胞・摘出皮膚の実験しか見つかりませんでした',
    'animal-only': '動物実験しか見つかりませんでした',
    'no-source': '出典が見つかりませんでした',
  };

  const html = items.length
    ? items
        .map(
          (n) => `<article class="news-item is-${escapeAttr(n.traced)}">
  <p class="news-date"><time datetime="${escapeAttr(n.date)}">${escapeHtml(n.date.replace(/-/g, '.'))}</time></p>
  <h2 class="news-title">${escapeHtml(n.title)}</h2>

  <p class="news-what"><span class="news-tag">発表されたこと</span>${escapeHtml(n.claim)}</p>
  ${
    n.sourceUrl
      ? `<p class="news-source">出どころ: <a href="${escapeAttr(n.sourceUrl)}" target="_blank" rel="noopener nofollow">${escapeHtml(n.sourceName ?? n.sourceUrl)}</a></p>`
      : ''
  }

  <p class="news-traced">${escapeHtml(TRACED_LABEL[n.traced] ?? n.traced)}</p>
  <p class="news-found">${escapeHtml(n.found)}</p>
  ${n.note ? `<p class="news-note">ここまでは言えません: ${escapeHtml(n.note)}</p>` : ''}

  ${
    (n.pmids ?? []).length
      ? `<p class="news-pmids">確かめた論文: ${n.pmids
          .map(
            (p) =>
              `<a href="https://pubmed.ncbi.nlm.nih.gov/${escapeAttr(p)}/" target="_blank" rel="noopener">PMID ${escapeHtml(p)}</a>`
          )
          .join(' / ')}</p>`
      : '<p class="news-pmids">確かめた論文: <strong>見つかりませんでした</strong></p>'
  }
  ${
    n.article
      ? `<p class="news-link"><a href="articles/${escapeAttr(n.article)}.html">この話を詳しく書いた記事へ</a></p>`
      : ''
  }
</article>`
        )
        .join('\n')
    : `<p class="news-empty">まだ検証したニュースはありません。<br>週に数回、新しく発表されたことの出典を辿って、ここに追加します。</p>`;

  write(
    join(DIST, 'news.html'),
    renderPage({
      content: read(join(SITE, 'templates', 'news.html')).replace('{{NEWS_ITEMS}}', html),
      headTitle: `ニュースを、論文で確かめる | ${cfg.title}`,
      metaDesc:
        '新しい成分、新しい商品、SNSで広まる手順。そのたびに生まれる「◯◯に効く」という主張の出典を辿った記録です。',
      canonical: `${baseUrl}/news.html`,
      ogType: 'website',
      rootPath: '',
      ogSlug: '_home',
    })
  );
  console.log(`  built  news.html (${items.length} 件)`);
}

// ---- 404 ---------------------------------------------------------------

write(
  join(DIST, '404.html'),
  renderPage({
    content: read(join(SITE, 'templates', '404.html')),
    headTitle: `ページが見つかりません | ${cfg.title}`,
    metaDesc: 'お探しのページは見つかりませんでした。',
    canonical: `${baseUrl}/404.html`,
    ogType: 'website',
    rootPath: '',
  })
);
console.log('  built  404.html');

// ---- お問い合わせ -----------------------------------------------------

write(
  join(DIST, 'contact.html'),
  renderPage({
    content: fill(tpl.contact, { ASK_URL: escapeAttr(cfg.askUrl ?? '') }),
    headTitle: `お問い合わせ | ${cfg.title}`,
    metaDesc:
      '調べてほしいこと、記事の誤りの指摘、取材のご依頼。化粧品メーカー・美容メディアからの監修や執筆はお受けしていません。',
    canonical: `${baseUrl}/contact.html`,
    ogType: 'website',
    rootPath: '',
  })
);
console.log('  built  contact.html');

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
<url><loc>${baseUrl}/news.html</loc></url>
<url><loc>${baseUrl}/check.html</loc></url>
<url><loc>${baseUrl}/contact.html</loc></url>
<url><loc>${baseUrl}/privacy.html</loc></url>
${categories.map((c) => `<url><loc>${baseUrl}/category/${catSlug(c)}.html</loc></url>`).join('\n')}
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
