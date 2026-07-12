# テーマ: PDRN（サーモンDNA）の化粧品は、ヒトで確かめられているのか

調査日: 2026-07-13
調査担当: researcher（メインのClaudeが直接実施）

使った道具: `node site/pubmed.mjs search` / `get`（PubMed 公式API、E-utilities）、WebFetch（PubMed・PLoS One・PMC の原文）

## 結論（ライター向けサマリ）

一言で: **塗るPDRN化粧品のヒト試験は、PubMed で探した範囲では1本しかありません（n=31、28日間）。そしてこの分野の土台になった注射の第III相試験は、2016年に撤回されています。撤回の理由が「利益相反の開示が誤りで、資金提供元の記載が誤っていた」でした。**

このテーマの核心は「効くか効かないか」ではありません。**「利益相反なし」と申告した論文の著者が、その製品を売る会社の所属だった——という同じ構造が、この分野で3回、10年にわたって繰り返されている**ことです。1回目は撤回されました。2026年の「塗るPDRN」の論文は、まだ撤回されていません。

### 言い切っていいこと

- 塗るPDRN（サーモン由来）の化粧品を、ヒトでランダム化して調べた試験は、**PubMed で1本だけ確認できた**（PMID 42430369, PLoS One 2026）。31人・28日間・顔の左右比較。
- **その1本には、プラセボ（基剤のみ）の対照群がない。** 比較相手は 0.1% レチノールを塗った反対側の顔。つまり「何も塗らない／基剤だけ」との比較は行われていない。
- その1本は「利益相反なし」「特定の資金提供を受けていない」と申告している。**同じ論文に印刷された著者5名の所属のうち、3名が Inertia Shanghai Biotechnology（UNISKIN Research Institute）と DermaHealth Shanghai Biotechnology という2社である。**
- **注射（Rejuran）の第III相試験（PMID 25473210, 72人）は、2016年に撤回された**（撤回通知: J Korean Med Sci. 2016;31(2):330, PMID 26839493）。撤回理由は「利益相反の開示が誤っており、資金提供元の記載が誤っていた」。共著者1名が Pharmaresearch Products R&D Center（Rejuran のメーカー）所属だったのに、論文は「全著者に金銭的関与なし」と記載していた。
- **その撤回された第III相試験は、そもそも要旨の中で「主要・副次の客観的な有効性評価項目で、2群間に統計学的有意差はなかった」と書いている。** 結論部では「シワを減らすのに有用でありうる」としている。
- Rejuran と別のフィラーを比べた別のRCT（PMID 39313949, 218人）も**撤回されている**（RETRACTION: J Cosmet Dermatol. 2026;25(3):e70794）。この論文は「利益相反なし」と申告しつつ、資金提供元は DexLevo 社（比較対象の新フィラーのメーカー）と記載されていた。撤回理由は確認できなかった。
- 独立性のあるRCT（PMID 32248707, 27人、大学病院のみの所属、資金・COIの記載なし）では、**PNフィラーとHAフィラーの間で、VAS・GAIS（見た目の改善スコア）に有意差はなかった。**
- よく「塗るPDRN」の根拠として引かれる Molecules 2022 の研究（PMID 35209068）は、**動物実験（UV-B を当てたマウス）＋マイクロニードリング**であり、ヒトが手で塗った試験ではない。資金提供は I'll Global 社、著者1名が同社所属、COIは「なし」と申告。

### 言い切ってはいけないこと

- **「PDRNは効かない」とは書けない。** ヒトRCTは実在する。書けるのは「独立した検証がまだ無い」「試験が1本しかない」「その1本の著者が売り手側だった」まで。
- **「撤回されたから、Rejuran に効果がない」とも書けない。** 撤回理由は利益相反の開示の問題であって、データの捏造とは書かれていない。ただし「有意差はなかった」は、その論文自身の要旨に書いてある。
- 注射（美容医療）の話と、塗る化粧品の話を混ぜない。**皮膚に針で入れたものの結果を、手で塗ったときの結果として書かない。**
- PLoS One の効果の数値（−20〜−23% など）は、**論文の本文に「approximately（およそ）」という形でしか印刷されていない。** 正確な数値と統計の値は、本文の文章からは読み取れなかった。断定的な数字として書かないこと。
- 「サーモンDNAはヒトのDNAと95%似ている」等の宣伝文句は、**一次情報で確認していない。書かない。**

### 記事にするときの注意

- 薬機法: 化粧品なので「シワが消える」「再生する」は絶対NG。「肌が生まれ変わる」もNG（§4の「細胞が生まれ変わる」に該当）。
- 「危険な成分」と煽らない。安全性の話は一切していない。していないことを、していないと書く。
- 撤回論文を扱うので、事実（撤回通知の号数・理由の一文）を正確に。推測を足さない。

---

## 論文1: Topical medium-length PDRN enhances dermal extracellular matrix repair in photodamaged skin via PI3K-Akt/TGF-β-regulated pathways.

- **出典**: Ye R, Wang Q, Du L, Li L, Hu F. PLoS One. 2026;21(7):e0350905.
- **PMID**: 42430369
- **URL**: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0350905
- **研究デザイン**: 基礎研究（培養線維芽細胞・再構成表皮・ブタ皮膚・ex vivo ヒト皮膚）＋ ランダム化二重盲検・顔面左右比較のヒト試験
- **被験者**: 健康な中国人女性 31人、35〜55歳（平均47.5±5.7歳）、自己申告の敏感肌。28日間、1日2回塗布
- **介入**: 0.1% PDRN-850K 配合アイクリームを顔の片側 / 反対側は**同じ基剤に 0.1% レチノールを配合したアイクリーム**。**基剤のみ（プラセボ）の対照は無い**
- **主要な結果**: 論文の本文が報告しているのは近似値のみ。目尻のシワの面積・本数の減少が28日目で「およそ −20〜−23%」、レチノール側が「およそ −6〜−7%」。真皮の厚み・density、目の下のふくらみは「レチノールのおよそ2倍」、弾力・ハリは「およそ1.8倍」。**正確な数値と p 値は本文の文章に印刷されていない（図が参照されている）**
- **限界**: n=31、28日間と小規模・短期。プラセボ対照が無い。中国人女性のみ。基礎研究部分（機序・浸透）はヒトの肌に塗った結果ではなく、培養細胞・ブタ皮膚・摘出皮膚
- **COI**: 論文の申告は「The authors declare no conflicts of interest.」。資金提供は「The author(s) received no specific funding for this work.」。**一方、同じ論文の著者所属欄に、Ye R・Du L・Hu F の3名が UNISKIN Research Institute on Skin Aging, Inertia Shanghai Biotechnology Co., Ltd.（上海）および DermaHealth Shanghai Biotechnology Co., Ltd.（上海）と記載されている。**残り2名は四川大学華西病院、復旦大学華山病院
- **確認範囲**: 全文（PLoS One はオープンアクセス）

> **引用に使える一文**: 塗るPDRN化粧品のヒト試験は、これ1本。その1本が「利益相反なし・資金提供なし」と申告しながら、著者5名のうち3名は化粧品・バイオ企業2社の所属です。

---

## 論文2: A phase III, randomized, double-blind, matched-pairs, active-controlled clinical trial and preclinical animal study to compare the durability, efficacy and safety between polynucleotide filler and hyaluronic acid filler in the correction of crow's feet: a new concept of regenerative filler.

- **出典**: Pak CS, Lee J, Lee H, et al. J Korean Med Sci. 2014;29 Suppl 3(Suppl 3):S201-9.
- **PMID**: 25473210
- **URL**: https://pubmed.ncbi.nlm.nih.gov/25473210/
- **研究デザイン**: 第III相・ランダム化二重盲検・ペアマッチ・実薬対照試験 ＋ マウス実験。**PubMed の刊行物種別に「Retracted Publication（撤回論文）」と記載されている**
- **被験者**: 72人（目尻のシワ）。片側に Rejuran、反対側に Yvoire-Hydro（HAフィラー）。2週間おきに計3回注射、12週間観察。マウス25匹
- **介入**: 注射（フィラー）。**塗る化粧品ではない**
- **主要な結果**: 要旨に「In the clinical trial, the primary and secondary objective efficacy outcome measure showed no statistical significance between the two groups」——**主要・副次の客観的評価項目で、2群間に統計学的有意差はなかった**。それでも結論は「シワを減らすのに有用でありうる」
- **限界**: 撤回済み。有意差が出ていないのに結論が肯定的
- **COI**: 論文の申告は「全著者が、過去5年間および将来にわたり、本論文の主題と金銭的利害を持つ組織との金銭的関与（雇用・顧問・謝礼・株式・特許・ロイヤリティ等）を持たない」。**しかし著者 Kim I の所属は Pharmaresearch Products R&D Center（Rejuran のメーカー）と、同じ論文に印刷されている**
- **撤回**: J Korean Med Sci. 2016;31(2):330（PMID 26839493）。撤回通知の一文: 「The board concluded that the article was an impaired publication of conflict of interest by wrong disclosure and incorrect notification of funding sponsor.」（利益相反の誤った開示と、資金提供元の誤った通知による、瑕疵ある出版であると理事会は結論した）。責任著者は申し立てを受け入れた。承認は2016年1月22日
- **確認範囲**: 要旨のみ確認（本体）＋ 撤回通知は全文確認

> **引用に使える一文**: この分野で最初の第III相試験は、撤回されました。理由は、データの誤りではなく、**「誰がお金を出したか」の書き方**でした。

---

## 論文3: Notice of Retraction（論文2の撤回通知）

- **出典**: Notice of Retraction: Pak CS, et al. ... J Korean Med Sci. 2016;31(2):330.
- **PMID**: 26839493
- **URL**: https://pmc.ncbi.nlm.nih.gov/articles/PMC4729519/
- **研究デザイン**: 撤回通知（Retraction Notice）
- **内容**: 読者からの指摘を受け、雑誌の理事会が調査。当初は地域のイノベーションセンターの助成として記載されていた資金提供元が、実際にはそのフィラーを製造する企業であったこと、共著者1名がその企業のR&Dセンターに勤務していたことが開示されていなかった、と記載
- **COI**: 記載なし
- **確認範囲**: 全文

---

## 論文4: A Randomized, Participant- and Evaluator-Blinded, Matched-Pair, Prospective Study Comparing the Safety and Efficacy Between Polycaprolactone and Polynucleotide Fillers in the Correction of Crow's Feet.

- **出典**: Choi SY, Koh YG, Yoo KH, Han HS, Seok J, Kim BJ. J Cosmet Dermatol. 2025;24(1):e16576.
- **PMID**: 39313949
- **URL**: https://pubmed.ncbi.nlm.nih.gov/39313949/
- **研究デザイン**: ランダム化・評価者盲検・ペアマッチ・顔面左右比較。**PubMed の刊行物種別に「Retracted Publication」と記載**
- **被験者**: 健康なアジア人 218人。12週間
- **介入**: 注射。PCLフィラー（DLMR01）vs 精製PNフィラー（Rejuran）
- **主要な結果**: DLMR01 は Rejuran に対して非劣性で、12週時点の改善率は有意に高かった、と要旨にある
- **COI**: 申告は「The authors declare no conflicts of interest.」。**資金提供の記載は「This work was funded by DexLevo, Inc.」**（DLMR01 側の企業）
- **撤回**: RETRACTION: J Cosmet Dermatol. 2026;25(3):e70794。**撤回の理由は、確認できなかった**
- **確認範囲**: 要旨のみ確認

---

## 論文5: Comparison of the effects of polynucleotide and hyaluronic acid fillers on periocular rejuvenation: a randomized, double-blind, split-face trial.

- **出典**: Lee YJ, Kim HT, Lee YJ, et al. J Dermatolog Treat. 2022;33(1):254-260.
- **PMID**: 32248707
- **URL**: https://pubmed.ncbi.nlm.nih.gov/32248707/
- **研究デザイン**: ランダム化・二重盲検・ペアマッチ・実薬対照の左右比較試験
- **被験者**: 27人。2週間おきに計3回注射
- **介入**: 注射。PNフィラー vs 非架橋ヒアルロン酸フィラー（目のまわり）
- **主要な結果**: **VAS（見た目の評価）と GAIS（総合的な美容改善スケール）の改善に、2群間で有意差はなかった。** 弾力・水分・粗さ・毛穴体積の改善率は PN 群のほうが高かった。真皮 density の改善率には有意差なし。重篤な有害事象の報告なし
- **限界**: n=27 と小規模。比較相手はヒアルロン酸であって、プラセボではない
- **COI**: PubMed の記録に**COI・資金提供の記載なし**。著者の所属はすべて大学病院（慶熙大学、蔚山大学 峨山医療院）。**この論文群の中で、著者に企業所属者がいない唯一のヒト試験**
- **確認範囲**: 要旨のみ確認

> **引用に使える一文**: 著者に企業の人が1人もいない、唯一のヒト試験。そこでは、見た目のスコアに差がつきませんでした。

---

## 論文6: A Mixture of Topical Forms of Polydeoxyribonucleotide, Vitamin C, and Niacinamide Attenuated Skin Pigmentation and Increased Skin Elasticity by Modulating Nuclear Factor Erythroid 2-like 2.

- **出典**: Kim HM, Byun KA, Oh S, et al. Molecules. 2022;27(4).
- **PMID**: 35209068
- **URL**: https://pubmed.ncbi.nlm.nih.gov/35209068/
- **研究デザイン**: **動物実験**（UV-B を照射した動物モデル）
- **被験者**: 動物。**ヒトではない**
- **介入**: PDRN＋ビタミンC＋ナイアシンアミドの外用液を、**マイクロニードリング（MTS、針で穴を開けて入れる機器）で送達**。手で塗ったのではない
- **主要な結果**: NRF2/HO-1 の発現増加、MMP2/3/9 の減少、メラニン量の減少、コラーゲン・エラスチン線維の増加
- **限界**: 動物実験。ヒトの肌の話として書けない。送達がマイクロニードリングであり、化粧品として手で塗る条件と異なる
- **COI**: 申告は「The authors have no conflict of interest to declare.」。**資金提供は I'll Global Inc. Co.。著者 Chung MS の所属が I'll Global Co., Inc.（同社）**
- **確認範囲**: 要旨のみ確認

---

## 論文7: Hyaluronic Acid-like Skin Plumping and Radiance Benefits of a Porphyridium Sulfated Exopolysaccharide- and Natural PDRN-Rich Extract.

- **出典**: Havas F, Krispin S, Cohen M, Attia-Vigneau J. Mar Drugs. 2026;24(3).
- **PMID**: 41892958
- **URL**: https://pubmed.ncbi.nlm.nih.gov/41892958/
- **研究デザイン**: 培養細胞（CHO細胞・線維芽細胞）＋ プラセボ対照・HA対照つきの二重盲検ヒト試験
- **被験者**: ヒト試験の人数は要旨に記載なし（未確認）
- **介入**: 紅藻 Porphyridium の抽出物（PDRN を含む）。**サーモン由来のPDRNではない**
- **主要な結果**: プラセボおよびHAの対照に対し、ふっくら感・水分・つやの改善。要旨に数値なし
- **限界**: **著者4名全員が原料メーカー Lucas Meyer Cosmetics の社員**。人数・数値が要旨から確認できない
- **COI**: 「The authors are employees of Lucas Meyer Cosmetics and its affiliates and declare no conflict of interest.」——**雇用関係は明記したうえで「利益相反なし」と申告**している。所属を隠していない点は、上の論文群と異なる
- **確認範囲**: 要旨のみ確認

---

## 論文8: Recent advances on polydeoxyribonucleotide extraction and its novel application in cosmeceuticals.

- **出典**: Nguyen TH, Wang SL, Nguyen VB. Int J Biol Macromol. 2024;282(Pt 3):137051.
- **PMID**: 39486723
- **URL**: https://pubmed.ncbi.nlm.nih.gov/39486723/
- **研究デザイン**: 総説（レビュー。一次データなし）
- **内容**: PDRN は主にサーモンから抽出される、分子量 50〜1500 kDa の DNA 断片の混合物（純度 >95%）で、登録された医薬品成分であると記載。抽出源と抽出法、化粧品分野での生物活性のレビュー
- **COI**: 「The authors declare no conflict of interest.」。著者の所属は淡江大学（台湾）、テイグエン大学（ベトナム）。企業所属者なし。資金提供の記載なし
- **確認範囲**: 要旨のみ確認

---

## 検索して「見つからなかった」もの（これも発見です）

以下は PubMed の公式API で検索した結果、**確認できなかった**ものです。

- **塗るPDRN化粧品の、プラセボ（基剤のみ）対照のヒトRCT** —— 見つかりませんでした。唯一のヒト試験（論文1）の対照はレチノールです。
- **塗るPDRN化粧品を、メーカーと無関係な研究者だけで検証したヒト試験** —— 見つかりませんでした。
- **サーモン由来PDRNの化粧品について、日本人を対象にしたヒト試験** —— 見つかりませんでした。
- **「PDRN配合の美容液を手で塗ると、皮膚のどこまで届くか」をヒトで定量した独立した研究** —— 論文1の中に予備的（pilot）なヒト Raman 分光の記載がありますが、独立した検証は見つかりませんでした。

使った検索語: `polydeoxyribonucleotide topical skin` / `polydeoxyribonucleotide randomized controlled trial skin` / `polynucleotide skin rejuvenation clinical trial` / `polynucleotide topical cream wrinkle randomized` / `PDRN salmon DNA cosmetic` / `polydeoxyribonucleotide injection skin rejuvenation randomized`
