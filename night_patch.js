(() => {
  if (window.__salaryNightV46) return;
  window.__salaryNightV46 = true;

  const FULL_NIGHT_PAID = 7.5;
  const REGULAR_BREAK_TEXT = 'штатная ночь 19:00–07:00; доплата 22:00–06:00 минус обед 23:00–23:30';

  function clockMin(v) {
    const s = typeof normalizeClockValue === 'function' ? normalizeClockValue(v) : String(v || '');
    if (!/^\d{2}:\d{2}$/.test(s)) return null;
    const [h,m] = s.split(':').map(Number);
    return h * 60 + m;
  }
  function overlap(a,b,x,y) { return Math.max(0, Math.min(b,y) - Math.max(a,x)); }
  function interval(start,end) {
    let a=clockMin(start),b=clockMin(end);
    if(a===null||b===null||a===b)return null;
    if(b<a)b+=1440;
    return [a,b];
  }
  function paidNightOverlap(start,end) {
    const iv=interval(start,end); if(!iv)return 0;
    const [a,b]=iv,segments=[[0,360],[1320,1380],[1410,1800]];
    let mins=0; for(const [x,y] of segments)mins+=overlap(a,b,x,y);
    return round2(mins/60);
  }
  function weekendNightOverlap(start,end) {
    const iv=interval(start,end); if(!iv)return 0;
    const [a,b]=iv,segments=[[0,360],[1320,1440],[1440,1800]];
    let mins=0; for(const [x,y] of segments)mins+=overlap(a,b,x,y);
    return round2(Math.min(480,mins)/60);
  }
  function nightReduction(entries){return round2((entries||[]).reduce((s,e)=>e&&e.type==='compUse'?s+paidNightOverlap(e.start,e.end):s,0));}
  function weekendNightHours(entries){return round2((entries||[]).reduce((s,e)=>e&&e.type==='weekend'?s+weekendNightOverlap(e.start,e.end):s,0));}

  Object.entries(app.months||{}).forEach(([key,m])=>{
    if(!m||!m.params)return;
    m.params.nightHoursPerShift=FULL_NIGHT_PAID;
    if(m.params.nightAutoV45===undefined)m.params.nightAutoV45=key>=browserMonth();
  });
  if(typeof defaults!=='undefined')defaults.nightHoursPerShift=FULL_NIGHT_PAID;

  const prevEnsureMonth=ensureMonth;
  ensureMonth=function(key){const existed=!!app.months[key],m=prevEnsureMonth(key);if(!existed&&m&&m.params){m.params.nightAutoV45=true;m.params.nightHoursPerShift=FULL_NIGHT_PAID;}return m;};

  const actualInput=el('nightHoursActual'),perShiftInput=el('nightHoursPerShift'),shiftsInput=el('nightShifts');
  if(perShiftInput){
    perShiftInput.value='7,5';perShiftInput.readOnly=true;
    const label=perShiftInput.closest('label'),spans=label?label.querySelectorAll('.label span'):[];
    if(spans[0])spans[0].textContent='Оплачиваемых ночных часов за штатную ночь';
    if(spans[1])spans[1].textContent=REGULAR_BREAK_TEXT;
    else if(label&&label.querySelector('.label')){const hint=document.createElement('span');hint.className='hint';hint.textContent=REGULAR_BREAK_TEXT;label.querySelector('.label').appendChild(hint);}
  }
  if(actualInput){
    const label=actualInput.closest('label'),spans=label?label.querySelectorAll('.label span'):[],formula='авто: смены × 7,5 + ночные выходных − ночной отгул';
    if(spans[0])spans[0].textContent='Ночных часов всего';
    if(spans[1])spans[1].textContent=formula;
    else if(label&&label.querySelector('.label')){const hint=document.createElement('span');hint.className='hint';hint.textContent=formula;label.querySelector('.label').appendChild(hint);}
    if(!el('nightAutoToggle')){const autoLabel=document.createElement('label');autoLabel.innerHTML='<div class="label"><span>Авторасчёт ночных</span><span class="hint">штатные ночи + выходные за оплату − отгулы</span></div><select id="nightAutoToggle"><option value="1">Включён</option><option value="0">Ручной режим</option></select>';label.insertAdjacentElement('afterend',autoLabel);}
  }

  const stats=document.querySelector('.ledger-stats');
  if(stats&&!el('logNightBase'))stats.insertAdjacentHTML('beforeend','<div class="stat"><span>Ночные по графику</span><b id="logNightBase">0 ч</b></div><div class="stat"><span>Ночные из выходных</span><b id="logNightWeekend">0 ч</b></div><div class="stat"><span>Ночные снято отгулами</span><b id="logNightReduction">0 ч</b></div>');
  else if(stats&&!el('logNightWeekend')){const baseStat=el('logNightBase')?.closest('.stat');if(baseStat)baseStat.insertAdjacentHTML('afterend','<div class="stat"><span>Ночные из выходных</span><b id="logNightWeekend">0 ч</b></div>');}

  function modeFor(p){return el('nightAutoToggle')?el('nightAutoToggle').value==='1':p&&p.nightAutoV45===true;}
  function syncNightHours(save=true){
    if(!currentMonth)return null;
    const m=ensureMonth(currentMonth),p=m.params,auto=modeFor(p);
    p.nightAutoV45=auto;p.nightHoursPerShift=FULL_NIGHT_PAID;if(perShiftInput)perShiftInput.value='7,5';
    const shifts=Math.max(0,num(shiftsInput?shiftsInput.value:p.nightShifts));
    const base=round2(shifts*FULL_NIGHT_PAID),weekend=weekendNightHours(m.entries||[]),reduction=round2(Math.min(base,(m.useShiftCalendar && window.salaryShiftTotals ? window.salaryShiftTotals(m).reduction : nightReduction(m.entries || [])))),actual=round2(Math.max(0,base-reduction)+weekend);
    if(auto){p.nightShifts=shifts;p.nightHoursActual=actual;if(actualInput)actualInput.value=String(actual).replace('.',',');}
    if(actualInput)actualInput.readOnly=auto;
    if(el('logNightBase'))el('logNightBase').textContent=qty(base)+' ч';
    if(el('logNightWeekend'))el('logNightWeekend').textContent=weekend?'+'+qty(weekend)+' ч':'0 ч';
    if(el('logNightReduction'))el('logNightReduction').textContent=reduction?'−'+qty(reduction)+' ч':'0 ч';
    if(save)saveApp();
    return {auto,base,weekend,reduction,actual};
  }

  // Compare the same month with and without this journal row.
  function journalImpact(params, entries, remaining) {
    const month = ensureMonth(currentMonth);
    function scenario(rows) {
      const p = {...params};
      const plan = month.useShiftCalendar && window.salaryShiftTotals
        ? window.salaryShiftTotals({...month, entries: rows}) : null;
      if (plan) p.baseHours = plan.hours;
      const base = (plan ? plan.nights : num(p.nightShifts)) * FULL_NIGHT_PAID;
      const loss = plan ? plan.reduction : nightReduction(rows);
      const nights = Math.max(0, base - loss) + weekendNightHours(rows);
      return {effective: effectiveParams(p, rows), nights};
    }
    const withRow = scenario(entries), withoutRow = scenario(remaining);
    if (params.nightAutoV45) {
      withRow.effective.nightHoursActual = withRow.nights;
      withoutRow.effective.nightHoursActual = withoutRow.nights;
    } else {
      // Forecast the marginal night premium even with a manual monthly total.
      const delta = withRow.nights - withoutRow.nights;
      withoutRow.effective.nightHoursActual = Math.max(0,num(params.nightHoursActual) - delta);
      withRow.effective.nightHoursActual = withoutRow.effective.nightHoursActual + delta;
    }
    return round2(calculate(withRow.effective).totalInHand - calculate(withoutRow.effective).totalInHand);
  }
  entryImpact = (entry, params, entries) =>
    journalImpact(params, entries, entries.filter(e => e.id !== entry.id));
  const renderLedgerBeforeNight = renderLedger;
  renderLedger = function(params, entries) {
    renderLedgerBeforeNight(params, entries);
    const impact = journalImpact(params, entries, []);
    const output = el('journalNetImpact');
    output.textContent = (impact >= 0 ? '+' : '') + money(impact);
    output.className = impact >= 0 ? 'positive' : 'danger';
  };

  const prevReadParams=readParams;
  readParams=function(){const p=prevReadParams(),old=app.months?.[currentMonth]?.params;p.nightAutoV45=el('nightAutoToggle')?el('nightAutoToggle').value==='1':!!old?.nightAutoV45;p.nightHoursPerShift=FULL_NIGHT_PAID;return p;};
  const prevWriteParams=writeParams;
  writeParams=function(p){prevWriteParams(p);if(perShiftInput)perShiftInput.value='7,5';if(el('nightAutoToggle'))el('nightAutoToggle').value=p?.nightAutoV45===true?'1':'0';if(actualInput)actualInput.readOnly=p?.nightAutoV45===true;};

  function appendNightNote(){
    if(!el('durationNote'))return;
    const type=el('entryType')?.value;
    if(type==='compUse'){
      const cut=paidNightOverlap(el('entryStart')?.value,el('entryEnd')?.value);
      if(cut>0)el('durationNote').textContent+=` Ночные автоматически уменьшатся на ${qty(cut)} ч; для штатной ночи обед 23:00–23:30 уже учтён.`;
    }else if(type==='weekend'){
      const add=weekendNightOverlap(el('entryStart')?.value,el('entryEnd')?.value);
      if(add>0)el('durationNote').textContent+=` В ночные автоматически добавится ${qty(add)} ч; в выходной обед не вычитается, максимум 8 ч за ночь.`;
    }
  }
  const prevUpdateDuration=updateDuration;
  updateDuration=function(){prevUpdateDuration();appendNightNote();};
  ['entryStart','entryEnd','entryType'].forEach(id=>el(id)?.addEventListener('input',()=>setTimeout(appendNightNote,0)));

  const prevRender=render;
  render=function(){const p=app.months?.[currentMonth]?.params;if(p?.nightAutoV45===true||el('nightAutoToggle')?.value==='1')syncNightHours(false);prevRender();const r=syncNightHours(false);if(r&&el('nightAutoToggle'))el('nightAutoToggle').value=r.auto?'1':'0';};

  el('nightAutoToggle')?.addEventListener('change',()=>{const m=ensureMonth(currentMonth);m.params.nightAutoV45=el('nightAutoToggle').value==='1';syncNightHours(true);render();});
  shiftsInput?.addEventListener('input',()=>{const m=ensureMonth(currentMonth);m.params.nightAutoV45=true;if(el('nightAutoToggle'))el('nightAutoToggle').value='1';syncNightHours(true);});

  const note=document.createElement('div');note.className='verified';note.style.marginTop='12px';note.id='nightAutoExplanation';
  note.innerHTML='<b>Авторасчёт ночных:</b> штатная дневная смена <b>08:00–20:00</b>, штатная ночная <b>19:00–07:00</b>. Ночная доплата — только за <b>22:00–06:00</b>. Штатная полная ночь даёт <b>7,5 ч</b> (минус обед 23:00–23:30). Для «Выходной — за оплату» считаем фактическое пересечение с 22:00–06:00 <b>без вычета обеда</b>, максимум <b>8 ч</b>. «Отгул — использован» уменьшает ночные только в своей части окна 22:00–06:00.';
  const ledger=document.querySelector('.ledger .body')||document.querySelector('section.card .body'),oldNote=document.getElementById('nightAutoExplanation');
  if(oldNote)oldNote.replaceWith(note);else if(ledger)ledger.appendChild(note);

  const footer=document.querySelector('.footer');
  if(footer)footer.textContent='PWA 5.5 · штатная ночь 7,5 ч · выходные: ночные по факту до 8 ч · авто-коррекция по отгулам · архив месяцев · PDF.';

  if(el('nightAutoToggle')){const p=ensureMonth(currentMonth).params;el('nightAutoToggle').value=p.nightAutoV45===true?'1':'0';}
  syncNightHours(true);render();
})();

(() => {
  if (document.getElementById('shiftCalendar')) return;
  const kinds = {
    day: ['Д', 'Дневная', '08:00–20:00', 11.2, [[480,690],[740,1200]]],
    night: ['Н', 'Ночная', '19:00–07:00', 11.5, [[1140,1380],[1410,1860]]],
    short: ['8', 'Пятидневка', '08:00–16:50', 8, [[480,690],[740,1010]]]
  };
  const panel = document.createElement('section');
  panel.id = 'shiftCalendar';
  panel.className = 'card';
  panel.style.cssText = 'padding:14px;margin:12px 0';
  const style = document.createElement('style');
  style.textContent = `
    #shiftCalendar { border-radius:18px; }
    #scGrid { display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:12px 0;text-align:center; }
    #scGrid .sc-cell { padding:2px;min-width:0;width:100%;height:auto;min-height:0;max-height:none;aspect-ratio:1 / 1;contain:size;align-self:start;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-start;gap:0;border:1px solid #aeb000;border-radius:10px;
      background:#d3d600;color:#282900;line-height:1.1; }
    #scGrid .sc-cell > span { flex-shrink:0; }
    #scGrid .sc-work { background:#0aa5d1;color:#ffffff;border-color:#168bb0; }
    #scGrid [aria-pressed="true"] { outline:2px solid #62daca;outline-offset:0; }
    #scGrid .sc-number { align-self:flex-start;font-size:9px;font-weight:600; }
    #scGrid .sc-hours { font-size:clamp(9px,2.5vw,14px);font-weight:700; }
    #scGrid .sc-kind { font-size:8px;max-width:100%;white-space:nowrap; }
    #scHelp { display:block;margin:5px 0 10px;color:#bdd1de; }
  `;
  document.head.appendChild(style);
  panel.innerHTML = `<h2>График смен</h2><b id="scMonth"></b><div id="scGrid"></div>
    <b id="scDate"></b><div id="scTypes"></div>
    <label><input id="scUse" style="width:auto" type="checkbox"> Считать зарплату по графику</label>
    <small id="scHelp"></small>
    <details><summary>Как записать отгул в ночную смену?</summary>
    Ночь с 7-го на 8-е: нажми 7-е, выбери в журнале «Отгул — использован» и укажи время, например 02:00–07:00.
    Если вышел в выходной за деньги, добавь в журнал «Выходной — оплата».</details>`;
  document.querySelector('.wrap header').after(panel);
  const grid = el('scGrid');
  let selected = '', snapshot = '';
  function scheduled(month) { return month.shiftCalendar || {}; }
  function types(month,date) { return (scheduled(month)[date] || []).filter(k => Object.hasOwn(kinds,k)); }
  function totals(month) {
    let hours = 0, nights = 0, reduction = 0;
    for (const date of Object.keys(scheduled(month))) {
      for (const k of types(month,date)) {
        const [, , , credit, segments] = kinds[k];
        hours += credit;
        if (k !== "night") continue;
        nights++;
        const absent = new Set();
        for (const e of month.entries || []) {
          if (e.date !== date || e.type !== 'compUse' || !e.start || !e.end) continue;
          const mins = v => Number(v.slice(0,2))*60 + Number(v.slice(3));
          let a = mins(e.start), b = mins(e.end);
          if (k === 'night' && a < 420) a += 1440;
          if (b < a) b += 1440;
          for (const [lo,hi] of segments) for (let t=Math.max(a,lo); t<Math.min(b,hi); t++) absent.add(t);
        }
        for (const t of absent) if (t >= 1320 && t < 1800) reduction += 1/60;
      }
    }
    return {hours:round2(hours), nights, reduction:round2(reduction)};
  }
  window.salaryShiftTotals = totals;
  const extraBank = 'overtimeComp';
  typeLabels[extraBank] = 'Сверхурочные — за отгул';
  el('entryType').add(new Option(typeLabels[extraBank], extraBank));
  const previousContribution = entryContribution;
  entryContribution = function(entry) {
    const result = previousContribution(entry);
    if (entry.type === extraBank) result.compEarn = durationHours(entry.start, entry.end);
    return result;
  };
  const beforeMode = updateEntryMode;
  updateEntryMode = function(force) {
    beforeMode(force);
    const exact = el('entryType').value === extraBank;
    el('entryPaidHours').readOnly = exact;
    if (exact) {
      el('entryHoursLabel').textContent = 'В банк отгулов, ч';
      el('entryHoursHint').textContent = 'по фактическому времени';
      el('entryPaidHours').value = qty(durationHours(el('entryStart').value, el('entryEnd').value));
    }
  };
  const beforeValidate = validateEntry;
  validateEntry = function() {
    if (el('entryType').value === extraBank) {
      const clocks = [el('entryStart').value, el('entryEnd').value].map(normalizeClockValue);
      if (!clocks.every(v => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)) || !durationHours(...clocks)) {
        alert('Укажи начало и окончание сверхурочных.'); return null;
      }
      el('entryPaidHours').value = durationHours(...clocks);
    }
    return beforeValidate();
  };

  const quick = document.createElement('dialog');
  quick.setAttribute('aria-labelledby','scQuickTitle');
  quick.style.cssText='width:min(360px,92vw);box-sizing:border-box;padding:20px;background:#10253a;color:#edf6ff;border:1px solid #416381;border-radius:16px';
  quick.innerHTML = `<form style="display:grid;gap:12px">
    <h3 id="scQuickTitle"></h3><label>Вид записи<select id="scQuickType"></select></label><small>На дату — один вид дополнительного выхода. Сохрани новый вариант, чтобы заменить прежний.</small>
    <div style="display:flex;gap:12px"><label>С какого времени<input type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="2000 → 20:00" id="scFrom" required></label>
    <label>До какого времени<input type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="2200 → 22:00" id="scTo"></label></div>
    <button type="button" id="scSaveStart">Сохранить вход · завершить позже</button><small>До указания ухода выход хранится отдельно и ожидает завершения.</small><output id="scCredit" aria-live="polite"></output><button class="primary" type="submit">Записать в журнал</button>
    <button type="button" id="scConfigure">Расставить смены</button><button type="button" id="scCancel">Отмена</button>
    </form>`;
  panel.append(quick);
  const categories = {weekend:'Выходной — за оплату',compEarn:'Выходной — за отгул',
    overtime:'Сверхурочные — за оплату',overtimeComp:typeLabels[extraBank]};
  let pendingId = null;
  let extraEditId = null;
  function isExtra(entry) { return Object.hasOwn(categories,entry.type); }
  function saveExclusiveExtra(month, data, id) {
    const others = month.entries.filter(e => e.date === data.date && isExtra(e) && e.id !== id);
    if (others.length && !confirm('На эту дату уже есть дополнительный выход. Заменить его выбранным вариантом?')) return false;
    const old = month.entries.find(e => e.id === id);
    const entry = {...old,...data,id:old?.id || Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      createdAt:old?.createdAt || new Date().toISOString()};
    month.entries = month.entries.filter(e => e.id !== id && !(e.date === data.date && isExtra(e)));
    month.entries.push(entry);
    month.entries.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    month.pendingWork = pendingList(month).filter(p => p.date !== data.date);
    saveApp();return true;
  }
  // The original journal button captured its handler at startup.
  el('addEntryBtn').addEventListener('click', event => {
    if (!Object.hasOwn(categories,el('entryType').value)) return;
    event.stopImmediatePropagation();
    const data = validateEntry();
    if (!data) return;
    if (saveExclusiveExtra(ensureMonth(currentMonth),data,editingId)) {
      resetEntryForm();render();
    }
  },true);
  const existingWork = document.createElement('div');
  existingWork.id = 'scExistingWork';
  quick.querySelector('form').prepend(existingWork);
  function showExistingWork(date) {
    existingWork.replaceChildren();
    const month=ensureMonth(workMonth);
    for (const entry of month.entries.filter(e=>e.date===date&&isExtra(e))) {
      const row=document.createElement('div');
      const text=document.createElement('span');
      text.textContent=categories[entry.type]+' · '+entry.start+'–'+entry.end+' · '+qty(entry.paidHours)+' ч ';
      const remove=document.createElement('button');
      remove.type='button';remove.textContent='Удалить';
      remove.onclick=()=>{
        if(!confirm('Удалить '+categories[entry.type]+' за '+date+'?'))return;
        month.entries=month.entries.filter(e=>e.id!==entry.id);
        saveApp();quick.close();render();
      };
      row.append(text,remove);existingWork.append(row);
    }
  }

  let workMonth = '';
  let workDate = '';
  const unfinished = document.createElement('div');
  unfinished.id = 'scUnfinished';
  panel.insertBefore(unfinished, quick);
  function pendingList(month) { return month.pendingWork || []; }
  function renderPending() {
    unfinished.replaceChildren();
    const month = ensureMonth(currentMonth);
    for (const item of pendingList(month)) {
      const row = document.createElement('div');
      row.style.cssText = 'padding:10px;margin:8px 0;border:1px solid #536b80;border-radius:10px';
      const resume = document.createElement('button');
      resume.type = 'button';
      resume.textContent = 'Завершить: '+item.date.split('-').reverse().join('.')+' · '+item.start+' · '+categories[item.type];
      resume.onclick = () => {
        selected = item.date;
        draw();
        openWork(item.date);
        pendingId = item.id;
        el('scQuickType').replaceChildren(new Option(categories[item.type],item.type));
        el('scQuickType').value = item.type;
        el('scFrom').value = item.start;
        el('scTo').value = item.end || '';
        el('scQuickTitle').textContent = 'Завершить выход '+item.date.split('-').reverse().join('.');
        previewWork();
      };
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Удалить';
      remove.onclick = () => {
        if (!confirm('Удалить незавершённый выход?')) return;
        month.pendingWork = pendingList(month).filter(p => p.id !== item.id);
        saveApp();render();
      };
      row.append(resume, remove);
      unfinished.append(row);
    }
  }
  function savePendingStart() {
    const start = normalizeClockValue(el('scFrom').value);
    const end = normalizeClockValue(el('scTo').value);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(start)) {
      el('scCredit').textContent = 'Укажи время входа, например 1002.';return;
    }
    if (end) {
      el('scCredit').textContent = 'Для завершённого выхода нажми «Записать в журнал».';return;
    }
    const month = ensureMonth(workMonth);
    if (month.entries.some(e => e.date === workDate && isExtra(e))) {
      el('scCredit').textContent='На эту дату уже есть завершённый выход. Удали его перед сохранением нового входа.';return;
    }
    const item = {id:pendingId || Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      date:workDate, type:el('scQuickType').value, start, end:'',createdAt:new Date().toISOString()};
    month.pendingWork = [...pendingList(month).filter(p => p.date !== workDate),item];
    saveApp();quick.close();render();
  }
  el('scSaveStart').onclick = savePendingStart;
  const journalStart = document.createElement('button');
  journalStart.type = 'button';
  journalStart.textContent = 'Сохранить только вход';
  el('addEntryBtn').after(journalStart);
  journalStart.onclick = () => {
    const date = el('entryDate').value, type = el('entryType').value;
    if (editingId || !Object.hasOwn(categories,type) || date.slice(0,7) !== currentMonth) {
      alert('Для начала выхода выбери дату текущего месяца и выходной или сверхурочные.');return;
    }
    const start = el('entryStart').value;
    if (el('entryEnd').value.trim()) {alert('Окончание уже указано. Можно зафиксировать запись в журнале.');return;}
    selected = date;openWork(date);el('scQuickType').replaceChildren(new Option(categories[type],type));
    el('scQuickType').value=type;el('scFrom').value=start;savePendingStart();
  };
  function quickHours() {
    const actual = durationHours(el('scFrom').value, el('scTo').value);
    const bank = el('scQuickType').value === 'compEarn';
    return {actual, credit:bank ? num(el('compEarnPerShift').value)||11.2 : actual};
  }
  function previewWork() {
    const {actual,credit} = quickHours();
    const bank = ['compEarn', extraBank].includes(el('scQuickType').value);
    el('scCredit').textContent = actual ? 'Факт: '+qty(actual)+' ч · '+(bank?'В банк: ':'К оплате: ')+qty(credit)+' ч' : 'Укажи время начала и окончания.';
  }
  function openWork(date) {
    pendingId = null;
    extraEditId = null;
    workMonth = currentMonth;
    workDate = date;
    const assigned = types(ensureMonth(currentMonth),date);
    el('scQuickTitle').textContent = 'Запись на '+date.split('-').reverse().join('.');
    const options = el('scQuickType');
    options.replaceChildren();
    for (const key of ['weekend','compEarn','overtime',extraBank]) options.add(new Option(categories[key],key));
    el('scFrom').value = assigned.length ? kinds[assigned[assigned.length-1]][2].split('–')[1] : '';
    el('scTo').value = '';
    const existing=ensureMonth(workMonth).entries.find(e=>e.date===date&&isExtra(e));
    if(existing){
      extraEditId=existing.id;
      el('scQuickType').value=existing.type;
      el('scFrom').value=existing.start||'';
      el('scTo').value=existing.end||'';
    }else if(assigned.length)el('scQuickType').value='overtime';
    showExistingWork(date);
    previewWork();if(!quick.open)quick.showModal();
  }
  for (const id of ['scFrom','scTo']) {
    el(id).addEventListener('blur', () => {
      el(id).value = normalizeClockValue(el(id).value);
      previewWork();
    });
  }
  quick.oninput = previewWork;
  el('scCancel').onclick = ()=>quick.close();
  el('scConfigure').onclick = ()=>{quick.close();el('scTypes').querySelector('button')?.focus();};
  quick.querySelector('form').onsubmit = event=>{
    event.preventDefault();
    const clocks = ['scFrom','scTo'].map(id => normalizeClockValue(el(id).value));
    if (!clocks.every(value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))) {
      el('scCredit').textContent = 'Проверь время. Например, 2000 или 20:00.';
      return;
    }
    el('scFrom').value = clocks[0];
    el('scTo').value = clocks[1];
    const {actual,credit}=quickHours();
    if (!actual) {el('scCredit').textContent='Начало и окончание должны различаться.';return;}
    const work = ensureMonth(workMonth);
    if (pendingId && !pendingList(work).some(p => p.id === pendingId)) return;
    const data={date:workDate,type:el('scQuickType').value,start:el('scFrom').value,end:el('scTo').value,
      actualHours:actual,paidHours:credit,comment:work.entries.find(e=>e.id===extraEditId)?.comment||''};
    if(saveExclusiveExtra(work,data,extraEditId)){
      quick.close();render();
    }
  };
  function draw() {
    const month = ensureMonth(currentMonth);
    if (!selected.startsWith(currentMonth+'-')) selected = currentMonth+'-01';
    const stamp = JSON.stringify([currentMonth,selected,scheduled(month),month.useShiftCalendar,(month.entries||[]).map(e=>[e.date,e.type,e.paidHours])]);
    if (stamp === snapshot) return;
    snapshot = stamp;
    const [y,m] = currentMonth.split('-').map(Number);
    el('scMonth').textContent = monthTitle(currentMonth);
    grid.replaceChildren();
    for (const d of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']) {const x=document.createElement('small');x.textContent=d;grid.append(x);}
    for(let i=0;i<(new Date(y,m-1,1).getDay()+6)%7;i++)grid.append(document.createElement('span'));
    for(let i=1;i<=new Date(y,m,0).getDate();i++){
      const date=currentMonth+'-'+String(i).padStart(2,'0');
      const btn=document.createElement('button');
      const leave=(month.entries||[]).some(e=>e.type==='compUse'&&e.date===date);
      const shifts = types(month,date);
      btn.className = 'sc-cell' + (shifts.length ? ' sc-work' : '');
      btn.setAttribute('aria-pressed',String(date===selected));
      const lines = [['sc-number', String(i)]];
      for (const key of shifts) {
        lines.push(['sc-hours', qty(kinds[key][3])], ['sc-kind', {day:'День',night:'Ночь',short:'5/2'}[key]]);
      }
      for (const e of month.entries || []) {
        if (e.date === date && Object.hasOwn(categories,e.type)) {
          const caption = {weekend:'Вых.оплата',compEarn:'Вых.отгул',overtime:'Св.опл',overtimeComp:'Св.отгул'}[e.type];
          lines.push(['sc-kind', caption], ['sc-kind', '+'+qty(e.paidHours)+' ч']);
        }
      }
      if (leave) lines.push(['sc-kind','Отгул']);
      btn.setAttribute('aria-label', [date, ...shifts.map(key => kinds[key][1]+' '+qty(kinds[key][3])+' ч'),
        shifts.length ? '' : 'Выходной', leave ? 'Отгул' : ''].filter(Boolean).join(', '));
      for (const [cls,label] of lines) {
        const line = document.createElement('span');
        line.className = cls;
        line.textContent = label;
        btn.append(line);
      }
      btn.onclick=()=>{selected=date;if(!editingId)el('entryDate').value=date;draw();openWork(date);};
      grid.append(btn);
    }
    el('scDate').textContent='Смены на '+selected.split('-').reverse().join('.');
    el('scTypes').replaceChildren();
    for(const [key,[,name,time,h]] of Object.entries(kinds)){
      const btn=document.createElement('button'), active=types(month,selected).includes(key);
      btn.textContent=(active?'✓ ':'')+name+' '+time+' · '+qty(h)+' ч';
      btn.setAttribute('aria-pressed',String(active));
      btn.onclick=()=>{
        month.shiftCalendar ||= {};
        const next=types(month,selected).filter(k=>k!==key && (key==='night'||k==='night'||active));
        if(!active)next.push(key);
        if(next.length)month.shiftCalendar[selected]=next;else delete month.shiftCalendar[selected];
        render();
      };
      el('scTypes').append(btn);
    }
    el('scUse').checked=!!month.useShiftCalendar;
    el('scHelp').textContent = month.useShiftCalendar
      ? 'Часы для зарплаты берутся из отмеченных смен. Отгул списывается из банка. Тарифные часы сохраняются. В ночную смену уменьшается доплата за пропущенные ночные часы.'
      : 'Часы для зарплаты задаются вручную. Включи после заполнения графика, чтобы подставить часы и число ночных смен.';
  }
  el('scUse').onchange=()=>{ensureMonth(currentMonth).useShiftCalendar=el('scUse').checked;render();};
  const originalRender=render;
  render=function(){
    const month=ensureMonth(currentMonth);
    if(month.useShiftCalendar){
      const total=totals(month);
      el('baseHours').value=total.hours;
      el('nightShifts').value=total.nights;
    }
    el('baseHours').readOnly=el('nightShifts').readOnly=!!month.useShiftCalendar;
    originalRender();draw();renderPending();
  };
  const entryLabel=el('entryDate').closest('label')?.querySelector('.label span');
  if(entryLabel)entryLabel.textContent='Дата начала смены';
  const dateMode=document.createElement('select');
  dateMode.setAttribute('aria-label','Как учитывать дату отгула');
  dateMode.innerHTML='<option value="shift">Дата начала смены</option><option value="actual">Фактическая дата отгула</option>';
  el('entryDate').after(dateMode);
  const validateBeforeCalendar=validateEntry;
  validateEntry=function(){
    const input=el('entryDate'), picked=input.value;
    if(dateMode.value!=='actual' || el('entryType').value!=='compUse')return validateBeforeCalendar();
    const clock=normalizeClockValue(el('entryStart').value);
    if(!picked || !clock || clock>='07:00')return validateBeforeCalendar();
    const day=new Date(picked+'T12:00:00Z');
    day.setUTCDate(day.getUTCDate()-1);
    const shift=day.toISOString().slice(0,10);
    if(!types(app.months[shift.slice(0,7)]||{},shift).includes('night'))return validateBeforeCalendar();
    if(shift.slice(0,7)!==currentMonth){alert('Эта ночь относится к '+monthTitle(shift.slice(0,7))+'. Открой этот месяц и выбери смену '+shift+'.');return null;}
    input.value=shift;
    try{return validateBeforeCalendar();}finally{input.value=picked;}
  };
  grid.addEventListener('click',()=>{dateMode.value='shift';});
  const editBeforeCalendar=editEntry;
  editEntry=function(id){dateMode.value='shift';editBeforeCalendar(id);};
  // Capture before the legacy input helper overwrites manually entered hours.
  el('nightShifts').addEventListener('input',event=>{
    if(el('nightAutoToggle').value==='0'){event.stopImmediatePropagation();render();}
  },true);
  draw();
  render();
})();

(() => {
  const section = el('extraHours')?.closest('.weekend');
  if (!section) return;
  const label = document.createElement('label');
  label.innerHTML = '<input id="extraNightShift" type="checkbox" style="width:auto"> Ночной выход (ориентир с 19:00)';
  el('extraHours').closest('label').after(label);
  const nightHint = document.createElement('small');
  nightHint.id = 'extraNightHint';
  label.after(nightHint);
  const overtime = document.createElement('div');
  overtime.style.marginTop='16px';
  overtime.innerHTML = '<h3>Прогноз сверхурочных за оплату</h3><label>Часов (1–4)<input id="forecastOvertimeHours" type="number" min="1" max="4" step="1" value="1" inputmode="numeric"></label><div id="forecastOvertimeButtons" class="quick-buttons"></div><div class="weekend-result"><span>Добавится на руки</span><strong id="forecastOvertimeResult"></strong></div>';
  section.append(overtime);
  for (let hours=1;hours<=4;hours++) {
    const btn=document.createElement('button');
    btn.type='button';btn.textContent=hours+' ч';
    btn.onclick=()=>{el('forecastOvertimeHours').value=hours;renderForecast();};
    el('forecastOvertimeButtons').append(btn);
  }
  function estimatedNights(hours) {
    // Starting at 19:00, each 24-hour period includes 22:00–06:00.
    return round2(Math.floor(hours/24)*8+Math.max(0,Math.min(hours%24,11)-3));
  }
  function renderForecast() {
    const month=ensureMonth(currentMonth);
    const p=effectiveParams(month.params,month.entries||[]);
    const baseline=calculate(p).totalInHand;
    function weekendImpact(hours) {
      const night=el('extraNightShift').checked ? estimatedNights(hours) : 0;
      return round2(calculate({...p,weekendHours:num(p.weekendHours)+hours,
        nightHoursActual:num(p.nightHoursActual)+night}).totalInHand-baseline);
    }
    const hours=Math.max(0,num(el('extraHours').value));
    el('extraResult').textContent='+'+money(weekendImpact(hours));
    el('extra12').textContent=money(weekendImpact(12));
    el('extraPerHour').textContent=money(round2(weekendImpact(12)/12));
    el('extraNightHint').textContent=el('extraNightShift').checked
      ? 'Ориентир: '+qty(estimatedNights(hours))+' ночных ч, начало в 19:00, окно 22:00–06:00 без вычета обеда. Итог по факту — в журнале.'
      : '';
    const requested=num(el('forecastOvertimeHours').value);
    const valid=Number.isInteger(requested)&&requested>=1&&requested<=4;
    el('forecastOvertimeHours').setCustomValidity(valid?'':'Укажи целое число от 1 до 4');
    el('forecastOvertimeResult').textContent=valid
      ? '+'+money(round2(calculate({...p,overtimeHours:num(p.overtimeHours)+requested}).totalInHand-baseline))
      : 'Выбери 1–4 часа';
  }
  el('extraNightShift').onchange=renderForecast;
  el('forecastOvertimeHours').oninput=renderForecast;
  const previousRender=render;
  render=function(){previousRender();renderForecast();};
  renderForecast();
})();

(() => {
  const PLAN_KEY='salaryTrackerPlanV1';
  const MODE_KEY='salaryTrackerModeV1';
  let mode='actual';
  const actualSave=saveApp;
  const controls=document.createElement('section');
  controls.id='salaryModes';
  controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap;padding:12px 0';
  controls.innerHTML='<button type="button" id="salaryActual">Факт</button><button type="button" id="salaryPlan">План</button><span id="salaryModeHint" style="flex-basis:100%"></span>';
  document.querySelector('.wrap').prepend(controls);
  const style=document.createElement('style');
  style.textContent=`
    body[data-salary-mode="actual"] { background:#0b1b2d; }
    body[data-salary-mode="plan"] { background:#271436; }
    body[data-salary-mode="plan"] .card,
    body[data-salary-mode="plan"] #monthArchiveCard { background:#30213f; border-color:#78568d; }
    body[data-salary-mode="plan"] .hero { background:#4a2c60; }
    #salaryModes button { padding:12px 24px;border-radius:12px;border:1px solid #7188a1;color:#f5f7ff;background:#182f46; }
    #salaryModes [aria-pressed="true"] { background:#216a86;border-color:#6ee7e4; }
    body[data-salary-mode="plan"] #salaryModes [aria-pressed="true"] { background:#704390;border-color:#d8a4ff; }
  `;
  document.head.append(style);
  function readStored(key) {
    const raw=localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
  function paintMode() {
    document.body.dataset.salaryMode=mode;
    el('salaryActual').setAttribute('aria-pressed',String(mode==='actual'));
    el('salaryPlan').setAttribute('aria-pressed',String(mode==='plan'));
    el('salaryModeHint').textContent=mode==='actual'
      ? 'Факт · выполненные выходы и текущая ожидаемая зарплата.'
      : 'План · отдельная база для будущих смен и выходов. Первый план создан как копия факта.';
    if(el('monthArchiveCard')) {
      const heading=el('monthArchiveCard').querySelector('h2');
      if(heading)heading.textContent='Архив месяцев · '+(mode==='actual'?'Факт':'План');
    }
  }
  saveApp=function(){
    app.currentMonth=currentMonth;
    if(mode==='actual')actualSave();
    else localStorage.setItem(PLAN_KEY,JSON.stringify(app));
  };
  function switchBase(next) {
    if(next===mode)return;
    saveCurrentParams();
    let target;
    try {
      target=readStored(next==='plan'?PLAN_KEY:APP_KEY);
      if(!target && next==='plan')target=JSON.parse(JSON.stringify(app));
      if(!target || typeof target.months!=='object' || !target.months || !target.presets)throw Error();
      // Persist the initial clone before switching so failed storage cannot overwrite fact.
      if(next==='plan')localStorage.setItem(PLAN_KEY,JSON.stringify(target));
    }catch(error){alert('Не удалось открыть базу. Текущие данные сохранены.');return;}
    app=target;mode=next;
    currentMonth=app.currentMonth||Object.keys(app.months).sort().at(-1)||browserMonth();
    const month=ensureMonth(currentMonth);
    el('monthPicker').value=currentMonth;
    writeParams(month.params);resetEntryForm();
    localStorage.setItem(MODE_KEY,mode);
    paintMode();render();
    document.dispatchEvent(new Event('change'));
  }
  el('salaryActual').onclick=()=>switchBase('actual');
  el('salaryPlan').onclick=()=>switchBase('plan');
  paintMode();
  if(localStorage.getItem(MODE_KEY)==='plan')switchBase('plan');
})();
