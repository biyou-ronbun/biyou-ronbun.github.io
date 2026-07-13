# テーマ: 肌質を判定する質問票は、実在するのか。使えるのか

調査日: 2026-07-13
調査担当: researcher

## 結論（ライター向けサマリ）

一言で: **「質問票で肌質を判定する」ことは学術的に行われているが、質問票が測っているのは「あなたが自分の肌をどう感じているか」であって、「機械で測った肌の状態」とは弱くしか一致しない。** そして、いちばん有名な肌質診断（Baumann）は、質問項目そのものが公開されていない。

### 言い切っていいこと

- **敏感肌の質問票は実在し、検証されている。** Sensitive Scale-10（SS-10）は11か国・2,966人で作られ（Misery 2014, PMID 24710717）、その後160人でカットオフ12.7が提案された（Legeas 2021, PMID 33426565）。**10項目が何を尋ねているかは公開されている**（顔に感じる10の徴候を0〜10で自己評価）。
- **敏感肌は、日本人でも多数派の自覚である。** 日本の全国標本の電話調査で、「やや敏感」または「非常に敏感」と答えたのは女性の 55.98%、男性の 52.84%（Kamide 2013, PMID 23253054）。
- **脂性・敏感を組み合わせた質問票も出ている。** 中国 1,297人で作られ、乳酸スティンギングテストと皮脂量でカットオフを検証した（Zhang 2024, PMID 38326964）。
- **「質問票で出した肌質」と「機械で測った肌」は、弱くしか一致しない。** 数字は下の「論文6・論文7」に。相関係数は r=0.24〜0.30 程度（脂性/乾燥 と 皮脂量）。**r=0.3 は、ばらつきの1割弱しか説明できない。**
- **Fitzpatrick（肌のタイプI〜VI）は、もともと日焼けの反応を見るためのものである。** 原典の目的は「光線療法で皮膚が焼ける傾向を評価すること」（Ware 2020, PMID 32186531 のアブストラクト冒頭にそう書いてある）。**肌質（脂性・乾燥・敏感）の分類器ではない。**

### 言い切ってはいけないこと

- **「質問に答えれば、あなたの肌質が分かります」とは言えない。** 分かるのは自己申告の傾向であって、皮脂量でも水分量でもない。
- **Baumann の16タイプ診断は、うちでは使えない。** 質問項目が論文に載っていない（後述）。
- **SS-10 で「敏感肌かどうか」を確定診断することはできない。** カットオフ12.7の感度は 72.4%（＝敏感肌の人の約4分の1を取りこぼす）。
- **Fitzpatrick を「肌質診断」として使ってはいけない。** 目的外使用であり、本人申告と医師判定がずれることも報告されている（Bhanot 2024, PMID 39759256）。
- 質問票のカットオフはすべて**その研究の集団のもの**。日本人一般に、そのまま当てはまる保証はない。

### 記事にするときの注意

- 「診断」「判定」という語を避ける。**質問票は診断器具ではなく、自覚の記述**。
- 薬機法以前の問題として、**うちがスコアや判定を持った瞬間、それは資産になり換金圧力を持つ**（CLAUDE.md）。質問票を「入口」に使うのは構わないが、**採点しない・タイプ名を与えない**。
- 「敏感肌の人は◯%」と書くときは、**「自分でそう感じている人が◯%」**と書く。Kamide 2013 は自己申告の調査。

---

## ★ 都合の悪い発見（他が書かない）

### ① Baumann の質問票（BSTI / BSTQ）は、項目が公開されていない

3本の検証論文を開いたが、**どれも質問項目そのものを載せていない。**

- インドネシア語版の検証（PLoS One 2026, PMID 41926383）は**オープンアクセスなのに項目を載せず**、こう書いている:
  > "Permission to translate the questionnaires was obtained from Dr. Leslie Baumann, the original author."
  （＝翻訳するのに原著者の許可が要る）
- ポーランド語版（PMID 40521065）も、構成（4軸）は書くが項目は載せない。
- 韓国のBSTQ最適化研究（PMID 37313638）も、各軸の設問数（6問・9問・7問・11問）は書くが、設問文は載せない。

**→ うちは BSTI を使えない。** 項目が読めない以上、「実在する質問票を使っています」と言えないし、勝手に作れば、それは検証されていない自作アルゴリズムになる。

### ② 「質問票の肌質」と「機械の肌」は、ほとんど一致しない

BSTQ の生体計測による検証（Skin Res Technol 2026, PMID 41972945、n=71）の結論より:

> "The oily vs. dry (O/D) score showed a poor but significant correlation with sebum, while hydration and TEWL were not significant."

脂性/乾燥スコア と 皮脂量: **r = 0.299**（p=0.011）。**水分量と TEWL は有意ですらない。**
韓国の研究（PMID 37313638、BSTQ vs デジタル肌解析）でも、O-D と皮脂の相関は **r = 0.232**。

**世の中の「肌質診断」は、この数字の上に立っている。**

### ③ Fitzpatrick は、肌質の分類器ではない

Ware 2020（Cutis, PMID 32186531）のアブストラクト冒頭、そのまま:

> "Fitzpatrick skin type (FST) was developed to assess the propensity of the skin to burn during phototherapy, but it also is commonly used by providers as means of describing constitutive skin color and ethnicity."

**光線療法で焼けるかどうかを見るために作られた。** 人種・肌色の記述に流用され、さらに美容では「肌質」に流用されている。**二重の目的外使用。**

---

## 論文1: A new ten-item questionnaire for assessing sensitive skin: the Sensitive Scale-10

- **出典**: Misery L, Jean-Decoster C, Mery S, Georgescu V, Sibaud V. Acta Derm Venereol. 2014;94(6):635-9.
- **PMID / DOI**: 24710717 / 10.2340/00015555-1870
- **URL**: https://pubmed.ncbi.nlm.nih.gov/24710717/
- **研究デザイン**: 質問票の開発・妥当性検証（横断調査＋クリーム試験による反応性の確認）
- **被験者**: 11か国・複数言語で 2,966人
- **内容**: 14項目版と10項目版。10項目版が「短く答えやすい」として採用された
- **主要な結果**: 高い内的整合性。乾燥肌・高齢・女性・色白のスキンタイプ・QOL低下と相関。「The mean initial scores were around 44/140 and 37/100.」
- **限界**: 参照基準は「本人の自己申告」。機械測定との照合はこの論文では確認できない
- **COI**: PubMed 上は "Research Support, Non-U.S. Gov't"。具体的な資金提供元は**確認できず**（著者に L'Oréal / Pierre Fabre 系の所属者が含まれるが、この論文の記載としては確認できていないので断定しない）
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: 敏感肌を測る10項目の尺度は、11か国2,966人で作られている。

---

## 論文2: Proposal for Cut-off Scores for Sensitive Skin on Sensitive Scale-10 in a Group of Adult Women

- **出典**: Legeas C, Misery L, Fluhr JW, Roudot AC, Ficheux AS, Brenaut E. Acta Derm Venereol. 2021;101(1):adv00373.
- **PMID / DOI**: 33426565 / 10.2340/00015555-3741
- **URL**: https://pmc.ncbi.nlm.nih.gov/articles/PMC9309873/（PMC全文）
- **研究デザイン**: 横断研究（カットオフ値の設定）
- **被験者**: 成人女性 160人、18〜65歳
- **参照基準**: 「非常に敏感／敏感」と自己申告した人を敏感肌陽性とした（n=87、55%）。**機械測定は使っていない**
- **主要な結果**: カットオフ **12.7** で、感度 72.4%、特異度 90.3%。敏感肌群の症状は skin irritability (100%)、tautness (97.5%)、discomfort (90%)、redness (90%)
- **★ 質問項目（この論文に書かれていた記述、そのまま）**:
  > "SS-10 was used to evaluate 10 signs felt on the face within the last 3 days (skin irritability, stinging, burning, sensations of heat, tautness, itching, pain, skin discomfort, flushes, redness) on a scale from 0 (no intensity) to 10 (unbearable intensity)."

  → 日本語にすると「この3日間に顔に感じた10の徴候（ヒリつきやすさ／チクチク感／灼熱感／熱感／つっぱり感／かゆみ／痛み／不快感／ほてり／赤み）を、0＝まったくない 〜 10＝耐えられない で評価」。
  **ただし、原論文の設問文（一字一句の言い回し）までは確認できていない。**確認できたのは「何を尋ねているか」まで。
- **限界**: 参照基準が自己申告なので、「自己申告を、自己申告で予測している」構造になっている。著者も適用範囲の限界に言及
- **COI**: "The authors have no conflicts of interest to declare."（資金提供元の記載は確認できず）
- **確認範囲**: **PMC全文を確認**（項目の記述を含む）

> **引用に使える一文**: SS-10 が尋ねているのは「この3日間、顔に何を感じたか」であって、肌の状態そのものではない。

---

## 論文3: Development and validation of a prospective questionnaire for assessing oily sensitive skin

- **出典**: Zhang J, Zhou Y, Zhou F, Li X, Lu Y, Wu F, Han Y, Liu Q, Chang S, Zhu W, Li B, Pan Y. Int J Cosmet Sci. 2024;46(5):657-667.
- **PMID / DOI**: 38326964 / 10.1111/ics.12946
- **URL**: https://pubmed.ncbi.nlm.nih.gov/38326964/（本文は有料。HTTP 402）
- **研究デザイン**: 質問票の開発・検証（ROC解析）
- **被験者**: 1,297人（中国。年齢・性別の内訳は本文にあり、未確認）
- **検証方法**: 乳酸スティンギングテスト（LAST）と非侵襲機器測定を参照
- **主要な結果**: カットオフは、敏感さで 11.5 / 20.5 / 29.5（軽度・中等度・重度）、脂性で 22.5 / 31.5（中等度・重度）。「significant correlations between measured parameters and skin characteristics」とあるが、**相関係数そのものはアブストラクトに書かれていない**
- **★ 質問項目**: **未確認（本文が有料のため読めない）。項目が公開されているかどうか、確認できていない**
- **限界**: 中国人集団のみ。カットオフは集団依存。相関の強さが不明
- **COI**: 所属に **Shanghai Junyu Biotechnology Group** と **Beijing EWISH Testing Technology Co., Ltd.**（企業）が含まれる。資金提供の明文はPubMed上で確認できず。**企業の関与あり、として扱う**
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: 脂性＋敏感の質問票は1,297人で作られ、乳酸スティンギングテストと皮脂測定で検証されている。ただし項目そのものは有料の壁の向こうにある。

---

## 論文4: Proposal of a self-assessment questionnaire for the diagnosis of sensitive skin

- **出典**: Corazza M, Guarneri F, Montesi L, Toni G, Donelli I, Borghi A. J Cosmet Dermatol. 2022;21(6):2488-2496.
- **PMID / DOI**: 34553479 / 10.1111/jocd.14425
- **URL**: https://pubmed.ncbi.nlm.nih.gov/34553479/
- **研究デザイン**: 観察・横断研究
- **被験者**: 162人（LAST陽性＝「患者」102人、陰性＝「対照」60人）。イタリア（フェラーラ大学・メッシーナ大学）
- **参照基準**: **乳酸スティンギングテスト（LAST）**。★ この論文は、機械／誘発試験を基準にしている点で SS-10 より一段強い
- **内容**: 自己評価パート（0〜10）＋ **10項目**（それぞれ「刺激になりうる特定の要因」を尋ねる）
- **主要な結果**: 質問票スコアは患者群で有意に高く、カットオフ **3** で **正診率 79%**
- **★ 質問項目**: **未確認**。「10項目それぞれが specific, potentially triggering stimulus を指す」とあるが、**その10個が何かはアブストラクトに書かれていない**（本文未確認）
- **限界**: 横断研究。LAST自体が主観評価に依存する（下記レビュー参照）
- **COI**: "The authors report no conflict of interest in this work."（**大学のみ。企業資金は見当たらない**）
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: 乳酸を塗ってヒリつくかどうかを基準にすると、質問票の正診率は79%だった。裏を返せば、5人に1人は外れる。

---

## 論文5: Sensitive skin evaluation in the Japanese population

- **出典**: Kamide R, Misery L, Perez-Cullell N, Sibaud V, Taïeb C. J Dermatol. 2013;40(3):177-81.
- **PMID / DOI**: 23253054 / 10.1111/1346-8138.12027
- **URL**: https://pubmed.ncbi.nlm.nih.gov/23253054/
- **研究デザイン**: 全国標本の電話調査（クオータ法）
- **被験者**: 18歳以上の日本人の全国代表標本（**正確な n はアブストラクトから確認できず**）
- **主要な結果**: 「やや敏感」または「非常に敏感」と答えたのは、**女性 55.98%、男性 52.84%**
- **限界**: 完全な自己申告。診察も機械測定もない。2013年のデータ
- **COI**: 記載を確認できず（著者に Pierre Fabre 関係者が含まれる可能性があるが、この論文の記載としては未確認）
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: 日本では、女性の約56%が「自分の肌は敏感だ」と答える。半分以上が敏感肌なら、それは「肌質」ではなく「自覚」である。

---

## 論文6: Biometric Evaluation of Baumann Skin Typing ★ 都合の悪い論文

- **出典**: Delavar S, Firooz A, Nassiri Kashani M, Ahmad Nasrollahi S, Amiri F, Yazdanparast T. Skin Res Technol. 2026;32(4):e70338.
- **PMID / DOI**: 41972945 / 10.1111/srt.70338
- **URL**: https://pubmed.ncbi.nlm.nih.gov/41972945/
- **研究デザイン**: 横断研究（質問票 vs 生体計測）
- **被験者**: 健常者 71人（イラン・テヘラン医科大学）
- **介入/測定**: Baumann の質問票と、角層水分量・TEWL・メラニン指数・皮脂量・弾力・pH（MPA 580）、超音波、VisioFace を照合
- **主要な結果**（アブストラクトの数値、そのまま）:
  - 脂性/乾燥スコア × 皮脂量: **r = 0.299**（p = 0.011）。**水分量・TEWL とは有意でない**
  - 敏感/耐性スコア × TEWL: r = 0.388（p = 0.001）、× pH: r = 0.445（p < 0.001）
  - 色素/非色素スコア × メラニン指数: **r = 0.280**（p = 0.018）
  - シワ/ハリスコア × 硬さ: r = 0.495、× 総弾力: r = -0.318
  - 著者自身の言葉: "poor but significant correlation"（**弱いが有意**）
- **限界**: n=71、イランの単一施設、健常者のみ
- **COI**: **確認できず**（アブストラクトに記載なし）
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: 著者自身が「弱いが有意な相関」と書いている。「あなたは脂性肌です」と質問票が言うとき、皮脂計との一致は r=0.3 でしかない。

---

## 論文7: Explore highly relevant questions in the Baumann skin type questionnaire through the digital skin analyzer

- **出典**: Cho SI, Kim D, Lee H, Um TT, Kim H. J Cosmet Dermatol. 2023;22(11):3159-3167.
- **PMID / DOI**: 37313638 / 10.1111/jocd.15820
- **URL**: https://pubmed.ncbi.nlm.nih.gov/37313638/
- **研究デザイン**: 単施設・後ろ向き研究（BSTQ改変版 vs デジタル撮影による肌計測）
- **被験者**: アジア人患者（**n はアブストラクトに書かれていない**）
- **主要な結果**（Pearson の相関係数、そのまま）:
  - O-D（脂性/乾燥）× 皮脂: **0.236 / 0.266**（最適化版）vs **0.232**（改変BSTQ）
  - S-R（敏感/耐性）× 赤み: **0.157 / 0.175** vs **0.095**
  - P-N（色素）× メラニン: 0.156 / 0.208 vs 0.150
  - W-T（シワ）× シワ: 0.265 / 0.269 vs 0.217
  - 各軸の設問数: O-D 6問、S-R 9問、P-N 7問、W-T 11問（**設問文は非掲載**）
- **限界**: 後ろ向き。アジア人単施設。著者の3名が **ArtLab Inc.** 所属（肌解析の企業）
- **COI**: **確認できず**（アブストラクトに記載なし）。ただし企業所属者を含む
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: 「敏感肌かどうか」の質問群と、実際の顔の赤みの相関は 0.095〜0.175 だった。ほぼ関係がない、と読める数字である。

---

## 論文8: Validity, reliability, and comparison of the Indonesian version of two Baumann skin type indicator (BSTI) questionnaires ★ 「使えない」ことの証拠

- **出典**: Batubara IS, Sitohang IBS, Widaty S, Nilasari H, Kekalih A, Chairunnisa S. PLoS One. 2026.
- **PMID / DOI**: 41926383 / 10.1371/journal.pone.0343028
- **URL**: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0343028（オープンアクセス全文）
- **研究デザイン**: 翻訳・妥当性検証研究
- **被験者**: 成人 150人（＋予備テスト30人）、ジャカルタ
- **主要な結果**: 2006年版（64問・4軸）と2022年版（7項目）を比較。Cronbach's α は 2006年版で 0.613〜0.718、2022年版で 0.704。**2つの版の一致は ICC = 0.435（95%CI 0.245–0.604）＝中程度どまり**（同じ人が、版によって違う肌質になりうる）
- **★ 質問項目**: **オープンアクセスの全文にも、項目は載っていない。** 構成（64問／7項目）を書くのみ。かわりにこう書いてある:
  > "Permission to translate the questionnaires was obtained from Dr. Leslie Baumann, the original author."
- **限界**（著者の言葉、そのまま）: "A limitation of this study is the lack of cultural validity testing. Indonesia's diverse ethnic groups may differ in perceptions of skin type, yet the sample was limited to Jakarta."
- **COI**: 著者らは "no conflicts of interest" と宣言。ただし **資金は "IBSS has received a research grant from Paragon Technology and Innovation Ltd, Jakarta, Indonesia (Grant No. 0271/SPK/RND/E/X/2023)"（化粧品企業からの研究助成）**
- **確認範囲**: **全文（オープンアクセス）を確認**

> **引用に使える一文**: 世界で最も使われている肌質診断は、翻訳するのに原著者の許可が要る。質問項目は、論文にも載っていない。

---

## 論文9: The validity and practicality of sun-reactive skin types I through VI（Fitzpatrick 原典）

- **出典**: Fitzpatrick TB. Arch Dermatol. 1988;124(6):869-71.
- **PMID / DOI**: 3377516 / 10.1001/archderm.124.6.869
- **URL**: https://pubmed.ncbi.nlm.nih.gov/3377516/
- **確認できたこと**: **PubMed にアブストラクトが無い。** タイトル・著者・掲載誌・年・DOI のみ確認。**内容は未確認**
- **確認範囲**: **書誌情報のみ**（本文・要旨とも未確認）

## 論文10: Racial limitations of Fitzpatrick skin type ★ Fitzpatrick の目的

- **出典**: Ware OR, Dawson JE, Shinohara MM, Taylor SC. Cutis. 2020;105(2):77-80.
- **PMID**: 32186531
- **URL**: https://pubmed.ncbi.nlm.nih.gov/32186531/
- **研究デザイン**: 皮膚科医・研修医への匿名調査
- **★ 主要な記述（アブストラクト、そのまま）**:
  > "Fitzpatrick skin type (FST) was developed to assess the propensity of the skin to burn during phototherapy, but it also is commonly used by providers as means of describing constitutive skin color and ethnicity. ... Although providers should be cognizant of conflating race/ethnicity with FST, the original intent of FST also should be emphasized in medical school and resident education."
- **限界**: 調査対象は医師のみ。n はアブストラクトに記載なし
- **COI**: 記載を確認できず
- **確認範囲**: **アブストラクトのみ確認**

> **引用に使える一文**: Fitzpatrick は「光線療法で肌が焼けるか」を見るために作られた。肌質を分類するためのものではない。

---

## 論文11: Fitzpatrick Skin Type Self Reporting Versus Provider Reporting

- **出典**: Bhanot A, Bassue J, Ademola S, Sallee B, Allen P. J Clin Aesthet Dermatol. 2024 Dec.
- **PMID / PMCID**: 39759256 / PMC11694732
- **URL**: https://pubmed.ncbi.nlm.nih.gov/39759256/
- **研究デザイン**: 単施設・アンケート調査（患者の自己申告 vs 医師の判定）
- **被験者**: オクラホマ大学皮膚科クリニックの患者・医師（**n はアブストラクトから確認できず**）
- **主要な結果**: 医師判定のほうが患者の自己申告より正確だった。**不一致には患者の人種が有意に関与**。経験が長い医師ほど、患者の自己判定と食い違う傾向。著者らは「Fitzpatrick は大幅な改訂か、より信頼できる方法への置き換えが必要」と結論
- **限界**: 単施設。κ 値などの具体的な一致度の数値はアブストラクトに記載なし
- **COI**: "no conflicts of interest"
- **確認範囲**: **アブストラクトのみ確認**

---

## 論文12: Comprehensive Approaches to Diagnosis and Treatment of Sensitive Skin（参考・レビュー）

- **出典**: Kim HO, Um JY, Kim HB, et al. Ann Dermatol. 2025.
- **PMID / PMCID**: 40736518 / PMC12318783
- **URL**: https://pmc.ncbi.nlm.nih.gov/articles/PMC12318783/
- **研究デザイン**: ナラティブレビュー（システマティックレビューではない）
- **★ 主要な記述（本文、そのまま）**:
  > "due to inconsistent results in tests like the Lactic Acid Stinging Test, Sodium Lauryl Sulfate (SLS) Occlusion Test, and Capsaicin Test, SS is recognized as a heterogeneous group with limitations arising from subjective interpretation and result variability."
- **意味**: **敏感肌の「機械側の基準」自体が揺れている。** 質問票が機械と一致しないのは、質問票だけの問題ではない
- **COI**: "The authors have nothing to disclose."。**資金: 韓国国立研究財団（NRF-2022R1A2C2007739）、KHIDI、Hallym大学**（公的資金）
- **確認範囲**: **PMC全文を確認**

---

## 参考: 脂性肌の質問票（未確認・今後の候補）

- **Oily Skin Self Assessment Scale (OSSAS)** — Arbuckle R, et al. Value Health. 2009. PMID 19508666。**未確認**（開いていない）。項目・資金源とも不明。ただしこの種の患者報告アウトカム尺度は製薬・化粧品企業の資金で作られることが多いので、使うなら要確認
- **A preliminary investigation of the impact of oily skin on quality of life and concordance of self-perceived skin oiliness and skin surface lipids (sebum)** — Wu Y, et al. Int J Cosmet Sci. 2013;35(5):442-7. PMID 23651406。北京の健常女性 300人。Sebumeter® で測定。**アブストラクトの記述: "The agreement between self-perceived skin oiliness and measured SSL was moderately strong in younger age groups, and declined with age."（若年層では中程度に一致するが、加齢とともに低下する）**。相関係数は未記載。**アブストラクトのみ確認**

---

## 最終行（依頼どおり）

**うちが作れる10問は、[ SS-10 の10項目——「この3日間に顔に感じた10の徴候（ヒリつきやすさ／チクチク感／灼熱感／熱感／つっぱり感／かゆみ／痛み／不快感／ほてり／赤み）を0〜10で答える」という、出版され検証された質問票の項目 ]である。作れないのは [ Baumann の16タイプ診断（BSTI/BSTQ）と、脂性/乾燥を「判定」する自作の10問、そして Fitzpatrick を肌質診断に流用した設問 ]である。理由は [ BSTI は項目が非公開で翻訳に原著者の許可が要り（PMID 41926383）、脂性/乾燥の質問票スコアは皮脂計と r=0.23〜0.30 でしか一致せず（PMID 41972945, 37313638）、Fitzpatrick はもともと光線療法で肌が焼ける傾向を見るための道具だから（PMID 32186531） ]。**

**そして、SS-10 を使う場合でも「診断」はしない。** 出すのは「あなたが今、こう感じている」という要約と、その感覚に関係する記事へのリンクだけ。スコアもタイプ名も与えない。**質問票が測っているのは、肌ではなく自覚だから。**
