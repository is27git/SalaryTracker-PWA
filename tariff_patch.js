(() => {
  try {
    if (typeof app === 'undefined') return;
    if (typeof ensurePresets === 'function') ensurePresets();

    app.presets = app.presets || {};
    app.presets.gradeRates = app.presets.gradeRates || {};

    const old = Number(app.presets.gradeRates['5']);
    if (app.presets.gradeRates['5'] === undefined || Math.abs(old - 116) < 0.001) {
      app.presets.gradeRates['5'] = 133.7;
    }

    Object.values(app.months || {}).forEach(m => {
      const p = m && m.params;
      if (!p) return;
      if (String(p.grade) === '5' && Math.abs(Number(p.hourlyRate) - 116) < 0.001) {
        p.hourlyRate = 133.7;
      }
    });

    document.querySelectorAll('.note').forEach(n => {
      if (n.innerHTML.includes('5-й разряд = <b>116 ₽/ч</b>')) {
        n.innerHTML = n.innerHTML.replace('5-й разряд = <b>116 ₽/ч</b>', '5-й разряд = <b>133,7 ₽/ч</b>');
      }
    });

    const footer = document.querySelector('.footer');
    if (footer) footer.textContent = footer.textContent.replace('5-й разряд 116 ₽/ч', '5-й разряд 133,7 ₽/ч');

    if (typeof saveApp === 'function') saveApp();
    if (typeof updatePresetHints === 'function') updatePresetHints();
    if (typeof writeParams === 'function' && typeof ensureMonth === 'function' && typeof currentMonth !== 'undefined') {
      writeParams(ensureMonth(currentMonth).params);
    }
    if (typeof render === 'function') render();
  } catch (e) {
    console.error('5th grade tariff migration', e);
  }
})();
