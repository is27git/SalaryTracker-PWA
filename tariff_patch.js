(() => {
  try {
    if (typeof app === 'undefined') return;
    const near = (a,b) => Math.abs(Number(a || 0)-b) < 0.001;
    if (typeof ensurePresets === 'function') ensurePresets();

    app.presets = app.presets || {};
    app.presets.gradeRates = app.presets.gradeRates || {};
    app.presets.servicePcts = app.presets.servicePcts || {};

    if (typeof defaults !== 'undefined') defaults.hourlyRate = 111.68;
    if (app.presets.gradeRates['4'] === undefined || near(app.presets.gradeRates['4'],116)) app.presets.gradeRates['4'] = 111.68;
    const g5 = Number(app.presets.gradeRates['5'] || 0);
    if (near(g5,116) || near(g5,133.7)) delete app.presets.gradeRates['5'];
    if (app.presets.gradeRates['6'] === undefined || near(app.presets.gradeRates['6'],133.7)) app.presets.gradeRates['6'] = 133.7;

    Object.keys(app.presets.servicePcts).forEach(k => {
      const v = Number(app.presets.servicePcts[k] || 0);
      if (v > 0 && v <= 1) app.presets.servicePcts[k] = Math.round(v * 10000) / 100;
    });
    app.presets.servicePcts['4'] = 40;

    Object.entries(app.months || {}).forEach(([key,m]) => {
      const p = m && m.params;
      if (!p) return;
      if (String(p.grade || '4') === '4' && near(p.hourlyRate,116)) p.hourlyRate = 111.68;
      if (String(p.grade) === '5' && near(p.hourlyRate,133.7)) {
        p.grade = '6';
        p.hourlyRate = 133.7;
      }
      let pct = Number(p.btkPct || 0);
      if (pct > 0 && pct <= 1) {
        pct = Math.round(pct * 10000) / 100;
        p.btkPct = pct;
      }
      if (key >= '2026-10' && Math.floor(Number(p.serviceYears || 0)) === 4 && near(p.btkPct,35)) p.btkPct = 40;
    });

    if (typeof renderPrint === 'function' && !window.__salaryPrintPwaV43) {
      window.__salaryPrintPwaV43 = true;
      const prevRenderPrint = renderPrint;
      renderPrint = function(params, entries, effective, r) {
        prevRenderPrint(params, entries, effective, r);
        const tables = document.querySelectorAll('#printReport table');
        const tbody = tables.length ? tables[tables.length - 1].querySelector('tbody') : null;
        if (!tbody) return;
        const totalRow = Array.from(tbody.querySelectorAll('tr')).find(tr => (tr.cells[0]?.textContent || '').includes('Итого начислено'));
        if (!totalRow) return;
        const moneyFn = typeof money === 'function' ? money : (v => Number(v || 0).toFixed(2) + ' ₽');
        const addRow = (label, value) => {
          if (Math.abs(Number(value || 0)) < 0.005) return;
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${label}</td><td class="right">${moneyFn(value)}</td>`;
          totalRow.before(tr);
        };
        addRow('Общецеховая премия', r.shopPremium);
        addRow('Праздничные / прочее', effective.holidayBonus);
      };
    }

    const presetNote = Array.from(document.querySelectorAll('.note')).find(n => n.textContent.includes('Пресеты:'));
    if (presetNote) presetNote.innerHTML = '<b>Пресеты:</b> 4-й разряд = <b>111,68 ₽/ч</b>, 6-й = <b>133,7 ₽/ч</b>, 5-й пока не подтверждён. Для стажа 4 года — <b>40%</b>. Старые 0,35/0,40 автоматически переводятся в 35%/40%.';

    const footer = document.querySelector('.footer');
    if (footer) footer.textContent = 'PWA 4.3 · 4-й 111,68 ₽/ч · 5-й — не подтверждён · 6-й 133,7 ₽/ч · БТК 35/40% · сверка по расчётке · журнал · PDF.';

    if (typeof saveApp === 'function') saveApp();
    if (typeof updatePresetHints === 'function') updatePresetHints();
    if (typeof writeParams === 'function' && typeof ensureMonth === 'function' && typeof currentMonth !== 'undefined') {
      writeParams(ensureMonth(currentMonth).params);
    }
    if (typeof render === 'function') render();
  } catch (e) {
    console.error('PWA v4.3 migration', e);
  }
})();
