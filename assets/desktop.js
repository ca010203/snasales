const F = {
  usd: d3.format('$,.2f'), usd0: d3.format('$,.0f'), int: d3.format(',d'), dec: d3.format(',.1f'),
  pct: (v) => d3.format('.1f')(v) + '%',
  hrs: (v) => v >= 48 ? d3.format('.1f')(v / 24) + ' days' : d3.format('.1f')(v) + ' hrs',
  txt: (v) => v
};
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PANELS = ['overview', 'occupancy', 'buying', 'mix', 'guests', 'founding'];
const DRAWINGS = ['num', 'period', 'periodname', 'rows', 'chart_sales', 'chart_occm', 'chart_occday', 'chart_wsales', 'chart_wocc', 'chart_frev', 'chart_fvis', 'chart_fhour', 'heat_fhour', 'chart_hourly', 'heat_occ', 'chart_daily', 'chart_ahead', 'chart_lead', 'heat_buy'];
const period = () => dash.params().period || 'All';
const dowP = () => dash.params().dow || 'All';
const chP = () => dash.params().ch || 'All';
const got = (id) => { const g = dash.data(id); return g.status === 'ok' ? g.data : null; };
const enc = (s) => String(s).replace(/[%&=]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const monthLabel = (k) => String(k).startsWith('wk-') ? d3.utcFormat('%b %-d')(new Date(k.slice(3) + 'T00:00:00Z')) : d3.utcFormat("%b '%y")(new Date(k + '-01T00:00:00Z'));
const dayLabel = (k) => d3.utcFormat('%a %b %-d')(new Date(k + 'T00:00:00Z'));
const hourLabel = (h) => { h = +h % 24; return (h % 12 || 12) + (h < 12 ? 'am' : 'pm'); };
const color0 = () => dash.colors[0];

// Tabs: one section shows at a time.
window.srTab = PANELS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
function sync() {
  document.querySelectorAll('[data-panel]').forEach((s) => { s.hidden = s.dataset.panel !== window.srTab; });
  document.querySelectorAll('.sr-tab').forEach((b) => {
    const on = b.dataset.tab === window.srTab;
    b.classList.toggle('sr-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.sr-dowsel').forEach((s) => { if (document.activeElement !== s) s.value = dowP(); });
  document.querySelectorAll('.sr-chsel').forEach((s) => { if (document.activeElement !== s) s.value = chP(); });
}
document.querySelectorAll('.sr-tab').forEach((b) => b.addEventListener('click', () => {
  window.srTab = b.dataset.tab;
  sync();
  dash.setLink(b.dataset.tab);
  DRAWINGS.forEach((n) => dash.draw(n));
}));
document.querySelectorAll('.sr-dowsel').forEach((s) => s.addEventListener('change', () => dash.setParams({ dow: s.value === 'All' ? null : s.value })));
document.querySelectorAll('.sr-chsel').forEach((s) => s.addEventListener('change', () => dash.setParams({ ch: s.value === 'All' ? null : s.value })));
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

// One number: data-src is its source (monthly unless said), data-f the column, data-fmt its format, data-k its row (else the period).
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

// Table bodies: columns come from the table's own header cells.
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
      if (r.key === 'All') tr.className = 'sr-total';
      else if (r.key === p) tr.className = 'sr-picked';
      tr.style.cursor = 'pointer';
      tr.onclick = () => dash.setParams({ period: r.key === 'All' || r.key === period() ? null : r.key });
    }
    ths.forEach((th) => {
      const td = document.createElement('td');
      const v = r[th.dataset.field];
      const fmt = th.dataset.fmt || 'txt';
      if (fmt === 'txt') {
        td.textContent = v == null ? '' : (th.dataset.field === 'period' && v === 'All' ? 'Since 18 Mar 2026' : th.dataset.field === 'period' ? monthLabel(v) : v);
      } else {
        td.className = 'sr-n';
        const txt = (v === '' || v == null || (+v === 0 && th.dataset.blankzero)) ? '' : F[fmt](+v);
        if (th.dataset.bar && txt && !tr.classList.contains('sr-total')) {
          const wrap = document.createElement('span'), track = document.createElement('span'), fill = document.createElement('i'), num = document.createElement('span');
          wrap.className = 'sr-share'; track.className = 'sr-track';
          const full = d3.max(rows, (x) => +x[th.dataset.field]) || 100;
          fill.style.width = Math.max(0, Math.min(100, 100 * +v / full)) + '%'; fill.style.background = color0();
          num.textContent = txt;
          track.append(fill); wrap.append(track, num); td.append(wrap);
        } else td.textContent = txt;
      }
      tr.append(td);
    });
    return tr;
  }));
});

// A tooltip inside a chart box: lines of text, placed over the pointer.
function tipper(box, W) {
  const tip = box.append('div').attr('class', 'sr-tip').attr('hidden', '');
  return {
    show(lines, xView, yView) {
      tip.attr('hidden', null).selectAll('*').remove();
      lines.forEach((l, i) => tip.append('div').attr('class', i === 0 ? null : (l.sub ? 'sr-tipsub' : null)).style('font-weight', i === 0 ? 600 : null).text(l.t || l));
      const bw = box.node().clientWidth, tw = tip.node().offsetWidth;
      const px = xView * bw / W;
      tip.style('left', Math.max(0, Math.min(bw - tw, px - tw / 2)) + 'px').style('top', Math.max(0, (yView || 0) * bw / W - 10) + 'px');
    },
    hide() { tip.attr('hidden', ''); }
  };
}
function legend(el, items) {
  const lg = d3.select(el).append('div').attr('class', 'sr-legend');
  items.forEach(([name, col, dashed]) => {
    const it = lg.append('span').attr('class', 'sr-key');
    const i = it.append('i');
    if (dashed) i.attr('class', 'sr-dash'); else i.style('background', col);
    it.append('span').text(name);
  });
}

// Monthly bars, optionally stacked, with totals on top; a click picks that month for the whole page.
function monthBars(el, rows, series, fmt, label, line) {
  el.replaceChildren();
  if (!rows || !rows.length) { el.textContent = '—'; return; }
  const color = (i) => dash.colors[i % dash.colors.length];
  legend(el, series.map(([, name], i) => [name, color(i)]).concat(line ? [[line.name, null, true]] : []));
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), H = 250, m = { t: 18, r: line ? 40 : 6, b: 26, l: 46 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', label);
  const val = (r, k) => Math.max(0, +r[k] || 0);
  const tot = (r) => d3.sum(series, ([k]) => val(r, k));
  const x = d3.scaleBand().domain(rows.map((r) => r.key)).range([m.l, W - m.r]).padding(0.24);
  const y = d3.scaleLinear().domain([0, d3.max(rows, tot) || 1]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 56)));
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(rows.map((r) => r.key).filter((_, i) => i % every === 0)).tickFormat(monthLabel))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(fmt === 'usd' ? d3.format('$~s') : d3.format('~s')))
    .call((g) => g.select('.domain').remove());
  let y2 = null;
  if (line) {
    y2 = d3.scaleLinear().domain([0, Math.max(1, d3.max(rows, (r) => +r[line.key]) || 1)]).nice(4).range([H - m.b, m.t]);
    svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${W - m.r},0)`)
      .call(d3.axisRight(y2).ticks(4).tickSize(0).tickPadding(6).tickFormat((v) => v + '%'))
      .call((g) => g.select('.domain').remove());
  }
  const tip = tipper(box, W);
  const p = period();
  const col = svg.selectAll('g.sr-col').data(rows).join('g').attr('class', 'sr-col')
    .style('opacity', (r) => (p === 'All' || r.key === p) ? 1 : 0.35).style('cursor', 'pointer')
    .on('click', (ev, r) => dash.setParams({ period: r.key === period() ? null : r.key }))
    .on('pointermove', (ev, r) => {
      const lines = [monthLabel(r.key)];
      series.forEach(([k, name]) => lines.push(name + ': ' + (fmt === 'usd' ? F.usd0 : F.dec)(val(r, k))));
      if (series.length > 1) lines.push({ t: 'Total: ' + (fmt === 'usd' ? F.usd0 : F.dec)(tot(r)), sub: true });
      if (line) lines.push(line.name + ': ' + F.pct(+r[line.key]));
      tip.show(lines, x(r.key) + x.bandwidth() / 2, m.t);
    })
    .on('pointerleave', () => tip.hide());
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
    if (acc && x.bandwidth() >= 26 && !line) g.append('text').attr('class', 'sr-barlabel').attr('x', x(r.key) + x.bandwidth() / 2).attr('y', y(acc) - 5).attr('text-anchor', 'middle').text(fmt === 'usd' ? d3.format('$.2~s')(acc) : d3.format('.0f')(acc));
  });
  if (line) {
    const ln = d3.line().x((r) => x(r.key) + x.bandwidth() / 2).y((r) => y2(+r[line.key]));
    svg.append('path').datum(rows).attr('d', ln).style('fill', 'none').style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 2).style('stroke-dasharray', '5 4').style('pointer-events', 'none');
    svg.selectAll('circle.sr-pt').data(rows).join('circle').attr('class', 'sr-pt').attr('cx', (r) => x(r.key) + x.bandwidth() / 2).attr('cy', (r) => y2(+r[line.key])).attr('r', 3).style('fill', 'var(--cds-chart-reference)').style('pointer-events', 'none');
    if (x.bandwidth() >= 30) svg.selectAll('text.sr-ptl').data(rows).join('text').attr('class', 'sr-barlabel sr-ptl').attr('x', (r) => x(r.key) + x.bandwidth() / 2).attr('y', (r) => y2(+r[line.key]) - 8).attr('text-anchor', 'middle').style('pointer-events', 'none').text((r) => d3.format('.0f')(+r[line.key]) + '%');
  }
}
const fmonths = () => { const d = got('founding'); return d && d.filter((r) => r.kind === 'month' && r.key !== '2026-03'); };
dash.draw('chart_frev', (el) => monthBars(el, fmonths(), [['charges', 'Monthly fees'], ['signups', 'Sign-ups']], 'usd', 'Founding membership revenue per month'));
dash.draw('chart_fvis', (el) => monthBars(el, fmonths(), [['visits', 'Member visits']], 'num', 'Founding member visits per month'));
const months = () => { const d = got('monthly'); return d && d.filter((r) => r.kind === 'month'); };
const weeks = () => { const d = got('monthly'); return d && d.filter((r) => r.kind === 'week'); };
dash.draw('chart_wsales', (el) => monthBars(el, weeks(), [['pass_net', 'Day passes'], ['other_net', 'Everything else']], 'usd', 'Net sales per week, day passes and everything else'));
dash.draw('chart_wocc', (el) => monthBars(el, weeks(), [['guests_per_day', 'Guests a day']], 'num', 'Average guests per day open and occupancy, per week', { key: 'occ_pct', name: 'Occupancy (right axis)' }));
dash.draw('chart_sales', (el) => monthBars(el, months(), [['pass_net', 'Day passes'], ['other_net', 'Everything else']], 'usd', 'Net sales per month, day passes and everything else'));
dash.draw('chart_occm', (el) => monthBars(el, months(), [['guests_per_day', 'Guests a day']], 'num', 'Average guests per day open and occupancy, per month', { key: 'occ_pct', name: 'Occupancy (right axis)' }));

// Guests on site in each clock hour, against capacity.
dash.draw('chart_hourly', (el) => {
  const d = got('hourly');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.filter((r) => r.period === period() && r.dow === dowP() && +r.hour >= 7).sort((a, b) => +a.hour - +b.hour);
  if (!rows.length) { el.textContent = 'No sessions in this period.'; return; }
  legend(el, [['Guests on site', color0()], ['Capacity', null, true]]);
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), H = 260, m = { t: 20, r: 6, b: 26, l: 34 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Average guests on site in each hour of the day, against capacity');
  const x = d3.scaleBand().domain(rows.map((r) => r.hour)).range([m.l, W - m.r]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(+r.capacity, +r.on_site)) || 1]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 40)));
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(rows.map((r) => r.hour).filter((_, i) => i % every === 0)).tickFormat(hourLabel))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)))
    .call((g) => g.select('.domain').remove());
  const tip = tipper(box, W);
  const g = svg.selectAll('g.sr-h').data(rows).join('g').attr('class', 'sr-h')
    .on('pointermove', (ev, r) => tip.show([hourLabel(r.hour) + ' to ' + hourLabel(+r.hour + 1), 'On site: ' + F.dec(+r.on_site) + ' guests', 'Capacity: ' + F.dec(+r.capacity), 'Occupancy: ' + F.pct(+r.occ_pct), { t: 'Arrivals starting this hour: ' + F.dec(+r.arrivals), sub: true }, { t: 'Averaged over ' + r.days + ' days', sub: true }], x(r.hour) + x.bandwidth() / 2, m.t))
    .on('pointerleave', () => tip.hide());
  g.append('rect').attr('x', (r) => x(r.hour)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent');
  g.append('rect').attr('x', (r) => x(r.hour)).attr('width', x.bandwidth()).attr('y', (r) => y(+r.on_site)).attr('height', (r) => Math.max(0, y(0) - y(+r.on_site))).attr('rx', 2).style('fill', color0());
  g.append('line').attr('x1', (r) => x(r.hour)).attr('x2', (r) => x(r.hour) + x.bandwidth()).attr('y1', (r) => y(+r.capacity)).attr('y2', (r) => y(+r.capacity)).style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 2).style('stroke-dasharray', '4 3');
  if (x.bandwidth() >= 22) g.append('text').attr('class', 'sr-barlabel').attr('x', (r) => x(r.hour) + x.bandwidth() / 2).attr('y', (r) => y(+r.on_site) - 5).attr('text-anchor', 'middle').text((r) => d3.format('.0f')(+r.occ_pct) + '%');
});

// A weekday-by-hour grid; darker cells hold more.
function heat(el, cells, hours, val, fmt, label, tipLines) {
  el.replaceChildren();
  if (!cells || !cells.length) { el.textContent = '—'; return; }
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), m = { t: 4, r: 4, b: 24, l: 36 };
  const cw = (W - m.l - m.r) / hours.length, ch = Math.max(18, Math.min(30, cw * 0.9));
  const H = m.t + m.b + ch * 7;
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', label);
  const by = new Map(cells.map((c) => [c.dow + '|' + c.hour, c]));
  const max = d3.max(cells, val) || 1;
  const every = Math.ceil(hours.length / Math.max(1, Math.floor((W - m.l) / 38)));
  hours.forEach((h, i) => { if (i % every === 0) svg.append('text').attr('class', 'sr-barlabel').attr('x', m.l + i * cw + cw / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(hourLabel(h)); });
  WEEK.forEach((d, j) => svg.append('text').attr('class', 'sr-barlabel').attr('x', m.l - 6).attr('y', m.t + j * ch + ch / 2 + 4).attr('text-anchor', 'end').text(d));
  const tip = tipper(box, W);
  WEEK.forEach((d, j) => hours.forEach((h, i) => {
    const c = by.get(d + '|' + h);
    const v = c ? val(c) : 0;
    svg.append('rect').attr('x', m.l + i * cw + 1).attr('y', m.t + j * ch + 1).attr('width', Math.max(1, cw - 2)).attr('height', ch - 2).attr('rx', 3)
      .style('fill', c ? color0() : 'var(--color-border-line)').style('fill-opacity', c ? 0.08 + 0.92 * v / max : 0.35)
      .on('pointermove', () => tip.show(c ? tipLines(d, h, c) : [d + ' ' + hourLabel(h), { t: 'Nothing here', sub: true }], m.l + i * cw + cw / 2, m.t + j * ch))
      .on('pointerleave', () => tip.hide());
    if (c && cw >= 30) svg.append('text').attr('class', 'sr-barlabel').attr('x', m.l + i * cw + cw / 2).attr('y', m.t + j * ch + ch / 2 + 4).attr('text-anchor', 'middle').style('pointer-events', 'none')
      .style('fill', v / max > 0.55 ? 'var(--color-panel)' : null).text(fmt(v));
  }));
}
const DAYNAME = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
dash.draw('heat_occ', (el) => {
  const d = got('hourly');
  const cells = d && d.filter((r) => r.period === period() && r.dow !== 'All' && +r.hour >= 7 && +r.hour <= 22);
  heat(el, cells, d3.range(7, 23), (c) => +c.occ_pct, (v) => d3.format('.0f')(v), 'Occupancy by weekday and hour',
    (d, h, c) => [DAYNAME[d] + ', ' + hourLabel(h) + ' to ' + hourLabel(h + 1), 'Occupancy: ' + F.pct(+c.occ_pct), 'On site: ' + F.dec(+c.on_site) + ' of ' + F.dec(+c.capacity), { t: 'Averaged over ' + c.days + ' ' + DAYNAME[d] + 's', sub: true }]);
});
// Founding member arrivals by start hour, with their share of everyone arriving that hour.
dash.draw('chart_fhour', (el) => {
  const d = got('founding_hourly');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.filter((r) => r.period === period() && r.dow === dowP()).sort((a, b) => +a.hour - +b.hour);
  if (!rows.length || !d3.sum(rows, (r) => +r.members)) { el.textContent = 'No founding member visits in this period.'; return; }
  legend(el, [['Member arrivals', color0()], ['Share of all guests that hour (right axis)', null, true]]);
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), H = 260, m = { t: 20, r: 38, b: 26, l: 34 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Founding member arrivals by hour of day, with their share of all guests');
  const x = d3.scaleBand().domain(rows.map((r) => r.hour)).range([m.l, W - m.r]).padding(0.2);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.members) || 1]).nice(4).range([H - m.b, m.t]);
  const y2 = d3.scaleLinear().domain([0, Math.max(10, d3.max(rows, (r) => +r.member_share))]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 40)));
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(rows.map((r) => r.hour).filter((_, i) => i % every === 0)).tickFormat(hourLabel))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(d3.format('d')))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${W - m.r},0)`)
    .call(d3.axisRight(y2).ticks(4).tickSize(0).tickPadding(6).tickFormat((v) => v + '%'))
    .call((g) => g.select('.domain').remove());
  const tip = tipper(box, W);
  const g = svg.selectAll('g.sr-h').data(rows).join('g').attr('class', 'sr-h')
    .on('pointermove', (ev, r) => tip.show([hourLabel(r.hour) + ' to ' + hourLabel(+r.hour + 1) + ' arrivals', 'Founding members: ' + F.int(+r.members), 'All guests: ' + F.int(+r.all_guests), 'Members are ' + F.pct(+r.member_share) + ' of guests', { t: F.pct(+r.pct_of_member_visits) + ' of all member visits', sub: true }], x(r.hour) + x.bandwidth() / 2, m.t))
    .on('pointerleave', () => tip.hide());
  g.append('rect').attr('x', (r) => x(r.hour)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent');
  g.append('rect').attr('x', (r) => x(r.hour)).attr('width', x.bandwidth()).attr('y', (r) => y(+r.members)).attr('height', (r) => Math.max(0, y(0) - y(+r.members))).attr('rx', 2).style('fill', color0());
  if (x.bandwidth() >= 18) g.append('text').attr('class', 'sr-barlabel').attr('x', (r) => x(r.hour) + x.bandwidth() / 2).attr('y', (r) => y(+r.members) - 5).attr('text-anchor', 'middle').text((r) => +r.members ? F.int(+r.members) : '');
  const ln = d3.line().x((r) => x(r.hour) + x.bandwidth() / 2).y((r) => y2(+r.member_share));
  svg.append('path').datum(rows).attr('d', ln).style('fill', 'none').style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 2).style('stroke-dasharray', '5 4').style('pointer-events', 'none');
  svg.selectAll('circle.sr-pt').data(rows).join('circle').attr('class', 'sr-pt').attr('cx', (r) => x(r.hour) + x.bandwidth() / 2).attr('cy', (r) => y2(+r.member_share)).attr('r', 3).style('fill', 'var(--cds-chart-reference)').style('pointer-events', 'none');
});
dash.draw('heat_fhour', (el) => {
  const d = got('founding_hourly');
  const cells = d && d.filter((r) => r.period === period() && r.dow !== 'All');
  heat(el, cells, d3.range(7, 21), (c) => +c.members, (v) => d3.format('d')(v), 'Founding member arrivals by weekday and hour',
    (d, h, c) => [DAYNAME[d] + ', ' + hourLabel(h) + ' to ' + hourLabel(h + 1), F.int(+c.members) + ' founding members of ' + F.int(+c.all_guests) + ' guests', 'Member share: ' + F.pct(+c.member_share)]);
});
// Average occupancy through the day: one line per weekday, week or month. Click a line in the key to pick it out.
window.srOccFocus = null;
window.srOccMode = 'day';
dash.draw('chart_occday', (el) => {
  const d = got('hourly');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const mode = window.srOccMode;
  const seg = d3.select(el).append('div').attr('class', 'sr-tabs').attr('role', 'group').attr('aria-label', 'Draw a line for each').style('margin-bottom', '10px');
  [['day', 'Day of week'], ['week', 'Week'], ['month', 'Month']].forEach(([k, l]) => seg.append('button').attr('type', 'button').attr('class', 'sr-tab' + (mode === k ? ' sr-on' : '')).attr('aria-pressed', mode === k ? 'true' : 'false').text(l)
    .on('click', () => { if (mode !== k) { window.srOccMode = k; window.srOccFocus = null; dash.draw('chart_occday'); } }));
  const ok = (r) => +r.hour >= 7 && +r.hour <= 22 && +r.capacity > 0;
  let rows, groups, keyOf, short, name;
  if (mode === 'day') {
    rows = d.filter((r) => r.period === period() && ok(r));
    const nd = (w) => +((rows.find((r) => r.dow === w) || {}).days || 0); const most = d3.max(WEEK, nd) || 0;
    groups = ['All', ...WEEK].filter((w) => rows.some((r) => r.dow === w && +r.on_site > 0) && (w === 'All' || nd(w) >= most / 4));
    keyOf = (r) => r.dow; short = (w) => w === 'All' ? 'Every day' : w; name = (w) => w === 'All' ? 'Every day' : DAYNAME[w];
  } else {
    const per = (got('monthly') || []).filter((r) => r.kind === mode);
    const lab = new Map(per.map((r) => [r.key, r.month]));
    rows = d.filter((r) => r.dow === 'All' && ok(r) && (r.period === 'All' || lab.has(r.period)));
    groups = ['All', ...per.map((r) => r.key).filter((k) => rows.some((r) => r.period === k && +r.on_site > 0))];
    keyOf = (r) => r.period; short = (k) => k === 'All' ? 'All time' : monthLabel(k); name = (k) => k === 'All' ? 'Since 18 Mar' : lab.get(k);
  }
  if (groups.length < 2) { el.append('No sessions in this period.'); return; }
  const n = groups.length - 1;
  const col = (g) => g === 'All' ? 'var(--cds-chart-reference)' : mode === 'day' ? dash.colors[WEEK.indexOf(g) % dash.colors.length] : color0();
  const shade = (g) => g === 'All' || mode === 'day' ? 1 : 0.22 + 0.78 * (n > 1 ? (groups.indexOf(g) - 1) / (n - 1) : 1);
  const dashOf = (g) => g === 'All' ? '5 4' : (mode === 'day' && WEEK.indexOf(g) >= dash.colors.length ? '2 3' : null);
  const focus = window.srOccFocus === '' ? null : groups.includes(window.srOccFocus) ? window.srOccFocus : (mode !== 'day' && groups.includes(period()) && period() !== 'All' ? period() : null);
  const lg = d3.select(el).append('div').attr('class', 'sr-legend');
  groups.forEach((g) => {
    const it = lg.append('button').attr('type', 'button').attr('class', 'sr-key sr-keybtn').attr('aria-pressed', focus === g ? 'true' : 'false').style('opacity', focus && focus !== g ? 0.45 : 1)
      .on('click', () => { window.srOccFocus = focus === g ? '' : g; dash.draw('chart_occday'); });
    const i = it.append('i');
    if (g === 'All') i.attr('class', 'sr-dash'); else i.style('background', col(g)).style('opacity', shade(g));
    it.append('span').text(short(g));
  });
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), H = 270, m = { t: 14, r: 12, b: 26, l: 40 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Average occupancy by hour of the day, one line for each ' + (mode === 'day' ? 'day of the week' : mode));
  const hours = d3.range(7, 23).filter((h) => rows.some((r) => +r.hour === h));
  const x = d3.scalePoint().domain(hours).range([m.l, W - m.r]).padding(0.3);
  const shown = rows.filter((r) => groups.includes(keyOf(r)));
  const y = d3.scaleLinear().domain([0, Math.max(10, d3.max(shown, (r) => +r.occ_pct))]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(hours.length / Math.max(1, Math.floor((W - m.l) / 40)));
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(hours.filter((_, i) => i % every === 0)).tickFormat(hourLabel))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat((v) => v + '%'))
    .call((g) => g.select('.domain').remove());
  const by = d3.group(shown, keyOf);
  const ln = d3.line().x((r) => x(+r.hour)).y((r) => y(+r.occ_pct));
  groups.filter((g) => g !== focus).concat(focus ? [focus] : []).forEach((g) => {
    const pts = (by.get(g) || []).slice().sort((a, b) => +a.hour - +b.hour);
    svg.append('path').datum(pts).attr('d', ln).style('fill', 'none').style('stroke', col(g)).style('stroke-opacity', focus === g ? 1 : shade(g))
      .style('stroke-width', focus === g ? 3 : (g === 'All' ? 2.5 : 1.75)).style('stroke-dasharray', dashOf(g)).style('stroke-linejoin', 'round')
      .style('opacity', focus && focus !== g ? 0.15 : 1).style('pointer-events', 'none');
  });
  const tip = tipper(box, W);
  const step = hours.length > 1 ? x(hours[1]) - x(hours[0]) : W - m.l - m.r;
  const guide = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--color-border-line)').style('stroke-width', 1).style('opacity', 0).style('pointer-events', 'none');
  const hov = svg.selectAll('rect.sr-hov').data(hours).join('rect').attr('class', 'sr-hov').attr('x', (h) => x(h) - step / 2).attr('y', m.t).attr('width', step).attr('height', H - m.b - m.t).style('fill', 'transparent');
  const show = (ev, h) => {
    guide.attr('x1', x(h)).attr('x2', x(h)).style('opacity', 1);
    const lines = (focus ? [focus, 'All'].filter((g, i, a) => a.indexOf(g) === i) : groups).map((g) => { const r = (by.get(g) || []).find((q) => +q.hour === h); return r ? name(g) + ': ' + F.pct(+r.occ_pct) + ' (' + F.dec(+r.on_site) + ' on site)' : null; }).filter(Boolean);
    tip.show([hourLabel(h) + ' to ' + hourLabel(h + 1), ...lines], x(h), m.t);
  };
  hov.on('pointermove', show).on('pointerleave', () => { guide.style('opacity', 0); tip.hide(); });
});
dash.draw('heat_buy', (el) => {
  const d = got('buy_heat');
  const cells = d && d.filter((r) => r.period === period());
  heat(el, cells, d3.range(0, 24), (c) => +c.guests, (v) => d3.format('d')(v), 'Guests by weekday and hour of purchase',
    (d, h, c) => [DAYNAME[d] + ', ' + hourLabel(h) + ' to ' + hourLabel(h + 1), F.int(+c.guests) + ' guests booked in this hour']);
});

// Guests per day, point to point.
dash.draw('chart_daily', (el) => {
  const d = got('daily');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const p = period();
  const per = (got('monthly') || []).find((r) => r.key === p);
  const rows = d.filter((r) => !per || (r.date >= per.start && r.date <= per.end)).sort((a, b) => a.date < b.date ? -1 : 1);
  if (!rows.length) { el.textContent = '—'; return; }
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), H = 240, m = { t: 14, r: 10, b: 26, l: 34 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Guests each day');
  const pd = (s) => new Date(s + 'T00:00:00Z');
  const x = d3.scaleUtc().domain(d3.extent(rows, (r) => pd(r.date))).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.guests) || 1]).nice(4).range([H - m.b, m.t]);
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).ticks(p === 'All' ? d3.utcMonth.every(Math.max(1, Math.ceil(9 * 60 / (W - m.l)))) : Math.max(2, Math.floor((W - m.l) / 80))).tickSize(0).tickPadding(8).tickFormat(p === 'All' ? d3.utcFormat("%b '%y") : d3.utcFormat('%b %-d')))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)))
    .call((g) => g.select('.domain').remove());
  svg.append('path').datum(rows).attr('d', d3.line().x((r) => x(pd(r.date))).y((r) => y(+r.guests))).style('fill', 'none').style('stroke', color0()).style('stroke-width', 1.75);
  const dot = svg.append('circle').attr('r', 4).style('fill', color0()).style('display', 'none');
  const tip = tipper(box, W);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [mx] = d3.pointer(ev);
      const t = x.invert(mx);
      const i = d3.minIndex(rows, (r) => Math.abs(pd(r.date) - t));
      const r = rows[i];
      dot.style('display', null).attr('cx', x(pd(r.date))).attr('cy', y(+r.guests));
      tip.show([dayLabel(r.date), F.int(+r.guests) + ' guests', 'Occupancy: ' + F.pct(+r.occ_pct), 'Net sales: ' + F.usd0(+r.net)], x(pd(r.date)), m.t);
    })
    .on('pointerleave', () => { tip.hide(); dot.style('display', 'none'); });
});

// Upcoming days already booked.
dash.draw('chart_ahead', (el) => {
  const d = got('ahead');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (!rows.length) { el.textContent = 'Nothing booked ahead.'; return; }
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), H = 220, m = { t: 14, r: 6, b: 26, l: 30 };
  const svg = box.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Guests already booked for each upcoming day');
  const x = d3.scaleBand().domain(rows.map((r) => r.date)).range([m.l, W - m.r]).padding(0.18);
  const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.guests) || 1]).nice(4).range([H - m.b, m.t]);
  const every = Math.ceil(rows.length / Math.max(1, Math.floor((W - m.l) / 64)));
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickSize(0).tickPadding(8).tickValues(rows.map((r) => r.date).filter((_, i) => i % every === 0)).tickFormat((k) => d3.utcFormat('%b %-d')(new Date(k + 'T00:00:00Z'))))
    .call((g) => g.select('.domain').remove());
  svg.append('g').attr('class', 'sr-axis').attr('transform', `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)))
    .call((g) => g.select('.domain').remove());
  const tip = tipper(box, W);
  const g = svg.selectAll('g.sr-a').data(rows).join('g').attr('class', 'sr-a')
    .on('pointermove', (ev, r) => tip.show([dayLabel(r.date), F.int(+r.guests) + ' guests booked', 'Occupancy so far: ' + F.pct(+r.occ_pct)], x(r.date) + x.bandwidth() / 2, m.t))
    .on('pointerleave', () => tip.hide());
  g.append('rect').attr('x', (r) => x(r.date)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).style('fill', 'transparent');
  g.append('rect').attr('x', (r) => x(r.date)).attr('width', x.bandwidth()).attr('y', (r) => y(+r.guests)).attr('height', (r) => Math.max(0, y(0) - y(+r.guests))).attr('rx', 1).style('fill', color0());
});

// Lead-time buckets as horizontal bars.
dash.draw('chart_lead', (el) => {
  const d = got('lead');
  el.replaceChildren();
  if (!d) { el.textContent = '—'; return; }
  const rows = d.filter((r) => r.period === period() && r.channel === chP()).sort((a, b) => +a.ord - +b.ord);
  if (!rows.length) { el.textContent = 'No guests on this channel in this period.'; return; }
  const box = d3.select(el).append('div').attr('class', 'sr-chartbox');
  const W = Math.max(280, el.clientWidth), rowH = 28, m = { t: 4, r: 96, b: 4, l: 0 };
  const svg = box.append('svg').attr('width', '100%').attr('role', 'img').attr('aria-label', 'Share of guests by how far ahead they booked');
  const lab = svg.append('g');
  rows.forEach((r, i) => lab.append('text').attr('class', 'sr-barlabel').style('font-size', 'var(--cds-font-size-caption)').attr('x', 0).attr('y', m.t + i * rowH + rowH / 2 + 4).text(r.bucket));
  const lw = Math.ceil(d3.max(lab.selectAll('text').nodes(), (n) => n.getComputedTextLength()) || 140) + 12;
  const H = m.t + m.b + rows.length * rowH;
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => +r.pct) || 1]).range([lw, Math.max(lw + 40, W - m.r)]);
  const tip = tipper(box, W);
  rows.forEach((r, i) => {
    const g = svg.append('g').on('pointermove', () => tip.show([r.bucket, F.int(+r.guests) + ' guests', F.pct(+r.pct) + ' of guests'], x(+r.pct) / 2 + lw / 2, m.t + i * rowH)).on('pointerleave', () => tip.hide());
    g.append('rect').attr('x', 0).attr('y', m.t + i * rowH).attr('width', W).attr('height', rowH).style('fill', 'transparent');
    g.append('rect').attr('x', lw).attr('y', m.t + i * rowH + 5).attr('height', rowH - 10).attr('width', Math.max(0, x(+r.pct) - lw)).attr('rx', 2).style('fill', color0());
    g.append('text').attr('class', 'sr-barlabel').attr('x', x(+r.pct) + 6).attr('y', m.t + i * rowH + rowH / 2 + 4).text(F.pct(+r.pct) + ' · ' + F.int(+r.guests));
  });
});
