// ---------------------------------------------------------------
//  PubMed から論文の一次情報を取ってくる
//
//    node site/pubmed.mjs check
//        → ネットワークが通っているかだけ確認する
//
//    node site/pubmed.mjs search "collagen peptide skin elasticity randomized"
//        → 該当する論文の PMID とタイトルを一覧で出す
//
//    node site/pubmed.mjs get 40324552 29949889
//        → タイトル・掲載誌・年・著者と所属・要旨・利益相反・資金提供元を出す
//
//  なぜこれが要るか:
//    クラウド上のエージェントは WebFetch でウェブページを開けない（403）。
//    しかし論文の一次情報は PubMed の公式API（E-utilities）から取れる。
//    検索結果のスニペットで論文カードを書くのは捏造なので、絶対にやらないこと。
//    ここから取れた情報だけを書く。
//
//  ※ ここで取れるのは要旨（アブストラクト）までです。
//     本文しか書かれていない数値は「アブストラクトのみ確認」と明記すること。
// ---------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = dirname(fileURLToPath(import.meta.url));

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const UA = { 'User-Agent': 'biyou-ronbun/1.0 (research)' };

const die = (msg) => {
  console.error(`\n！ ${msg}`);
  process.exit(1);
};

async function getText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

// XML から中身を抜くだけの、ごく素朴な取り出し
const strip = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const pick = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? strip(m[1]) : '';
};

const pickAll = (xml, tag) =>
  [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);

// ---- サブコマンド ------------------------------------------------

// ---- 検索ログ（機械が、検索を実行した副作用として書く） ------------------
//
// ★ このファイルを手で編集しないこと。エージェントに書かせないこと。
//   書かせた瞬間、それは「検索した証拠」ではなく「検索したという主張」に戻ります。
//
//   記録するのは、実際に PubMed に投げた検索語と、返ってきた件数と、日付だけです。
//   件数が 0 でも記録します。**むしろ 0 のときこそ、この記録に意味があります。**

const SEARCHES = join(SITE_DIR, 'searches.json');

function recordSearch(slug, query, count) {
  if (!slug) return; // --for が無いときは記録しない（下調べの検索まで全部は残さない）

  const data = existsSync(SEARCHES)
    ? JSON.parse(readFileSync(SEARCHES, 'utf8'))
    : {
        _readme: [
          'site/pubmed.mjs が、検索を実行した副作用として追記します。',
          '**手で編集しないこと。エージェントに書かせないこと。**',
          '書かせた瞬間、これは「検索した証拠」ではなく「検索したという主張」になります。',
          '',
          'ここに記録されるのは、実際に PubMed に投げた検索語・返ってきた件数・日付だけです。',
          '件数が 0 でも記録します。**むしろ 0 のときこそ、この記録に意味があります。**',
          '',
          'この記録は、記事のレシートに「読者がクリックできるリンク」として出ます。',
          '★ 読者は30秒で、うちの検索を自分の画面で再実行できます。',
          '  **このブログを信じなくても、答えが手に入る。** それが、この仕組みの目的です。',
        ],
        searches: {},
      };

  const day = new Date().toISOString().slice(0, 10);
  data.searches[slug] ??= [];

  // 同じ検索語を何度も走らせても、記録は1行（最後の件数と日付で更新）
  const existing = data.searches[slug].find((s) => s.query === query);
  if (existing) {
    existing.count = count;
    existing.searchedOn = day;
  } else {
    data.searches[slug].push({ query, count, searchedOn: day });
  }

  writeFileSync(SEARCHES, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'check') {
  try {
    const t = await getText(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=29949889`);
    if (t.includes('29949889')) {
      console.log('OK: PubMed に到達できます。論文の一次情報を取得できます。');
      process.exit(0);
    }
    die('PubMed から想定外の応答が返りました。');
  } catch (e) {
    console.error('');
    console.error('NG: PubMed に到達できません。');
    console.error(`    ${e.message}`);
    console.error('');
    console.error('  この状態では論文を確認できません。');
    console.error('  検索結果のスニペットだけで論文カードを書くのは捏造です。');
    console.error('  記事を書かずに、この事実を報告して終了してください。');
    process.exit(1);
  }
}

if (cmd === 'search') {
  // --for <スラッグ> … その記事のための検索であることを記録する
  const forIdx = rest.indexOf('--for');
  const slug = forIdx >= 0 ? rest[forIdx + 1] : null;
  const query = (forIdx >= 0 ? [...rest.slice(0, forIdx), ...rest.slice(forIdx + 2)] : rest).join(' ');

  if (!query) die('検索語がありません。 例: node site/pubmed.mjs search "retinol wrinkle randomized" --for retinol-concentration');

  const json = JSON.parse(
    await getText(
      `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=20&sort=relevance&term=${encodeURIComponent(query)}`
    )
  );
  const ids = json.esearchresult?.idlist ?? [];
  const total = Number(json.esearchresult?.count ?? ids.length);

  // ★★ 地雷。ここを外すと、この仕組み全体が嘘になります。
  //
  //   PubMed は、認識できない語を **エラーにせず、黙って無視して「0件」を返します。**
  //
  //     randomized[pt]  →  phrasesnotfound: ["randomized"]  →  count: 0
  //     "randomized controlled trial"[pt]  →  12 件
  //
  //   **同じことを聞いているのに、書き方を1つ間違えると 0 件になります。**
  //   そして 0 件は、うちにとって「探したが無かった」という最も強い証拠です。
  //
  //   **つまり、検索式を書き損じるだけで、偽の証拠を製造できてしまいます。**
  //   この仕組みが防ぐはずだった、まさにその罪です。
  //
  //   （2026-07-13、記事8本の検索を記録する作業で、実際にこれを踏みかけました。
  //     指示書に書いてあった検索式の例そのものが、この地雷でした）
  //
  //   だから、PubMed が「その語は知らない」と言ったら、**記録せずに落とします。**
  const notFound = json.esearchresult?.errorlist?.phrasesnotfound ?? [];
  const ignored = json.esearchresult?.warninglist?.phrasesignored ?? [];

  // ★★★ 2つ目の地雷。1つ目より、はるかに危ない。
  //
  //   PubMed は **記号を黙って捨てます。errorlist にも warninglist にも何も出ません。**
  //
  //     投げた式 : retinol[tiab] AND "0.3%"[tiab]
  //     解釈     : "retinol" AND "0 3"        ← % が消え、ピリオドが空白に
  //     件数     : 10
  //
  //     投げた式 : retinol[tiab] AND "1%"[tiab]
  //     解釈     : "retinol" AND "1"          ← "1" は数万件にマッチする
  //     件数     : 7247
  //
  //   **「0.3%の研究は0件」と書いたら、それは捏造です。** 検索式が壊れていただけです。
  //   **うちが糾弾している行為そのものになります。**
  //
  //   （PA++++ も同じ。+ が全部落ちて "pa" になる）
  //
  //   だから、**PubMed が実際にどう解釈したか（querytranslation）を、こちらで照合します。**
  //   投げた検索式に記号（% + など）が含まれ、それが解釈から消えていたら、記録せずに落とします。

  const translation = json.esearchresult?.querytranslation ?? '';
  const symbols = [...new Set((query.match(/[%+#&]/g) ?? []))];
  const dropped = symbols.filter((s) => query.includes(s) && !translation.includes(s));

  if (dropped.length) {
    console.error('');
    console.error('  ✗ PubMed が、検索式の記号を黙って捨てました。記録しません。');
    console.error('');
    console.error(`    捨てられた記号: ${dropped.join(' ')}`);
    console.error(`    あなたが投げた式  : ${query}`);
    console.error(`    PubMed の解釈    : ${translation}`);
    console.error('');
    console.error('  ★ PubMed は記号を落とします。**エラーも警告も出ません。**');
    console.error('    "0.3%" → "0 3" になり、"1%" → "1"（数万件にマッチ）になります。');
    console.error('');
    console.error('    **この結果を「0件でした」と書けば、それは捏造です。**');
    console.error('    検索式が壊れていただけです。');
    console.error('');
    console.error('  濃度や指数を数えたいなら、記号に頼らない書き方をしてください。');
    console.error('    ✗ "0.3%"[tiab]');
    console.error('    ○ "0.3 percent"[tiab] OR "0.3%"[tiab]  ← それでも %  は落ちる。効くのは前者だけ');
    console.error('    ○ そもそも、濃度で数えられない可能性を疑うこと');
    console.error('');
    process.exit(1);
  }

  if (notFound.length || ignored.length) {
    console.error('');
    console.error('  ✗ PubMed が、検索式の一部を理解できませんでした。記録しません。');
    console.error('');
    if (notFound.length) console.error(`    知らない語: ${notFound.join(', ')}`);
    if (ignored.length) console.error(`    無視した語: ${ignored.join(', ')}`);
    console.error('');
    console.error('  ★ PubMed は、知らない語をエラーにせず、黙って無視して結果を返します。');
    console.error('    そのまま記録すると、**「探したが見つからなかった」という偽の証拠**になります。');
    console.error('');
    console.error('  よくある間違い:');
    console.error('    ✗ randomized[pt]                      → 0 件（語を知らないため）');
    console.error('    ○ "randomized controlled trial"[pt]   → 正しく返る');
    console.error('    ✗ "PA++++"[tiab]                      → PubMed は + を落とすので、検索不能');
    console.error('');
    console.error('  検索式を直して、もう一度実行してください。');
    console.error('');
    process.exit(1);
  }

  // ★ ここが要点です。
  //
  //   このブログの芯は「探したが、無かった」です。
  //   ところが、論文の実在・撤回・タイトル一致は機械で証明しているのに、
  //   **「探した」だけが、ずっと自己申告でした。**
  //   サイトで唯一、裏付けの無い部分が、いちばん大事な部分になっていました。
  //
  //   だから、**検索を実行した副作用として、機械が自分でログを書きます。**
  //   エージェントに書かせません。書かせた瞬間、それは自己申告に戻ります。
  //
  //   このログは記事のレシートに、**読者がクリックできるリンク**として出ます。
  //   **読者は30秒で、うちの検索を自分の画面で再実行できます。**
  //   **このブログを信じなくても、答えが手に入る。** それが狙いです。
  recordSearch(slug, query, total);

  if (!ids.length) {
    console.log(`「${query}」で該当する論文は見つかりませんでした。`);
    console.log('見つからないこと自体が発見です。そう書いてください。');
    if (slug) console.log(`（この検索は site/searches.json に記録しました。読者が同じ検索を再実行できます）`);
    process.exit(0);
  }

  const sum = JSON.parse(
    await getText(`${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`)
  );

  console.log(`「${query}」— ${ids.length} 件\n`);
  for (const id of ids) {
    const r = sum.result?.[id];
    if (!r) continue;
    const type = (r.pubtype ?? []).join(', ');
    console.log(`PMID ${id}`);
    console.log(`  ${r.title}`);
    console.log(`  ${r.source} ${r.pubdate}  [${type}]`);
    console.log('');
  }
  console.log('気になるものを `node site/pubmed.mjs get <PMID>` で詳しく見てください。');
  process.exit(0);
}

if (cmd === 'get') {
  if (!rest.length) die('PMID がありません。 例: node site/pubmed.mjs get 40324552');

  const xml = await getText(
    `${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id=${rest.join(',')}`
  );

  const articles = pickAll(xml, 'PubmedArticle');
  if (!articles.length) die('該当する論文がありません。PMID が間違っている可能性があります。');

  for (const a of articles) {
    const pmid = pick(a, 'PMID');
    const title = pick(a, 'ArticleTitle');
    const journal = pick(a, 'Title');
    const volume = pick(a, 'Volume');
    const issue = pick(a, 'Issue');
    const pages = pick(a, 'MedlinePgn');

    // 掲載年（電子版の年ではなく、雑誌の発行年）
    const jIssue = a.match(/<JournalIssue[\s\S]*?<\/JournalIssue>/)?.[0] ?? '';
    const year = pick(jIssue, 'Year') || pick(a, 'Year');

    // 要旨（ラベル付きの節がある場合はラベルごと出す）
    const abs = pickAll(a, 'AbstractText')
      .map((seg) => {
        const raw = a.match(new RegExp(`<AbstractText[^>]*>${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</AbstractText>`));
        const label = raw?.[0]?.match(/Label="([^"]+)"/)?.[1];
        return label ? `[${label}] ${strip(seg)}` : strip(seg);
      })
      .join('\n  ');

    // 著者と所属（企業所属かどうかを見るため、所属は必ず出す）
    const authors = pickAll(a, 'Author').map((au) => {
      const last = pick(au, 'LastName');
      const init = pick(au, 'Initials');
      const affs = pickAll(au, 'Affiliation').map(strip);
      return { name: [last, init].filter(Boolean).join(' '), affs };
    });

    const coi = pick(a, 'CoiStatement');
    const grants = pickAll(a, 'Grant').map((g) => strip(pick(g, 'Agency')));
    const types = pickAll(a, 'PublicationType').map(strip);

    console.log('='.repeat(70));
    console.log(`PMID ${pmid}`);
    console.log('='.repeat(70));
    console.log(`タイトル : ${title}`);
    console.log(`掲載誌   : ${journal}. ${year};${volume}${issue ? `(${issue})` : ''}${pages ? `:${pages}` : ''}`);
    console.log(`種別     : ${types.join(', ')}`);
    console.log('');
    console.log('著者と所属:');
    for (const au of authors) {
      console.log(`  ${au.name}`);
      for (const af of au.affs) console.log(`    所属: ${af}`);
    }
    console.log('');
    console.log(`利益相反(COI): ${coi || '（記載なし）'}`);
    console.log(`資金提供     : ${grants.length ? [...new Set(grants)].join(' / ') : '（記載なし）'}`);
    console.log('');
    console.log('要旨:');
    console.log(`  ${abs || '（要旨なし）'}`);
    console.log('');
  }

  console.log('※ ここに出ているのは要旨までです。');
  console.log('   本文にしか無い数値を、要旨から推測して書かないこと。');
  console.log('   確認できたのが要旨だけなら、カードに「アブストラクトのみ確認」と書くこと。');
  process.exit(0);
}

console.log(`使い方:
  node site/pubmed.mjs check                          ネットワークの確認
  node site/pubmed.mjs search "<英語の検索語>"        論文を探す
  node site/pubmed.mjs get <PMID> [PMID...]           論文の詳細を見る`);
