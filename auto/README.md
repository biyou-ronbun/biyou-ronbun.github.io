# 自動運転

人間が見ていない時間に動くものは、全部ここにあります。

## 全体像

```
月・水・金 09:00  auto/run.ps1          記事を1本作って公開する
                    ├ 1. 記事      claude ← auto/prompt.md
                    ├ 2. 画像      site/ogp.ps1, site/xcards.ps1
                    ├ 3. ネタ補充  残り3件以下なら claude ← auto/replenish-prompt.md
                    └ 4. 次の巻    8本溜まったら claude ← auto/book-prompt.md

1時間おき        auto/post-x.ps1       x/queue.json の予定時刻を過ぎた投稿を出す

月曜 08:00       auto/metrics.ps1      PV・収益を公式APIから取って ops/auto-metrics.md に書く
```

ログは `auto/logs/`（git 管理外）。

## この機械が止まる条件

**自動運転で一番怖いのは「止まったことに気づかない」ことです。** 止まる条件を、先に書いておきます。

| 止まるもの | 条件 | 防いでいるもの |
|---|---|---|
| 記事の生成 | `topics.json` の `queued` が 0 になる | **ネタの自動補充**（残り3件で発動） |
| 記事の生成 | ネタに論文が1本も無く、書けない | 補充のときに **PubMed で実在を確認**してから入れる |
| 記事の公開 | 論文の捏造・薬機法違反 | `site/verify.mjs`（GitHub Actions の関門）。**これは止まって正解です** |
| X の投稿 | `x/queue.json` が壊れる / `pending` が 0 になる | `run.ps1` が毎回 JSON を検証してログに書く |
| 次の巻 | 前の巻が `draft` のまま溜まる | 未提出の巻があるうちは、次の巻を作らない |
| 数値の取得 | APIキーが無い・失効した | **0 と書かずに「取得失敗」と書く**（`CLAUDE.md` ルール4） |

## 人間しかできないこと

**ここを自動化する方法はありません。** 忘れると、収益は永久にゼロのままです。

| やること | いつ | なぜ機械にできないか |
|---|---|---|
| **Kindle に原稿をアップロードする** | 原稿ができたら（1冊30分） | **KDP に個人向けの出版APIがありません** |
| **`site/books.json` の `amazonUrl` を入れる** | 発売されたら | 入れるまで、サイトに本は出ません |
| **Stripe の支払いリンクを `config.json` に入れる** | 審査が通ったら | 入れるまで、メンバーシップの導線は出ません |
| **AdSense のカテゴリをブロックしてから `showAdUnits: true`** | 審査が通ったら | **順番を逆にすると、検証した業界の広告が検証記事の横に出ます** |
| **X に投稿する鍵を `auto/.env` に入れる** | 最初の1回 | — |

> **この4つの「出口」が閉じているあいだ、記事を何本自動生成しても、収益は 0 円です。**
> 自動化されているのは**生産**であって、**換金**ではありません。

## 鍵（`auto/.env`）

**リポジトリは public です。`auto/.env` は `.gitignore` 済み。絶対に git に入れないこと。**

```
# X（投稿用）
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=

# Cloudflare Web Analytics（PVの取得用）
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_SITE_TAG=

# Stripe（収益の取得用。読み取り専用の制限付きキーで足ります）
STRIPE_SECRET_KEY=
```

数値の取得（`collect-metrics.mjs`）は、**鍵が無ければ何もせずに終わります。** エラーにはしません。

## 手で試す

```powershell
node auto/next-volume.mjs           # 次の巻を出せるか見るだけ（何も作らない）
node auto/post-x.mjs --dry          # X に何を投げるか見るだけ（投稿しない）
node auto/collect-metrics.mjs --dry # 何を取ってくるか見るだけ（ファイルを書かない）
node site/book.mjs vol1             # 巻を指定して EPUB を作り直す

powershell -ExecutionPolicy Bypass -File auto/run.ps1   # 本番と同じもの（記事が1本、本当に公開されます）
```
