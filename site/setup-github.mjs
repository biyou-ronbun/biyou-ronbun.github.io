// ---------------------------------------------------------------
//  GitHub に置いて、自動公開を有効にする（最初の1回だけ実行）
//
//    node site/setup-github.mjs
//
//  やること:
//    1. GitHub にログインする（ブラウザが開きます）
//    2. リポジトリを作って、push する
//    3. 公開URLを config.json に書き込んで、もう一度 push する
//
//  2回目以降は不要です。以降は「git push するだけ」で自動公開されます。
// ---------------------------------------------------------------

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SITE);

const REPO_NAME = process.argv[2] || 'beauty-evidence-blog';

// 対話が必要なコマンド（ログインなど）は、そのまま画面に出す
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, shell: false });
  if (r.status !== 0) {
    console.error(`\n失敗しました: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
};

// 出力を受け取りたいコマンド
const capture = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();

const isOk = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'ignore' }).status === 0;

console.log('');
console.log('=== 1. GitHub にログインします ===');

if (isOk('gh', ['auth', 'status'])) {
  console.log('ログイン済みです。');
} else {
  console.log('ブラウザが開きます。GitHub アカウントでログインしてください。');
  console.log('（アカウントが無ければ、その場で無料で作れます）');
  console.log('');
  console.log('聞かれたら、こう答えてください:');
  console.log('  What account do you want to log into?  -> GitHub.com');
  console.log('  What is your preferred protocol?       -> HTTPS');
  console.log('  Authenticate Git with your credentials? -> Yes');
  console.log('  How would you like to authenticate?     -> Login with a web browser');
  console.log('');
  run('gh', ['auth', 'login']);
}

const owner = capture('gh', ['api', 'user', '--jq', '.login']);
console.log(`ログイン中のアカウント: ${owner}`);

console.log('');
console.log(`=== 2. リポジトリ ${owner}/${REPO_NAME} を作って push します ===`);

if (isOk('gh', ['repo', 'view', `${owner}/${REPO_NAME}`])) {
  console.log('すでに存在します。push だけします。');
  if (!isOk('git', ['remote', 'get-url', 'origin'])) {
    run('git', ['remote', 'add', 'origin', `https://github.com/${owner}/${REPO_NAME}.git`]);
  }
  run('git', ['push', '-u', 'origin', 'main']);
} else {
  // public にする理由: GitHub Pages を無料で使うため。
  // 見せたくないもの（ops/ x/ output/）は .gitignore で除外済み。
  run('gh', ['repo', 'create', REPO_NAME, '--public', '--source=.', '--remote=origin', '--push']);
}

console.log('');
console.log('=== 3. 公開URLを設定に書き込みます ===');

const pageUrl = `https://${owner}.github.io/${REPO_NAME}`;
const cfgPath = join(SITE, 'config.json');
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

if (cfg.baseUrl !== pageUrl) {
  cfg.baseUrl = pageUrl;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  run('git', ['add', 'site/config.json']);
  run('git', ['commit', '-m', `公開URLを ${pageUrl} に設定`]);
  run('git', ['push']);
  console.log(`baseUrl を ${pageUrl} にしました。`);
} else {
  console.log('すでに設定済みです。');
}

console.log('');
console.log('----------------------------------------------------------');
console.log('完了しました。');
console.log('');
console.log(`  サイト:   ${pageUrl}/`);
console.log(`  ビルド状況: https://github.com/${owner}/${REPO_NAME}/actions`);
console.log('');
console.log('初回の公開には 1〜2分かかります。');
console.log('上の Actions のページで、緑のチェックがつけば公開完了です。');
console.log('');
console.log('次からは、記事を書いたあとに次の3行を実行するだけです:');
console.log('');
console.log('  git add -A');
console.log('  git commit -m "記事を追加"');
console.log('  git push');
console.log('');
console.log('push すれば、GitHub が勝手にビルドして、勝手に公開します。');
console.log('----------------------------------------------------------');
