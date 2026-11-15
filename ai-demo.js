/* ai-demo.js — APERÇU de l'assistant tomates (aucune API connectée)
   - bouton flottant discret, qui se déplie seulement quand c'est utile :
       · quelques secondes après l'arrivée (une seule fois par session)
       · quand on ouvre une fiche
       · quand une recherche ne donne rien (bouton « Demander à l'assistant » dans l'état vide)
   - panneau de chat avec une conversation d'exemple construite à partir du vrai catalogue
   Pour brancher la vraie IA plus tard : remplacer reply() par un appel au relais (Cloudflare Worker). */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TLx = () => window.TL || { getTomatoes: () => [], openDetail() {}, toast() {} };
  const SPARK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 2l2.2 6.3L20.5 10l-6.3 1.7L12 18l-2.2-6.3L3.5 10l6.3-1.7z" fill="currentColor"/></svg>';

  const QUESTION = 'Je cherche une tomate précoce pour mon balcon, que me conseilles-tu ?';

  // ── Exemple : 3 variétés précoces / petites choisies dans le vrai catalogue ─
  function pick() {
    const all = TLx().getTomatoes().filter(t => (t.imageURLs && t.imageURLs[0]) || t.imageURL);
    const info = t => {
      const c = window.FV ? FV.parseCulture(t) : { cycle: '' };
      const n = (String(c.cycle).match(/\d+/g) || []).map(Number);
      return { t, days: n.length ? Math.max.apply(null, n) : 0 };
    };
    const small = t => /cerise|petite/i.test(t.averageSize || '') || (+t.weight > 0 && +t.weight <= 60);
    let c = all.map(info).filter(x => x.days && x.days <= 80 && small(x.t)).sort((a, b) => a.days - b.days);
    if (c.length < 3) c = c.concat(all.map(info).filter(x => x.days && !c.includes(x)).sort((a, b) => a.days - b.days));
    if (c.length < 3) c = c.concat(all.map(info).filter(x => !c.includes(x)));
    return c.slice(0, 3);
  }
  function card(x) {
    const t = x.t, u = (t.imageURLs && t.imageURLs[0]) || t.imageURL || '';
    const img = window.FV ? FV.thumb(u, 160) : u;
    const meta = [t.weight ? t.weight + ' g' : '', x.days ? 'cycle ' + x.days + ' j' : '', t.country || ''].filter(Boolean).map(esc).join(' · ');
    return `<div class="ai-card" data-open="${esc(t.id)}">
      <div class="ai-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}</div>
      <div class="ai-cinfo"><b>${esc(t.name)}</b><span>${window.FV ? FV.tomato(t.color, 14) : ''} ${esc(t.color || '')}</span><small>${meta}</small></div>
      <button class="pl-btn pl-inline" data-pl-id="${esc(t.id)}" title="Ajouter à ma liste"><i class="fa-solid fa-cart-plus"></i></button>
    </div>`;
  }

  // ── DOM ───────────────────────────────────────────────────────────────────
  let fab, panel, msgs, played = false, labelTimer;
  function build() {
    if (fab) return;
    fab = document.createElement('button');
    fab.id = 'ai-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Poser une question sur les tomates');
    fab.innerHTML = `<span class="ai-fab-label" id="ai-fab-label">Une question&nbsp;?</span><span class="ai-fab-ico">${window.FV ? FV.tomato('Rouge', 26) : '🍅'}<i class="ai-spark">${SPARK}</i></span>`;
    fab.onclick = openChat;
    document.body.appendChild(fab);

    panel = document.createElement('section');
    panel.id = 'ai-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Assistant tomates');
    panel.innerHTML = `
      <header class="ai-head">
        <span class="ai-av">${window.FV ? FV.tomato('Rouge', 24) : '🍅'}</span>
        <div><b>Assistant tomates</b><small>Il connaît tout le catalogue</small></div>
        <button class="ai-x" aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="ai-demo-note"><i class="fa-solid fa-flask"></i> Aperçu : l’assistant n’est pas encore connecté, cette conversation est un exemple.</div>
      <div class="ai-msgs" id="ai-msgs" aria-live="polite"></div>
      <form class="ai-form" autocomplete="off"><input type="text" id="ai-input" maxlength="300" placeholder="Pose ta question…" aria-label="Ta question"><button type="submit" aria-label="Envoyer"><i class="fa-solid fa-paper-plane"></i></button></form>`;
    document.body.appendChild(panel);
    msgs = panel.querySelector('#ai-msgs');
    panel.querySelector('.ai-x').onclick = closeChat;
    panel.querySelector('form').onsubmit = e => { e.preventDefault(); const i = panel.querySelector('#ai-input'); const v = i.value.trim(); if (v) { i.value = ''; ask(v); } };
    panel.addEventListener('click', e => {
      const chip = e.target.closest('.ai-chip');
      if (chip) { ask(chip.textContent); return; }
      const c = e.target.closest('.ai-card[data-open]');
      if (c && !e.target.closest('button')) { closeChat(); TLx().openDetail(c.dataset.open); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) closeChat(); });
  }

  const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };
  const bubble = (who, html) => { const d = document.createElement('div'); d.className = 'ai-m ' + who; d.innerHTML = html; msgs.appendChild(d); scroll(); return d; };
  const typing = () => bubble('bot', '<span class="ai-dots"><i></i><i></i><i></i></span>');
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function playDemo() {
    played = true;
    bubble('me', esc(QUESTION));
    const t = typing();
    await wait(1100);
    const picks = pick();
    t.remove();
    if (!picks.length) {
      bubble('bot', '<p>Le catalogue est en cours de chargement… rouvre-moi dans un instant.</p>');
      played = false; return;
    }
    const names = picks.map(x => `<b>${esc(x.t.name)}</b>`);
    const m = bubble('bot', `
      <p>Pour un balcon, vise des variétés <b>à petits fruits et à cycle court</b> : elles se contentent d’un grand pot et mûrissent vite. Dans le catalogue, je te propose ${names.length > 1 ? names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1] : names[0]} :</p>
      <div class="ai-cards">${picks.map(card).join('')}</div>
      <p class="ai-tip">Astuce : un pot de 10 à 20 litres, du soleil direct la majeure partie de la journée et un arrosage régulier suffisent.</p>
      <div class="ai-chips"><button class="ai-chip" type="button">Laquelle est la plus facile ?</button><button class="ai-chip" type="button">Compare-les moi</button><button class="ai-chip" type="button">Et pour une salade ?</button></div>`);
    if (window.PL) PL.refresh();
    // on reste en haut : la question et le début de la réponse restent visibles
    msgs.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function ask(text) {
    bubble('me', esc(text));
    const t = typing();
    await wait(800);
    t.remove();
    const n = TLx().getTomatoes().length;
    bubble('bot', `<p>Ceci est un aperçu : je ne suis pas encore connecté à l’IA. Bientôt, je pourrai chercher dans les ${n || ''} variétés du catalogue et te montrer leurs photos 🍅</p>`);
  }

  function openChat() {
    build();
    clearTimeout(labelTimer); fab.classList.remove('wide');
    panel.classList.add('open'); fab.classList.add('hide');
    if (!played) playDemo();
    setTimeout(() => { const i = panel.querySelector('#ai-input'); if (i && matchMedia('(hover:hover)').matches) i.focus(); }, 300);
  }
  function closeChat() { panel.classList.remove('open'); fab.classList.remove('hide'); }

  // ── Quand le bouton se déplie ─────────────────────────────────────────────
  function hint(text, ms) {
    build();
    if (panel.classList.contains('open')) return;
    document.getElementById('ai-fab-label').innerHTML = text;
    fab.classList.add('wide');
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => fab.classList.remove('wide'), ms || 5000);
  }
  function init() {
    build();
    // 1) à l'arrivée : une seule fois par session
    let seen = false; try { seen = sessionStorage.getItem('pdt_ai_hint'); } catch (e) {}
    if (!seen) setTimeout(() => { hint('Une question sur les tomates&nbsp;?', 6000); try { sessionStorage.setItem('pdt_ai_hint', '1'); } catch (e) {} }, 9000);
    // 2) ouverture d'une fiche
    new MutationObserver(() => { if (document.body.classList.contains('detail-open')) hint('Une question sur cette tomate&nbsp;?', 4500); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // 3) recherche sans résultat : bouton dans l'état vide
    const grid = document.getElementById('tomatoes-grid');
    if (grid) new MutationObserver(() => {
      const e = grid.querySelector('.empty-state .fa-leaf');
      if (e && !grid.querySelector('.ai-ask')) e.parentElement.insertAdjacentHTML('beforeend', '<button class="btn btn-primary btn-sm ai-ask" type="button" style="margin:14px auto 0"><i class="fa-solid fa-wand-magic-sparkles"></i> Demander à l’assistant</button>');
    }).observe(grid, { childList: true });
    document.addEventListener('click', e => { if (e.target.closest('.ai-ask')) openChat(); });
  }

  const st = document.createElement('style');
  st.textContent = `
#ai-fab{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:1150;display:flex;align-items:center;gap:0;height:48px;padding:0;border:1px solid rgba(185,28,28,.22);border-radius:99px;background:#fff;color:var(--text-main);box-shadow:0 4px 16px rgba(0,0,0,.16);cursor:pointer;opacity:.9;transition:opacity .2s,transform .25s,box-shadow .2s}
#ai-fab:hover{opacity:1;box-shadow:0 6px 20px rgba(0,0,0,.22)}
#ai-fab.hide{transform:scale(.6);opacity:0;pointer-events:none}
.ai-fab-label{max-width:0;overflow:hidden;white-space:nowrap;font-size:13.5px;font-weight:600;transition:max-width .35s cubic-bezier(.22,.8,.2,1),padding .35s}
#ai-fab.wide .ai-fab-label{max-width:230px;padding:0 4px 0 16px}
.ai-fab-ico{position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ai-spark{position:absolute;top:7px;right:6px;display:flex;color:#f59e0b;background:#fff;border-radius:50%;padding:1px}
#ai-fab.wide .ai-spark{animation:aiTwinkle 1.4s ease-in-out infinite}
@keyframes aiTwinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.25) rotate(20deg)}}
#ai-panel{position:fixed;right:16px;bottom:16px;width:min(390px,calc(100vw - 24px));height:min(620px,calc(100vh - 32px));height:min(620px,calc(100dvh - 32px));z-index:1200;display:flex;flex-direction:column;background:var(--surface,#fff);border:1px solid var(--line);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.3);overflow:hidden;opacity:0;transform:translateY(24px) scale(.98);pointer-events:none;transition:opacity .2s,transform .28s cubic-bezier(.22,.8,.2,1)}
#ai-panel.open{opacity:1;transform:none;pointer-events:auto}
@media (max-width:640px){#ai-panel{left:0;right:0;bottom:0;width:auto;height:84vh;height:84dvh;border-radius:20px 20px 0 0;border-bottom:none}}
.ai-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fef2f2;border-bottom:1px solid #fecaca}
.ai-head div{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}.ai-head b{font-size:15px}.ai-head small{font-size:12px;color:var(--text-muted)}
.ai-av{width:36px;height:36px;border-radius:50%;background:#fff;border:1px solid #fecaca;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ai-x{width:36px;height:36px;border:none;border-radius:50%;background:transparent;font-size:16px;cursor:pointer;color:var(--text-main)}.ai-x:hover{background:#fee2e2}
.ai-demo-note{font-size:12px;padding:7px 14px;background:#fffbeb;color:#92400e;border-bottom:1px solid #fde68a}
.ai-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;background:#fffafa}
.ai-m{max-width:92%;font-size:14.5px;line-height:1.5;animation:aiIn .3s ease both}
@keyframes aiIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ai-m.me{align-self:flex-end;background:var(--primary);color:#fff;padding:10px 14px;border-radius:16px 16px 4px 16px}
.ai-m.bot{align-self:flex-start;background:#fff;border:1px solid var(--line);padding:11px 13px;border-radius:16px 16px 16px 4px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
.ai-m p{margin:0}.ai-m p+*{margin-top:10px}.ai-tip{font-size:13px;color:var(--text-muted)}
.ai-cards{display:flex;flex-direction:column;gap:8px}
.ai-card{display:flex;align-items:center;gap:10px;padding:7px;border:1px solid var(--line);border-radius:12px;background:#fff;cursor:pointer}.ai-card:hover{border-color:#fca5a5;background:#fef2f2}
.ai-thumb{width:56px;height:56px;border-radius:9px;overflow:hidden;background:#f3f4f6;flex-shrink:0}.ai-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ai-cinfo{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.ai-cinfo b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-cinfo span{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:5px}.ai-cinfo small{font-size:11.5px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ai-chips{display:flex;flex-wrap:wrap;gap:6px}
.ai-chip{border:1px solid #fca5a5;background:#fff;color:var(--primary);border-radius:99px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer}.ai-chip:hover{background:#fef2f2}
.ai-dots{display:inline-flex;gap:4px;padding:4px 2px}.ai-dots i{width:7px;height:7px;border-radius:50%;background:#d1a0a0;animation:aiDot 1s infinite}.ai-dots i:nth-child(2){animation-delay:.15s}.ai-dots i:nth-child(3){animation-delay:.3s}
@keyframes aiDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-4px);opacity:1}}
.ai-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:#fff}
.ai-form input{flex:1;min-width:0;padding:11px 14px;border:1px solid var(--line);border-radius:99px;font:inherit;font-size:16px;background:#fafafa;color:var(--text-main)}.ai-form input:focus{outline:2px solid #fca5a5;border-color:transparent}
.ai-form button{width:42px;height:42px;flex-shrink:0;border:none;border-radius:50%;background:var(--primary);color:#fff;cursor:pointer}
@media (prefers-reduced-motion:reduce){.ai-m,#ai-fab.wide .ai-spark{animation:none}}
`;
  document.head.appendChild(st);

  window.AIDemo = { open: () => { build(); openChat(); }, hint };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
