// ---------------------------------------------------------------
//  note / はてなブログ 用の「紹介記事」を作る
//
//    node site/syndicate.mjs          全記事ぶんを作る
//    node site/syndicate.mjs <slug>   1本だけ作る
//
//  出力: output/syndicate/<slug>.md
//
//  ---------------------------------------------------------------
//  ★ なぜ全文を転載しないのか
//
//    同じ本文が2か所にあると、Google はどちらか一方しか検索結果に出しません。
//    **うちのドメインは生まれたばかりで、note とはてなは巨大です。負けます。**
//    全文を出せば、自分のサイトを、自分で潰すことになります。
//
//    だから出すのは:
//      ・その記事で何が分かったか（答え＝2番目の見出し）
//      ・論文の数字（図のデータ。**ここにしかない**）
//      ・機械が確かめたこと（何本の論文を、いつ照会したか）
//      ・**実際に投げた検索式**（読者が自分で再実行できる）
//      ・本文へのリンク
//
//    **要約ではありません。「そこにしかない事実」を出して、本文に呼びます。**
//
//  ★ 煽らないこと。note / はてな だからといって、書き方を変えないこと。
//    書き方を変えた瞬間、それは別のブログになります。
//  ---------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);
const OUT = join(ROOT, 'output', 'syndicate');

const read = (p) => readFileSync(p, 'utf8');

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

mkdirSync(OUT, { recursive: true });

const today = new Date().toISOString().slice(0, 10);

let made = 0;

for (const a of meta) {
  if (!a.published || a.date > today) continue;
  if (only && a.slug !== only) continue;

  const md = read(join(ROOT, 'articles', `${a.slug}.md`));
  const url = `${baseUrl}/articles/${a.slug}.html`;

  // 答え（2番目の見出し。§4.8 で「答えそのものを書く」と義務にしてある）
  const heads = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  const answer = heads[1] ?? '';

  // 図（この記事にしかない数字）
  const figId = md.match(/^::figure:([\w-]+)::/m)?.[1];
  const fig = figId ? figures[figId] : null;

  const figText = fig
    ? `### ${fig.title}\n\n` +
      (fig.rows ?? [])
        .map((r) => {
          const v = r.display ?? (Array.isArray(r.values) ? r.values.join(' / ') : r.value);
          return `- **${r.label}**: ${v ?? ''}`;
        })
        .join('\n') +
      (fig.unit ? `\n\n${fig.unit}` : '') +
      (fig.source ? `\n\n${fig.source}` : '') +
      '\n'
    : '';

  const v = verified.articles?.[a.slug] ?? {};

  // 実際に投げた検索式（**これがいちばん強い。他所には無い**）
  const s = searches[a.slug] ?? [];
  const searchText = s.length
    ? `## 使った検索式（あなたの画面で再実行できます）\n\n` +
      s
        .map(
          (x) =>
            `\`\`\`\n${x.query}\n\`\`\`\n→ ${x.searchedOn} 時点で **${x.count} 件**\n` +
            `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(x.query)}\n`
        )
        .join('\n') +
      `\n**私を信じる必要はありません。押せば、あなたの画面で同じ検索が走ります。**\n`
    : '';

  const body = `# ${a.title}

${a.subtitle}

---

## ${answer}

${a.summary}

${figText}
## 機械が確かめたこと

- この記事が引用した論文 **${v.count ?? '?'} 本**すべてを、**${(verified.verifiedAt ?? '').slice(0, 10)}** に PubMed へ自動照会しました
- 実在すること、タイトルが一致すること、**撤回されていないこと**を確認しています
- 内訳は、総説・メタアナリシス **${v.reviews ?? 0} 本**、ヒトを対象にした試験 **${v.humanTrials ?? 0} 本**
${v.retracted?.length ? `- **うち ${v.retracted.length} 本は撤回された論文です。**撤回された事実を明記したうえで、「撤回後も根拠として使われている」という事実そのものとして引用しています\n` : ''}
**確かめたのは、論文が実在することだけです。** 論文の内容が正しいかどうかは、機械には判定できません。**医師の監修はありません。**

${searchText}
---

## 全文（参考文献・数値グラフ・限界の記述つき）

**${url}**

この記事の全文、引用した論文 ${v.count ?? '?'} 本の一覧、そして「**ここまでは言えません**」の節は、上のリンクにあります。

---

*このブログは、美容の「常識」の出典を論文まで辿ります。効果は約束しません。渡すのは、自分で判断できる目です。*
*記事は AI が書き、公開前に機械が PubMed へ全件照会しています。1本でも通らなければ、その記事は世に出ません。*
`;

  writeFileSync(join(OUT, `${a.slug}.md`), body, 'utf8');
  console.log(`  ${a.slug}.md  （${body.length} 文字 / 図: ${fig ? 'あり' : 'なし'} / 検索式: ${s.length} 本）`);
  made++;
}

console.log('');
console.log(`${made} 本を output/syndicate/ に作りました`);
console.log('');
console.log('★ 全文は載せていません。同じ本文が2か所にあると、Google はどちらか一方しか出しません。');
console.log('  うちのドメインは生まれたばかりで、note とはてなは巨大です。**負けます。**');
console.log('  出しているのは「そこにしかない事実」（論文の数字・検索式）と、本文へのリンクだけです。');
