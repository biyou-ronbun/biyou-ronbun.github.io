// ---------------------------------------------------------------
//  英語で書くときの関門
//
//  ★ なぜ、これを先に作るのか
//
//    **うちの商品は記事ではなく「関門」です。そして、その関門は英語を読めません。**
//
//    verify.mjs が止めているのは、日本語の禁止表現だけです。
//    英語で書いた瞬間、"This ingredient doesn't work." と書いても、機械は止めません。
//
//    **関門を通していない記事を公開することは、うちが批判してきた形そのものです。**
//
//    だから、**英語記事を1本も出さないうちに、関門を先に作ります。**
//    作っておけば、英語をやると決めた日に安全に始められます。
//    作っていなければ、その日に事故を起こします。
//
//  ---------------------------------------------------------------
//  ★★ 日本語とは、前提が違います
//
//    **薬機法66条は「何人も」。** だから日本語の関門は、法的必需品でした。
//    書いた人が処罰されます。
//
//    一方、英語圏は違います。
//      ・FDA の drug 判定は「**売り手の intended use**」にかかる（21 U.S.C. §321(g)）
//      ・FTC の実証責任は「**広告主と endorser**」にかかる（16 CFR §255）
//
//    **書いただけの第三者への射程は、狭い。**
//
//    ★ その射程が一気に開く瞬間があります。
//      **アフィリエイトリンクを1本入れた瞬間です。**
//      （16 CFR §255.5 の Example 11 は、アフィリエイトを貼るブロガーそのものが対象）
//
//    つまり英語で止める理由は、**法律のためではありません。**
//    **うちが、うちでなくなるのを防ぐためです。**
//
//  ---------------------------------------------------------------
//  ★ EU では、うちのルールが法律でした
//
//    EU 655/2013 の "Fairness" 条項:
//      "shall not denigrate the competitors, nor ... ingredients legally used"
//
//    **うちの「効かないとは書かない」は、EU では法規制でもありました。**
//    誠実さのために自分に課したルールが、法律と一致していた。
// ---------------------------------------------------------------

// ---- 引用の中を、検査から外す ----------------------------------------
//
// ★ ここを外すと、うちの記事の型そのものが機械に禁止されます。
//
//   うちの記事は「世間がこう言っている」を**引用して解体する**形です。
//     The bottle says "clinically proven to erase wrinkles."
//     → 引用文ごと止めたら、この文が書けなくなります。
//
//   （日本語版が「」の中を見逃す仕組みと、同じ考え方です）

// ★★ アポストロフィを、引用符と間違えないこと。
//
//   最初の実装は ' も引用符として扱っていました。その結果——
//
//     Salmon DNA cream doesn't work. Don't buy it.
//                            ↑                ↑
//                     この2つの ' の間が「引用」として消され、
//                     **"work. Don" が消えて、関門をすり抜けました。**
//
//   **英語では、アポストロフィは単語の中に出てきます。** 引用符ではありません。
//   だから、**両側が空白か文頭・文末にある引用符だけ**を、引用とみなします。
//
//   （試験で実際にすり抜けました。試さなければ、気づきませんでした）

const stripQuoted = (t) =>
  t
    // 二重引用符（これは安全）
    .replace(/["“”][^"“”]{0,200}["“”]/g, ' ')
    // 単一引用符は、**前が空白か文頭**で、**後ろが空白か句読点**のものだけ
    .replace(/(^|\s)['‘][^'’]{0,200}['’](?=\s|[.,;:!?)]|$)/g, ' ')
    // 「〜と主張している」の直後（報告動詞のあと）
    .replace(
      /\b(claims?|claimed|marketed as|labell?ed|advertis\w+|says?|said|the ad reads|the label reads)\b[^.]{0,160}\./gi,
      ' '
    );

// ---- (A) 書いた時点で終わる言葉（煽り・名誉毀損） ----------------------
//
// ★ 英国の名誉毀損は、**被告側に真実の立証責任**があります。
//   企業名の近くにこれを置いたら、そこで終わりです。
export const EN_FATAL = [
  'scam', 'a lie', 'lying to you', 'lied to you', "you've been lied to", 'you have been lied to',
  'snake oil', 'quack', 'quackery', 'fraud', 'fraudulent', 'bogus', 'ripoff', 'rip-off',
  'con job', 'scamming', 'deceiving you', "they don't want you to know",
  "big beauty doesn't want", 'the industry is hiding',
];

// ---- (B) 化粧品を超えて「体の構造・機能を変える」と言う言葉 --------------
//
// 根拠: 21 U.S.C. §321(g)(1)(C) "affect the structure or any function of the body"
//       ASA/CAP 12.7（無限定の cure / rejuvenation は不可）
//
// ★ 論文の結果として "tretinoin increased procollagen I" と書くのは正当です。
//   止めるのは、**うちが地の文で断定する形だけ**。
export const EN_DRUG_CLAIM = [
  'cures acne', 'cures eczema', 'cures rosacea', 'cure for acne', 'cures dandruff',
  'treats acne', 'treats eczema', 'heals your skin', 'heals acne',
  'removes wrinkles', 'erases wrinkles', 'eliminates wrinkles', 'gets rid of wrinkles',
  'removes dark spots', 'erases dark spots',
  'reverses aging', 'reverses ageing', 'reverses the aging process', 'turns back the clock',
  'rejuvenates the skin', 'rejuvenation',
  'regenerates skin', 'renews skin cells', 'repairs dna', 'repairs your dna',
  'permanently shrinks pores', 'permanently removes', 'restores collagen', 'rebuilds collagen',
  'detoxifies', 'detoxify your skin', 'draws out toxins', 'flushes out toxins',
  'prevents premature ageing', 'prevents premature aging',
];

// ---- (C) 断定・保証・安全宣言 -----------------------------------------
// 根拠: ASA/CAP 12.9 "guaranteed to work" / "absolutely safe or without side-effects"
export const EN_ABSOLUTE = [
  'guaranteed to work', 'guaranteed results', '100% safe', 'completely safe',
  'absolutely safe', 'no side effects', 'without side effects', 'zero risk', 'risk-free',
  'works for everyone', 'works for every skin type', 'always works', 'never fails',
  'miracle ingredient', 'holy grail', 'the only ingredient that',
];

// ---- (D) 「証明された」と言い切る言葉 ----------------------------------
//
// ★ **うちは「証明」という語を、自分の主張には一度も使いません。**
export const EN_PROOF = [
  'clinically proven', 'scientifically proven', 'proven to work', 'proven to reduce',
  'studies prove', 'research proves', 'science proves', 'the science is settled',
  'doctors recommend', 'dermatologists recommend', 'doctor-recommended',
  'experts agree', 'science says',
];

// ---- (E) 「証拠が無い」を「効果が無い」に変換する言葉 --------------------
//
// ★ **これが英語版でいちばん重要です。** 日本語の OVERREACH の対応物。
//   根拠: EU 655/2013 附属書5「合法に使用される成分を貶めてはならない」
export const EN_OVERREACH = [
  "doesn't work", 'does not work', "don't work", 'is useless', 'are useless',
  'is pointless', 'is a waste of money', 'waste of your money',
  'has no effect', 'have no effect', 'is ineffective', 'are ineffective',
  'no benefit whatsoever', "don't buy", 'do not buy', 'never buy', 'stop using',
  'you should avoid', 'avoid this ingredient', 'throw it away',
  'is meaningless', 'is nonsense', 'is pseudoscience',
];

// ---- (F) 読者を主語にする言葉 -----------------------------------------
//
// ★ 主語は、試験の参加者であって、読者ではありません。
export const EN_READER_SUBJECT = [
  'your skin will', 'you will see', 'you will notice', 'this will make your skin',
  'you need to stop', 'you must stop', 'you should be using', 'if you want clear skin',
  '9 out of 10', "most people don't know", 'nobody tells you', 'what they never tell you',
];

// ---- (G) 「証拠の不在」→「効果の不在」の変換（文の形） -------------------
export const EN_ABSENCE_TO_NONEXISTENCE = [
  /\bno (?:good )?(?:evidence|studies|research|data)\b[^.]{0,60}\b(?:so|therefore|which means|meaning|hence)\b[^.]{0,60}\b(?:doesn't work|does not work|is ineffective|has no effect|is useless)\b/i,
  /\b(?:studies|research|the evidence|science)\b[^.]{0,40}\b(?:prove|proves|proved|show|shows|showed)\b[^.]{0,40}\b(?:it doesn't work|it does not work|it is ineffective|there is no effect)\b/i,
  /\bbecause there(?:'s| is| are) no (?:evidence|proof|studies)\b[^.]{0,60}\b(?:it doesn't work|it's useless|it has no effect)\b/i,
];

// ---- (H) ★ 「無いこと」で落とす検査 -----------------------------------
//
// ★ **これが英語版でいちばん強い検査です。**
//
//   うちの記事は、この言葉が1つも無い時点で、**うちの記事ではありません。**
//   資金源に触れず、動物実験と人間を区別せず、「見つからなかった」も「限界」も書いていない——
//   それは、ただの美容記事です。
export const EN_SIGNATURE = [
  'funding', 'funded by', 'conflict of interest', 'competing interest', 'sponsor',
  'in vitro', 'mice', 'mouse', 'rat', 'rats', 'pigs', 'animal study', 'cell culture',
  'we could not find', 'could not be found', 'no source', 'we were unable to',
  'no primary source', 'limitation', 'limitations',
];

// ---- (I) アフィリエイトを入れたら、開示を必須にする ----------------------
//
// 根拠: 16 CFR §255.5 "such connection must be disclosed clearly and conspicuously"
//       Example 11 = **アフィリエイトリンクを貼るブロガーそのもの**
//
// ★ 開示は「フッター」ではなく「読者が気づく場所」に。
//   （The Derm Review は開示している。それでも信頼されていない。
//     開示がフッタにあり、判断が本文にあるから。**開示は、集計を救わない**）
export const EN_AFFILIATE_DISCLOSURE =
  /\b(?:paid link|affiliate link|we (?:may )?earn a commission|commission (?:from|on) purchases)\b/i;

// ---- 打ち消し（言い過ぎを断っている文は通す） ---------------------------
//
// ★ 日本語版と同じ考え方です。
//
//     ✗ 止める : This ingredient doesn't work.
//     ○ 通す  : We can't say it doesn't work.
//     ○ 通す  : That doesn't mean it doesn't work.
//     ○ 通す  : "It doesn't work" is not what the paper says.
//
//   **言い過ぎを断っている文を関門が止めるなら、間違っているのは関門のほうです。**

const EN_NEGATION_BEFORE =
  /(can'?t say|cannot say|can not say|does ?n'?t mean|do ?n'?t mean|is not the same as|isn'?t the same as|we are not saying|we're not saying|that is not|that's not|nor (?:can|does))\s+[^.]{0,40}$/i;

/**
 * その文が、言い過ぎを「言い切っている」か。
 * 引用の中にある語、打ち消しが前に来ている語は、言い切っていない（＝通す）。
 */
export function enAssertsOverreach(text) {
  const t = stripQuoted(text);

  for (const w of EN_OVERREACH) {
    let i = -1;
    const lower = t.toLowerCase();
    const word = w.toLowerCase();
    while ((i = lower.indexOf(word, i + 1)) >= 0) {
      const before = t.slice(Math.max(0, i - 60), i);
      if (EN_NEGATION_BEFORE.test(before)) continue; // 断っている
      return {
        word: w,
        context: t.slice(Math.max(0, i - 40), i + w.length + 40).replace(/\s+/g, ' '),
      };
    }
  }
  return null;
}

/**
 * 英語の本文を検査する。
 * @returns {string[]} 問題のリスト（空なら通過）
 */
export function checkEnglish(text) {
  const t = stripQuoted(text);
  const lower = t.toLowerCase();
  const problems = [];

  const hit = (list, label) => {
    for (const w of list) {
      if (lower.includes(w.toLowerCase())) problems.push(`${label}: "${w}"`);
    }
  };

  hit(EN_FATAL, '煽り・名誉毀損（書いた時点で終わる）');
  hit(EN_DRUG_CLAIM, '医薬品的な効能（21 U.S.C. §321(g)）');
  hit(EN_ABSOLUTE, '断定・保証・安全宣言（ASA/CAP 12.9）');
  hit(EN_PROOF, '「証明された」と言い切っている');
  hit(EN_READER_SUBJECT, '読者を主語にしている');

  const over = enAssertsOverreach(text);
  if (over) {
    problems.push(
      `言い過ぎ（EU 655/2013 の Fairness にも触れる）: "${over.word}"\n      …${over.context}…`
    );
  }

  for (const re of EN_ABSENCE_TO_NONEXISTENCE) {
    const m = t.match(re);
    if (m) {
      problems.push(
        `「証拠が無い」を「効果が無い」に変換している\n      …${m[0].slice(0, 90)}…\n` +
          `      "no evidence of an effect" と "evidence of no effect" は別のことです`
      );
    }
  }

  // ★ 「無いこと」で落とす検査
  const signature = EN_SIGNATURE.filter((w) => lower.includes(w.toLowerCase()));
  if (signature.length === 0) {
    problems.push(
      'この記事には、うちの記事であることを示す言葉が1つもありません\n' +
        '      （funding / conflict of interest / in vitro / mice / rats /\n' +
        '        we could not find / limitations …）\n' +
        '      資金源に触れず、動物実験と人間を区別せず、「見つからなかった」も\n' +
        '      「限界」も書いていない記事は、**ただの美容記事です。**'
    );
  }

  return problems;
}
