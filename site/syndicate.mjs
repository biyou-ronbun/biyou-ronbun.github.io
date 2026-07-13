// ---------------------------------------------------------------
//  note / はてなブログ 用の記事を作る
//
//    node site/syndicate.mjs          全記事ぶんを作る
//    node site/syndicate.mjs <slug>   1本だけ作る
//
//  出力: output/syndicate/<slug>.md
//
//  ---------------------------------------------------------------
//  ★ 誰に向けて書くか
//
//    note / はてな の読者は、論文を読み慣れていません。
//    「総説・メタアナリシス 1本」「ヒトを対象にした試験 0本」——
//    **これは論文を読む人の言葉であって、読者の言葉ではありません。**
//
//    **読者がいちばん知りたいのは「で、明日どうすればいいの?」です。**
//    だから「日常への生かし方」を必ず入れます。記事にある、いちばん役に立つ節です。
//
//  ★ 全文は載せません
//
//    同じ本文が2か所にあると、Google はどちらか一方しか検索結果に出しません。
//    **うちのドメインは生まれたばかりで、note とはてなは巨大です。負けます。**
//
//    ただし「出し惜しみ」もしません。**読者が0人のうちは、まず価値を渡すほうが先です。**
//    渡すのは: 答え / 論文の数字 / 明日どうするか / 自分で確かめる方法。
//    リンクの先にあるのは: 参考文献の全リスト、数値グラフ、「ここまでは言えません」の全文、他の記事。
//
//  ★ 煽らないこと。書き方を変えないこと。
//    note だから、はてなだから、と書き方を変えた瞬間、それは別のブログになります。
//    「9割が知らない」「騙されていました」——**読者を主語にした瞬間、終わりです。**
//  ---------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertsOverreach } from './tone.mjs';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);
const OUT = join(ROOT, 'output', 'syndicate');

// ★ 改行を LF に揃える。
//   記事ファイルは CRLF（Windows）で保存されています。揃えないと、段落の区切り（空行）が
//   「\n\n」ではなく「\r\n\r\n」になり、**段落で切る処理が全部すり抜けます。**
//   実際にそれで、切り詰めるはずの節が全文まるごと出ました（＝重複コンテンツの事故）。
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const cfg = JSON.parse(read(join(SITE, 'config.json')));
const meta = JSON.parse(read(join(SITE, 'articles.json')));
const figures = JSON.parse(read(join(SITE, 'figures.json'))).figures ?? {};
const verified = existsSync(join(SITE, 'verified.json'))
  ? JSON.parse(read(join(SITE, 'verified.json')))
  : { articles: {} };
const searches = existsSync(join(SITE, 'searches.json'))
  ? JSON.parse(read(join(SITE, 'searches.json'))).searches ?? {}
  : {};

const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
const only = process.argv[2];
const today = new Date().toISOString().slice(0, 10);

mkdirSync(OUT, { recursive: true });

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 長すぎる節を、段落の切れ目で切る。
// ★ 全文を出さないため。「ここまでは言えません」は記事で最も長い節になりがちで、
//   まるごと載せると、実質の全文転載になります。
const trim = (text, max) => {
  if (text.length <= max) return { text, cut: false };
  const paras = text.split(/\n\n+/);
  let out = '';
  for (const p of paras) {
    if ((out + p).length > max) break;
    out += (out ? '\n\n' : '') + p;
  }
  return { text: out || paras[0], cut: true };
};

// 記事の Markdown から、見出しで節を切り出す
const section = (md, headingRe) => {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^##\s/.test(l) && headingRe.test(l));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .replace(/^::figure:[\w-]+::$/gm, '') // 図の指定は、サイトにしかない
    .trim();
};

let made = 0;

for (const a of meta) {
  if (!a.published || a.date > today) continue;
  if (only && a.slug !== only) continue;

  const md = read(join(ROOT, 'articles', `${a.slug}.md`));
  const url = `${baseUrl}/articles/${a.slug}.html`;

  const heads = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  const answer = heads[1] ?? '';

  // 答えの節の本文（見出しだけ出して中身が無いと、読者は置いていかれる）
  const answerBody = answer ? section(md, new RegExp(escapeRe(answer))) : '';

  // ---- 論文の数字（図のデータ。読者にも分かる形で） ----
  const figId = md.match(/^::figure:([\w-]+)::/m)?.[1];
  const fig = figId ? figures[figId] : null;

  const figText = fig
    ? `### ${fig.title}\n\n` +
      (fig.rows ?? [])
        .map((r) => {
          const v = r.display ?? (Array.isArray(r.values) ? r.values.join(' / ') : r.value);
          return `- **${r.label}** … ${v ?? ''}`;
        })
        .join('\n') +
      (fig.unit ? `\n\n※ ${fig.unit}` : '') +
      '\n'
    : '';

  // ---- 明日どうするか（読者がいちばん知りたいこと） ----
  const daily = trim(section(md, /日常への生かし方/), 900);

  // ---- ここまでは言えません（このブログの本体。ただし全部は出さない） ----
  const limits = trim(section(md, /ここまでは言えません/), 700);

  // ---- 自分で確かめる方法 ----
  const s = searches[a.slug] ?? [];
  const checkText = s.length
    ? `## 私を信じる必要はありません。ご自分で確かめられます

**PubMed**（パブメド）という、世界中の医学論文が集まっているデータベースがあります。**無料で、誰でも使えます。**

この記事を書くとき、機械が実際に投げた検索が、これです。**押せば、あなたの画面で同じ検索が走ります。**

${s
  .map(
    (x) =>
      `**${x.searchedOn} 時点で ${x.count} 件**\n\n` +
      `\`\`\`\n${x.query}\n\`\`\`\n\n` +
      `→ https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(x.query)}\n`
  )
  .join('\n')}
件数は、いま押すと変わっているかもしれません。**論文は毎日増えるからです。** 増えていたら、それは私たちが記事を更新すべきだというサインです。
`
    : '';

  const v = verified.articles?.[a.slug] ?? {};

  const body = `${a.subtitle}

${a.summary}

---

## ${answer}

${trim(answerBody, 700).text}

${figText}
${
  limits.text
    ? `## ただし、ここまでは言えません

${limits.text}
${limits.cut ? `\n**このほかにも、言えないことがあります。**（全文はブログに書いています）\n` : ''}
**「ここまでは言えない」を書かない美容記事を、私は信用していません。** だから、自分の記事にも必ず書きます。
`
    : ''
}
${
  daily.text
    ? `## 明日から、どうすればいいか

${daily.text}
${daily.cut ? `\n**続きは、ブログの全文にあります。**\n` : ''}`
    : ''
}
${checkText}
---

## この記事を書いた仕組みについて

この記事は **AI が書いています。** 隠しません。

そのかわり、**公開する前に、機械が引用した論文を1本ずつ PubMed に問い合わせます。**

- その論文が**本当に存在するか**
- **タイトルが一致するか**（別の論文の番号を書いていないか）
- **撤回されていないか**（論文は、あとから撤回されることがあります）

**1本でも通らなければ、その記事は公開されません。** この記事は ${v.count ?? '?'} 本の論文すべてが、この検査を通っています。

**確かめられるのは、論文が実在することだけです。** 論文の中身が正しいかどうかまでは、機械には分かりません。**医師の監修もありません。** そこは正直に書いておきます。

---

## 全文はこちらです

**${url}**

上のリンクには、この記事の全文と、引用した論文 ${v.count ?? '?'} 本の一覧があります。
数値をグラフにした図も、「ここまでは言えません」の全文も、そこにあります。

### ブログ「[出典のある美容](${baseUrl}/)」でやっていること

**美容の「常識」の出典を、論文まで辿ります。**

- 「肌のターンオーバーは28日」——**その28日を測った論文が、見つかりませんでした**
- 「飲んだヒアルロン酸が肌に届く」——**出典をたどったら、ラットの呼気にたどりつきました**
- 「コラーゲンサプリの研究結果が割れている」——**分けていたのは、誰がお金を出したかでした**

**効果は約束しません。** 渡すのは商品ではなく、**広告を自分で読み解ける目**です。

平日は毎日、1本ずつ調べています。**「根拠が見つかりませんでした」で終わることもあります。**
それも、そのまま書きます。

**${baseUrl}/**

調べてほしい美容の常識があれば、ブログの質問箱から送ってください。
`;

  // ---- 関門 ----------------------------------------------------------
  //
  // ★ note / はてな に出したものは、こちらから直せません。
  //   サイトなら verify.mjs が止められますが、向こうに出た文は、こちらの手を離れます。
  //   **だから、出す前にここで止めます。**

  const FORBIDDEN = [
    'シミが消える', 'シワが消える', '肌が若返る', 'アンチエイジング効果',
    'デトックス', '副作用はありません', '100%安全', '必ず効きます',
    'ニキビが治る', '医師が推奨', '医師も推奨',
  ];
  const READER_AS_SUBJECT = [
    'あなたは騙され', '騙されていました', 'あなたが信じて', '信じ込まされ',
    '知らないと損', '情弱', 'まだ信じてるの', '9割が知らない',
  ];
  // 言い過ぎの判定は site/tone.mjs に一本化してある。
  // （3つの関門が別々に実装していて、3つとも別々の穴を持っていた）
  const over = assertsOverreach(body);

  const bad = [
    ...FORBIDDEN.filter((w) => body.includes(w)).map((w) => `薬機法「${w}」`),
    ...READER_AS_SUBJECT.filter((w) => body.includes(w)).map((w) => `読者を主語にしている「${w}」`),
    ...(over ? [`言い過ぎ「${over.word}」\n        …${over.context}…`] : []),
  ];

  if (bad.length) {
    console.error(`  ✗ ${a.slug}: 出せません`);
    bad.forEach((b) => console.error(`      ${b}`));
    console.error(`      note / はてな に出した文は、こちらから直せません。だから出す前に止めます。`);
    process.exitCode = 1;
    continue;
  }

  writeFileSync(join(OUT, `${a.slug}.md`), body, 'utf8');
  console.log(
    `  ${a.slug}.md  （${body.length} 字 / 図:${fig ? '○' : '×'} / 生かし方:${daily ? '○' : '×'} / 検索式:${s.length}）`
  );
  made++;
}

console.log('');
console.log(`${made} 本を output/syndicate/ に作りました`);
console.log('');
console.log('★ 全文は載せていません（同じ本文が2か所にあると、Google はどちらか一方しか出しません）。');
console.log('  ただし出し惜しみもしていません。読者が0人のうちは、まず価値を渡すほうが先です。');
