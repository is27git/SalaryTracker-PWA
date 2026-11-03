(() => {
  if (window.__salaryNightV45) return;
  window.__salaryNightV45 = true;

  const FULL_NIGHT_PAID = 7.5;
  const BREAK_TEXT = '22:00–06:00 минус обед 23:00–23:30';

  function clockMin(v) {
    const s = typeof normalizeClockValue === 'function' ? normalizeClockValue(v) : String(v || '');
    if (!/^\d{2}:\d{2}$/.test(s)) return null;
    const [h,m] = s.split(':').map(Number);
    return h * 60 + m;
  }
  function overlap(a,b,x,y) { return Math.max(0, Math.min(b,y) - Math.max(a,x)); }
  function paidNightOverlap(start,end) {
    let a = clockMin(start), b = clockMin(end);
    if (a === null || b === null || a === b) return 0;
    if (b < a) b += 1440;
    const segments = [[0,360],[1320,1380],[1410,1800]];
    let mins = 0;
    for (const [x,y] of segments) mins += overlap(a,b,x,y);
    return round2(mins / 60);
  }
  function nightReduction(entries) {
    return round2((entries || []).reduce((sum,e) => e && e.type === 'compUse' ? sum + paidNightOverlap(e.start,e.end) : sum, 0));
  }

  Object.entries(app.months || {}).forEach(([key,m]) => {
    if (!m || !m.params) return;
    m.params.nightHoursPerShift = FULL_NIGHT_PAID;
    if (m.params.nightAutoV45 === undefined) m.params.nightAutoV45 = key >= browserMonth();
  });
  if (typeof defaults !== 'undefined') defaults.nightHoursPerShift = FULL_NIGHT_PAID;

  const prevEnsureMonth = ensureMonth;
  ensureMonth = function(key) {
    const existed = !!app.months[key];
    const m = prevEnsureMonth(key);
    if (!existed && m && m.params) {
      m.params.nightAutoV45 = true;
      m.params.nightHoursPerShift = FULL_NIGHT_PAID;
    }
    return m;
  };

  const actualInput = el('nightHoursActual');
  const perShiftInput = el('nightHoursPerShift');
  const shiftsInput = el('nightShifts');
  if (perShiftInput) {
    perShiftInput.value = '7,5'; perShiftInput.readOnly = true;
    const label = perShiftInput.closest('label'); const spans = label ? label.querySelectorAll('.label span') : [];
    if (spans[0]) spans[0].textContent = 'Оплачиваемых ночных часов за полную смену';
    if (spans[1]) spans[1].textContent = BREAK_TEXT;
    else if (label && label.querySelector('.label')) { const hint=document.createElement('span'); hint.className='hint'; hint.textContent=BREAK_TEXT; label.querySelector('.label').appendChild(hint); }
  }
  if (actualInput) {
    const label = actualInput.closest('label'); const spans = label ? label.querySelectorAll('.label span') : [];
    if (spans[0]) spans[0].textContent = 'Ночных часов всего';
    if (spans[1]) spans[1].textContent = 'авто: смены × 7,5 − ночной отгул';
    else if (label && label.querySelector('.label')) { const hint=document.createElement('span'); hint.className='hint'; hint.textContent='авто: смены × 7,5 − ночной отгул'; label.querySelector('.label').appendChild(hint); }
    if (!el('nightAutoToggle')) {
      const autoLabel=document.createElement('label');
      autoLabel.innerHTML='<div class="label"><span>Авторасчёт ночных</span><span class="hint">штатные смены и отгулы</span></div><select id="nightAutoToggle"><option value="1">Включён</option><option value="0">Ручной режим</option></select>';
      label.insertAdjacentElement('afterend',autoLabel);
    }
  }

  const stats=document.querySelector('.ledger-stats');
  if (stats && !el('logNightBase')) stats.insertAdjacentHTML('beforeend','<div class="stat"><span>Ночные по графику</span><b id="logNightBase">0 ч</b></div><div class="stat"><span>Ночные снято отгулами</span><b id="logNightReduction">0 ч</b></div>');

  function modeFor(p) { return el('nightAutoToggle') ? el('nightAutoToggle').value === '1' : p && p.nightAutoV45 === true; }
  function syncNightHours(save=true) {
    if (!currentMonth) return null;
    const m=ensureMonth(currentMonth),p=m.params,auto=modeFor(p);
    p.nightAutoV45=auto; p.nightHoursPerShift=FULL_NIGHT_PAID;
    if (perShiftInput) perShiftInput.value='7,5';
    const shifts=Math.max(0,num(shiftsInput ? shiftsInput.value : p.nightShifts));
    const base=round2(shifts*FULL_NIGHT_PAID);
    const reduction=round2(Math.min(base,nightReduction(m.entries||[])));
    const actual=round2(Math.max(0,base-reduction));
    if (auto) { p.nightShifts=shifts; p.nightHoursActual=actual; if (actualInput) actualInput.value=String(actual).replace('.',','); }
    if (actualInput) actualInput.readOnly=auto;
    if (el('logNightBase')) el('logNightBase').textContent=qty(base)+' ч';
    if (el('logNightReduction')) el('logNightReduction').textContent=reduction?'−'+qty(reduction)+' ч':'0 ч';
    if (save) saveApp();
    return {auto,base,reduction,actual};
  }

  const prevReadParams=readParams;
  readParams=function(){ const p=prevReadParams(); const old=app.months?.[currentMonth]?.params; p.nightAutoV45=el('nightAutoToggle')?el('nightAutoToggle').value==='1':!!old?.nightAutoV45; p.nightHoursPerShift=FULL_NIGHT_PAID; return p; };
  const prevWriteParams=writeParams;
  writeParams=function(p){ prevWriteParams(p); if(perShiftInput)perShiftInput.value='7,5'; if(el('nightAutoToggle'))el('nightAutoToggle').value=p?.nightAutoV45===true?'1':'0'; if(actualInput)actualInput.readOnly=p?.nightAutoV45===true; };

  function appendNightNote(){ if(!el('durationNote')||el('entryType')?.value!=='compUse')return; const cut=paidNightOverlap(el('entryStart')?.value,el('entryEnd')?.value); if(cut>0)el('durationNote').textContent+=` Ночные автоматически уменьшатся на ${qty(cut)} ч; обед 23:00–23:30 не вычитается второй раз.`; }
  const prevUpdateDuration=updateDuration;
  updateDuration=function(){ prevUpdateDuration(); appendNightNote(); };
  ['entryStart','entryEnd'].forEach(id=>el(id)?.addEventListener('input',()=>setTimeout(appendNightNote,0)));

  const prevRender=render;
  render=function(){ const p=app.months?.[currentMonth]?.params; if(p?.nightAutoV45===true||el('nightAutoToggle')?.value==='1')syncNightHours(false); prevRender(); const r=syncNightHours(false); if(r&&el('nightAutoToggle'))el('nightAutoToggle').value=r.auto?'1':'0'; };

  el('nightAutoToggle')?.addEventListener('change',()=>{ const m=ensureMonth(currentMonth); m.params.nightAutoV45=el('nightAutoToggle').value==='1'; syncNightHours(true); render(); });
  shiftsInput?.addEventListener('input',()=>{ const m=ensureMonth(currentMonth); m.params.nightAutoV45=true; if(el('nightAutoToggle'))el('nightAutoToggle').value='1'; syncNightHours(true); });

  const note=document.createElement('div'); note.className='verified'; note.style.marginTop='12px'; note.id='nightAutoExplanation';
  note.innerHTML='<b>Ночные автоматически:</b> полная штатная ночная смена = <b>7,5 ч</b> (22:00–06:00 минус обед 23:00–23:30). Если ушёл в отгул, внеси «Отгул — использован» с фактическим интервалом отсутствия. Например, 02:00–08:00 спишет 6 ч банка отгулов, но ночные уменьшит только на 4 ч. Выходные за оплату пока в этот автомат не входят.';
  const ledger=document.querySelector('.ledger .body')||document.querySelector('section.card .body');
  if(ledger&&!document.getElementById('nightAutoExplanation'))ledger.appendChild(note);

  const footer=document.querySelector('.footer');
  if(footer)footer.textContent='PWA 4.5 · ночные 7,5 ч/смена · авто-коррекция ночных по отгулам · 4-й 111,68 ₽/ч · 6-й 133,7 ₽/ч · архив месяцев · PDF.';

  if(el('nightAutoToggle')){const p=ensureMonth(currentMonth).params;el('nightAutoToggle').value=p.nightAutoV45===true?'1':'0';}
  syncNightHours(true); render();
})();
