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
  const query = rest.join(' ');
  if (!query) die('検索語がありません。 例: node site/pubmed.mjs search "retinol wrinkle randomized"');

  const json = JSON.parse(
    await getText(
      `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=20&sort=relevance&term=${encodeURIComponent(query)}`
    )
  );
  const ids = json.esearchresult?.idlist ?? [];
  if (!ids.length) {
    console.log(`「${query}」で該当する論文は見つかりませんでした。`);
    console.log('見つからないこと自体が発見です。そう書いてください。');
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
