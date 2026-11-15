/* lists.js — listes de variétés (localStorage) + partage par lien + échanges
   Lien de partage :  ?l=id1~id2~id3&n=Nom%20de%20la%20liste&k=h
     l = ids des variétés séparés par "~" (caractère sûr dans une URL, absent des ids Firebase)
     n = nom de la liste     k = h (« J'ai des graines ») | w (« Je cherche ») | absent (liste libre)
   Dépend de window.TL (exposé par index.html) et de window.FV (fiche-visuals.js). */
(function () {
  const KEY = 'pdt_lists_v1';
  const KINDS = {
    have: { label: "J'ai des graines", icon: 'fa-seedling', code: 'h' },
    want: { label: 'Je cherche', icon: 'fa-magnifying-glass', code: 'w' },
    '': { label: 'Liste libre', icon: 'fa-list', code: '' }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const TLx = () => window.TL || { getTomatoes: () => [], openDetail() {}, toast() {}, detailId: () => null };
  const byId = id => TLx().getTomatoes().find(t => t.id === id);
  const thumb = t => (t && ((t.imageURLs && t.imageURLs[0]) || t.imageURL)) || '';

  // ── Stockage ──────────────────────────────────────────────────────────────
  function seed() {
    const now = Date.now();
    return { lists: [
      { id: uid(), name: "J'ai des graines", kind: 'have', ids: [], created: now },
      { id: uid(), name: 'Je cherche', kind: 'want', ids: [], created: now }
    ] };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.lists)) return d;
    } catch (e) {}
    return seed();
  }
  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { TLx().toast('Stockage local indisponible', 'fa-triangle-exclamation'); }
    refresh();
    renderManage();
  }
  window.addEventListener('storage', e => { if (e.key === KEY) { S = load(); refresh(); renderManage(); } });

  const listsOf = id => S.lists.filter(l => l.ids.includes(id));
  function addTo(listId, tid) { const l = S.lists.find(x => x.id === listId); if (l && !l.ids.includes(tid)) { l.ids.unshift(tid); l.updated = Date.now(); } }
  function removeFrom(listId, tid) { const l = S.lists.find(x => x.id === listId); if (l) { l.ids = l.ids.filter(i => i !== tid); l.updated = Date.now(); } }
  function createList(name, kind, ids) {
    name = String(name || '').trim().slice(0, 60);
    if (!name) return null;
    const l = { id: uid(), name, kind: kind in KINDS ? kind : '', ids: (ids || []).slice(), created: Date.now() };
    S.lists.push(l);
    return l;
  }

  // ── Lien de partage ───────────────────────────────────────────────────────
  function linkFor(l) {
    const k = KINDS[l.kind || ''].code;
    return location.origin + location.pathname + '?l=' + l.ids.join('~') + '&n=' + encodeURIComponent(l.name) + (k ? '&k=' + k : '');
  }
  async function copyLink(l) {
    if (!l.ids.length) return TLx().toast('Liste vide : ajoute d’abord des variétés', 'fa-circle-info');
    const url = linkFor(l);
    try { await navigator.clipboard.writeText(url); TLx().toast('Lien de la liste copié !', 'fa-link'); }
    catch (e) { window.prompt('Copie ce lien :', url); }
  }
  async function shareList(l) {
    if (!l.ids.length) return TLx().toast('Liste vide : ajoute d’abord des variétés', 'fa-circle-info');
    const url = linkFor(l);
    const text = l.kind === 'have' ? `J’ai ${l.ids.length} variété(s) de tomates à échanger 🍅`
      : l.kind === 'want' ? `Je cherche ${l.ids.length} variété(s) de tomates 🍅` : `Ma liste de tomates : ${l.name} 🍅`;
    if (navigator.share) { try { await navigator.share({ title: l.name, text, url }); } catch (e) {} }
    else copyLink(l);
  }
  function parseShared() {
    const p = new URLSearchParams(location.search);
    const raw = p.get('l');
    if (!raw) return null;
    const ids = Array.from(new Set(raw.split('~').filter(i => /^[\w-]{1,64}$/.test(i)))).slice(0, 400);
    if (!ids.length) return null;
    const k = p.get('k');
    return { ids, name: (p.get('n') || 'Liste partagée').slice(0, 60), kind: k === 'h' ? 'have' : k === 'w' ? 'want' : '' };
  }

  // ── Modales ───────────────────────────────────────────────────────────────
  const closeEl = el => el && el.classList.remove('active');
  function modal(id, maxw, z) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'modal-overlay pl-overlay';
      el.id = id;
      if (z) el.style.zIndex = z;
      el.innerHTML = `<div class="modal" style="max-width:${maxw}px"><div class="modal-header"><div class="modal-title"></div><button class="modal-close" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body"></div></div>`;
      el.addEventListener('mousedown', e => { if (e.target === el) closeEl(el); });
      el.querySelector('.modal-close').onclick = () => closeEl(el);
      document.body.appendChild(el);
    }
    return el;
  }
  const show = el => requestAnimationFrame(() => el.classList.add('active'));
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = Array.from(document.querySelectorAll('.pl-overlay.active')).sort((a, b) => (+b.style.zIndex || 1000) - (+a.style.zIndex || 1000))[0];
    if (open) closeEl(open);
  });

  function itemRow(t, opts) {
    opts = opts || {};
    const img = thumb(t);
    const color = window.FV ? FV.tomato(t.color, 16) : '';
    return `<div class="pl-item${opts.hit ? ' hit' : ''}" data-open="${esc(t.id)}">
      <div class="pl-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</div>
      <div class="pl-iname"><b>${esc(t.name)}</b><span>${color} ${esc(t.color || '')}${t.weight ? ' · ' + esc(t.weight) + ' g' : ''}</span></div>
      ${opts.hit ? '<span class="pl-hit" title="Correspondance">🎯</span>' : ''}
      ${opts.rm ? `<button class="pl-x" data-act="rm" data-list="${esc(opts.rm)}" data-t="${esc(t.id)}" title="Retirer de la liste"><i class="fa-solid fa-xmark"></i></button>`
        : `<button class="pl-x pl-save" data-pl-id="${esc(t.id)}" title="Ajouter à une liste"><i class="fa-regular fa-bookmark"></i></button>`}
    </div>`;
  }

  // 1) Sélecteur « Ajouter à une liste »
  let pickId = null;
  function openPicker(tid) {
    const t = byId(tid);
    if (!t) return;
    pickId = tid;
    const el = modal('pl-pick', 420, 1200);
    el.querySelector('.modal-title').textContent = 'Ajouter à une liste';
    renderPicker();
    show(el);
  }
  function renderPicker() {
    const el = document.getElementById('pl-pick');
    if (!el || !pickId) return;
    const t = byId(pickId);
    el.querySelector('.modal-body').innerHTML = `
      <div class="pl-pick-t">${window.FV ? FV.tomato(t && t.color, 26) : ''} <b>${esc(t ? t.name : '')}</b></div>
      <div class="pl-pick-list">${S.lists.map(l => {
        const on = l.ids.includes(pickId);
        return `<button class="pl-row${on ? ' on' : ''}" data-act="toggle" data-list="${l.id}"><i class="fa-solid ${on ? 'fa-square-check' : 'fa-square'}"></i><span>${esc(l.name)}<small>${KINDS[l.kind || ''].label} · ${l.ids.length}</small></span></button>`;
      }).join('') || '<p class="pl-empty">Aucune liste pour l’instant.</p>'}</div>
      <div class="pl-new"><input type="text" id="pl-pick-name" maxlength="60" placeholder="Nouvelle liste…"><select id="pl-pick-kind">${Object.keys(KINDS).map(k => `<option value="${k}">${KINDS[k].label}</option>`).join('')}</select><button class="btn btn-primary btn-sm" data-act="create-add"><i class="fa-solid fa-plus"></i></button></div>`;
  }

  // 2) Gestion des listes
  const openSet = new Set();
  function openManage() {
    const el = modal('pl-manage', 760);
    el.querySelector('.modal-title').textContent = 'Mes listes';
    show(el);
    renderManage(true);
  }
  function renderManage(force) {
    const el = document.getElementById('pl-manage');
    if (!el || !el.classList.contains('active') && !force) return;
    const body = el.querySelector('.modal-body');
    el.querySelectorAll('details[data-list]').forEach(d => { d.open ? openSet.add(d.dataset.list) : openSet.delete(d.dataset.list); });
    const tomatoes = TLx().getTomatoes();
    body.innerHTML = `
      <p class="pl-intro">Crée tes listes (enregistrées sur cet appareil) et partage-les par lien pour organiser des échanges : une liste <b>« J’ai des graines »</b> et une liste <b>« Je cherche »</b>. Quand quelqu’un ouvre ton lien, il voit tout de suite les correspondances avec ses propres listes.</p>
      <div class="pl-new pl-new-top"><input type="text" id="pl-new-name" maxlength="60" placeholder="Nom de la nouvelle liste"><select id="pl-new-kind">${Object.keys(KINDS).map(k => `<option value="${k}">${KINDS[k].label}</option>`).join('')}</select><button class="btn btn-primary btn-sm" data-act="create"><i class="fa-solid fa-plus"></i> Créer</button></div>
      ${S.lists.map(l => {
        const rows = l.ids.map(i => tomatoes.find(t => t.id === i)).filter(Boolean);
        const lost = l.ids.length - rows.length;
        return `<details class="pl-list" data-list="${l.id}" ${openSet.has(l.id) || (!openSet.size && rows.length) ? 'open' : ''}>
          <summary><i class="fa-solid ${KINDS[l.kind || ''].icon}"></i><span class="pl-lname">${esc(l.name)}</span><span class="pl-cnt">${l.ids.length}</span></summary>
          <div class="pl-actions">
            <button class="btn btn-outline btn-sm" data-act="copy" data-list="${l.id}"><i class="fa-solid fa-link"></i> Copier le lien</button>
            <button class="btn btn-outline btn-sm" data-act="share" data-list="${l.id}"><i class="fa-solid fa-share-nodes"></i> Partager</button>
            <button class="btn btn-outline btn-sm" data-act="rename" data-list="${l.id}"><i class="fa-solid fa-pen"></i> Renommer</button>
            <button class="btn btn-outline btn-sm" data-act="clear" data-list="${l.id}"><i class="fa-solid fa-broom"></i> Vider</button>
            <button class="btn btn-danger btn-sm" data-act="del" data-list="${l.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
          ${rows.length ? rows.map(t => itemRow(t, { rm: l.id })).join('') : '<p class="pl-empty">Vide : clique sur <i class="fa-regular fa-bookmark"></i> sur une variété pour l’ajouter.</p>'}
          ${lost > 0 ? `<p class="pl-empty">${lost} variété(s) ne sont plus au catalogue.</p>` : ''}
        </details>`;
      }).join('')}`;
  }

  // 3) Liste reçue par lien
  function openShared(sh) {
    const el = modal('pl-shared', 760);
    const all = TLx().getTomatoes();
    const rows = sh.ids.map(i => all.find(t => t.id === i)).filter(Boolean);
    const missing = sh.ids.length - rows.length;
    // correspondances d'échange avec mes propres listes
    const mineKind = sh.kind === 'have' ? 'want' : sh.kind === 'want' ? 'have' : null;
    const mine = new Set();
    if (mineKind) S.lists.filter(l => l.kind === mineKind).forEach(l => l.ids.forEach(i => mine.add(i)));
    const hits = new Set(rows.filter(t => mine.has(t.id)).map(t => t.id));
    const sorted = rows.slice().sort((a, b) => (hits.has(b.id) - hits.has(a.id)));
    el.querySelector('.modal-title').innerHTML = `<i class="fa-solid ${KINDS[sh.kind].icon}" style="color:var(--primary)"></i> ${esc(sh.name)}`;
    let banner = '';
    if (mineKind) {
      banner = hits.size
        ? `<div class="pl-banner ok">🎯 <b>${hits.size}</b> correspondance${hits.size > 1 ? 's' : ''} avec ta liste « ${KINDS[mineKind].label} » : ${sh.kind === 'have' ? 'tu peux demander ces graines !' : 'tu peux proposer ces graines !'}</div>`
        : `<div class="pl-banner">Aucune correspondance avec tes listes « ${KINDS[mineKind].label} » pour l’instant. Crée-les depuis « Mes listes » pour voir les échanges possibles.</div>`;
    }
    el.querySelector('.modal-body').innerHTML = `
      <p class="pl-intro">${rows.length} variété${rows.length > 1 ? 's' : ''} · ${KINDS[sh.kind].label}${missing > 0 ? ` · ${missing} introuvable${missing > 1 ? 's' : ''}` : ''}</p>
      ${banner}
      <div class="pl-actions"><button class="btn btn-primary btn-sm" data-act="save-shared"><i class="fa-solid fa-download"></i> Enregistrer dans mes listes</button><button class="btn btn-outline btn-sm" data-act="open-manage"><i class="fa-solid fa-bookmark"></i> Mes listes</button></div>
      ${sorted.map(t => itemRow(t, { hit: hits.has(t.id) })).join('') || '<p class="pl-empty">Aucune de ces variétés n’est au catalogue.</p>'}`;
    el._sh = sh;
    show(el);
  }
  function maybeOpenShared() {
    if (maybeOpenShared.done) return;
    const sh = parseShared();
    if (!sh || !TLx().getTomatoes().length) return;
    maybeOpenShared.done = true;
    openShared(sh);
  }

  // ── Interactions (délégation) ─────────────────────────────────────────────
  document.addEventListener('click', e => {
    const save = e.target.closest('[data-pl-id]');
    if (save) { e.stopPropagation(); e.preventDefault(); openPicker(save.getAttribute('data-pl-id')); return; }
  }, true);

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a && a.closest('.pl-overlay')) {
      const act = a.dataset.act, lid = a.dataset.list, l = S.lists.find(x => x.id === lid);
      if (act === 'toggle' && l) { l.ids.includes(pickId) ? removeFrom(lid, pickId) : addTo(lid, pickId); save(); renderPicker(); TLx().toast(l.ids.includes(pickId) ? `Ajouté à « ${l.name} »` : `Retiré de « ${l.name} »`, 'fa-bookmark'); }
      else if (act === 'create-add') {
        const n = document.getElementById('pl-pick-name');
        const nl = createList(n.value, document.getElementById('pl-pick-kind').value, [pickId]);
        if (nl) { save(); renderPicker(); } else n.focus();
      }
      else if (act === 'create') {
        const n = document.getElementById('pl-new-name');
        if (createList(n.value, document.getElementById('pl-new-kind').value)) save(); else n.focus();
      }
      else if (act === 'rm') { removeFrom(lid, a.dataset.t); save(); }
      else if (act === 'copy' && l) copyLink(l);
      else if (act === 'share' && l) shareList(l);
      else if (act === 'rename' && l) { const n = prompt('Nouveau nom de la liste :', l.name); if (n && n.trim()) { l.name = n.trim().slice(0, 60); save(); } }
      else if (act === 'clear' && l) { if (l.ids.length && confirm(`Vider la liste « ${l.name} » ?`)) { l.ids = []; save(); } }
      else if (act === 'del' && l) { if (confirm(`Supprimer la liste « ${l.name} » ?`)) { S.lists = S.lists.filter(x => x.id !== lid); save(); } }
      else if (act === 'save-shared') {
        const sh = document.getElementById('pl-shared')._sh;
        if (sh) { createList(sh.name, sh.kind, sh.ids); save(); TLx().toast('Liste enregistrée dans « Mes listes »', 'fa-check'); closeEl(document.getElementById('pl-shared')); openManage(); }
      }
      else if (act === 'open-manage') { closeEl(document.getElementById('pl-shared')); openManage(); }
      return;
    }
    const row = e.target.closest('.pl-item[data-open]');
    if (row && !e.target.closest('button')) TLx().openDetail(row.dataset.open);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'pl-new-name') document.querySelector('#pl-manage [data-act="create"]').click();
    if (e.key === 'Enter' && e.target.id === 'pl-pick-name') document.querySelector('#pl-pick [data-act="create-add"]').click();
  });

  // ── Boutons / pastilles de la page ────────────────────────────────────────
  function refresh() {
    document.querySelectorAll('.pl-btn[data-pl-id], #detail-list-btn').forEach(b => {
      const id = b.id === 'detail-list-btn' ? TLx().detailId() : b.getAttribute('data-pl-id');
      const on = !!id && listsOf(id).length > 0;
      b.classList.toggle('on', on);
      const i = b.querySelector('i');
      if (i) i.className = (on ? 'fa-solid' : 'fa-regular') + ' fa-bookmark';
    });
    const total = S.lists.reduce((n, l) => n + l.ids.length, 0);
    const c = document.getElementById('pl-count');
    if (c) { c.textContent = total || ''; c.style.display = total ? '' : 'none'; }
  }
  function init() {
    const b = document.getElementById('btn-lists');
    if (b) b.onclick = openManage;
    const d = document.getElementById('detail-list-btn');
    if (d) d.onclick = () => { const id = TLx().detailId(); if (id) openPicker(id); };
    refresh();
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const st = document.createElement('style');
  st.textContent = `
#detail-modal{z-index:1100}
.pl-btn{position:absolute;left:10px;top:10px;z-index:4;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.92);color:#374151;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.22);transition:transform .15s,background .15s}
.pl-btn:hover{transform:scale(1.1)}.pl-btn.on,#detail-list-btn.on{color:var(--primary)}
.pl-btn.on{background:#fff}
#btn-lists{position:relative}.pl-count{background:var(--primary);color:#fff;border-radius:99px;font-size:11px;font-weight:700;padding:1px 6px;min-width:18px;text-align:center}
.pl-intro{font-size:13.5px;color:var(--text-muted);line-height:1.5;margin:0 0 14px}
.pl-new{display:flex;gap:8px;flex-wrap:wrap}.pl-new input,.pl-new select{padding:9px 11px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:14px;background:var(--surface);color:var(--text-main)}
.pl-new input{flex:1;min-width:140px}.pl-new-top{margin-bottom:14px}
.pl-list{border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden;background:var(--surface)}
.pl-list summary{display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer;font-weight:700;list-style:none}
.pl-list summary::-webkit-details-marker{display:none}.pl-list summary i{color:var(--primary);width:18px;text-align:center}
.pl-lname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-cnt{background:var(--bg);border:1px solid var(--line);border-radius:99px;padding:1px 9px;font-size:12px;color:var(--text-muted)}
.pl-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 14px 12px}
.pl-item{display:flex;align-items:center;gap:12px;padding:8px 14px;border-top:1px solid var(--line);cursor:pointer}
.pl-item:hover{background:var(--bg)}.pl-item.hit{background:rgba(34,197,94,.1)}
.pl-thumb{width:46px;height:46px;border-radius:10px;overflow:hidden;background:#f3f4f6;flex-shrink:0}.pl-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.pl-iname{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.pl-iname b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pl-iname span{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:5px}
.pl-x{border:none;background:transparent;color:var(--text-muted);width:32px;height:32px;border-radius:50%;cursor:pointer;flex-shrink:0}.pl-x:hover{background:var(--line);color:var(--primary)}
.pl-save.on{color:var(--primary)}
.pl-empty{font-size:13px;color:var(--text-muted);padding:6px 14px 14px;margin:0}
.pl-banner{padding:11px 14px;border-radius:12px;background:var(--bg);border:1px solid var(--line);font-size:13.5px;margin-bottom:12px;line-height:1.45}
.pl-banner.ok{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.4)}
.pl-pick-t{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.pl-pick-list{display:flex;flex-direction:column;gap:6px;margin-bottom:14px;max-height:40vh;overflow:auto}
.pl-row{display:flex;align-items:center;gap:12px;padding:11px 12px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text-main);cursor:pointer;text-align:left;font:inherit;font-weight:600;font-size:14px}
.pl-row i{color:var(--text-muted);font-size:18px}.pl-row.on{border-color:var(--primary)}.pl-row.on i{color:var(--primary)}
.pl-row small{display:block;font-weight:400;color:var(--text-muted);font-size:12px}
`;
  document.head.appendChild(st);

  window.PL = { refresh, maybeOpenShared, openPicker, openManage, init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
