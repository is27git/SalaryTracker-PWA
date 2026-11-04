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
  if(footer)footer.textContent='PWA 5.3 · штатная ночь 7,5 ч · выходные: ночные по факту до 8 ч · авто-коррекция по отгулам · архив месяцев · PDF.';

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
  panel.innerHTML = `<h2>График смен</h2><b id="scMonth"></b><div id="scGrid"></div><small>Д — дневная · Н — ночная</small><br>
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
    <h3 id="scQuickTitle"></h3><label>Вид записи<select id="scQuickType"></select></label>
    <div style="display:flex;gap:12px"><label>С какого времени<input type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="2000 → 20:00" id="scFrom" required></label>
    <label>До какого времени<input type="text" inputmode="numeric" maxlength="5" autocomplete="off" placeholder="2200 → 22:00" id="scTo" required></label></div>
    <output id="scCredit" aria-live="polite"></output><button class="primary" type="submit">Записать в журнал</button>
    <button type="button" id="scConfigure">Расставить смены</button><button type="button" id="scCancel">Отмена</button>
    </form>`;
  panel.append(quick);
  const categories = {weekend:'Выходной — за оплату',compEarn:'Выходной — за отгул',
    overtime:'Сверхурочные — за оплату',overtimeComp:typeLabels[extraBank]};
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
    const assigned = types(ensureMonth(currentMonth),date);
    el('scQuickTitle').textContent = 'Запись на '+date.split('-').reverse().join('.');
    const options = el('scQuickType');
    options.replaceChildren();
    for (const key of assigned.length ? ['overtime',extraBank] : ['weekend','compEarn','overtime',extraBank]) options.add(new Option(categories[key],key));
    el('scFrom').value = assigned.length ? kinds[assigned[assigned.length-1]][2].split('–')[1] : '';
    el('scTo').value = '';
    previewWork();quick.showModal();
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
    const entries=ensureMonth(currentMonth).entries;
    entries.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),
      date:selected,type:el('scQuickType').value,start:el('scFrom').value,end:el('scTo').value,
      actualHours:actual,paidHours:credit,comment:'',createdAt:new Date().toISOString()});
    entries.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
    saveApp();quick.close();render();
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
        lines.push(['sc-hours', qty(kinds[key][3])+' '+{day:'Д',night:'Н',short:'Д'}[key]]);
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
    originalRender();draw();
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
