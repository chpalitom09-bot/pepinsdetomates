/* lists.js — « Ma liste de courses » (une seule liste, enregistrée dans le navigateur) + partage par lien
   Lien de partage :  ?l=id1~id2~id3&n=Nom%20de%20la%20liste
     l = ids des variétés séparés par "~" (sûr dans une URL, absent des ids Firebase)   n = nom de la liste
   Dépend de window.TL (exposé par index.html) et de window.FV (fiche-visuals.js). */
(function () {
  const KEY = 'pdt_cart_v1', OLD_KEY = 'pdt_lists_v1', DEFAULT_NAME = 'Ma liste de courses';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TLx = () => window.TL || { getTomatoes: () => [], openDetail() {}, toast() {}, detailId: () => null };
  const thumb = t => { const u = (t && ((t.imageURLs && t.imageURLs[0]) || t.imageURL)) || ''; return window.FV && u ? FV.thumb(u, 120) : u; };

  // ── Stockage (migre les anciennes listes « j'ai / je cherche » en une seule) ──
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.ids)) return { ids: d.ids, done: d.done || {}, name: d.name || DEFAULT_NAME };
    } catch (e) {}
    const s = { ids: [], done: {}, name: DEFAULT_NAME };
    try {
      const old = JSON.parse(localStorage.getItem(OLD_KEY));
      if (old && Array.isArray(old.lists)) old.lists.forEach(l => (l.ids || []).forEach(i => { if (!s.ids.includes(i)) s.ids.push(i); }));
    } catch (e) {}
    return s;
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { TLx().toast('Stockage local indisponible', 'fa-triangle-exclamation'); }
    refresh();
    renderManage();
  }
  window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); refresh(); renderManage(); } });

  const has = id => S.ids.includes(id);
  function toggle(id) {
    if (has(id)) { S.ids = S.ids.filter(i => i !== id); delete S.done[id]; save(); TLx().toast('Retirée de ta liste', 'fa-cart-shopping'); }
    else { S.ids.unshift(id); save(); TLx().toast('Ajoutée à ta liste', 'fa-cart-shopping'); }
  }

  // ── Partage ───────────────────────────────────────────────────────────────
  const linkFor = () => location.origin + location.pathname + '?l=' + S.ids.join('~') + '&n=' + encodeURIComponent(S.name || DEFAULT_NAME);
  async function copyLink() {
    if (!S.ids.length) return TLx().toast('Ta liste est vide', 'fa-circle-info');
    const url = linkFor();
    try { await navigator.clipboard.writeText(url); TLx().toast('Lien de la liste copié !', 'fa-link'); }
    catch (e) { window.prompt('Copie ce lien :', url); }
  }
  async function shareList() {
    if (!S.ids.length) return TLx().toast('Ta liste est vide', 'fa-circle-info');
    if (navigator.share) { try { await navigator.share({ title: S.name, text: `Ma liste de tomates (${S.ids.length}) 🍅`, url: linkFor() }); } catch (e) {} }
    else copyLink();
  }
  function parseShared() {
    const p = new URLSearchParams(location.search), raw = p.get('l');
    if (!raw) return null;
    const ids = Array.from(new Set(raw.split('~').filter(i => /^[\w-]{1,64}$/.test(i)))).slice(0, 400);
    return ids.length ? { ids, name: (p.get('n') || 'Liste partagée').slice(0, 60) } : null;
  }

  // ── Modales ───────────────────────────────────────────────────────────────
  const closeEl = el => el && el.classList.remove('active');
  function modal(id, maxw) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'modal-overlay pl-overlay';
      el.id = id;
      el.innerHTML = `<div class="modal" style="max-width:${maxw}px"><div class="modal-header"><div class="modal-title"></div><button class="modal-close" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body"></div></div>`;
      el.addEventListener('mousedown', e => { if (e.target === el) closeEl(el); });
      el.querySelector('.modal-close').onclick = () => closeEl(el);
      document.body.appendChild(el);
    }
    return el;
  }
  const show = el => requestAnimationFrame(() => el.classList.add('active'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { const o = document.querySelector('.pl-overlay.active'); if (o) closeEl(o); }
  });

  function row(t, mode) {
    const img = thumb(t);
    const color = window.FV ? FV.tomato(t.color, 16) : '';
    const done = mode === 'cart' && S.done[t.id];
    const left = mode === 'cart'
      ? `<button class="pl-chk" data-act="check" data-t="${esc(t.id)}" aria-label="Cocher"><i class="fa-${done ? 'solid fa-square-check' : 'regular fa-square'}"></i></button>` : '';
    const right = mode === 'cart'
      ? `<button class="pl-x" data-act="rm" data-t="${esc(t.id)}" title="Retirer"><i class="fa-solid fa-xmark"></i></button>`
      : `<button class="pl-btn pl-inline" data-pl-id="${esc(t.id)}" title="Ajouter à ma liste"><i class="fa-solid fa-cart-plus"></i></button>`;
    return `<div class="pl-item${done ? ' done' : ''}" data-open="${esc(t.id)}">${left}
      <div class="pl-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}</div>
      <div class="pl-iname"><b>${esc(t.name)}</b><span>${color} ${esc(t.color || '')}${t.weight ? ' · ' + esc(t.weight) + ' g' : ''}</span></div>${right}</div>`;
  }

  function openManage() {
    const el = modal('pl-manage', 640);
    el.querySelector('.modal-title').innerHTML = '<i class="fa-solid fa-cart-shopping" style="color:var(--primary)"></i> Ma liste de courses';
    show(el);
    renderManage(true);
  }
  function renderManage(force) {
    const el = document.getElementById('pl-manage');
    if (!el || (!el.classList.contains('active') && !force)) return;
    const all = TLx().getTomatoes();
    const rows = S.ids.map(i => all.find(t => t.id === i)).filter(Boolean);
    rows.sort((a, b) => (!!S.done[a.id]) - (!!S.done[b.id]));
    const todo = rows.filter(t => !S.done[t.id]).length;
    const body = el.querySelector('.modal-body');
    const focus = document.activeElement && document.activeElement.id === 'pl-name';
    body.innerHTML = `
      <label class="pl-lbl" for="pl-name">Nom de la liste <small>(visible par ceux qui reçoivent ton lien)</small></label>
      <input type="text" id="pl-name" maxlength="60" value="${esc(S.name)}">
      <p class="pl-intro">${rows.length ? `<b>${todo}</b> à trouver${rows.length - todo ? ` · ${rows.length - todo} cochée${rows.length - todo > 1 ? 's' : ''}` : ''}` : 'Ta liste est vide : appuie sur <i class="fa-solid fa-cart-plus"></i> sur une variété pour l’ajouter.'}</p>
      <div class="pl-actions">
        <button class="btn btn-primary btn-sm" data-act="share"><i class="fa-solid fa-share-nodes"></i> Partager</button>
        <button class="btn btn-outline btn-sm" data-act="copy"><i class="fa-solid fa-link"></i> Copier le lien</button>
        ${rows.length - todo ? '<button class="btn btn-outline btn-sm" data-act="clear-done"><i class="fa-solid fa-broom"></i> Retirer les cochées</button>' : ''}
        ${rows.length ? '<button class="btn btn-danger btn-sm" data-act="clear"><i class="fa-solid fa-trash"></i> Vider</button>' : ''}
      </div>
      <div class="pl-rows">${rows.map(t => row(t, 'cart')).join('')}</div>`;
    if (focus) { const n = document.getElementById('pl-name'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
  }

  function openShared(sh) {
    const el = modal('pl-shared', 640);
    const all = TLx().getTomatoes();
    const rows = sh.ids.map(i => all.find(t => t.id === i)).filter(Boolean);
    el.querySelector('.modal-title').innerHTML = `<i class="fa-solid fa-cart-shopping" style="color:var(--primary)"></i> ${esc(sh.name)}`;
    el.querySelector('.modal-body').innerHTML = `
      <p class="pl-intro">${rows.length} variété${rows.length > 1 ? 's' : ''} dans cette liste${sh.ids.length > rows.length ? ` (${sh.ids.length - rows.length} introuvable${sh.ids.length - rows.length > 1 ? 's' : ''})` : ''}.</p>
      <div class="pl-actions"><button class="btn btn-primary btn-sm" data-act="add-all"><i class="fa-solid fa-cart-plus"></i> Tout ajouter à ma liste</button><button class="btn btn-outline btn-sm" data-act="open-manage"><i class="fa-solid fa-cart-shopping"></i> Ma liste</button></div>
      <div class="pl-rows">${rows.map(t => row(t, 'shared')).join('') || '<p class="pl-empty">Aucune de ces variétés n’est au catalogue.</p>'}</div>`;
    el._sh = sh;
    show(el);
    refresh();
  }
  function maybeOpenShared() {
    if (maybeOpenShared.done) return;
    const sh = parseShared();
    if (!sh || !TLx().getTomatoes().length) return;
    maybeOpenShared.done = true;
    openShared(sh);
  }

  // ── Interactions ──────────────────────────────────────────────────────────
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pl-id]');
    if (b) { e.stopPropagation(); e.preventDefault(); toggle(b.getAttribute('data-pl-id')); }
  }, true);

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a && a.closest('.pl-overlay')) {
      const act = a.dataset.act, id = a.dataset.t;
      if (act === 'check') { S.done[id] ? delete S.done[id] : (S.done[id] = 1); save(); }
      else if (act === 'rm') { S.ids = S.ids.filter(i => i !== id); delete S.done[id]; save(); }
      else if (act === 'copy') copyLink();
      else if (act === 'share') shareList();
      else if (act === 'clear-done') { S.ids = S.ids.filter(i => !S.done[i]); S.done = {}; save(); }
      else if (act === 'clear') { if (confirm('Vider toute ta liste ?')) { S.ids = []; S.done = {}; save(); } }
      else if (act === 'add-all') {
        const sh = document.getElementById('pl-shared')._sh;
        if (sh) { const add = sh.ids.filter(i => !has(i)); S.ids = add.concat(S.ids); save(); TLx().toast(add.length ? `${add.length} variété(s) ajoutée(s) à ta liste` : 'Tout est déjà dans ta liste', 'fa-cart-shopping'); closeEl(document.getElementById('pl-shared')); openManage(); }
      }
      else if (act === 'open-manage') { closeEl(document.getElementById('pl-shared')); openManage(); }
      return;
    }
    const r = e.target.closest('.pl-item[data-open]');
    if (r && !e.target.closest('button')) TLx().openDetail(r.dataset.open);
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'pl-name') { S.name = e.target.value.slice(0, 60) || DEFAULT_NAME; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (x) {} }
  });

  // ── Boutons de la page ────────────────────────────────────────────────────
  function refresh() {
    document.querySelectorAll('.pl-btn[data-pl-id], #detail-list-btn').forEach(b => {
      const id = b.id === 'detail-list-btn' ? TLx().detailId() : b.getAttribute('data-pl-id');
      const on = !!id && has(id);
      b.classList.toggle('on', on);
      const i = b.querySelector('i');
      if (i) i.className = on ? 'fa-solid fa-check' : 'fa-solid fa-cart-plus';
      if (b.id === 'detail-list-btn') { const sp = b.querySelector('span'); if (sp) sp.textContent = on ? 'Dans ma liste' : 'Ma liste'; }
    });
    const c = document.getElementById('pl-count');
    if (c) { const n = S.ids.length; c.textContent = n || ''; c.style.display = n ? '' : 'none'; }
  }
  function init() {
    const b = document.getElementById('btn-lists');
    if (b) b.onclick = openManage;
    const d = document.getElementById('detail-list-btn');
    if (d) d.onclick = () => { const id = TLx().detailId(); if (id) toggle(id); };
    refresh();
  }

  const st = document.createElement('style');
  st.textContent = `
#detail-modal{z-index:1100}
.pl-btn{position:absolute;left:10px;top:10px;z-index:4;width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.94);color:#374151;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.22);transition:transform .15s,background .15s,color .15s}
.pl-btn:hover{transform:scale(1.08)}.pl-btn.on{background:var(--primary);color:#fff}
.pl-btn.pl-inline{position:static;box-shadow:none;background:transparent;width:34px;height:34px;flex-shrink:0}
.pl-btn.pl-inline.on{background:var(--primary);color:#fff}
#detail-list-btn.on{color:var(--primary);border-color:var(--primary)}
#btn-lists{position:relative}.pl-count{background:var(--primary);color:#fff;border-radius:99px;font-size:11px;font-weight:700;padding:1px 6px;min-width:18px;text-align:center}
.pl-lbl{display:block;font-size:13px;font-weight:600;margin-bottom:6px}.pl-lbl small{font-weight:400;color:var(--text-muted)}
#pl-name{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:15px;background:var(--surface);color:var(--text-main)}
.pl-intro{font-size:14px;color:var(--text-muted);line-height:1.5;margin:12px 0}
.pl-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.pl-rows{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--surface)}.pl-rows:empty{display:none}
.pl-item{display:flex;align-items:center;gap:12px;padding:9px 12px;border-top:1px solid var(--line);cursor:pointer}.pl-item:first-child{border-top:none}
.pl-item:hover{background:var(--bg)}.pl-item.done .pl-iname,.pl-item.done .pl-thumb{opacity:.45}.pl-item.done .pl-iname b{text-decoration:line-through}
.pl-chk{border:none;background:transparent;font-size:20px;color:var(--text-muted);cursor:pointer;padding:0;width:26px;height:26px;flex-shrink:0}.pl-item.done .pl-chk{color:var(--primary)}
.pl-thumb{width:46px;height:46px;border-radius:10px;overflow:hidden;background:#f3f4f6;flex-shrink:0}.pl-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.pl-iname{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.pl-iname b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-iname span{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:5px}
.pl-x{border:none;background:transparent;color:var(--text-muted);width:32px;height:32px;border-radius:50%;cursor:pointer;flex-shrink:0}.pl-x:hover{background:var(--line);color:var(--primary)}
.pl-empty{font-size:13px;color:var(--text-muted);padding:14px;margin:0}
`;
  document.head.appendChild(st);

  window.PL = { refresh, maybeOpenShared, openManage, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
