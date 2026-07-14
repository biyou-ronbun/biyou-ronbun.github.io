// ---------------------------------------------------------------
//  X の投稿に書かれた数値が、記事に実在するかを確かめる
//
//      node auto/x-numbers.mjs          （未投稿を全部）
//      node auto/x-numbers.mjs --posted （投稿済みも見る）
//
//  auto/verify-x.mjs から呼ばれる。単体でも動く。
//
//  ---------------------------------------------------------------
//  ★★ なぜこれが要るのか（2026-07-14、実際に出かけていた）
//
//    投稿の下書きに、こう書いてあった:
//
//        1本目: 著者7人中**5人**がメーカー社員
//
//    記事には「著者7人のうち**6人**が、キユーピー株式会社」と書いてある。
//    論文カードも、図も、記事も、同じ日に 6人 へ訂正済みだった。
//
//    **訂正が3箇所に入って、4箇所目（カード内の引用用の一文）と、**
//    **5箇所目（X の下書き）が、取り残されていた。**
//
//    そして関門は、それを通した。**関門は x/queue.json しか読んでいなかったから。**
//    articles/ を一度も開かない。記事に無い数字を書いても、通る。
//
//    投稿は 2026-07-16 15:00 の予定で、**次の実行で出るところだった。**
//
//  ★ 考え方
//
//    投稿に「数値」があるなら、それは必ず**どれか1本の記事**から来ている。
//    **その記事1本の中に、投稿の数値が全部そろっているはず。**
//
//    どの記事にも全部そろっていないなら、それは
//      ① 記事から来ていない数字（＝捏造）か
//      ② 記事が訂正されて、投稿だけ古いまま（＝今回のこれ）
//    のどちらか。**どちらも出してはいけない。**
//
//  ★ 「記事に無い数字」だけを見る。**言い回しの一致は見ない。**
//    「7人のうち6人」と「7人中6人」は、同じ事実の別の書き方。そこは咎めない。
// ---------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ---- 「数値」とは何か -------------------------------------------------
//
// ★ ただの数字は見ない。**単位が付いた数字だけ**を見る。
//   「1本目」「3つ」のような数え上げは、事実の主張ではない。
//   「7人」「0.3 mg/cm²」「p=0.03」「24%」は、事実の主張。
//
// ★ 見逃すより、誤って止めるほうがまし——ではない。
//   誤って止め続けると、人は関門を切る。**だから単位で絞る。**

// ★ 数と単位の区切り。**見えない空白に頼らない。**
//   最初これを空白にしていたら、空白のつもりで NUL 文字を書いてしまい、
//   照合が静かに全部外れた（正しい投稿を止め、間違った投稿を通した）。
const SEP = '\u0001';

const UNITS = [
  '人', '名', '件', '%', '％', '倍',
  'mg', 'µm', 'μm', 'g', 'ml', 'mL',
  '週', '日間', 'か月', 'ヶ月', 'カ月', '年間', '歳',
];

// 数え上げ（事実の主張ではない）。ここに当たるものは見ない。
const COUNTING = /^\d+(本目|つ目|番目|人目)$/;

export function extractNumbers(rawText) {
  // ★★ URL を先に外す。**URL は、数値の主張を運ばない。**
  //
  //   外さないと、パーセントエンコーディングを数値として読む:
  //       ...%22salmon%20DNA%22%5Btiab%5D...
  //                          ↑ 「22」の直後に「%」→ **「22%」だと誤読する**
  //
  //   実際に、PubMed の検索URLを載せた正しい投稿を1件、これで止めた。
  const text = rawText.replace(/https?:\/\/\S+/g, ' ');

  const found = new Set();

  // ① p値（p=0.03 / p<0.05 / p＝0.03）
  //   ★ 演算子も一緒に持つ。**「p=0.001」と「p<0.001」は、別の主張。**
  //     （最初これを混ぜて、捏造した p値 を通した）
  for (const m of text.matchAll(/p\s*([=＝<＜>＞])\s*(0?\.\d+)/gi)) {
    const op = { '＝': '=', '＜': '<', '＞': '>' }[m[1]] ?? m[1];
    found.add('p' + op + m[2].replace(/^\./, '0.'));
  }

  // ② 単位つきの数
  const unitAlt = UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${unitAlt})`, 'g');
  for (const m of text.matchAll(re)) {
    const whole = m[0];
    if (COUNTING.test(whole.replace(/\s/g, ''))) continue;
    found.add(m[1].replace(/,/g, '') + SEP + m[2]); // 数 と 単位 を、SEP で分けて持つ
  }

  return [...found];
}

// ★ 記事は「1,474人」と書き、投稿も「1,474人」と書く。
//   だが数を比べるときは、**両側からカンマを外さないと一致しない。**
//   （最初これを忘れて、正しい投稿を2件、誤って止めた）
const normalize = (s) => s.replace(/(\d),(?=\d{3}\b)/g, '$1');

// ★★ 数と単位は、**くっついていること**を求める。
//
//   最初、あいだに4文字まで挟んでよいことにした。**それが致命傷だった。**
//   「5」と「人」のあいだに何か挟めるなら、記事のこういう箇所に一致してしまう:
//
//       ...（参考文献5）、著者7人...
//              ↑ ↑↑↑↑ ↑
//              5 ）、著者 人      ← **これで「5人」が記事に在ることになる**
//
//   実際に、**訂正前の「著者7人中5人」を、この関門は通した。**
//   **守るつもりだった間違い、そのものを通した。**
//
//   だから、くっついている場合しか認めない。
//   「7人のうち6人」は 7人 と 6人 の2つに分かれるので、これで拾える。
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function corpusHas(rawHay, token) {
  // ★★ 干し草の側も、必ず正規化する。**片側だけ正規化すると、永久に一致しない。**
  //
  //   2026-07-14、これで正しい診断項目を3件、誤って止めた:
  //     ・こちらは「.051」を「0.051」に直してから探す
  //     ・材料（論文）は欧米誌の標準表記「**P = .051**」で書かれている
  //     → **先頭の 0 が無いので、literal 検索が永久に外れる**
  //   カンマも同じ。記事と図では外していたが、**論文カードと台帳では外していなかった。**
  const hay = normalize(rawHay);

  if (!token.includes(SEP)) {
    // p値。**演算子まで一致すること**（p=0.001 と p<0.001 は、別の主張）
    // ただし先頭の 0 は有っても無くてもよい（P = .051 と p=0.051 は、同じ主張）
    const m = token.match(/^p([=<>])0?\.(.+)$/);
    if (!m) return false;
    const ops = { '=': '[=＝]', '<': '[<＜]', '>': '[>＞]' }[m[1]];
    return new RegExp(`p\\s*${ops}\\s*0?\\.${escape(m[2])}`, 'i').test(hay);
  }
  const [num, unit] = token.split(SEP);
  return new RegExp(`${escape(num)}\\s*${escape(unit)}`).test(hay);
}

// 人に見せるときは、区切りを外して元の見た目に戻す（「903人」「p=0.013」）
const label = (token) => token.split(SEP).join('');

// ---- 記事（＋その記事が埋め込んでいる図）を、1本ずつ束ねる -------------------

export function loadCorpus() {
  const figs = existsSync(join(ROOT, 'site', 'figures.json'))
    ? JSON.parse(readFileSync(join(ROOT, 'site', 'figures.json'), 'utf8')).figures
    : {};

  const papers = existsSync(join(ROOT, 'site', 'papers.json'))
    ? readFileSync(join(ROOT, 'site', 'papers.json'), 'utf8')
    : '';

  const dir = join(ROOT, 'articles');
  const corpus = {};

  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const slug = f.replace(/\.md$/, '');
    const md = readFileSync(join(dir, f), 'utf8');

    // ★ 記事が埋め込んでいる図の中身も、その記事の一部として数える。
    //   **文章から消して図に移した数値**が、ここで拾えなくなると、
    //   「記事に無い数字」と誤判定して、正しい投稿を止めてしまう。
    const ids = [...md.matchAll(/^::figure:([\w-]+)::/gm)].map((m) => m[1]);
    const figText = ids.map((id) => (figs[id] ? JSON.stringify(figs[id]) : '')).join(' ');

    corpus[slug] = normalize(md + ' ' + figText);
  }

  // ★★ 台帳（papers.json）は、照合先に**入れない**。
  //
  //   最初、全記事の照合先に台帳を足していた。**それが骨抜きだった。**
  //   台帳は全論文の数字を持つ。「5人」も「7人」も、どこかに必ずある。
  //   だから、どんな数字を書いても「記事に在る」と判定されてしまう。
  //
  //   **投稿の数値は、記事本文（と、その記事が載せている図）に在るべきもの。**
  //   台帳にしか無い数字を投稿するなら、それは記事に書かれていない数字。出してはいけない。
  corpus['__papers__'] = '';

  return corpus;
}

// ---- 「この文が書いている数値のうち、この記事に無いもの」を返す ----------------
//
// ★ X の投稿にも、診断（claims.json）にも、同じ照合が要る。
//   **同じロジックを2箇所に書かない**（CLAUDE.md）。ここ1つだけに置く。
export function missingNumbers(articleText, text) {
  if (!articleText) return [];
  return extractNumbers(text)
    .filter((t) => !corpusHas(articleText, t))
    .map(label);
}

// ---- 1つの投稿を調べる ------------------------------------------------

export function checkPost(text, corpus) {
  const tokens = extractNumbers(text);
  if (!tokens.length) return { ok: true, tokens: [] };

  // ★ どれか1本の記事に、**投稿の数値が全部そろっている**こと。
  //   （記事をまたいで数字を寄せ集めた投稿は、出所が追えない）
  const slugs = Object.keys(corpus).filter((s) => s !== '__papers__');

  let best = null;
  for (const slug of slugs) {
    const hay = corpus[slug];
    const missing = tokens.filter((t) => !corpusHas(hay, t));
    if (!best || missing.length < best.missing.length) best = { slug, missing };
    if (missing.length === 0) return { ok: true, slug, tokens };
  }

  // ★ 「いちばん近い記事」は、あくまで手がかり。**それが正しい記事とは限らない。**
  //   （実際、無関係な記事が「いちばん近い」と出て、本当の問題の数値ではなく
  //     別の数値を報告した。**それを見た者は、間違った側を直しかねない。**）
  //   だから、投稿が主張している数値を**全部**見せる。人が突き合わせられるように。
  return {
    ok: false,
    tokens: tokens.map(label),
    slug: best?.slug ?? null,
    missing: (best?.missing ?? tokens).map(label),
  };
}

// ---- 単体で動かしたとき ------------------------------------------------

const isMain = process.argv[1] && process.argv[1].endsWith('x-numbers.mjs');

if (isMain) {
  const queue = JSON.parse(readFileSync(join(ROOT, 'x', 'queue.json'), 'utf8'));
  const wantPosted = process.argv.includes('--posted');
  const targets = queue.posts.filter(
    (p) => p.status === 'pending' || (wantPosted && p.status === 'posted')
  );

  const corpus = loadCorpus();
  const bad = [];

  for (const p of targets) {
    const r = checkPost(p.text ?? '', corpus);
    if (!r.ok) bad.push({ p, r });
  }

  console.log(`${targets.length} 件を調べました（記事 ${Object.keys(corpus).length - 1} 本と突き合わせ）`);
  console.log('');

  if (!bad.length) {
    console.log('  投稿に書かれた数値は、全部、記事に実在します');
    process.exit(0);
  }

  console.log('==========================================');
  console.log(`★★ 記事に無い数値を書いた投稿が ${bad.length} 件あります`);
  console.log('==========================================');
  console.log('');
  for (const { p, r } of bad) {
    console.log(`  #${p.id} (${p.at})  [${p.status}]`);
    console.log(`    いちばん近い記事: ${r.slug}`);
    console.log(`    ★ その記事に無い数値: ${r.missing.join(' / ')}`);
    console.log(`    ${(p.text ?? '').split('\n')[0]}`);
    console.log('');
  }
  process.exit(1);
}
