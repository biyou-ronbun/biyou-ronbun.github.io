// ---------------------------------------------------------------
//  メンバーシップの文面が、壊れていないかを見る
//
//    node auto/membership-gates.mjs
//
//  auto/membership.ps1 が、作業の**前と後**に呼びます。
//  作業のあとで壊れていたら、その変更は git で元に戻されます。
//
//  ---------------------------------------------------------------
//  ★ なぜ、これが要るのか
//
//    「メンバーを増やせ」と毎週命じられた機械は、必ずこうします。
//
//      ・限定コンテンツを作る（「メンバーだけが読めます」）
//      ・渡せないものを約束する（「メールでお届けします」）
//      ・数字を捏造する（「500人が支援しています」）
//      ・煽る（「今だけ」「残りわずか」）
//
//    **どれもメンバーを増やします。そして、どれもこのブログを殺します。**
//
//  ★★ 特に「限定」が危ない
//
//    うちのメンバーページには、こう書いてあります。
//
//      「このページに、鍵のかかった情報はありません。
//        記事も、コードも、すべて GitHub で公開しています。
//        あなたが払っているのは、隠された情報へのアクセス権ではありません。」
//
//    **機械がこれを「もったいない」と思った瞬間、終わります。**
//    **隠していないものを『限定』と呼んで売った時点で、このブログを読む理由が消えます。**
//
//  ★ 一度、実際に壊れました
//
//    旧プランは「記事にならなかった論文のメモが**届きます**」と書いていました。
//    **届ける手段がありませんでした。** メールを送る仕組みが無いからです。
//    **続かない約束を収益の入口に置いた時点で、このブログの唯一の武器が壊れます。**
// ---------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = join(ROOT, 'site');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

// ★ 説明文（`_` で始まる欄）を、検査から外す。
//
//   config.json には「『メールで届きます』は書かないこと」という**警告**が書いてあります。
//   それを違反として拾っていました。
//   **関門が、自分の説明書を違反と判定するのは、間違いです。**
//
//   （試験を書いたら、試験の前から2件「壊れて」いました。壊れていたのは関門のほうでした）
const stripDocs = (json) => {
  try {
    const o = JSON.parse(json);
    const walk = (v) => {
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === 'object') {
        const out = {};
        for (const [k, val] of Object.entries(v)) {
          if (k.startsWith('_')) continue; // 説明文は見ない
          out[k] = walk(val);
        }
        return out;
      }
      return v;
    };
    return JSON.stringify(walk(o));
  } catch {
    return json;
  }
};

// コード中のコメントも、検査から外す（同じ理由）
const stripComments = (js) => js.replace(/^\s*\/\/.*$/gm, '');

// メンバーシップに関わる文面
const FILES = {
  'templates/membership.html': read(join(SITE, 'templates', 'membership.html')),
  'templates/tokushoho.html': read(join(SITE, 'templates', 'tokushoho.html')),
  'config.json': stripDocs(read(join(SITE, 'config.json'))),
  'build.mjs（メンバーのページ）': stripComments(read(join(SITE, 'build.mjs'))),
};

// 「必ず残っていること」の検査は、コメントを外す前の本文で見る
const RAW = {
  'templates/membership.html': read(join(SITE, 'templates', 'membership.html')),
  'build.mjs（メンバーのページ）': read(join(SITE, 'build.mjs')),
};

const failures = [];

// ---- ① 渡せないものを約束していないか --------------------------------
//
// ★ 書けるのは、**機械が自動で渡せるものだけ。**
//   「メールで届きます」「質問に優先的に答えます」——どちらも人間の手作業で、続かない。
//   **続かない約束をした時点で、このブログは終わる。**

const CANNOT_DELIVER = [
  'メールでお届け', 'メールで届き', 'メールでお送り', 'メールで送り',
  'メールマガジン', 'ニュースレター',
  '優先的に回答', '優先的にお答え', '優先回答', '質問に優先',
  '個別に対応', '個別にお答え', '個別相談',
  '毎月お届け', '毎週お届け',
];

// ---- ② 「限定」と言っていないか ---------------------------------------
//
// ★★ うちのメンバーページには「鍵のかかった情報はありません」と書いてある。
//   隠していないものを「限定」と呼んで売った瞬間、このブログを読む理由が消える。

const FAKE_EXCLUSIVITY = [
  'メンバー限定', '会員限定', '限定公開', '限定記事', '限定コンテンツ',
  'ここでしか読めない', 'メンバーだけが読める', '会員だけが読める',
  '非公開の', '独占', 'クローズド',
];

// ---- ③ 煽っていないか -------------------------------------------------
const URGENCY = [
  '今だけ', '期間限定', '残りわずか', '先着', '締切', '今すぐ',
  'お早めに', 'この機会に', 'チャンス', '見逃さないで',
];

// ---- ④ 支援者の数を捏造していないか -----------------------------------
//
// ★ 「500人が支援しています」——**実測でない数字を、絶対に書かない。**
//   CLAUDE.md ルール4。数字は実測値だけ。取得できないなら「取得失敗」と書く。

const SOCIAL_PROOF = /(\d+)\s*(人|名)\s*(が|の)\s*(支援|参加|購読|メンバー|応援)/;

// ---- ⑤ 「隠していません」の一文が、消されていないか ---------------------
//
// ★★ これが**この検査でいちばん大事**です。
//
//   機械は、この一文を「もったいない」と思います。
//   **「鍵のかかった情報はありません」と正直に書いたら、誰も払わないのでは?——**
//   そう考えた瞬間、この一文を消したくなります。
//
//   **消させません。**
//
//   （The Derm Review は開示している。それでも信頼されていない。
//     開示がフッタにあり、判断が本文にあるから。**開示は、集計を救わない**）

const MUST_KEEP = [
  { file: 'templates/membership.html', text: '鍵のかかった情報はありません' },
  { file: 'templates/membership.html', text: 'メールは送りません' },
  { file: 'build.mjs（メンバーのページ）', text: '鍵のかかった情報はありません' },
];

// ---- 検査 -------------------------------------------------------------

for (const [name, text] of Object.entries(FILES)) {
  if (!text) continue;

  for (const w of CANNOT_DELIVER) {
    if (text.includes(w)) {
      failures.push(
        `${name}: 渡せないものを約束しています「${w}」\n` +
          `      **書けるのは、機械が自動で渡せるものだけです。**\n` +
          `      メールを送る仕組みは、ありません。人間の手作業は、続きません。\n` +
          `      **続かない約束を収益の入口に置いた時点で、このブログの唯一の武器が壊れます。**\n` +
          `      （一度、実際にこれをやりました。旧プランは「メモが届きます」と書いていました）`
      );
    }
  }

  for (const w of FAKE_EXCLUSIVITY) {
    if (text.includes(w)) {
      failures.push(
        `${name}: 「限定」と言っています「${w}」\n` +
          `      **うちのメンバーページには「鍵のかかった情報はありません」と書いてあります。**\n` +
          `      記事も、検証メモも、コードも、すべて GitHub で公開しています。\n` +
          `      **隠していないものを「限定」と呼んで売った瞬間、このブログを読む理由が消えます。**`
      );
    }
  }

  for (const w of URGENCY) {
    if (text.includes(w)) {
      failures.push(
        `${name}: 煽っています「${w}」\n` +
          `      「今だけ」「残りわずか」——**これは判断を急がせる技術です。**\n` +
          `      うちが読者に渡したいのは、**急がずに自分で確かめる目**です。`
      );
    }
  }

  const m = text.match(SOCIAL_PROOF);
  if (m) {
    failures.push(
      `${name}: 支援者の数を書いています「${m[0]}」\n` +
        `      **これは実測値ですか。** Stripe の API から取った数字ですか。\n` +
        `      違うなら、書いてはいけません（CLAUDE.md ルール4）。\n` +
        `      **「0人だった」と「数えられなかった」は、別の事実です。**`
    );
  }
}

for (const { file, text } of MUST_KEEP) {
  if (RAW[file] && !RAW[file].includes(text)) {
    failures.push(
      `${file}: 「${text}」の一文が消えています\n` +
        `\n` +
        `      **★ 機械は、この一文を「もったいない」と思います。**\n` +
        `      「鍵のかかった情報はありません」と正直に書いたら、誰も払わないのでは——\n` +
        `      そう考えた瞬間、消したくなります。\n` +
        `\n` +
        `      **消させません。**\n` +
        `      隠していないものを「限定」と呼んで売った時点で、このブログは終わります。`
    );
  }
}

// ---- 結果 -------------------------------------------------------------

console.log('');
console.log('メンバーシップの文面');
console.log('='.repeat(46));

if (failures.length) {
  console.error('');
  failures.forEach((f) => console.error(`  ✗ ${f}\n`));
  console.error('='.repeat(46));
  console.error(`  ${failures.length} 件、壊れています。`);
  console.error('='.repeat(46));
  console.error('');
  console.error('  「メンバーを増やせ」と命じられた機械は、必ずここに手を伸ばします。');
  console.error('  限定コンテンツを作る。渡せないものを約束する。数字を捏造する。煽る。');
  console.error('  **どれもメンバーを増やします。そして、どれもこのブログを殺します。**');
  console.error('');
  process.exit(1);
}

console.log('  渡せないものを約束していない');
console.log('  「限定」と言っていない');
console.log('  煽っていない');
console.log('  支援者の数を捏造していない');
console.log('  「鍵のかかった情報はありません」が、消されていない');
console.log('');
console.log('  健全です。');
console.log('');
