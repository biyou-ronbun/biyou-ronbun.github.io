// ---------------------------------------------------------------
//  記事に埋める図版
//
//  ここに書いてよい数値は、articles/*.md（＝論文カード由来）に
//  実際に書かれている数値だけ。ここで新しい数字を作らないこと。
//  出典（source）は必ず添える。
//
//  記事の Markdown に次の1行を書くと、その位置に図版が入る:
//      ::figure:retinol-dropout::
// ---------------------------------------------------------------

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 横棒グラフ。1系列だけ。色で語らず、長さと直接ラベルで語る。
function barChart({ title, rows, max, unit, refLine, source }) {
  const bars = rows
    .map((r) => {
      const pct = Math.max((r.value / max) * 100, 0.5);
      const cls = r.pending ? 'fig-bar is-pending' : 'fig-bar';
      const ref = refLine
        ? `<span class="fig-ref" style="left:${(refLine.value / max) * 100}%"></span>`
        : '';
      return `      <div class="fig-row">
        <span class="fig-label">${esc(r.label)}</span>
        <span class="fig-track">${ref}<span class="${cls}" style="width:${pct}%"></span></span>
        <span class="fig-value">${esc(r.display ?? String(r.value))}</span>
      </div>`;
    })
    .join('\n');

  const note = refLine
    ? `    <p class="fig-note"><span class="fig-ref-key"></span> ${esc(refLine.label)}</p>`
    : '';

  return `<figure class="fig">
  <p class="fig-title">${esc(title)}</p>
  <div class="fig-chart">
${bars}
  </div>
  <p class="fig-unit">${esc(unit)}</p>
${note}
  <figcaption>${esc(source)}</figcaption>
</figure>`;
}

// 2系列の横棒。系列が2つ以上あるので凡例を必ず出す（色だけに頼らない）。
function barChartGrouped({ title, series, rows, max, unit, refLine, source }) {
  const legend = series
    .map(
      (s, i) =>
        `<span class="fig-key"><span class="fig-swatch fig-col-${i + 1}"></span>${esc(s)}</span>`
    )
    .join('');

  const body = rows
    .map((r) => {
      const ref = refLine
        ? `<span class="fig-ref" style="left:${(refLine.value / max) * 100}%"></span>`
        : '';
      const bars = r.values
        .map(
          (v, i) =>
            `<span class="fig-bar fig-col-${i + 1}" style="width:${Math.max((v / max) * 100, 0.5)}%"></span>`
        )
        .join('');
      // 141 と 141.0 が混ざると数字が揃って見えないので、桁を固定する
      const vals = r.values.map((v) => `<span>${esc(v.toFixed(1))}</span>`).join('');
      return `      <div class="fig-row is-grouped">
        <span class="fig-label">${esc(r.label)}</span>
        <span class="fig-track is-grouped">${ref}${bars}</span>
        <span class="fig-value is-stacked">${vals}</span>
      </div>`;
    })
    .join('\n');

  const note = refLine
    ? `  <p class="fig-note"><span class="fig-ref-key"></span> ${esc(refLine.label)}</p>`
    : '';

  return `<figure class="fig">
  <p class="fig-title">${esc(title)}</p>
  <p class="fig-legend">${legend}</p>
  <div class="fig-chart">
${body}
  </div>
  <p class="fig-unit">${esc(unit)}</p>
${note}
  <figcaption>${esc(source)}</figcaption>
</figure>`;
}

// 2列 × 3行の対比。色だけで語らないよう、文字も必ず入れる。
function matrix({ title, cols, rows, source }) {
  const head = cols.map((c, i) => `<th class="fig-col-${i + 1}">${esc(c)}</th>`).join('');
  const body = rows
    .map(
      (r) => `      <tr>
        <th scope="row">${esc(r.label)}</th>
${r.cells
  .map(
    (c, i) =>
      `        <td><span class="fig-dot fig-col-${i + 1} ${c.on ? 'is-on' : 'is-off'}"></span>${esc(c.text)}</td>`
  )
  .join('\n')}
      </tr>`
    )
    .join('\n');

  return `<figure class="fig">
  <p class="fig-title">${esc(title)}</p>
  <div class="table-scroll">
    <table class="fig-matrix">
      <thead><tr><td></td>${head}</tr></thead>
      <tbody>
${body}
      </tbody>
    </table>
  </div>
  <figcaption>${esc(source)}</figcaption>
</figure>`;
}

// 根拠の強さのように「順位はあるが数量ではない」もの。
// 色の濃さではなく、四角の数で強さを表す（色覚に依存しない）。
function ladder({ title, rows, source }) {
  const items = rows
    .map((r) => {
      const pips = Array.from({ length: 4 }, (_, i) =>
        `<span class="fig-pip${i < r.strength ? ' is-on' : ''}"></span>`
      ).join('');
      return `    <li class="fig-step">
      <span class="fig-pips" aria-label="根拠の強さ ${r.strength} / 4">${pips}</span>
      <span class="fig-step-body">
        <span class="fig-step-name">${esc(r.name)}</span>
        <span class="fig-step-note">${esc(r.note)}</span>
      </span>
    </li>`;
    })
    .join('\n');

  return `<figure class="fig">
  <p class="fig-title">${esc(title)}</p>
  <ol class="fig-ladder">
${items}
  </ol>
  <figcaption>${esc(source)}</figcaption>
</figure>`;
}

// ---------------------------------------------------------------

export const FIGURES = {
  'sunscreen-amount': barChart({
    title: '日焼け止めは、基準の何割しか塗られていないのか',
    rows: [
      { label: '乳液タイプ', value: 0.3 },
      { label: '下地クリーム', value: 0.5 },
      { label: 'スプレー', value: 0.5 },
      { label: 'ジェル', value: 1.2 },
    ],
    max: 2.2,
    unit: '単位: mg/cm²',
    refLine: { value: 2.0, label: 'SPFを測るときの基準量 2.0 mg/cm²。ここに届いて、はじめて表示どおりのSPFが出る' },
    source: '出典: Marume 2020（日本化粧品技術者会誌、日本人女性131人の実測）',
  }),

  'collagen-funding': matrix({
    title: '同じ23件の試験。資金提供元で分けると、結果が入れ替わる',
    cols: ['企業の資金あり', '企業の資金なし'],
    rows: [
      { label: '皮膚の水分量', cells: [{ on: true, text: '有意な改善' }, { on: false, text: '差なし' }] },
      { label: '弾力', cells: [{ on: true, text: '有意な改善' }, { on: false, text: '差なし' }] },
      { label: 'シワ', cells: [{ on: true, text: '有意な改善' }, { on: false, text: '差なし' }] },
    ],
    source: '出典: Myung & Park 2025（Am J Med、23件のRCT・のべ1,474人）',
  }),

  'bathing-nolotion': barChartGrouped({
    title: '「速さ」ではなく「塗るか塗らないか」だった',
    series: ['アトピー群', '健常群'],
    rows: [
      { label: '入浴のみ・無塗布', values: [91.4, 94.6] },
      { label: '入浴＋直後に塗る', values: [141.6, 168.8] },
      { label: '入浴＋30分後に塗る', values: [141.0, 178.6] },
      { label: '入浴なし・塗るだけ', values: [206.2, 215.0] },
    ],
    max: 220,
    unit: '入浴前を100としたときの、90分間の平均角層水分量',
    refLine: { value: 100, label: '入浴前 = 100。この線を下回ったのは、無塗布の条件だけ。直後と30分後は、ほとんど変わらない' },
    source: '出典: 記事末尾の参考文献を参照',
  }),

  'retinol-dropout': barChart({
    title: '肌に合わずに、使用をやめた人の数',
    rows: [
      { label: '0.3% を使った群', value: 4, display: '4人' },
      { label: '1% を使った群', value: 23, display: '23人' },
    ],
    max: 26,
    unit: '218人が6週間、自宅でレチノールを使った試験',
    source: '肌の反応が「なし、または軽度」で済んだ人は、0.3%群 88.7% に対して 1%群 62.1%（p<0.0001）',
  }),

  'vitc-evidence': ladder({
    title: 'ヒトでの根拠の強さで、並べ替える',
    rows: [
      { strength: 4, name: 'ピュアなL-アスコルビン酸', note: '複数の二重盲検RCTと、システマティックレビューがある' },
      { strength: 3, name: 'リン酸アスコルビルNa（SAP）', note: 'ヒトRCTあり。ただし測ったのはニキビで、シワでも色素沈着でもない' },
      { strength: 2, name: 'リン酸アスコルビルMg（MAP）', note: '1996年の、対照群のない試験が1本（34人中19人）' },
      { strength: 1, name: 'VC-IP / アスコルビルグルコシド / 3-O-エチルアスコルビン酸', note: '単独のヒトRCTを、今回の調査では確認できず' },
    ],
    source: '「最新」「高浸透」と書かれた成分ほど、下に来る。広告が強い成分と、根拠が強い成分は別物です',
  }),

  'ha-fate': barChart({
    title: '飲んだヒアルロン酸の炭素は、どこへ行ったのか',
    rows: [
      { label: '呼気（吐く息）', value: 76.5, display: '76.5%' },
      { label: '糞', value: 11.9, display: '11.9%' },
      { label: '尿', value: 3.0, display: '3.0%' },
    ],
    max: 80,
    unit: '168時間までの排泄の内訳',
    source: 'ラットに標識したヒアルロン酸を飲ませた実験です。ヒトの皮膚で確かめたデータではありません',
  }),

  'fasting-recovery': barChart({
    title: '保湿をやめた肌が、もとに戻るまでの日数',
    rows: [
      { label: '17〜25歳（客観評価）', value: 6, display: '6日' },
      { label: '17〜25歳（自己評価）', value: 10, display: '10日' },
      { label: '15〜20歳（夏）', value: 11, display: '11日' },
      { label: '40〜55歳', value: 21, display: '戻らず', pending: true },
    ],
    max: 23,
    unit: '日',
    source: '出典: Maul 2020（分割顔パイロット試験）。40〜55歳群は21日間の観察期間内に有意な回復が見られなかった。ただし13人と小さな群です',
  }),
};
