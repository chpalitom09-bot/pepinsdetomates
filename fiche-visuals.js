/* fiche-visuals.js — éléments visuels des fiches tomates
   - FV.tomato(couleur, px)            : petite tomate SVG réaliste, à la couleur de la variété
   - FV.weightScale(poids, taille, c)  : échelle poids/taille (plus petite → plus grosse tomate du monde)
   - FV.country(nom, code)             : silhouette du pays (frontières noires), chargée depuis countries-shapes.json
   - FV.cycle(cycle, semis, couleur)   : animation du cycle de culture (SMIL, aucune lib)
   - FV.hydrate(racine)                : à appeler après l'insertion du HTML (remplit les pays) */
(function () {
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const L = (k, d) => {
    try { const v = typeof tr === 'function' ? tr(k) : k; return v && v !== k ? v : d; } catch (e) { return d; }
  };
  let uid = 0;

  // ── Couleurs de base des tomates ──────────────────────────────────────────
  const PAL = {
    rouge: '#e03a2f', jaune: '#f6c21b', noire: '#4a2a33', verte: '#7db240', orange: '#f2800f',
    rose: '#ea6197', blanche: '#f3efdc', violette: '#6c43c9', bordeaux: '#7a1d2b', creme: '#e5c98b',
    bleue: '#3f61d6', turquoise: '#19b3a1', corail: '#fb6f5f', saumon: '#f98a7c', chocolat: '#6a3f26',
    ocre: '#cf9a3c', prune: '#722a4e', grise: '#a3a9b3', doree: '#d9b23a',
    bicolore: '#ee7a2c', rayee: '#a8b83a', 'arc-en-ciel': '#e05a7a'
  };
  const baseColor = c => PAL[norm(c)] || PAL.rouge;

  function fillDef(color, id) {
    const k = norm(color);
    if (k === 'bicolore')
      return `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e53935"/><stop offset=".42" stop-color="#ec5a35"/><stop offset=".6" stop-color="#f5a623"/><stop offset="1" stop-color="#f7c52a"/></linearGradient>`;
    if (k === 'rayee')
      return `<linearGradient id="${id}f" x1="0" y1="0" x2=".2" y2="0" spreadMethod="repeat"><stop offset="0" stop-color="#6fae3f"/><stop offset=".5" stop-color="#6fae3f"/><stop offset=".5" stop-color="#e9b52a"/><stop offset="1" stop-color="#e9b52a"/></linearGradient>`;
    if (k === 'arc-en-ciel')
      return `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ef4444"/><stop offset=".25" stop-color="#f59e0b"/><stop offset=".5" stop-color="#84cc16"/><stop offset=".75" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>`;
    return `<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${baseColor(color)}"/><stop offset="1" stop-color="${baseColor(color)}"/></linearGradient>`;
  }

  // ── Tomate réaliste ───────────────────────────────────────────────────────
  function tomato(color, px) {
    px = px || 22;
    const id = 'fvt' + (++uid);
    const body = 'M32 17 C22 10 5 16 5 35 C5 51 17 60 32 60 C47 60 59 51 59 35 C59 16 42 10 32 17Z';
    const sepal = a => `<path transform="rotate(${a} 32 19)" d="M32 19 C28.5 22 27.5 28 32 33 C36.5 28 35.5 22 32 19Z"/>`;
    return `<svg class="fv-tomato" viewBox="0 0 64 66" width="${px}" height="${Math.round(px * 66 / 64)}" aria-hidden="true">
  <defs>
    ${fillDef(color, id)}
    <radialGradient id="${id}s" cx=".36" cy=".3" r=".85">
      <stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/>
    </radialGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cb342"/><stop offset="1" stop-color="#3d7a1f"/></linearGradient>
  </defs>
  <ellipse cx="32" cy="62" rx="19" ry="2.6" fill="#000" opacity=".16"/>
  <path d="${body}" fill="url(#${id}f)"/>
  <path d="${body}" fill="url(#${id}s)"/>
  <path d="M32 18 C25 30 25 47 32 59 M32 18 C39 30 39 47 32 59" fill="none" stroke="#000" stroke-opacity=".09" stroke-width="1.2"/>
  <ellipse cx="20" cy="29" rx="4.6" ry="8" transform="rotate(28 20 29)" fill="#fff" opacity=".34"/>
  <circle cx="14.5" cy="40" r="1.6" fill="#fff" opacity=".22"/>
  <g fill="url(#${id}g)" stroke="#2f5f17" stroke-width=".4" stroke-linejoin="round">${[-78, -40, 0, 40, 78].map(sepal).join('')}</g>
  <path d="M32 20 C31.5 15 32 11 34 8" fill="none" stroke="#4d7c0f" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;
  }

  // ── Échelle poids / taille ────────────────────────────────────────────────
  const W_MIN = 1, W_MAX = 7661; // ~1 g (tomate groseille) → 7,66 kg (record Guinness 2025)
  const SIZE_W = { cerise: 15, petite: 55, moyenne: 140, grosse: 300, 'tres grosse': 600 };
  const fmtW = g => g >= 1000 ? (g / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' kg' : Math.round(g) + ' g';
  const posOf = g => Math.min(1, Math.max(0, Math.log(g / W_MIN) / Math.log(W_MAX / W_MIN)));

  function weightScale(weight, sizeLabel, color, rawSize) {
    let w = Number(weight) || 0;
    if (!w && rawSize) w = SIZE_W[norm(rawSize)] || 0;
    if (!w) return '';
    const p = posOf(w);
    const vis = Math.min(96, Math.max(4, p * 100));
    const ticks = [1, 10, 100, 1000].map(g => `<i style="left:${posOf(g) * 100}%"><b>${fmtW(g)}</b></i>`).join('');
    const head = (weight ? `<b>${fmtW(w)}</b>` : `<b>≈ ${fmtW(w)}</b>`) + (sizeLabel ? ` <span>· ${sizeLabel}</span>` : '');
    return `<div class="fv-card">
  <div class="fv-card-title">${L('fv_weight_size', 'Poids &amp; taille')}</div>
  <div class="fv-scale-head">${head}</div>
  <div class="fv-scale">
    <div class="fv-end fv-end-l">${tomato(color, 14)}<small>${L('fv_smallest', 'Plus petite')}<br>~1 g</small></div>
    <div class="fv-track-wrap">
      <div class="fv-marker" style="--p:${vis}%">${tomato(color, 34)}<span class="fv-pin"></span></div>
      <div class="fv-track"><span class="fv-fill" style="--p:${vis}%"></span>${ticks}</div>
    </div>
    <div class="fv-end fv-end-r">${tomato(color, 40)}<small>${L('fv_biggest', 'Record')}<br>7,66 kg</small></div>
  </div>
  <div class="fv-note">${L('fv_log_note', 'Échelle logarithmique : de la plus petite à la plus grosse tomate du monde.')}</div>
</div>`;
  }

  // ── Pays (silhouette) ─────────────────────────────────────────────────────
  let shapesPromise = null;
  function loadShapes() {
    if (!shapesPromise) shapesPromise = fetch('countries-shapes.json').then(r => r.json()).catch(() => ({}));
    return shapesPromise;
  }
  function country(name, code) {
    if (!name) return '';
    return `<div class="fv-country-row"><div class="fv-country" data-code="${code || ''}"></div><span>${name}</span></div>`;
  }
  function hydrate(root) {
    root = root || document;
    root.querySelectorAll('.fv-country[data-code]').forEach(el => {
      const code = el.getAttribute('data-code');
      if (!code) { el.remove(); return; }
      loadShapes().then(S => {
        const s = S[code];
        if (!s) { el.remove(); return; }
        const k = 1.45, w = (s.w + 4) * k, h = (s.h + 4) * k;
        el.innerHTML = `<svg viewBox="-2 -2 ${s.w + 4} ${s.h + 4}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" role="img" aria-label="${code}">
  <path d="${s.d}" fill="#fff1e8" stroke="#111" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke" fill-rule="evenodd"/></svg>`;
      });
    });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.querySelectorAll('svg.fv-cycle-svg').forEach(svg => {
        try { svg.setCurrentTime(8.8); svg.pauseAnimations(); } catch (e) {}
      });
    }
  }

  // ── Cycle animé ───────────────────────────────────────────────────────────
  const DUR = 10;
  const an = (attr, vals, times, extra) =>
    `<animate attributeName="${attr}" values="${vals.join(';')}" keyTimes="${times.join(';')}" dur="${DUR}s" repeatCount="indefinite" ${extra || ''}/>`;
  const at = (type, vals, times) =>
    `<animateTransform attributeName="transform" type="${type}" values="${vals.join(';')}" keyTimes="${times.join(';')}" dur="${DUR}s" repeatCount="indefinite"/>`;

  function leaf(x, y, a, t0, t1, s) {
    return `<g transform="translate(${x} ${y}) rotate(${a})"><g>${at('scale', [0, 0, s || 1, s || 1], [0, t0, t1, 1])}
      <path d="M0 0 C7 -8 19 -8 25 0 C19 8 7 8 0 0Z" fill="#5fa83a" stroke="#3f7d20" stroke-width=".6"/><path d="M2 0 L22 0" stroke="#3f7d20" stroke-width=".6" opacity=".6"/></g></g>`;
  }
  function flower(x, y) {
    const petals = [0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-3.6" rx="2.2" ry="3.4" transform="rotate(${a})" fill="#ffd43b"/>`).join('');
    return `<g transform="translate(${x} ${y})"><g>${at('scale', [0, 0, 1, 1, 0, 0], [0, .5, .56, .64, .68, 1])}${petals}<circle r="1.8" fill="#f08c00"/></g></g>`;
  }
  function fruit(x, y, r, base, t0) {
    const ry = r * .92;
    const star = `<path transform="translate(0 ${-ry + 1.2}) scale(${r / 9})" d="M0,-3 L1.2,-1 L4,-1.8 L2.2,0.4 L3.6,3 L0.9,1.8 L-0.9,1.8 L-3.6,3 L-2.2,0.4 L-4,-1.8 L-1.2,-1Z" fill="#3f7d20"/>`;
    return `<g transform="translate(${x} ${y})"><g>${at('scale', [0, 0, .3, .72, 1, 1], [0, t0, t0 + .04, t0 + .16, t0 + .28, 1])}
      <ellipse rx="${r}" ry="${ry}" fill="#86bf4f">${an('fill', ['#86bf4f', '#86bf4f', base, base], [0, t0 + .12, t0 + .3, 1])}</ellipse>
      <ellipse rx="${r}" ry="${ry}" fill="url(#fvcs)"/>
      <ellipse cx="${-r * .35}" cy="${-r * .35}" rx="${r * .22}" ry="${r * .38}" transform="rotate(30 ${-r * .35} ${-r * .35})" fill="#fff" opacity=".35"/>${star}</g></g>`;
  }

  function cycle(cycleTxt, semisTxt, color) {
    if (!cycleTxt) return '';
    const base = baseColor(color);
    const stages = [
      [L('fv_st_sow', 'Semis'), 0, .14], [L('fv_st_grow', 'Croissance'), .14, .5], [L('fv_st_flower', 'Floraison'), .5, .64],
      [L('fv_st_green', 'Fruits verts'), .64, .8], [L('fv_st_ripe', 'Maturité !'), .8, 1]
    ];
    const label = stages.map(([txt, a, b]) => {
      const f = .025;
      const vals = a === 0 ? [1, 1, 0, 0] : b === 1 ? [0, 0, 1, 1] : [0, 0, 1, 1, 0, 0];
      const times = a === 0 ? [0, b - f, b, 1] : b === 1 ? [0, a, a + f, 1] : [0, a, a + f, b - f, b, 1];
      return `<text x="14" y="23" font-size="12" font-weight="700" fill="#166534" opacity="0">${txt}${an('opacity', vals, times)}</text>`;
    }).join('');
    const dots = stages.map(([, a]) => `<circle cx="${20 + a * 220}" cy="164" r="3" fill="#fff" stroke="#16a34a" stroke-width="1.5"/>`).join('');
    const rays = Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="-17" x2="0" y2="-21" transform="rotate(${i * 45})" stroke="#fbbf24" stroke-width="2" stroke-linecap="round"/>`).join('');
    const sapling = (d, t0, t1) => `<path d="${d}" pathLength="1" fill="none" stroke="#4d8f2b" stroke-width="3.4" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1">${an('stroke-dashoffset', [1, 1, 0, 0], [0, t0, t1, 1])}</path>`;
    const info = `<div class="fv-cycle-info"><b>${L('fv_cycle', 'Cycle')} : ${cycleTxt}</b>${semisTxt ? `<span>${L('fv_sow', 'Semis')} : ${semisTxt}</span>` : ''}</div>`;
    return `<div class="fv-card">
  <div class="fv-card-title">${L('fv_cycle_title', 'Cycle de culture')}</div>
  <svg class="fv-cycle-svg" viewBox="0 0 260 176" role="img" aria-label="${L('fv_cycle_title', 'Cycle de culture')}">
    <defs>
      <linearGradient id="fvsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset="1" stop-color="#fefce8"/></linearGradient>
      <radialGradient id="fvcs" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
    </defs>
    <rect width="260" height="176" rx="14" fill="url(#fvsky)"/>
    <g transform="translate(228 34)"><circle r="12" fill="#fbbf24"/><g>${at('rotate', ['0', '360'], [0, 1])}${rays}</g></g>
    ${label}
    <path d="M0 126 Q65 118 130 124 T260 124 L260 140 Q260 150 250 150 L10 150 Q0 150 0 140Z" fill="#8b5e3c"/>
    <path d="M0 126 Q65 118 130 124 T260 124 L260 130 Q195 127 130 130 T0 132Z" fill="#a5774f"/>
    <ellipse cx="130" cy="131" rx="5" ry="3" fill="#d7b27a">${an('opacity', [1, 1, 0, 0, 0, 1], [0, .1, .16, .97, .99, 1])}</ellipse>
    <g>${an('opacity', [1, 1, 0, 0], [0, .94, .99, 1])}
      ${sapling('M130 126 C127 104 134 84 130 52', .08, .46)}
      ${sapling('M130 94 C112 90 102 84 92 72', .3, .5)}
      ${sapling('M130 80 C148 76 160 70 170 62', .34, .52)}
      ${leaf(129, 112, -150, .18, .3, .9)}${leaf(131, 106, -30, .2, .32, .9)}
      ${leaf(127, 92, -160, .3, .42)}${leaf(133, 74, -20, .34, .46)}
      ${leaf(129, 62, -135, .38, .5, .8)}${leaf(131, 56, -55, .4, .52, .8)}
      ${flower(92, 70)}${flower(170, 60)}${flower(130, 50)}
      ${fruit(90, 83, 9, base, .62)}${fruit(171, 73, 10, base, .64)}${fruit(130, 60, 8, base, .66)}
    </g>
    <rect x="20" y="162" width="220" height="4" rx="2" fill="#d1d5db"/>
    <rect x="20" y="162" width="0" height="4" rx="2" fill="#22c55e">${an('width', [0, 0, 220, 220], [0, .02, .97, 1])}</rect>
    ${dots}
  </svg>
  ${info}
</div>`;
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const css = `
.fv-inline{display:inline-flex;align-items:center;gap:8px}
.fv-tomato{display:inline-block;vertical-align:middle;flex-shrink:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.12))}
.fv-card{margin:0 0 22px;padding:16px 18px;border:1px solid var(--line,#e5e7eb);border-radius:16px;background:var(--card-bg,rgba(255,255,255,.6))}
.fv-card-title{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted,#6b7280);margin-bottom:10px}
.fv-scale-head{font-size:15px;margin-bottom:4px}.fv-scale-head span{color:var(--text-muted,#6b7280)}
.fv-scale{display:flex;align-items:flex-end;gap:10px;padding-top:6px}
.fv-end{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-width:48px}
.fv-end small{font-size:10.5px;line-height:1.25;color:var(--text-muted,#6b7280)}
.fv-track-wrap{position:relative;flex:1;min-width:0;height:78px;margin-bottom:34px}
.fv-track{position:absolute;left:0;right:0;bottom:0;height:8px;border-radius:99px;background:linear-gradient(90deg,#fde8e4,#f3c9c1);box-shadow:inset 0 1px 2px rgba(0,0,0,.12)}
.fv-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#f7a99d,#e03a2f);width:var(--p);animation:fvGrow 1.1s cubic-bezier(.22,1,.36,1) both}
.fv-track i{position:absolute;top:-3px;width:1.5px;height:14px;background:rgba(0,0,0,.28);transform:translateX(-50%)}
.fv-track i b{position:absolute;top:18px;left:50%;transform:translateX(-50%);font-size:10px;font-style:normal;font-weight:600;color:var(--text-muted,#6b7280);white-space:nowrap}
.fv-marker{position:absolute;bottom:6px;left:var(--p);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;animation:fvSlide 1.1s cubic-bezier(.34,1.4,.5,1) both}
.fv-marker .fv-tomato{filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
.fv-pin{width:2px;height:10px;background:#111;border-radius:2px;margin-top:-2px}
.fv-note{font-size:11px;color:var(--text-muted,#6b7280);margin-top:2px}
.fv-country-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.fv-country svg{display:block;max-width:100%;height:auto;filter:drop-shadow(0 2px 3px rgba(0,0,0,.12))}
.fv-cycle-svg{display:block;width:100%;max-width:420px;height:auto;border-radius:14px}
.fv-cycle-info{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:10px;font-size:14px}
.fv-cycle-info span{color:var(--text-muted,#6b7280)}
@keyframes fvSlide{from{left:0}to{left:var(--p)}}
@keyframes fvGrow{from{width:0}to{width:var(--p)}}
@media (prefers-reduced-motion:reduce){.fv-marker,.fv-fill{animation:none}}
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  // ── Extraction du cycle / semis depuis la description importée ───────────
  function parseCulture(t) {
    const d = (t && t.description) || '';
    const c = (t && t.cycle) || ((/cycle\s+([^,.\n]+)/i.exec(d) || [])[1] || '').trim();
    const s = (t && t.semis) || ((/semis\s+([^,.\n]+)/i.exec(d.split('Culture :')[1] || '') || [])[1] || '').trim();
    return { cycle: c, semis: s };
  }

  window.FV = { tomato, weightScale, country, cycle, hydrate, parseCulture };
})();
