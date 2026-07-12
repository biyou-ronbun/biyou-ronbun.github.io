// ---------------------------------------------------------------
//  記事に埋める図版を描く
//
//  データは site/figures.json にあります。**このファイルは描き方だけ**です。
//  図版を足したいときは figures.json に1つ追加してください（ここは触らない）。
//
//  記事の Markdown に次の1行を書くと、その位置に図版が入ります:
//      ::figure:retinol-dropout::
//
//  ★ figures.json に書いてよい数値は、articles/*.md に実際に書かれている
//    数値だけです。図版のために新しい数字を作らないこと。出典を必ず添えること。
// ---------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(SITE, 'figures.json'), 'utf8'));

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- 横棒（1系列） -------------------------------------------------
// 色で語らず、長さと直接ラベルで語る。

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
    ? `  <p class="fig-note"><span class="fig-ref-key"></span> ${esc(refLine.label)}</p>`
    : '';

  return `<figure class="fig">
  <p class="fig-title">${esc(title)}</p>
  <div class="fig-chart">
${bars}
  </div>
  <p class="fig-unit">${esc(unit ?? '')}</p>
${note}
  <figcaption>${esc(source)}</figcaption>
</figure>`;
}

// ---- 横棒（2系列） -------------------------------------------------
// 系列が2つ以上あるので凡例を必ず出す（色だけに頼らない）。

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
  <p class="fig-unit">${esc(unit ?? '')}</p>
${note}
  <figcaption>${esc(source)}</figcaption>
</figure>`;
}

// ---- 2列の対比表 ---------------------------------------------------
// 色だけで語らないよう、文字も必ず入れる。

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

// ---- 根拠の階段 ----------------------------------------------------
// 順位はあるが数量ではないもの。色の濃さではなく四角の数で表す（色覚に依存しない）。

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

// ---- JSON から組み立てる -------------------------------------------

const RENDERERS = {
  bar: barChart,
  grouped: barChartGrouped,
  matrix,
  ladder,
};

export const FIGURES = Object.fromEntries(
  Object.entries(data.figures).map(([key, spec]) => {
    const render = RENDERERS[spec.type];
    if (!render) throw new Error(`figures.json: 知らない type です → ${key}: ${spec.type}`);
    return [key, render(spec)];
  })
);
