# テーマ: 「飲む日焼け止め」は、塗るのの代わりになるのか

調査日: 2026-07-13
調査担当: researcher（自動運転）

一次情報の取得方法: `node site/pubmed.mjs search/get`（PubMed 公式API）。
Nutroxsun の論文（PMID 27374032）のみ、PMC で全文（PMC4931025）を開いて資金提供の記述を確認した。

## 結論（ライター向けサマリ）

一言で: **効果はゼロではない。複数の独立した試験で「日焼けし始める紫外線の量（MED）」が
2〜3割上がることが再現している。しかし「塗るものの代わりになる」と書いた論文は、
売っている側の研究も含めて、1本も見つからなかった。** 論文の結論は、企業資金のものでさえ
揃って「adjunct（塗るものの補助）」である。

### 言い切っていいこと

- 経口摂取で MED（最小紅斑量＝肌が赤くなり始める紫外線の量）が上がった、という報告は
  複数ある。**企業と無関係なデンマークの大学病院の試験でも再現している**（PL 480mg/日・30日で
  UVB の MED +29%、UVA の MED +26%）。
- 報告された上がり幅は **+8.1% 〜 +29.8%**（近年の試験）。
- **そのデンマークの独立試験では、赤み（MED）は動いたが、DNA 損傷の指標（チミンダイマー）は
  皮膚でも尿でも動かなかった**（UVB 試験・UVA 試験の両方で）。著者自身が「この不一致を今後
  調べるべきだ」と書いている。
- 日本の「飲む日焼け止め」の中核成分ニュートロックスサン（ローズマリー＋シトラス）の主要試験
  （PMID 27374032）は、**成分メーカー Monteloeder S.L. と Nutrafur S.A. が資金を出し、
  Monteloeder は試験プロトコルの設計にも関与している**（全文の funding 節に明記。一次情報で確認）。
- 総説（PMID 38845468）は「systemic photoprotection should be used as an **adjunctive** measure to
  topical photoprotection」と書いている。企業資金の RCT（PMID 40218997）の結論も
  「as an **adjunct** to topical photoprotection」。**売る側も「代わりになる」とは言っていない。**

### 言い切ってはいけないこと

- **「効かない」「意味がない」とは書けない。** MED の上昇は独立試験でも再現している。
- **「SPF◯相当」と書けない。** 経口摂取の効果を SPF に換算した論文を探したが、見つからなかった
  （検索は30件返るが、上位20件はいずれも塗る日焼け止めの処方・総説・リップのSPFなどで、
  経口サプリを SPF 換算したものではなかった。30件すべては見ていない）。
- **長期のかたい結果（年単位でシワ・皮膚がんを見た試験）は見つからなかった。** 測られているのは
  ほぼすべて短期の代理指標（MED、赤み、DNA マーカー）。塗る日焼け止めには 903人・4.5年の RCT
  （PMID 23732711、SPF15+）があるのと対照的。
- **1997年の試験（PMID 9361129, n=21）は MED 2.8倍**という桁違いの数字を報告しているが、
  近年の試験（+2〜3割）と大きく食い違う。この数字を単独で使わないこと。
- 安全性の結論を出さない。試験は n=21〜110、期間は30日〜12週の小規模・短期。

### 記事にするときの注意

- **健康食品。** 「飲めば日焼けしない」「シミを防ぐ」は書いた時点で薬機法アウト。
  書けるのは「その試験で何が測られ、どう動いたか」まで。**主語は必ず試験参加者。**
- Nutroxsun 試験の「シワの深さ −14.8%」は、**試験の測定結果の報告としてのみ**書く。
  読者の肌に接続しない。
- 参加者はほぼ全員が **Fitzpatrick 肌タイプ I〜III（＝欧州の白人が中心）**。
  日本人の読者にそのまま当てはめられない。アジア人を含む試験は PMID 35684041 の1本のみ。
- **「塗るのをやめていい」とは絶対に書かない。**

---

## 論文1: Changes in ultraviolet B radiation-induced DNA damage and erythema after oral nicotinamide and polypodium leucotomos in healthy volunteers: an intraindividual controlled trial

- **出典**: Faisal A, Philipsen PA, Lerche CM, et al. Photochem Photobiol Sci. 2025;24(11):1951-1958.
- **PMID**: 41182568
- **研究デザイン**: 個体内対照試験（intraindividual controlled trial）。**著者自身が限界として
  「非ランダム化デザイン」と明記している**
- **被験者**: 健康なボランティア47人が完了。**肌タイプ I〜III。デンマーク**（オールボー大学病院・
  コペンハーゲン大学病院ビスペビャウ）。測定部位は皮膚（生検）と尿
- **介入**: ポリポディウム・ロイコトモス（PL）480mg/日、またはニコチンアミド（NAM）2000mg/日を30日間
- **主要な結果**:
  - **PL で MED が +29%（p=0.00018）**。NAM は MED に影響なし（p=0.533）
  - **チミンダイマー（DNA 損傷の指標）は、皮膚生検でも尿でも、どちらの薬剤でも有意に動かなかった**
- **限界**: 著者記載——非ランダム化、および太陽光の全 UV スペクトルを覆わない狭帯域光源を使用
- **COI**: **著者9名全員が「利益相反なし」と申告。所属はすべて大学病院・大学**（企業所属なし）。
  資金提供の記載なし
- **確認範囲**: アブストラクト（＋ COI 全文を API で確認）

> **引用に使える一文**: 企業と無関係な大学病院の試験でも、赤くなり始める紫外線の量は29%増えた。
> だが DNA の傷は減らなかった。著者は「この不一致を今後調べるべきだ」と書いている。

---

## 論文2: Changes in ultraviolet A radiation-induced thymidine dimers and erythema after oral nicotinamide or polypodium leucotomos extract in healthy volunteers: a randomized intraindividual trial

- **出典**: Faisal A, Philipsen PA, Lerche CM, et al. Photochem Photobiol Sci. 2026;25(5):845-852.
- **PMID**: 41838346
- **研究デザイン**: ランダム化個体内試験（randomized intraindividual trial）
- **被験者**: 健康なボランティア50人。**肌タイプ I〜III。デンマーク**（論文1と同じ研究グループ）
- **介入**: NAM 2000mg/日 または PL（Heliocare Advanced）480mg/日を30日間、1:1 にランダム化。UVA を照射
- **主要な結果**:
  - **NAM・PL とも MED が +26%**（NAM: 27.7→34.8 J/cm², p=0.0008 / PL: 27.7→34.8 J/cm², p=0.0002）
  - **チミンダイマーは、皮膚（NAM p=0.15 / PL p=0.15）でも尿（p=0.89 / p=0.30）でも動かなかった**
- **限界**: 著者記載——照射期間中は NAM・PL を投与しておらず、照射後の効果の評価が限られる
- **COI**: **著者全員が「利益相反なし」と申告**。所属は大学病院・大学。資金提供の記載なし
- **確認範囲**: アブストラクト（＋ COI 全文を API で確認）

> **引用に使える一文**: UVA でも同じことが起きた。赤みは26%ぶん減ったのに、DNA の傷は動かなかった。

---

## 論文3: Skin photoprotective and antiageing effects of a combination of rosemary (Rosmarinus officinalis) and grapefruit (Citrus paradisi) polyphenols ★ 日本の「飲む日焼け止め」の中核成分

- **出典**: Nobile V, Michelotti A, Cestone E, et al. Food Nutr Res. 2016;60:31871.
- **PMID**: 27374032 ／ **URL**: https://pmc.ncbi.nlm.nih.gov/articles/PMC4931025/
- **研究デザイン**: 単施設・ランダム化・並行群間（長期試験）。**プラセボ対照・盲検**
  （全文より:「Subjects, investigator and collaborators were kept masked to products assignment.
  The active and the placebo products were in capsule form and identical in appearance.」）
- **被験者**: **女性90人・平均約52歳・イタリア。肌タイプ I〜III（うち約60%がタイプIII）**
- **介入**: Nutroxsun™（ローズマリー＋グレープフルーツのポリフェノール）100mg または 250mg、2か月
- **主要な結果**（全文で確認）:
  - **MED +29.8%（100mg）／ +26.9%（250mg）**（2か月時点）
  - **目尻のシワの深さ −14.8%（100mg, p=0.0000）／ −13.9%（250mg）**
  - 弾力 R2 +4.6%、R5 +9.0%（100mg）
  - 100mg と 250mg で差がなく、100mg で頭打ち（プラトー）
- **限界**: 白人女性のみ・平均52歳。測定は短期（2か月）。長期のかたい結果は見ていない
- **COI / 資金**: ★ **全文の funding 節に明記——「This study was funded by Monteloeder S.L. and
  Nutrafur S.A. **Monteloeder was involved in the design of the study protocol** and provided the
  test products samples.」** Monteloeder S.L. は Nutroxsun の製造元。
  **さらに著者の所属も企業**: Caturla N = Monteloeder S.L.、Castillo J・Benavente-García O =
  Nutrafur S.A.（Frutarom Group）、Nobile V・Michelotti A・Cestone E = Complife Group（受託試験会社）
- **確認範囲**: **全文（PMC4931025）**

> **引用に使える一文**: 日本の飲む日焼け止めの多くが中核成分にしているニュートロックスサン。
> その主要試験は、成分メーカーが資金を出し、**試験の設計にも関与していた**。

---

## 論文4: Effects of Eight-Week Supplementation Containing Red Orange and Polypodium leucotomos Extracts on UVB-Induced Skin Responses: A Randomized Double-Blind Placebo-Controlled Trial

- **出典**: Keršmanc P, Pogačnik T, Žmitek J, et al. Nutrients. 2025;17(7).
- **PMID**: 40218997
- **研究デザイン**: ランダム化・二重盲検・プラセボ対照試験（このテーマで最も設計が固い部類）
- **被験者**: **色白の参加者54人（各群27人）。肌タイプ I〜III。スロベニア**
- **介入**: PLE ＋ レッドオレンジ抽出物 ＋ ビタミン A・C・D・E を含むシロップを8週間
- **主要な結果**:
  - **MED +23.8%**（0.447 → 0.553 J/cm², p<0.05）※有意になったのは8週時点。2週時点では有意差なし
  - 赤みの強さ −46.2%（p<0.0001）
  - **色素沈着（ΔMI）はプラセボ群と差がなかった**
- **限界**: 8週間・54人。色白の参加者のみ
- **COI / 資金**: ★ **企業資金。**「this study received funding from **Tosla d.o.o.**」（資金提供者は
  試験設計・解析・執筆・公表の判断に関与していないと申告）。資金提供欄はスロベニア研究革新庁と
  Tosla d.o.o. の併記
- **確認範囲**: アブストラクト（＋ COI・資金提供欄を API で確認）

> **引用に使える一文**: 企業が資金を出したこの試験ですら、結論は
> 「supports oral supplementation **as an adjunct to topical photoprotection**」——
> **塗るものの「補助」である、と書いてある。**

---

## 論文5: Prospective Evaluation of the Efficacy of a Food Supplement in Increasing Photoprotection and Improving Selective Markers Related to Skin Photo-Ageing

- **出典**: Granger C, Aladrén S, Delgado J, Garre A, Trullas C, Gilaberte Y. Dermatol Ther (Heidelb).
  2020;10(1):163-178.
- **PMID**: 31797305
- **研究デザイン**: ★ **非盲検（open）・単施設・前向き。対照群なし・プラセボなし**
- **被験者**: 30人（女性27人・男性3人）。肌タイプ I〜III。12週間
- **介入**: ビタミン A・C・D3・E、セレン、リコピン、ルテイン、緑茶・ポリポディウム・ブドウ抽出物の
  複合サプリ
- **主要な結果**: **MED +8.1%（84日, p<0.001）**。FRAP +22.7%、MDA −6.4%
- **限界**: **対照群がない。**「ベースラインと比べて上がった」しか言えない設計
- **COI**: ★ **著者6名のうち5名が ISDIN 社員**（Granger, Aladrén, Delgado, Garre, Trullas）。
  ISDIN は日焼け止め・皮膚科向け製品の企業
- **確認範囲**: アブストラクト（＋ COI 全文を API で確認）

> **引用に使える一文**: 「経口 と 外用の比較」で検索して唯一返ってきた試験がこれ。だがこれは
> 比較試験ではない。**対照群のない、企業社員による30人の非盲検試験**だった。

---

## 論文6: The Utility of Oral Polypodium Leucotomos Extract for Dermatologic Diseases: A Systematic Review ★ 総説

- **出典**: Zundell MP, Katz A, Shah M, Burshtein J, Rigel D, Zakria D. J Drugs Dermatol.
  2025;24(4):346-351.
- **PMID**: 40196953
- **研究デザイン**: システマティックレビュー（AHRQ・PRISMA に準拠と記載）
- **対象**: 152件中21件が組入れ基準を満たす。**うち RCT は11件**。
  内訳は 光老化/皮膚がん9件、日光角化症3件、光線過敏症3件、肝斑2件、白斑3件、アトピー性皮膚炎1件
- **結論（原文）**: 「PLE exhibits strong therapeutic potential with an encouraging safety profile.
  ... underscoring its potential as an **adjuvant therapy**」
- **COI / 資金**: PubMed の記録に記載なし（**未確認**）。本文が有料のため一次情報で確認できていない
- **確認範囲**: アブストラクトのみ確認

---

## 論文7: Sunproofing from within: A deep dive into oral photoprotection strategies in dermatology ★ 総説

- **出典**: Hartmann D, Valenzuela F. Photodermatol Photoimmunol Photomed. 2024;40(4):e12985.
- **PMID**: 38845468
- **研究デザイン**: 総説（review）
- **結論（原文）**: 「Current evidence indicates that systemic photoprotection should be used as an
  **adjunctive measure to topical photoprotection**.」
- **COI / 資金**: PubMed の記録に記載なし（**未確認**）。著者所属に Probity Medical Research
  （受託試験機関）を含む
- **確認範囲**: アブストラクトのみ確認

---

## 論文8: Topical or oral administration with an extract of Polypodium leucotomos prevents acute sunburn and psoralen-induced phototoxic reactions as well as depletion of Langerhans cells in human skin

- **出典**: González S, Pathak MA, Cuevas J, Villarrubia VG, Fitzpatrick TB.
  Photodermatol Photoimmunol Photomed. 1997;13(1-2):50-60.
- **PMID**: 9361129
- **研究デザイン**: 臨床試験（PubMed の種別は Randomized Controlled Trial）
- **被験者**: 健康なボランティア21人（一部はソラレン投与下）
- **主要な結果**: **経口投与後、MED が 2.8 ± 0.59 倍に増加**（p<0.001）
- **限界**: ★ **この 2.8倍 は、近年の試験の +2〜3割と桁が違う。** n=21、1997年、太陽光曝露。
  **単独で使わないこと**
- **COI**: 記載なし（未確認）
- **確認範囲**: アブストラクトのみ確認

---

## 論文9: Photoprotective and Antiaging Effects of a Standardized Red Orange (Citrus sinensis (L.) Osbeck) Extract in Asian and Caucasian Subjects: A Randomized, Double-Blind, Controlled Study

- **出典**: Nobile V, Burioli A, Yu S, et al. Nutrients. 2022;14(11).
- **PMID**: 35684041
- **研究デザイン**: ランダム化・二重盲検・対照試験
- **被験者**: ★ **アジア人と白人 計110人**（このテーマで、アジア人を含む数少ない試験）
- **介入**: レッドオレンジ抽出物 100mg/日、56日間
- **主要な結果**: MED の改善、UVA 誘発の脂質過酸化の低下、保湿・弾力・シワの深さの改善を報告。
  **具体的な数値はアブストラクトに記載がないため、ここには書かない**
- **COI**: 著者 V.Z. が **Bionap srl の社員**。他の著者は利益相反なしと申告
- **確認範囲**: アブストラクトのみ確認（数値は未確認）

---

## 探して、見つからなかったもの（`site/searches.json` に機械が記録済み）

| 探したもの | 検索式 | 件数 | 中身 |
|---|---|---|---|
| 経口 と 外用 を比べた試験 | oral supplement AND topical sunscreen AND (compared OR comparison OR versus) AND (erythema OR "sun protection factor") | **1件** | その1件（PMID 31797305）は比較試験ではなく、対照群のない非盲検30人試験（著者の5/6が ISDIN 社員） |
| 経口の効果を SPF に換算した論文 | (oral OR systemic OR dietary) AND (photoprotection OR photoprotective) AND ("sun protection factor" OR "SPF equivalent") | 30件 | 上位20件を確認。塗る日焼け止めの処方・総説・リップの SPF などで、**経口サプリを SPF 換算したものは無し**。30件すべては見ていない |
| 年単位でシワ・皮膚がんを見た経口試験 | ("Polypodium leucotomos" OR "oral photoprotection" OR "systemic photoprotection") AND (wrinkle OR wrinkles OR photoaging OR photoageing OR "skin cancer") AND ("randomized controlled trial"[pt]) | 5件 | 30日の MED/DNA 試験、56日のレッドオレンジ試験、UVA の「コモン欠失」を見たレター、1997年の急性日焼け試験、そして日光角化症の患者34人（平均75.7歳）に光線力学療法の**補助**として使った6か月試験。**健康な人を年単位で追ってシワ・皮膚がんを見た試験は、この5件の中に無かった** |

★ 比較のため: 塗る日焼け止めには **903人・4.5年のランダム化比較試験**（PMID 23732711、使われたのは
SPF15+）がある。飲むほうには、これに相当する試験が見つからない。
