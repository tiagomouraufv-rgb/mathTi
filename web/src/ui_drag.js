/* MathTi — arrastar regiões para qualquer posição da folha (dedo ou mouse) */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  let drag = null;
  function regionAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const e of els) { const s = e.closest && e.closest('section.region'); if (s && (!drag || s.id !== drag.id)) return s; }
    return null;
  }
  function place(x, y) {
    const tgt = regionAt(x, y), mark = drag.mark;
    if (!tgt) { mark.hidden = true; drag.dest = null; return; }
    const r = tgt.getBoundingClientRect();
    // antes ou depois: pela metade horizontal (regiões lado a lado) ou vertical (região inteira)
    const wide = r.width > window.innerWidth * 0.6;
    const after = wide ? y > r.top + r.height / 2 : x > r.left + r.width / 2;
    drag.dest = { id: tgt.id, after };
    mark.hidden = false;
    if (wide) Object.assign(mark.style, { left: r.left + 'px', top: (after ? r.bottom + 3 : r.top - 5) + 'px', width: r.width + 'px', height: '4px' });
    else Object.assign(mark.style, { left: (after ? r.right + 3 : r.left - 5) + 'px', top: r.top + 'px', width: '4px', height: r.height + 'px' });
  }
  function autoscroll(y) {
    const m = document.querySelector('main'); if (!m) return;
    const b = m.getBoundingClientRect();
    if (y < b.top + 40) m.scrollBy(0, -18); else if (y > b.bottom - 40) m.scrollBy(0, 18);
  }
  document.addEventListener('pointerdown', (e) => {
    const h = e.target.closest && e.target.closest('.rdrag');
    if (!h || e.button > 0) return;
    const sec = h.closest('section.region'); if (!sec) return;
    e.preventDefault();
    drag = { id: sec.id, x0: e.clientX, y0: e.clientY, started: false, pid: e.pointerId };
    try { h.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
      drag.started = true;
      const sec = document.getElementById(drag.id);
      sec.classList.add('dragging');
      const ghost = sec.cloneNode(false); ghost.className = 'drag-ghost'; { const t = sec.querySelector('.rtitle'); ghost.textContent = (t && (t.value || t.placeholder)) || 'Região'; }
      document.body.append(ghost); drag.ghost = ghost;
      const mark = document.createElement('div'); mark.className = 'drop-mark'; mark.hidden = true; document.body.append(mark); drag.mark = mark;
    }
    drag.ghost.style.left = (e.clientX + 12) + 'px'; drag.ghost.style.top = (e.clientY + 10) + 'px';
    place(e.clientX, e.clientY); autoscroll(e.clientY);
    e.preventDefault();
  }, { passive: false });
  function end() {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.started) return;
    d.ghost.remove(); d.mark.remove();
    const sec = document.getElementById(d.id); if (sec) sec.classList.remove('dragging');
    if (!d.dest) return;
    const st = U().state, from = st.regions.findIndex((r) => r.id === d.id);
    const reg = st.regions[from];
    st.regions.splice(from, 1);
    let to = st.regions.findIndex((r) => r.id === d.dest.id);
    if (to < 0) { st.regions.splice(from, 0, reg); return; }
    if (d.dest.after) to++;
    st.regions.splice(to, 0, reg);
    if (to === from) return;
    U().buildSheet(); U().recalc(); U().markDirty(false);
  }
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
