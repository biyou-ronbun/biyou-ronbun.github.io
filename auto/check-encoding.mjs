// ---------------------------------------------------------------
//  .ps1 の文字コードを点検する
//
//      node auto/check-encoding.mjs        （点検するだけ）
//      node auto/check-encoding.mjs --fix  （BOM を付けて直す）
//
//  ---------------------------------------------------------------
//  ★ なぜこれが要るのか（2026-07-14 に、実際に踏んだ）
//
//    タスクを登録しようとしたら、スクリプトが動かなかった。
//
//        + ... Description '莉悶Γ繝・ぅ繧｢繧堤皮ｩｶ縺励?..
//        The string is missing the terminator: '.
//
//    **Windows PowerShell 5.1 は、BOM の無い UTF-8 を Shift-JIS として読む。**
//    日本語が化け、化けたバイト列の中に ' が現れて、文字列が閉じられなくなる。
//
//    エディタも git も、この違いを見せてくれない。**動かして初めて分かる。**
//
//  ★ そして、これは必ず再発する
//
//    Claude が書くファイルには、BOM が付かない。
//    **次に .ps1 を1本足したとき、また同じところで止まる。**
//
//    そのときログに出るのは文字化けなので、**原因に辿り着くのに時間がかかる。**
//
//  ★ 日本語を含まない .ps1 は、BOM が無くても動く。それは見逃す。
//    「BOM が無いこと」ではなく「**壊れること**」を捕まえる。
// ---------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FIX = process.argv.includes('--fix');

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

// .ps1 は auto/ 以外にも置ける（site/build.ps1 など）
const dirs = ['auto', 'site'];
const files = [];
for (const d of dirs) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    if (f.endsWith('.ps1')) files.push(path.join(d, f));
  }
}

const broken = [];

for (const rel of files) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  const hasBom = buf.subarray(0, 3).equals(BOM);
  const hasJa = /[^\x00-\x7f]/.test(buf.toString('utf8'));

  // 日本語が無ければ、BOM が無くても PowerShell は正しく読む
  if (!hasJa || hasBom) continue;

  broken.push(rel);

  if (FIX) {
    fs.writeFileSync(path.join(ROOT, rel), Buffer.concat([BOM, buf]));
  }
}

console.log(`.ps1 を ${files.length} 本、点検しました`);

if (broken.length === 0) {
  console.log('  全部 BOM 付きです（PowerShell 5.1 が正しく読めます）');
  process.exit(0);
}

if (FIX) {
  console.log('');
  console.log(`★ ${broken.length} 本に BOM を付けました:`);
  for (const f of broken) console.log(`    ${f}`);
  console.log('');
  console.log('  ★ 直したら、実際に動かして確かめること。');
  process.exit(0);
}

console.log('');
console.log('==========================================');
console.log('★★ BOM の無い .ps1 があります。**これは動きません。**');
console.log('==========================================');
console.log('');
for (const f of broken) console.log(`    ${f}`);
console.log('');
console.log('  Windows PowerShell 5.1 は、BOM の無い UTF-8 を **Shift-JIS として読みます。**');
console.log('  日本語が化け、化けたバイト列の中に \' が現れて、文字列が閉じられなくなります。');
console.log('');
console.log('  実際に出るエラー:');
console.log('      The string is missing the terminator: \'.');
console.log('');
console.log('  直すには:');
console.log('      node auto/check-encoding.mjs --fix');
console.log('');
process.exit(1);
