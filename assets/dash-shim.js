// Minimal stand-in for the dashboard runtime, so the same page code runs as a static site.
(function () {
  const IDS = ['monthly', 'hourly', 'daily', 'ahead', 'lead', 'lead_dow', 'buy_heat', 'channel', 'party', 'paid', 'sale_type', 'items', 'codes', 'customers', 'frequency'];
  const store = {};
  IDS.forEach((id) => { store[id] = { status: 'loading', data: [] }; });
  const draws = new Map();
  const onDatas = [];
  const readParams = () => {
    const q = new URLSearchParams(location.search);
    const o = {};
    q.forEach((v, k) => { o[k] = v; });
    return o;
  };
  let params = readParams();
  const visible = (el) => !el.closest('[hidden]');
  function runDraw(name) {
    const fn = draws.get(name);
    if (!fn) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (!visible(el)) return;
      try { fn(el); } catch (e) { console.error('draw ' + name, e); }
    });
  }
  function runAll() {
    onDatas.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    draws.forEach((_, n) => runDraw(n));
  }
  const root = getComputedStyle(document.documentElement);
  window.dash = {
    data: (id) => store[id] || { status: 'missing', data: [] },
    params: () => params,
    setParams: (p) => {
      params = Object.assign({}, params, p);
      Object.keys(p).forEach((k) => { if (p[k] == null || p[k] === '') delete params[k]; });
      const q = new URLSearchParams(params).toString();
      history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
      runAll();
    },
    resetParams: () => window.dash.setParams(Object.fromEntries(Object.keys(params).map((k) => [k, null]))),
    onData: (fn) => { onDatas.push(fn); try { fn(); } catch (e) { console.error(e); } },
    draw: (name, fn) => { if (typeof fn === 'function') draws.set(name, fn); else runDraw(name); },
    calc: () => {},
    loader: () => {},
    refresh: () => {},
    setLink: (name) => history.replaceState(null, '', location.pathname + location.search + '#' + name),
    colors: ['var(--c0)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'],
    __start: (base) => {
      const b64 = (s) => Uint8Array.from(atob(s.trim()), (c) => c.charCodeAt(0));
      async function keyFor(pw, meta) {
        const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(meta.salt), iterations: meta.iter, hash: 'SHA-256' }, raw, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      }
      async function open(key, name) {
        const buf = b64(await (await fetch(base + name + '.enc')).text());
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
        return new TextDecoder().decode(plain);
      }
      async function unlock(pw) {
        const meta = await (await fetch(base + 'meta.json')).json();
        const key = await keyFor(pw, meta);
        if ((await open(key, 'check')) !== 'sana') throw new Error('bad');
        await Promise.all(IDS.map((id) => open(key, id).then((t) => { const rows = d3.csvParse(t); store[id] = { status: 'ok', data: rows, columns: rows.columns }; })));
      }
      const gate = document.createElement('div');
      gate.className = 'gate';
      gate.innerHTML = '<div class="gate-card"><div class="gate-title">Sana \u00b7 Trybe bookings</div><p class="gate-sub">Enter the password to view this dashboard.</p><input type="password" class="gate-in" autocomplete="current-password" placeholder="Password" aria-label="Password"><label class="gate-rem"><input type="checkbox" class="gate-chk"> Remember on this device</label><button type="button" class="gate-btn">Open</button><p class="gate-err" hidden>That password didn\u2019t work.</p></div>';
      document.body.classList.add('locked');
      document.body.prepend(gate);
      const inp = gate.querySelector('.gate-in'), btn = gate.querySelector('.gate-btn'), err = gate.querySelector('.gate-err'), chk = gate.querySelector('.gate-chk');
      const done = () => { gate.remove(); document.body.classList.remove('locked'); runAll(); };
      async function attempt(pw, quiet) {
        btn.disabled = true; err.hidden = true;
        try {
          await unlock(pw);
          try { sessionStorage.setItem('sana-pw', pw); if (chk.checked) localStorage.setItem('sana-pw', pw); } catch (e) {}
          done();
        } catch (e) {
          try { sessionStorage.removeItem('sana-pw'); localStorage.removeItem('sana-pw'); } catch (x) {}
          if (!quiet) err.hidden = false;
          btn.disabled = false; inp.focus();
        }
      }
      btn.addEventListener('click', () => attempt(inp.value));
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(inp.value); });
      let saved = null;
      try { saved = sessionStorage.getItem('sana-pw') || localStorage.getItem('sana-pw'); } catch (e) {}
      if (saved) attempt(saved, true); else inp.focus();
      let w = window.innerWidth, timer = null;
      window.addEventListener('resize', () => {
        if (Math.abs(window.innerWidth - w) < 8) return;
        w = window.innerWidth;
        clearTimeout(timer); timer = setTimeout(runAll, 150);
      });
    }
  };
})();
