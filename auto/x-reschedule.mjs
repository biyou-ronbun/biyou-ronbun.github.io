// ---------------------------------------------------------------
//  X の投稿予定を、組み直す
//
//    node auto/x-reschedule.mjs --dry    どうなるかを見るだけ
//    node auto/x-reschedule.mjs          実際に組み直す
//
//  未投稿の投稿を、下の時間帯に詰め直します。投稿済みには触りません。
//
//  ★ スレッド（連投）の続きは、親と同じ時刻のままにします。
//    post-x.mjs が、親を出した直後に続けて出すからです。
//    ここで別々の時刻に散らすと、連投がバラバラに出ます。
// ---------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const QUEUE = join(ROOT, 'x', 'queue.json');

const DRY = process.argv.includes('--dry');

// 1日に出す時刻。読者は20〜40代の女性。
//   07:40 … 通勤・支度の時間
//   12:15 … 昼休みの入り
//   15:00 … 午後の中だるみ
//   18:30 … 帰宅の移動中
//   21:00 … 夜のいちばん見られる時間
//   22:45 … 寝る前
const SLOTS = ['07:40', '12:15', '15:00', '18:30', '21:00', '22:45'];

const queue = JSON.parse(readFileSync(QUEUE, 'utf8'));

const isChild = (p) => Boolean(p.replyToLocalId);
const pending = queue.posts.filter((p) => p.status === 'pending');
const roots = pending.filter((p) => !isChild(p)).sort((a, b) => (a.at < b.at ? -1 : 1));

// 明日から詰める（今日ぶんは、すでに出た/出る予定のものがあるので触らない）
const start = new Date();
start.setDate(start.getDate() + 1);

const at = (dayOffset, slotIndex) => {
  const d = new Date(start);
  d.setDate(d.getDate() + dayOffset);
  return `${d.toISOString().slice(0, 10)}T${SLOTS[slotIndex]}:00`;
};

const changes = [];

roots.forEach((p, i) => {
  const day = Math.floor(i / SLOTS.length);
  const slot = i % SLOTS.length;
  const next = at(day, slot);

  if (p.at !== next) changes.push({ id: p.id, from: p.at, to: next });
  p.at = next;

  // スレッドの続きを、親に揃える
  let cur = p;
  for (let n = 0; n < 12; n++) {
    const c = queue.posts.find((x) => x.status === 'pending' && x.replyToLocalId === cur.id);
    if (!c) break;
    c.at = next;
    cur = c;
  }
});

const days = Math.ceil(roots.length / SLOTS.length);

console.log('');
console.log(`未投稿の独立した投稿: ${roots.length} 件`);
console.log(`1日 ${SLOTS.length} 本（${SLOTS.join(' / ')}）で組み直します`);
console.log(`→ ${days} 日ぶん（${at(0, 0).slice(0, 10)} 〜 ${at(days - 1, 0).slice(0, 10)}）`);
console.log('');

const byDay = {};
for (const p of roots) (byDay[p.at.slice(0, 10)] ??= []).push(p.at.slice(11, 16));
for (const d of Object.keys(byDay).sort().slice(0, 5)) {
  console.log(`  ${d}  ${byDay[d].length}本  ${byDay[d].join(' ')}`);
}
if (Object.keys(byDay).length > 5) console.log(`  ...（ほか ${Object.keys(byDay).length - 5} 日）`);
console.log('');

if (DRY) {
  console.log('--dry なので、書き込みませんでした');
  process.exit(0);
}

writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + '\n', 'utf8');
console.log(`x/queue.json を書き換えました（${changes.length} 件の時刻を変更）`);
