(() => {
  try {
    if (typeof app === 'undefined') return;
    if (typeof ensurePresets === 'function') ensurePresets();

    app.presets = app.presets || {};
    app.presets.gradeRates = app.presets.gradeRates || {};

    const g5 = Number(app.presets.gradeRates['5']);
    if (Math.abs(g5 - 116) < 0.001 || Math.abs(g5 - 133.7) < 0.001) {
      delete app.presets.gradeRates['5'];
    }
    if (app.presets.gradeRates['6'] === undefined || Math.abs(Number(app.presets.gradeRates['6']) - 133.7) < 0.001) {
      app.presets.gradeRates['6'] = 133.7;
    }

    Object.values(app.months || {}).forEach(m => {
      const p = m && m.params;
      if (!p) return;
      if (String(p.grade) === '5' && Math.abs(Number(p.hourlyRate) - 133.7) < 0.001) {
        p.grade = '6';
        p.hourlyRate = 133.7;
      }
    });

    const footer = document.querySelector('.footer');
    if (footer) footer.textContent = 'Версия 3.9 · 4-й разряд 111,68 ₽/ч · 5-й разряд — ставка не подтверждена · 6-й разряд 133,7 ₽/ч · ставка по месяцу · сверка по расчётке · журнал · банк отгулов · PDF.';

    if (typeof saveApp === 'function') saveApp();
    if (typeof updatePresetHints === 'function') updatePresetHints();
    if (typeof writeParams === 'function' && typeof ensureMonth === 'function' && typeof currentMonth !== 'undefined') {
      writeParams(ensureMonth(currentMonth).params);
    }
    if (typeof render === 'function') render();
  } catch (e) {
    console.error('6th grade tariff migration', e);
  }
})();
