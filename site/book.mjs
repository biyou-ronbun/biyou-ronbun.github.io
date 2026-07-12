// ---------------------------------------------------------------
//  記事を1冊の電子書籍（EPUB）に束ねる
//
//    node site/book.mjs           いちばん新しい draft の巻を作る
//    node site/book.mjs vol1      巻を指定して作る
//
//  本の中身は site/books.json（巻の台帳）に書いてあります。
//  次の巻をいつ出すかは auto/next-volume.mjs が判定します。
//
//  出力: site/dist-book/<ファイル名>.epub
//        （Kindle ダイレクト・パブリッシング にそのままアップロードできる）
//
//  外部ライブラリは使いません。EPUB は ZIP なので、ZIP を自前で書きます。
//
//  ★ 記事はブログで無料公開したまま、本として売れます。
//    KDP のコンテンツガイドラインは「Webから無料で入手できるコンテンツは、
//    その著作権所有者から提出される場合を除き取り扱えない」としており、
//    著作権者は本人なので例外に当たります。
//    ただし **KDPセレクト（独占契約）には登録できません**。
//    登録すると独占になり、ブログでの無料公開と両立しません。
//    → ロイヤリティは 35% になります。それでいい。資産を削らないほうが大事です。
//
//  ★ AI生成コンテンツは KDP への申告義務があります。アップロード時に申告してください。
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);
const OUT = join(SITE, 'dist-book');

const read = (p) => readFileSync(p, 'utf8');
const cfg = JSON.parse(read(join(SITE, 'config.json')));
const meta = JSON.parse(read(join(SITE, 'articles.json')));
const ledger = JSON.parse(read(join(SITE, 'books.json')));

// ---- どの巻を作るか -------------------------------------------------
// 引数があればその巻。無ければ「まだ KDP に出していない（draft）」の最後の巻。

const wanted = process.argv[2];
const volumes = ledger.volumes ?? [];

const volume = wanted
  ? volumes.find((v) => v.id === wanted)
  : [...volumes].reverse().find((v) => v.status === 'draft');

if (!volume) {
  if (wanted) {
    console.error(`site/books.json に「${wanted}」という巻がありません。`);
    console.error(`ある巻: ${volumes.map((v) => v.id).join(', ') || '（なし）'}`);
  } else {
    console.error('まだ KDP に出していない巻（status: draft）がありません。');
    console.error('巻を指定して作り直すなら: node site/book.mjs vol1');
    console.error('次の巻を出せるだけ記事が溜まったかを見るなら: node auto/next-volume.mjs');
  }
  process.exit(1);
}

// 台帳の defaults を、巻ごとの設定で上書きする（巻が持っていない項目は defaults を使う）
const book = { ...(ledger.defaults ?? {}), ...volume };

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- 薬機法の検査（本にも同じ法律が掛かる） -------------------------

const FORBIDDEN = [
  'シミが消える', 'シミが取れる', 'シワが消える', 'シワがなくなる',
  '肌が若返る', '若返り効果', 'アンチエイジング効果',
  '細胞が生まれ変わる', '肌が再生する',
  'デトックス', '毒素を排出',
  '副作用はありません', '副作用がない', '100%安全', '絶対に安全',
  '必ず効きます', '絶対に効く', '誰にでも効く',
  'ニキビが治る', 'アトピーが治る',
  '医師も推奨', '医師が推奨',
];

// ---- Markdown → XHTML ---------------------------------------------
// サイト用の変換とは別に、EPUB は厳密な XHTML を要求するので独立させる。

function mdToXhtml(md) {
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  md = md.replace(/^::figure:[a-z0-9-]+::$/gm, ''); // 図版は本には入れない

  const out = [];
  let para = [];
  let list = [];
  let listType = 'ul';
  let table = [];

  const inline = (t) => {
    let s = esc(t);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');   // 本ではリンクを外し、文字だけ残す
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return s;
  };

  const flushP = () => { if (para.length) { out.push(`<p>${para.join('<br />')}</p>`); para = []; } };
  const flushL = () => {
    if (list.length) {
      out.push(`<${listType}>`);
      list.forEach((i) => out.push(`<li>${i}</li>`));
      out.push(`</${listType}>`);
      list = [];
    }
  };
  const flushT = () => {
    if (table.length) {
      out.push('<table>');
      out.push('<tr>' + table[0].map((c) => `<th>${c}</th>`).join('') + '</tr>');
      for (let r = 1; r < table.length; r++) {
        out.push('<tr>' + table[r].map((c) => `<td>${c}</td>`).join('') + '</tr>');
      }
      out.push('</table>');
      table = [];
    }
  };
  const flushAll = () => { flushP(); flushL(); flushT(); };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushAll(); continue; }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushP(); flushL();
      const cells = line.trim().replace(/^\||\|$/g, '').split('|');
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))) {
        table.push(cells.map((c) => inline(c.trim())));
      }
      continue;
    }
    flushT();

    if (/^\s*---+\s*$/.test(line)) { flushAll(); out.push('<hr />'); continue; }

    let m;
    if ((m = line.match(/^###\s+(.*)$/))) { flushAll(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = line.match(/^##\s+(.*)$/)))  { flushAll(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = line.match(/^>\s?(.*)$/)))   { flushAll(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }

    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      flushP();
      if (listType !== 'ol') { flushL(); listType = 'ol'; }
      list.push(inline(m[1]));
      continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flushP();
      if (listType !== 'ul') { flushL(); listType = 'ul'; }
      list.push(inline(m[1]));
      continue;
    }

    flushL();
    para.push(inline(line));
  }
  flushAll();
  return out.join('\n');
}

// ---- ZIP を自前で書く（外部ライブラリなし） --------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.from(e.data);
    // mimetype だけは無圧縮で先頭に置く決まり（EPUB の仕様）
    const store = e.store === true;
    const body = store ? raw : deflateRawSync(raw);
    const crc = crc32(raw);
    const method = store ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, name, body);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(method, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(0, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(raw.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);

    central.push(cen, name);
    offset += local.length + name.length + body.length;
  }

  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, cenBuf, end]);
}

// ---- 収録する記事を選ぶ ---------------------------------------------

const chapters = [];
const failures = [];

for (const slug of book.articles) {
  const info = meta.find((a) => a.slug === slug);
  if (!info) { failures.push(`${slug}: site/articles.json にありません`); continue; }

  const md = read(join(ROOT, 'articles', `${slug}.md`));

  for (const ng of FORBIDDEN) {
    if (md.includes(ng)) failures.push(`${slug}: 薬機法でアウトな表現「${ng}」`);
  }

  chapters.push({
    slug,
    title: info.title,
    subtitle: info.subtitle,
    body: mdToXhtml(md),
  });
}

if (failures.length) {
  console.error('\n本にできません:');
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

// ---- EPUB を組み立てる ----------------------------------------------

const CSS = `body { font-family: serif; line-height: 1.9; margin: 1em; }
h1 { font-size: 1.5em; line-height: 1.5; margin: 2em 0 0.4em; }
h2 { font-size: 1.2em; line-height: 1.6; margin: 2em 0 0.6em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
h3 { font-size: 1.05em; margin: 1.6em 0 0.5em; }
p  { margin: 0 0 1em; text-indent: 0; }
.subtitle { color: #666; font-size: 0.9em; margin-bottom: 2em; }
blockquote { border-left: 3px solid #999; margin: 0 0 1em; padding-left: 1em; color: #555; }
table { border-collapse: collapse; width: 100%; font-size: 0.85em; margin-bottom: 1em; }
th, td { border: 1px solid #ccc; padding: 0.4em; text-align: left; }
hr { border: 0; border-top: 1px solid #ccc; margin: 2em 0; }`;

const page = (title, inner) =>
  `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja" lang="ja">
<head><meta charset="utf-8" /><title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css" /></head>
<body>
${inner}
</body></html>`;

const files = [
  { name: 'mimetype', data: 'application/epub+zip', store: true },
  {
    name: 'META-INF/container.xml',
    data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  },
  { name: 'OEBPS/style.css', data: CSS },
  {
    name: 'OEBPS/front.xhtml',
    data: page(
      book.title,
      `<h1>${esc(book.title)}</h1>
<p class="subtitle">${esc(book.subtitle ?? '')}</p>
<p>${esc(book.author)}</p>
<hr />
${book.frontMatter.map((p) => `<p>${esc(p)}</p>`).join('\n')}`
    ),
  },
];

chapters.forEach((c, i) => {
  files.push({
    name: `OEBPS/ch${i + 1}.xhtml`,
    data: page(
      c.title,
      `<h1>${esc(c.title)}</h1>\n<p class="subtitle">${esc(c.subtitle ?? '')}</p>\n${c.body}`
    ),
  });
});

files.push({
  name: 'OEBPS/back.xhtml',
  data: page('おわりに', book.backMatter.map((p) => `<p>${esc(p)}</p>`).join('\n')),
});

const navItems = [
  '<li><a href="front.xhtml">はじめに</a></li>',
  ...chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${esc(c.title)}</a></li>`),
  '<li><a href="back.xhtml">おわりに</a></li>',
].join('\n');

files.push({
  name: 'OEBPS/nav.xhtml',
  data: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="ja" lang="ja">
<head><meta charset="utf-8" /><title>目次</title></head>
<body><nav epub:type="toc" id="toc"><h1>目次</h1><ol>
${navItems}
</ol></nav></body></html>`,
});

const manifest = [
  '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
  '<item id="css" href="style.css" media-type="text/css"/>',
  '<item id="front" href="front.xhtml" media-type="application/xhtml+xml"/>',
  ...chapters.map((c, i) => `<item id="ch${i + 1}" href="ch${i + 1}.xhtml" media-type="application/xhtml+xml"/>`),
  '<item id="back" href="back.xhtml" media-type="application/xhtml+xml"/>',
].join('\n');

const spine = [
  '<itemref idref="front"/>',
  ...chapters.map((_, i) => `<itemref idref="ch${i + 1}"/>`),
  '<itemref idref="back"/>',
].join('\n');

files.push({
  name: 'OEBPS/content.opf',
  data: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ja">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${esc(book.uuid)}</dc:identifier>
<dc:title>${esc(book.title)}</dc:title>
<dc:creator>${esc(book.author)}</dc:creator>
<dc:language>ja</dc:language>
<dc:publisher>${esc(cfg.title)}</dc:publisher>
<dc:description>${esc(book.description)}</dc:description>
<meta property="dcterms:modified">${book.modified}</meta>
</metadata>
<manifest>
${manifest}
</manifest>
<spine>
${spine}
</spine>
</package>`,
});

// 巻ごとにファイル名が違うので、まるごと消さない。前の巻の EPUB は残しておく。
mkdirSync(OUT, { recursive: true });

const epubPath = join(OUT, `${book.filename}.epub`);
writeFileSync(epubPath, zip(files));

console.log('');
console.log('=========================================');
console.log(`  ${book.title}（${book.id}）`);
console.log('=========================================');
console.log(`  収録: ${chapters.length} 章`);
chapters.forEach((c, i) => console.log(`    ${i + 1}. ${c.title}`));
console.log('');
console.log(`  出力: ${epubPath}`);
console.log('');
console.log('  KDP にアップロードするときの注意:');
console.log('    ・「AI生成コンテンツ」を必ず申告すること（規約上の義務）');
console.log('    ・KDPセレクトには登録しないこと（登録すると独占になり、');
console.log('      ブログでの無料公開と両立できません。ロイヤリティは35%になります）');
console.log('=========================================');
