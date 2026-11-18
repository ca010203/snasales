const F = {
  usd: d3.format('$,.2f'), usd0: d3.format('$,.0f'), usdk: (v) => v >= 1000 ? d3.format('$,.1f')(v / 1000) + 'k' : d3.format('$,.0f')(v),
  int: d3.format(',d'), dec: d3.format(',.1f'),
  pct: (v) => d3.format('.1f')(v) + '%', pct0: (v) => d3.format('.0f')(v) + '%',
  hrs: (v) => v >= 48 ? d3.format('.1f')(v / 24) + ' d' : d3.format('.1f')(v) + ' h',
  txt: (v) => v
};
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PANELS = ['overview', 'hours', 'buying', 'mix', 'guests'];
const DRAWINGS = ['num', 'period', 'periodname', 'rows', 'chart_sales', 'chart_occm', 'chart_wsales', 'chart_wocc', 'chart_hourly', 'heat_occ', 'chart_daily', 'chart_ahead', 'chart_lead', 'heat_buy'];
const period = () => dash.params().period || 'All';
const dowP = () => dash.params().dow || 'All';
const chP = () => dash.params().ch || 'All';
const got = (id) => { const g = dash.data(id); return g.status === 'ok' ? g.data : null; };
const enc = (s) => String(s).replace(/[%&=]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const monthLabel = (k) => k === 'All' ? 'All' : String(k).startsWith('wk-') ? d3.utcFormat('%b %-d')(new Date(k.slice(3) + 'T00:00:00Z')) : d3.utcFormat("%b '%y")(new Date(k + '-01T00:00:00Z'));
const monShort = (k) => String(k).startsWith('wk-') ? d3.utcFormat('%-m/%-d')(new Date(k.slice(3) + 'T00:00:00Z')) : d3.utcFormat('%b')(new Date(k + '-01T00:00:00Z'));
const dayLabel = (k) => d3.utcFormat('%a %b %-d')(new Date(k + 'T00:00:00Z'));
const hourLabel = (h) => { h = +h % 24; return (h % 12 || 12) + (h < 12 ? 'a' : 'p'); };
const hourLong = (h) => { h = +h % 24; return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); };
const color0 = () => dash.colors[0];

// Tabs: one section shows at a time.
window.mbTab = PANELS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
function sync() {
  document.querySelectorAll('[data-panel]').forEach((s) => { s.hidden = s.dataset.panel !== window.mbTab; });
  document.querySelectorAll('.mb-tab').forEach((b) => {
    const on = b.dataset.tab === window.mbTab;
    b.classList.toggle('mb-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.mb-dowsel').forEach((s) => { if (document.activeElement !== s) s.value = dowP(); });
  document.querySelectorAll('.mb-chsel').forEach((s) => { if (document.activeElement !== s) s.value = chP(); });
}
document.querySelectorAll('.mb-tab').forEach((b) => b.addEventListener('click', () => {
  window.mbTab = b.dataset.tab;
  sync();
  dash.setLink(b.dataset.tab);
  DRAWINGS.forEach((n) => dash.draw(n));
}));
document.querySelectorAll('.mb-dowsel').forEach((s) => s.addEventListener('change', () => dash.setParams({ dow: s.value === 'All' ? null : s.value })));
document.querySelectorAll('.mb-chsel').forEach((s) => s.addEventListener('change', () => dash.setParams({ ch: s.value === 'All' ? null : s.value })));
dash.onData(sync);

dash.draw('period', (sel) => {
  const d = got('monthly') || [];
  const grp = (label, rows) => { const g = document.createElement('optgroup'); g.label = label; g.append(...rows.map((r) => new Option(r.month, r.key))); return g; };
  sel.replaceChildren(...d.filter((r) => r.kind === 'all').map((r) => new Option(r.month, r.key)), grp('Weeks', d.filter((r) => r.kind === 'week').reverse()), grp('Months', d.filter((r) => r.kind === 'month').reverse()));
  sel.value = period();
  sel.onchange = () => dash.setParams({ period: sel.value === 'All' ? null : sel.value });
});
dash.draw('periodname', (el) => {
  const d = got('monthly');
  const r = d && d.find((x) => x.key === period());
  el.textContent = r ? r.month : '—';
});
dash.draw('num', (el) => {
  const src = el.dataset.src || 'monthly';
  const d = got(src);
  const k = el.dataset.k || period();
  const r = d && d.find((x) => x.key === k);
  const v = r ? r[el.dataset.f] : null;
  if (v == null || v === '') { el.textContent = '—'; return; }
  const s = document.createElement('span');
  s.dataset.source = src; s.dataset.field = el.dataset.f; s.dataset.where = 'key=' + enc(k);
  s.textContent = F[el.dataset.fmt || 'usd'](+v);
  el.replaceChildren(s);
});

// Table bodies: columns come from the header cells.
dash.draw('rows', (tb) => {
  const table = tb.closest('table');
  if (!table) return;
  const d = got(table.dataset.source);
  if (!d) { tb.replaceChildren(); return; }
  const ths = [...table.querySelectorAll('thead th')];
  const p = period(), scope = table.dataset.scope;
  let rows = d;
  if (scope === 'period') rows = d.filter((r) => r.period === p);
  if (scope === 'months') rows = d.filter((r) => r.kind === 'month').concat(d.filter((r) => r.key === 'All'));
  if (scope === 'weeks') rows = d.filter((r) => r.kind === 'week');
  if (table.dataset.sort) rows = rows.slice().sort((a, b) => +b[table.dataset.sort] - +a[table.dataset.sort]);
  else if (rows.length && 'ord' in rows[0]) rows = rows.slice().sort((a, b) => +a.ord - +b.ord);
  tb.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = enc(r.key);
    if (scope === 'months' || scope === 'weeks') {
      if (r.key === 'All') tr.className = 'mb-total';
      else if (r.key === p) tr.className = 'mb-picked';
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => dash.setParams({ period: r.key === 'All' || r.key === period() ? null : r.key }));
    }
    ths.forEach((th) => {
      const td = document.createElement('td');
      const v = r[th.dataset.field];
      const fmt = th.dataset.fmt || 'txt';
      if (fmt === 'mon') { td.textContent = monthLabel(r.key); }
      else if (fmt === 'txt') { td.className = 'mb-t'; td.textContent = v == null ? '' : v; }
      else {
        td.className = 'mb-n';
        td.textContent = (v === '' || v == null || (+v === 0 && th.dataset.blankzero)) ? '' : F[fmt](+v);
      }
      tr.append(td);
    });
    return tr;
  }));
});

// Touch-friendly tooltip: shows on tap or drag, hides on lift away.
function tipper(box, W) {
  const tip = box.append('div').attr('class', 'mb-tip').attr('hidden', '');
  return {
    show(lines, xView, yView) {
      tip.attr('hidden', null).selectAll('*').remove();
      lines.forEach((l, i) => tip.append('div').attr('class', l.sub ? 'mb-tipsub' : null).style('font-weight', i === 0 ? 600 : null).text(l.t || l));
      const bw = box.node().clientWidth, tw = tip.node().offsetWidth;
      const px = xView * bw / W;
      tip.style('left', Math.max(0, Math.min(bw - tw, px - tw / 2)) + 'px').style('top', Math.max(0, (yView || 0) * bw / W - 8) + 'px');
    },
    hide() { tip.attr('hidden', ''); }
  };
}
const onTouch = (sel, fn, tip) => sel.on('pointerdown', fn).on('pointermove', fn).on('pointerleave', () => tip.hide());
function legend(el, items) {
  const lg = d3.select(el).append('div').attr('class', 'mb-legend');
  items.forEach(([name, col, dashed]) => {
    const it = lg.append('span').attr('class', 'mb-key');
    const i = it.append('i');
    if (dashed) i.attr('class', 'mb-dash'); else i.style('background', col);
    it.append('span').text(name);
  });
}
const sizeOf = (el) => Math.max(300, el.clientWidth);

// Monthly bars; tap a bar to pick that month for the whole page.
function monthBars(el, rows, series, fmt, label, line) {
  el.replaceChildren();
  if (!rows || !rows.length) { el.textContent = '—'; return; }
  const color = (i) => dash.colors[i % dash.colors.length];
  legend(el, series.map(([, name], i) => [name, color(i)]).concat(line ? [[line.name, null, true]] : []));
  const box = d3.select(el).append('div').attr('class', 'mb-box');
  const W = sizeOf(el), H = 210, m = { t: 16, r: line ? 30 : 2, b: 22, l: 34 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', label);
  const val = (r, k) => Math.max(0, +r[k] || 0);
  const tot = (r) => d3.sum(series, ([k]) => val(r, k));
  const x = d3.scaleBand().domain(rows.map((r) => r.key)).range([m.l, W - m.r]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(rows, tot) || 1]).nice(4).range([H - m.b, m.t]);
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(7).tickFormat(monShort)).call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(fmt === 'usd' ? d3.format('$~s') : d3.format('~s')))
    .call((g) => g.select('.domain').remove());
  let y2 = null;
  if (line) {
    y2 = d3.scaleLinear().domain([0, Math.max(1, d3.max(rows, (r) => +r[line.key]) || 1)]).nice(4).range([H - m.b, m.t]);
    svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(${W - m.r},0)`)
      .call(d3.axisRight(y2).ticks(4).tickSize(0).tickPadding(4).tickFormat((v) => v + '%')).call((g) => g.select('.domain').remove());
  }
  const tip = tipper(box, W);
  const p = period();
  const col = svg.selectAll('g.mb-col').data(rows).join('g').attr('class', 'mb-col')
    .style('opacity', (r) => (p === 'All' || r.key === p) ? 1 : 0.35).style('cursor', 'pointer')
    .on('click', (ev, r) => dash.setParams({ period: r.key === period() ? null : r.key }));
  onTouch(col, (ev, r) => {
    const lines = [monthLabel(r.key)];
    series.forEach(([k, name]) => lines.push(name + ': ' + (fmt === 'usd' ? F.usd0 : F.dec)(val(r, k))));
    if (series.length > 1) lines.push({ t: 'Total: ' + (fmt === 'usd' ? F.usd0 : F.dec)(tot(r)), sub: true });
    if (line) lines.push(line.name + ': ' + F.pct(+r[line.key]));
    tip.show(lines, x(r.key) + x.bandwidth() / 2, m.t);
  }, tip);
  col.each(function (r) {
    let acc = 0;
    const g = d3.select(this);
    g.append('rect').attr('x', x(r.key)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent');
    series.forEach(([k], i) => {
      const v = val(r, k);
      if (!v) return;
      g.append('rect').attr('x', x(r.key)).attr('width', x.bandwidth()).attr('y', y(acc + v)).attr('height', Math.max(0, y(acc) - y(acc + v) - 1)).attr('rx', 1).style('fill', color(i));
      acc += v;
    });
    if (acc && !line) g.append('text').attr('class', 'mb-lbl').attr('x', x(r.key) + x.bandwidth() / 2).attr('y', y(acc) - 4).attr('text-anchor', 'middle').text(fmt === 'usd' ? d3.format('$.2~s')(acc) : d3.format('.0f')(acc));
  });
  if (line) {
    svg.append('path').datum(rows).attr('d', d3.line().x((r) => x(r.key) + x.bandwidth() / 2).y((r) => y2(+r[line.key])))
      .style('fill', 'none').style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 2).style('stroke-dasharray', '5 4').style('pointer-events', 'none');
    svg.selectAll('circle.mb-pt').data(rows).join('circle').attr('class', 'mb-pt').attr('cx', (r) => x(r.key) + x.bandwidth() / 2).attr('cy', (r) => y2(+r[line.key])).attr('r', 3).style('fill', 'var(--cds-chart-reference)').style('pointer-events', 'none');
    svg.selectAll('text.mb-ptl').data(rows).join('text').attr('class', 'mb-lbl mb-ptl').attr('x', (r) => x(r.key) + x.bandwidth() / 2).attr('y', (r) => y2(+r[line.key]) - 7).attr('text-anchor', 'middle').style('pointer-events', 'none').text((r) => d3.format('.0f')(+r[line.key]) + '%');
  }
}
const months = () => { const d = got('monthly'); return d && d.filter((r) => r.kind === 'month'); };
const weeks = () => { const d = got('monthly'); return d && d.filter((r) => r.kind === 'week'); };
dash.draw('chart_wsales', (el) => monthBars(el, weeks(), [['pass_net', 'Day passes'], ['other_net', 'Everything else']], 'usd', 'Net sales per week'));
dash.draw('chart_wocc', (el) => monthBars(el, weeks(), [['guests_per_day', 'Guests a day']], 'num', 'Guests per day open and occupancy, per week', { key: 'occ_pct', name: 'Occupancy' }));
dash.draw('chart_sales', (el) => monthBars(el, months(), [['pass_net', 'Day passes'], ['other_net', 'Everything else']], 'usd', 'Net sales per month'));
dash.draw('chart_occm', (el) => monthBars(el, months(), [['guests_per_day', 'Guests a day']], 'num', 'Guests per day open and occupancy, per month', { key: 'occ_pct', name: 'Occupancy' }));

// Guests on site in each clock hour, against capacity.
dash.draw('chart_hourly', (el) => {
  const d = got('hourly');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.filter((r) => r.period === period() && r.dow === dowP() && +r.hour >= 7).sort((a, b) => +a.hour - +b.hour);
  if (!rows.length) { el.textContent = 'No sessions in this period.'; return; }
  legend(el, [['On site', color0()], ['Capacity', null, true]]);
  const box = d3.select(el).append('div').attr('class', 'mb-box');
  const W = sizeOf(el), H = 220, m = { t: 16, r: 2, b: 22, l: 26 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Average guests on site each hour against capacity');
  const x = d3.scaleBand().domain(rows.map((r) => r.hour)).range([m.l, W - m.r]).padding(0.16);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(+r.capacity, +r.on_site)) || 1]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 30)));
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(7).tickValues(rows.map((r) => r.hour).filter((_, i) => i % every === 0)).tickFormat(hourLabel))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r))).call((g) => g.select('.domain').remove());
  const tip = tipper(box, W);
  const g = svg.selectAll('g.mb-h').data(rows).join('g').attr('class', 'mb-h');
  onTouch(g, (ev, r) => tip.show([hourLong(r.hour) + ' to ' + hourLong(+r.hour + 1), 'On site: ' + F.dec(+r.on_site), 'Capacity: ' + F.dec(+r.capacity), 'Occupancy: ' + F.pct(+r.occ_pct), { t: 'Over ' + r.days + ' days', sub: true }], x(r.hour) + x.bandwidth() / 2, m.t), tip);
  g.append('rect').attr('x', (r) => x(r.hour)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent');
  g.append('rect').attr('x', (r) => x(r.hour)).attr('width', x.bandwidth()).attr('y', (r) => y(+r.on_site)).attr('height', (r) => Math.max(0, y(0) - y(+r.on_site))).attr('rx', 2).style('fill', color0());
  g.append('line').attr('x1', (r) => x(r.hour)).attr('x2', (r) => x(r.hour) + x.bandwidth()).attr('y1', (r) => y(+r.capacity)).attr('y2', (r) => y(+r.capacity)).style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 2).style('stroke-dasharray', '3 2');
  if (x.bandwidth() >= 14) g.append('text').attr('class', 'mb-lbl').style('font-size', x.bandwidth() >= 20 ? '10px' : '8.5px').attr('x', (r) => x(r.hour) + x.bandwidth() / 2).attr('y', (r) => y(+r.on_site) - 4).attr('text-anchor', 'middle').text((r) => d3.format('.0f')(+r.occ_pct) + '%');
});

// Hours down the side, weekdays across the top, so it fits a phone.
function heat(el, cells, hours, val, label, tipLines) {
  el.replaceChildren();
  if (!cells || !cells.length) { el.textContent = '—'; return; }
  const box = d3.select(el).append('div').attr('class', 'mb-box');
  const W = sizeOf(el), m = { t: 18, r: 0, b: 2, l: 30 };
  const cw = (W - m.l - m.r) / 7, ch = 22;
  const H = m.t + m.b + ch * hours.length;
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', label);
  const by = new Map(cells.map((c) => [c.dow + '|' + c.hour, c]));
  const max = d3.max(cells, val) || 1;
  WEEK.forEach((d, i) => svg.append('text').attr('class', 'mb-lbl').style('font-size', '11px').attr('x', m.l + i * cw + cw / 2).attr('y', 12).attr('text-anchor', 'middle').text(d));
  hours.forEach((h, j) => svg.append('text').attr('class', 'mb-lbl').attr('x', m.l - 5).attr('y', m.t + j * ch + ch / 2 + 3.5).attr('text-anchor', 'end').text(hourLabel(h)));
  const tip = tipper(box, W);
  hours.forEach((h, j) => WEEK.forEach((d, i) => {
    const c = by.get(d + '|' + h);
    const v = c ? val(c) : 0;
    const r = svg.append('rect').attr('x', m.l + i * cw + 1).attr('y', m.t + j * ch + 1).attr('width', Math.max(1, cw - 2)).attr('height', ch - 2).attr('rx', 3)
      .style('fill', c ? color0() : 'var(--color-border-line)').style('fill-opacity', c ? 0.08 + 0.92 * v / max : 0.35);
    onTouch(r, () => tip.show(c ? tipLines(d, h, c) : [d + ' ' + hourLong(h), { t: 'Nothing here', sub: true }], m.l + i * cw + cw / 2, m.t + j * ch), tip);
    if (c) svg.append('text').attr('class', 'mb-lbl').attr('x', m.l + i * cw + cw / 2).attr('y', m.t + j * ch + ch / 2 + 3.5).attr('text-anchor', 'middle').style('pointer-events', 'none')
      .style('fill', v / max > 0.55 ? 'var(--color-panel)' : null).text(d3.format('d')(Math.round(v)));
  }));
}
const DAYNAME = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
dash.draw('heat_occ', (el) => {
  const d = got('hourly');
  const cells = d && d.filter((r) => r.period === period() && r.dow !== 'All' && +r.hour >= 7 && +r.hour <= 22);
  heat(el, cells, d3.range(7, 23), (c) => +c.occ_pct, 'Occupancy by weekday and hour',
    (d, h, c) => [DAYNAME[d] + ' ' + hourLong(h), 'Occupancy: ' + F.pct(+c.occ_pct), 'On site: ' + F.dec(+c.on_site) + ' of ' + F.dec(+c.capacity)]);
});
dash.draw('heat_buy', (el) => {
  const d = got('buy_heat');
  const cells = d && d.filter((r) => r.period === period());
  heat(el, cells, d3.range(6, 24), (c) => +c.guests, 'Guests by weekday and hour of purchase',
    (d, h, c) => [DAYNAME[d] + ' ' + hourLong(h), F.int(+c.guests) + ' guests bought']);
});

// Guests per day, point to point; drag across to read a day.
dash.draw('chart_daily', (el) => {
  const d = got('daily');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const p = period();
  const per = (got('monthly') || []).find((r) => r.key === p);
  const rows = d.filter((r) => !per || (r.date >= per.start && r.date <= per.end)).sort((a, b) => a.date < b.date ? -1 : 1);
  if (!rows.length) { el.textContent = '—'; return; }
  const box = d3.select(el).append('div').attr('class', 'mb-box');
  const W = sizeOf(el), H = 200, m = { t: 12, r: 6, b: 22, l: 28 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Guests each day');
  const pd = (s) => new Date(s + 'T00:00:00Z');
  const x = d3.scaleUtc().domain(d3.extent(rows, (r) => pd(r.date))).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.guests) || 1]).nice(4).range([H - m.b, m.t]);
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).ticks(p === 'All' ? d3.utcMonth.every(2) : 4).tickSize(0).tickPadding(7).tickFormat(p === 'All' ? d3.utcFormat('%b') : d3.utcFormat('%b %-d')))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r))).call((g) => g.select('.domain').remove());
  svg.append('path').datum(rows).attr('d', d3.line().x((r) => x(pd(r.date))).y((r) => y(+r.guests))).style('fill', 'none').style('stroke', color0()).style('stroke-width', 1.5);
  const dot = svg.append('circle').attr('r', 4).style('fill', color0()).style('display', 'none');
  const tip = tipper(box, W);
  const hit = svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent').style('touch-action', 'pan-y');
  onTouch(hit, (ev) => {
    const [mx] = d3.pointer(ev);
    const i = d3.minIndex(rows, (r) => Math.abs(pd(r.date) - x.invert(mx)));
    const r = rows[i];
    dot.style('display', null).attr('cx', x(pd(r.date))).attr('cy', y(+r.guests));
    tip.show([dayLabel(r.date), F.int(+r.guests) + ' guests', 'Occupancy: ' + F.pct(+r.occ_pct), 'Net: ' + F.usd0(+r.net)], x(pd(r.date)), m.t);
  }, tip);
});

// Upcoming days already booked.
dash.draw('chart_ahead', (el) => {
  const d = got('ahead');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (!rows.length) { el.textContent = 'Nothing booked ahead.'; return; }
  const box = d3.select(el).append('div').attr('class', 'mb-box');
  const W = sizeOf(el), H = 190, m = { t: 12, r: 2, b: 22, l: 26 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Guests booked for each upcoming day');
  const x = d3.scaleBand().domain(rows.map((r) => r.date)).range([m.l, W - m.r]).padding(0.15);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.guests) || 1]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 52)));
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(7).tickValues(rows.map((r) => r.date).filter((_, i) => i % every === 0)).tickFormat((k) => d3.utcFormat('%b %-d')(new Date(k + 'T00:00:00Z'))))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'mb-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r))).call((g) => g.select('.domain').remove());
  const tip = tipper(box, W);
  const g = svg.selectAll('g.mb-a').data(rows).join('g').attr('class', 'mb-a');
  onTouch(g, (ev, r) => tip.show([dayLabel(r.date), F.int(+r.guests) + ' guests booked', 'Occupancy so far: ' + F.pct(+r.occ_pct)], x(r.date) + x.bandwidth() / 2, m.t), tip);
  g.append('rect').attr('x', (r) => x(r.date)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent');
  g.append('rect').attr('x', (r) => x(r.date)).attr('width', x.bandwidth()).attr('y', (r) => y(+r.guests)).attr('height', (r) => Math.max(0, y(0) - y(+r.guests))).attr('rx', 1).style('fill', color0());
});

// Lead-time buckets as horizontal bars, labels above each bar so they fit.
dash.draw('chart_lead', (el) => {
  const d = got('lead');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.filter((r) => r.period === period() && r.channel === chP()).sort((a, b) => +a.ord - +b.ord);
  if (!rows.length) { el.textContent = 'No guests on this channel in this period.'; return; }
  const box = d3.select(el).append('div').attr('class', 'mb-box');
  const W = sizeOf(el), rowH = 34, m = { r: 56 };
  const H = rows.length * rowH;
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Share of guests by how far ahead they booked');
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.pct) || 1]).range([0, W - m.r]);
  const tip = tipper(box, W);
  rows.forEach((r, i) => {
    const g = svg.append('g');
    onTouch(g, () => tip.show([r.bucket, F.int(+r.guests) + ' guests', F.pct(+r.pct) + ' of guests'], W / 2, i * rowH), tip);
    g.append('rect').attr('x', 0).attr('y', i * rowH).attr('width', W).attr('height', rowH).style('fill', 'transparent');
    g.append('text').attr('class', 'mb-lbl').style('font-size', '11.5px').style('fill', 'var(--color-fg)').attr('x', 0).attr('y', i * rowH + 12).text(r.bucket);
    g.append('rect').attr('x', 0).attr('y', i * rowH + 17).attr('height', 11).attr('width', Math.max(1, x(+r.pct))).attr('rx', 2).style('fill', color0());
    g.append('text').attr('class', 'mb-lbl').style('font-size', '11px').attr('x', x(+r.pct) + 6).attr('y', i * rowH + 26.5).text(F.pct(+r.pct));
  });
});
