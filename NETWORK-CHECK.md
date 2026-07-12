# クラウド環境のネットワーク診断

実行日時: Sun Jul 12 07:27:07 UTC 2026

| 調べたこと | 結果 |
|---|---|
| node site/pubmed.mjs check | 失敗：`NG: PubMed に到達できません。HTTP 403 — https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=29949889`（exit code 1） |
| PubMed API (eutils) への curl | 到達不可（`000`、curl exit code 56）。verbose では、プロキシへの CONNECT トンネル自体が `HTTP/1.1 403 Forbidden` で拒否されている |
| PubMed のページへの curl | 到達不可（`000`、curl exit code 56） |
| example.com への curl | 到達不可（`000`、curl exit code 56）。verbose でも同様にプロキシの CONNECT トンネルが `403 Forbidden` |

## 結論

この環境からは外部ネットワークに一切出られず（PubMed も example.com も同じ理由で遮断されている）、論文の一次情報を直接 curl / fetch で取得することはできない。

## 補足：原因

`curl -v` で見ると、リクエストは `https_proxy=http://127.0.0.1:46065`（`/root/.ccr/README.md` に記載のエージェントプロキシ）を経由しており、宛先ホストへの `CONNECT` トンネル要求そのものがプロキシ側から `403 Forbidden` で拒否されている（DNS失敗やタイムアウトではない）。つまり curl や Node のネットワークコードの問題ではなく、プロキシのポリシーで `eutils.ncbi.nlm.nih.gov` を含む一般の外部ホストへの接続が許可されていない状態。`no_proxy` に列挙されているホスト（`anthropic.com`、`registry.npmjs.org`、`pypi.org` など特定ドメインのみ）以外は原則遮断されているとみられる。

## 生の出力

### `node site/pubmed.mjs check`
```
NG: PubMed に到達できません。
    HTTP 403 — https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=29949889

  この状態では論文を確認できません。
  検索結果のスニペットだけで論文カードを書くのは捏造です。
  記事を書かずに、この事実を報告して終了してください。
(exit code 1)
```

### `curl -s -o /dev/null -w '%{http_code}' https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=29949889`
```
000
(exit code 56)
```

verbose (`curl -v`):
```
* Uses proxy env variable https_proxy == 'http://127.0.0.1:46065'
*   Trying 127.0.0.1:46065...
* Connected to 127.0.0.1 (127.0.0.1) port 46065
* CONNECT tunnel: HTTP/1.1 negotiated
* allocate connect buffer
* Establish HTTP proxy tunnel to eutils.ncbi.nlm.nih.gov:443
> CONNECT eutils.ncbi.nlm.nih.gov:443 HTTP/1.1
> Host: eutils.ncbi.nlm.nih.gov:443
> User-Agent: curl/8.5.0
> Proxy-Connection: Keep-Alive
>
< HTTP/1.1 403 Forbidden
< Content-Length: 36
<
* CONNECT tunnel failed, response 403
* Closing connection
```

### `curl -s -o /dev/null -w '%{http_code}' https://pubmed.ncbi.nlm.nih.gov/29949889/`
```
000
(exit code 56)
```

### `curl -s -o /dev/null -w '%{http_code}' https://example.com`
```
000
(exit code 56)
```

verbose (`curl -v`):
```
* Uses proxy env variable https_proxy == 'http://127.0.0.1:46065'
*   Trying 127.0.0.1:46065...
* Connected to 127.0.0.1 (127.0.0.1) port 46065
* CONNECT tunnel: HTTP/1.1 negotiated
* allocate connect buffer
* Establish HTTP proxy tunnel to example.com:443
> CONNECT example.com:443 HTTP/1.1
> Host: example.com:443
> User-Agent: curl/8.5.0
> Proxy-Connection: Keep-Alive
>
< HTTP/1.1 403 Forbidden
< Content-Length: 36
<
* CONNECT tunnel failed, response 403
* Closing connection
```
