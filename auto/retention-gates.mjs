// ---------------------------------------------------------------
//  「リピーターを増やせ」と命じられた機械が、やってはいけないこと
//
//    node auto/retention-gates.mjs
//
//  auto/retention.ps1 が、作業の前と後に呼びます。
//
//  ---------------------------------------------------------------
//  ★★ この輪が、いちばん暴走しやすい
//
//    「リピーターを増やすコンテンツを毎週作れ」と命じられた機械は、必ずこうします。
//
//      ・2個目の診断・クイズを作る
//      ・ゲーミフィケーション（ポイント・バッジ・レベル・連続記録）
//      ・通知をねだる（「通知を許可してください」）
//      ・煽る（「毎日更新中!」「見逃さないで」）
//
//    **全部、却下済みです。**
//
//  ★ 調査の結論（商品を勧めない媒体を4つ、実際に開いて調べた）
//
//    **再訪の理由が、コンテンツの中にあった例はゼロ。**
//    観測できたのは ①配信（push） ②読者自身の次の疑問 の2つだけ。
//
//    > **「読者が喜ぶページを1枚足す」は、再訪の打ち手ではありません。**
//
//  ★★ そして、クイズ・診断の2個目は明確に禁止された
//
//    > **読者を採点した瞬間、うちのサイトは「騙されてましたね」に変わります。**
//    > 既存の check.html が採点していないのは正解であって、偶然にしないほうがいい。
//
//  ★ うちは再訪を測れません
//
//    解析は Cookie を使いません（同意バナーを出さないため）。
//    **Cookie が無ければ、同じ人が戻ってきたことは分かりません。**
//    **測れない数字を改善目標にすると、機械は必ず数字を捏造します。**
//
//    だから、目標は「再訪」ではなく「配信の購読者数」（測れる）。
// ---------------------------------------------------------------

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = join(ROOT, 'site');
const TPL = join(SITE, 'templates');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const stripComments = (s) => s.replace(/^\s*(\/\/|#).*$/gm, '');

const failures = [];

// ---- ① 診断・クイズの2個目を作っていないか ------------------------------
//
// ★ うちには既に /check.html（診断）がある。**2個目を作らない。**
//   再訪の分かれ目は「入力（問題）が来るたび変わるか」の1点だけ。
//   うちの診断は入力が変わらない。**一度やったら終わる。2個目も同じ。**

{
  const templates = existsSync(TPL) ? readdirSync(TPL) : [];
  const quizLike = templates.filter(
    (f) => /quiz|shindan|diagnos|test|score/i.test(f) && f !== 'check.html'
  );
  if (quizLike.length) {
    failures.push(
      `診断・クイズの2個目を作っています: ${quizLike.join(', ')}\n` +
        `      **うちには既に /check.html があります。2個目を作らないこと。**\n` +
        `      再訪の分かれ目は「入力（問題）が来るたび変わるか」の1点だけです。\n` +
        `      うちの診断は入力が変わりません。**一度やったら終わります。2個目も同じです。**`
    );
  }
}

// ---- ② ゲーミフィケーションを作っていないか -----------------------------
//
// ★ ポイント・バッジ・レベル・連続記録——**読者を採点する装置です。**
//   採点した瞬間、うちのサイトは「騙されてましたね」に変わります。

const GAMIFICATION = [
  'ポイント', 'バッジ', 'レベル', 'ランク', 'スコア',
  '連続', 'ストリーク', '達成率', '進捗',
  'あなたの正解率', '何問正解', '点満点', 'ランキング',
];

// ---- ③ 通知をねだっていないか -----------------------------------------
// ★ 「お知らせを受け取る」は外した。
//   プライバシーポリシーに「**お知らせを受け取るかどうかを選んでもらう形にします**」
//   と書いてある。**同意を取ると約束している文**を、違反として拾っていた。
//   （3度目。関門は、自分の善行を違反と判定しがち）
const NOTIFICATION = ['通知を許可', 'プッシュ通知', '通知をオン', '通知をONに'];

// ---- ④ 煽っていないか -------------------------------------------------
const URGENCY = [
  '毎日更新中', '見逃さないで', '今すぐチェック', 'お見逃しなく',
  'また来てください', '毎日来て', 'ブックマーク推奨',
];

// ---- ⑤ 購読者の数を捏造していないか -----------------------------------
//
// ★ X も note も はてな も、購読者は 0 です。
//   **「◯人が読んでいます」と書いた瞬間、それは捏造です。**
const FAKE_COUNT = /(\d[\d,]*)\s*(人|名)\s*(が|の)\s*(読者|購読|フォロー|愛読)/;

const FILES = {};
if (existsSync(TPL)) {
  for (const f of readdirSync(TPL)) FILES[`templates/${f}`] = read(join(TPL, f));
}
FILES['build.mjs'] = stripComments(read(join(SITE, 'build.mjs')));

// ★ 「持ちません」「作りません」と**否定している文**を、違反として拾わないこと。
//
//   membership.html には、こう書いてあります。
//     「スコアも、ランキングも、認証マークも持ちません」
//
//   **これは「持たない」という宣言です。それを違反として拾うのは、間違いです。**
//   （2度目です。前にも、関門が自分の説明書を違反と判定しました）
//
//   その語のうしろ40字以内に「持ちません」「作りません」等が来ていれば、否定とみなします。

const DENIAL = [
  '持ちません', '持たない', '作りません', '作らない', '持ちません',
  'ありません', 'ない', '使いません', '出しません', '与えません',
  'つけません', '書きません', 'しません',
];

const isDenied = (text, word) => {
  let i = -1;
  while ((i = text.indexOf(word, i + 1)) >= 0) {
    const after = text.slice(i + word.length, i + word.length + 40);
    if (!DENIAL.some((d) => after.includes(d))) return false; // 1つでも言い切っていれば駄目
  }
  return true;
};

for (const [name, text] of Object.entries(FILES)) {
  if (!text) continue;

  // check.html（既存の診断）だけは、採点していないことを別途確認する
  const isCheck = name.endsWith('check.html');

  for (const w of GAMIFICATION) {
    if (text.includes(w) && !isDenied(text, w)) {
      failures.push(
        `${name}: ゲーミフィケーション「${w}」\n` +
          `      ポイント・バッジ・レベル・連続記録——**これは読者を採点する装置です。**\n` +
          `      **読者を採点した瞬間、うちのサイトは「騙されてましたね」に変わります。**\n` +
          `      既存の診断が採点していないのは正解であって、偶然にしないこと。`
      );
    }
  }

  for (const w of NOTIFICATION) {
    if (text.includes(w)) {
      failures.push(
        `${name}: 通知をねだっています「${w}」\n` +
          `      うちは読者を追跡しません。通知は、追跡の入口です。`
      );
    }
  }

  for (const w of URGENCY) {
    if (text.includes(w)) {
      failures.push(
        `${name}: 煽っています「${w}」\n` +
          `      「また来てください」と言って人は来ません。**来る理由を作るしかありません。**\n` +
          `      そして調査の結論は「再訪はコンテンツでは作れない。作れるのは配信だけ」でした。`
      );
    }
  }

  const m = text.match(FAKE_COUNT);
  if (m && !isCheck) {
    failures.push(
      `${name}: 購読者の数を書いています「${m[0]}」\n` +
        `      **これは実測値ですか。** X も note も はてな も、購読者は 0 です。\n` +
        `      **「0人だった」と「数えられなかった」は、別の事実です**（CLAUDE.md ルール4）。`
    );
  }
}

// ---- 結果 -------------------------------------------------------------

console.log('');
console.log('リピーターの輪');
console.log('='.repeat(46));

if (failures.length) {
  console.error('');
  failures.forEach((f) => console.error(`  ✗ ${f}\n`));
  console.error('='.repeat(46));
  console.error(`  ${failures.length} 件、越えています。`);
  console.error('='.repeat(46));
  console.error('');
  console.error('  「リピーターを増やせ」と命じられた機械は、必ずここに手を伸ばします。');
  console.error('  2個目の診断を作る。ポイントを配る。通知をねだる。煽る。');
  console.error('');
  console.error('  **調査の結論: 再訪の理由が、コンテンツの中にあった例はゼロ。**');
  console.error('  **作れるのは配信（push）だけ。ページを1枚足しても、誰も戻ってきません。**');
  console.error('');
  process.exit(1);
}

console.log('  診断・クイズの2個目を作っていない');
console.log('  ゲーミフィケーションを作っていない');
console.log('  通知をねだっていない');
console.log('  煽っていない');
console.log('  購読者の数を捏造していない');
console.log('');
console.log('  健全です。');
console.log('');
