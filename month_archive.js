(() => {
  if (window.__salaryMonthArchiveV1) return;
  window.__salaryMonthArchiveV1 = true;

  const FORMAT_MONTH = 'salarytracker-month';
  const FORMAT_FULL = 'salarytracker-full';
  const SCHEMA = 1;
  const clone = v => JSON.parse(JSON.stringify(v));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function monthTitle(key) {
    try {
      const d = new Date(`${key}-01T12:00:00`);
      let s = new Intl.DateTimeFormat('ru-RU', {month:'long', year:'numeric'}).format(d);
      return s.charAt(0).toUpperCase() + s.slice(1);
    } catch (_) { return key; }
  }

  function saveJson(filename, payload) {
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], {type:'application/json;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function getCurrentKey() {
    try { if (typeof currentMonth !== 'undefined' && currentMonth) return String(currentMonth); } catch (_) {}
    const monthControl = Array.from(document.querySelectorAll('select,input[type="month"]')).find(el => /^\d{4}-\d{2}$/.test(el.value || ''));
    if (monthControl) return monthControl.value;
    return new Date().toISOString().slice(0,7);
  }

  function exportCurrentMonth() {
    if (typeof app === 'undefined' || !app.months) return alert('Не удалось прочитать данные приложения.');
    const key = getCurrentKey();
    const data = app.months[key] || (typeof ensureMonth === 'function' ? ensureMonth(key) : null);
    if (!data) return alert('Для этого месяца пока нет данных.');
    saveJson(`SalaryTracker_${key}.json`, {
      format: FORMAT_MONTH, schemaVersion: SCHEMA, month: key,
      monthTitle: monthTitle(key), exportedAt: new Date().toISOString(), data: clone(data)
    });
  }

  function exportFullArchive() {
    if (typeof app === 'undefined') return alert('Не удалось прочитать данные приложения.');
    saveJson(`SalaryTracker_FULL_${new Date().toISOString().slice(0,10)}.json`, {
      format: FORMAT_FULL, schemaVersion: SCHEMA, exportedAt: new Date().toISOString(), app: clone(app)
    });
  }

  function trySwitchWithControl(key) {
    for (const el of Array.from(document.querySelectorAll('select,input[type="month"]'))) {
      if (el.tagName === 'SELECT') {
        const has = Array.from(el.options || []).some(o => o.value === key);
        if (has) { el.value = key; el.dispatchEvent(new Event('change',{bubbles:true})); return true; }
      } else if (el.type === 'month') {
        el.value = key; el.dispatchEvent(new Event('change',{bubbles:true})); return true;
      }
    }
    return false;
  }

  function openMonth(key) {
    if (typeof app === 'undefined' || !app.months || !app.months[key]) return;
    let switched = false;
    try { switched = trySwitchWithControl(key); } catch (_) {}
    if (!switched) {
      try { currentMonth = key; } catch (_) {}
      try { if (typeof writeParams === 'function') writeParams(app.months[key].params); } catch (_) {}
      try { if (typeof render === 'function') render(); } catch (_) {}
    }
    setTimeout(() => {
      try { if (typeof writeParams === 'function') writeParams(app.months[key].params); } catch (_) {}
      try { if (typeof render === 'function') render(); } catch (_) {}
      refreshArchiveList(); window.scrollTo({top:0,behavior:'smooth'});
    }, 80);
  }

  function mergeFullArchive(incoming) {
    app.months = app.months || {};
    Object.assign(app.months, clone(incoming.months || {}));
    app.presets = app.presets || {};
    if (incoming.presets) {
      app.presets.gradeRates = Object.assign({}, app.presets.gradeRates || {}, incoming.presets.gradeRates || {});
      app.presets.servicePcts = Object.assign({}, app.presets.servicePcts || {}, incoming.presets.servicePcts || {});
    }
  }

  function importPayload(payload) {
    if (typeof app === 'undefined') throw new Error('Приложение ещё не готово');
    if (payload && payload.format === FORMAT_MONTH && /^\d{4}-\d{2}$/.test(payload.month || '') && payload.data) {
      const key = payload.month;
      if (app.months && app.months[key] && !confirm(`${monthTitle(key)} уже есть. Заменить его данными из JSON?`)) return;
      app.months = app.months || {}; app.months[key] = clone(payload.data);
      if (typeof saveApp === 'function') saveApp();
      refreshArchiveList(); openMonth(key);
      alert(`${monthTitle(key)} импортирован. Его можно редактировать как обычный месяц.`); return;
    }
    const full = payload && payload.format === FORMAT_FULL ? payload.app : (payload && payload.months ? payload : (payload && payload.app && payload.app.months ? payload.app : null));
    if (full && full.months) {
      if (!confirm('Импортировать месяцы из общего JSON-архива? Существующие месяцы с теми же именами будут заменены.')) return;
      mergeFullArchive(full); if (typeof saveApp === 'function') saveApp(); refreshArchiveList();
      const keys = Object.keys(full.months).sort(); if (keys.length) openMonth(keys[keys.length-1]);
      alert(`Импортировано месяцев: ${keys.length}.`); return;
    }
    throw new Error('Это не JSON-архив SalaryTracker');
  }

  function refreshArchiveList() {
    const list = document.getElementById('monthArchiveList');
    if (!list || typeof app === 'undefined') return;
    const keys = Object.keys(app.months || {}).sort().reverse();
    if (!keys.length) { list.innerHTML='<div class="ma-empty">Сохранённых месяцев пока нет.</div>'; return; }
    const active = getCurrentKey();
    list.innerHTML = keys.map(key => `<button type="button" class="ma-month ${key===active?'active':''}" data-month="${esc(key)}"><span>${esc(monthTitle(key))}</span><small>${esc(key)}</small></button>`).join('');
    list.querySelectorAll('[data-month]').forEach(btn => btn.addEventListener('click',()=>openMonth(btn.dataset.month)));
  }

  function installUi() {
    if (document.getElementById('monthArchiveCard')) return;
    const style=document.createElement('style');
    style.textContent=`#monthArchiveCard{margin:18px 0;padding:18px;border:1px solid rgba(116,163,215,.28);border-radius:18px;background:rgba(15,37,61,.72);box-sizing:border-box;max-width:100%}#monthArchiveCard h2{margin:0 0 6px;font-size:24px}#monthArchiveCard .ma-hint{color:#9fb0c6;line-height:1.45;margin-bottom:14px}.ma-actions{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}.ma-actions button,.ma-month{border:1px solid #315578;background:#0b2035;color:#eef6ff;border-radius:12px;padding:11px 13px;font:inherit;cursor:pointer}.ma-actions button{flex:1 1 180px}.ma-actions button.primary{border-color:#2b8c8b;background:#123d4b;color:#dffff9}#monthArchiveList{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px}.ma-month{text-align:left;display:flex;flex-direction:column;gap:2px}.ma-month.active{border-color:#55dec9;background:#123a47}.ma-month small,.ma-empty{color:#91a6bd}@media(max-width:520px){#monthArchiveCard{padding:14px 12px}.ma-actions{display:grid;grid-template-columns:1fr}.ma-actions button{width:100%}#monthArchiveList{grid-template-columns:1fr 1fr}}@media(max-width:360px){#monthArchiveList{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    const card=document.createElement('section'); card.id='monthArchiveCard';
    card.innerHTML='<h2>🗂 Архив месяцев</h2><div class="ma-hint">Каждый месяц хранится отдельно и остаётся редактируемым. JSON можно сохранить в файл, отправить в Telegram и потом открыть обратно в Android или PWA.</div><div class="ma-actions"><button type="button" class="primary" id="monthArchiveSave">💾 Сохранить текущий месяц JSON</button><button type="button" id="monthArchiveOpen">📂 Импортировать JSON</button><button type="button" id="monthArchiveSaveAll">🧰 Сохранить всю базу JSON</button></div><input id="monthArchiveFileInput" type="file" accept="application/json,.json" hidden><div id="monthArchiveList"></div>';
    const footer=document.querySelector('.footer'); if(footer&&footer.parentNode) footer.parentNode.insertBefore(card,footer); else document.body.appendChild(card);
    card.querySelector('#monthArchiveSave').addEventListener('click',exportCurrentMonth);
    card.querySelector('#monthArchiveOpen').addEventListener('click',()=>card.querySelector('#monthArchiveFileInput').click());
    card.querySelector('#monthArchiveSaveAll').addEventListener('click',exportFullArchive);
    card.querySelector('#monthArchiveFileInput').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];e.target.value='';if(!file)return;try{importPayload(JSON.parse(await file.text()));}catch(err){alert(`Не удалось импортировать JSON: ${err&&err.message?err.message:err}`);}});
    refreshArchiveList(); document.addEventListener('change',()=>setTimeout(refreshArchiveList,100),true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(installUi,50)); else setTimeout(installUi,50);
})();
