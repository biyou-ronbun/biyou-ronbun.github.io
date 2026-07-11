# サイトの使い方

`articles/*.md` から、サイトを丸ごと自動生成します。
**GitHub に push すれば、勝手にビルドされて勝手に公開されます。**

---

## 最初の1回だけ（セットアップ）

```powershell
node site\setup-github.mjs
```

これだけです。ブラウザが開くので GitHub にログインしてください（アカウントが無ければ、その場で無料で作れます）。

スクリプトが、リポジトリの作成 → push → 公開URLの設定まで、全部やります。
1〜2分後に `https://<あなたのID>.github.io/beauty-evidence-blog/` でサイトが見られます。

> リポジトリ名を変えたいときは `node site\setup-github.mjs 好きな名前` のように渡してください。

---

## 記事を公開する（毎回やること）

### 1. 記事の Markdown を置く

`articles\<スラッグ>.md`。いつもどおり writer が作ってくれるものです。

### 2. `site\articles.json` に1ブロック足す

```json
{
  "slug": "turnover-28days",
  "title": "「肌のターンオーバー28日周期」の出典はどこにあるのか",
  "subtitle": "美容界で最も引用される数字を、遡ってみる",
  "date": "2026-07-20",
  "category": "習慣",
  "summary": "トップページのカードに出る、2〜3行の要約。",
  "published": true
}
```

### 3. push する

```powershell
git add -A
git commit -m "記事を追加"
git push
```

**これで終わりです。** GitHub が勝手にビルドして、勝手に公開します。
トップページ・記事ページ・RSS・サイトマップが全部更新されます。

進み具合は GitHub の **Actions** タブで見られます。緑のチェックがつけば公開完了です。

---

## articles.json の各項目

| 項目 | 意味 |
|---|---|
| `slug` | `articles\<slug>.md` と一致させること。URLにもなります |
| `title` / `subtitle` | 記事ページとトップページに出ます |
| `category` | カードに出るタグ。`塗る` / `飲む` / `習慣` など自由 |
| `date` | `YYYY-MM-DD`。並び順と RSS の日付になります |
| `summary` | トップページのカードと、検索結果・SNSに出る説明文 |
| `published` | **`false` にすると、書けているのに公開されません** |

**`published: false` は「週2本ずつ出す」運用のための機能です。**
記事は全部書き上げておいて、出す分だけ `true` にする。在庫を持ちながら、公開ペースをコントロールできます。

---

## 公開せずに手元で確認したいとき

```powershell
node site\build.mjs
```

`site\dist\index.html` をブラウザで開けば、公開後とまったく同じものが見られます。
（`powershell -ExecutionPolicy Bypass -File site\build.ps1` でも同じです。中身は同じスクリプトを呼んでいるだけです）

---

## 見た目を変える

| 変えたいもの | 触るファイル |
|---|---|
| サイト名、キャッチコピー、免責文 | `site\config.json` |
| 色、文字サイズ、余白 | `site\assets\style.css`（先頭の `:root` の色だけ変えても雰囲気が変わります） |
| ページの構造、ヘッダー、フッター | `site\templates\*.html` |
| 「このブログについて」の文章 | `site\templates\about.html` |

変えたら push するだけで反映されます。ダークモードは読者のOS設定に自動で追従します。

---

## 独自ドメインを使いたくなったら

1. ドメインを買う（年1,000〜2,000円ほど）
2. GitHub のリポジトリ → Settings → Pages → Custom domain に入力
3. `site\config.json` の `baseUrl` を新しいURLに書き換えて push

SSL（https）は GitHub が無料で自動設定します。

---

## 注意

- **`site\dist\` は毎回まるごと作り直されます。** ここを直接編集しても次のビルドで消えます。
  編集するのは `articles\`、`site\config.json`、`site\templates\`、`site\assets\` です。
- **リポジトリは public（誰でも見られる）です。** GitHub Pages を無料で使うためです。
  経営の内部情報（`ops\`、`x\`、`output\`）は `.gitignore` で公開対象から外してあります。
  記事と論文カードはあえて公開しています。「本当に論文に当たっている」ことの証明になるからです。
- **`.gitignore` は行末コメントを解釈しません。** `ops/  # ネタ帳` と書くと1行まるごとがパターン扱いになり、
  除外が効きません。コメントは必ず独立した行に書いてください（一度これで事故りました）。
