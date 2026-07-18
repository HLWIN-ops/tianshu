/**
 * 八字排盘 综合版 - 交互与渲染
 * 依赖：Bazi（engine.js）、Bazi.plus（engine-plus.js）、Bazi.interpret（interpret.js）、Bazi.figures（figures.js）
 */
(function () {
  'use strict';

  const core = typeof Bazi !== 'undefined' ? Bazi : null;
  const missing = !core ? 'engine.js' : [
    ['constants', 'engine.js'], ['plus', 'engine-plus.js'], ['product', 'product.js'],
  ].filter(item => !core[item[0]]).map(item => item[1]).join('、');

  if (!core || missing) {
    const report = () => showBootError(`缺少必要组件：${missing || 'engine.js'}。请检查静态文件是否完整发布。`);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', report, { once: true });
    else report();
    return;
  }

  const P = core.plus;
  const I = core.interpret;
  const F = core.figures;
  const T = core.product;
  const K = core.constants;
  let current = null; // fullChart 结果
  let currentFormInput = null;
  let currentAccuracy = null;
  let currentInsights = null;
  let funCategory = ''; // 趣味页分类过滤
  let lastFunResult = null; // 最近一次趣味匹配结果（供海报使用）
  let toastTimer = null;
  let recentProfile = null;
  let lastModalFocus = null;
  let pendingShareText = '';
  const REFLECTION_KEY = 'tianshu.reflections.v1';
  const REFLECTION_LIMIT = 60;

  // 十二时辰：value = 地支序(0子..11亥)，对应真太阳时小时起点见引擎 hourZhiFromMinutes
  const SHICHEN = [
    { idx: 0, name: '子时', range: '23:00 – 00:59', label: '夜半' },
    { idx: 1, name: '丑时', range: '01:00 – 02:59', label: '鸡鸣' },
    { idx: 2, name: '寅时', range: '03:00 – 04:59', label: '平旦' },
    { idx: 3, name: '卯时', range: '05:00 – 06:59', label: '日出' },
    { idx: 4, name: '辰时', range: '07:00 – 08:59', label: '食时' },
    { idx: 5, name: '巳时', range: '09:00 – 10:59', label: '隅中' },
    { idx: 6, name: '午时', range: '11:00 – 12:59', label: '日中' },
    { idx: 7, name: '未时', range: '13:00 – 14:59', label: '日昳' },
    { idx: 8, name: '申时', range: '15:00 – 16:59', label: '晡时' },
    { idx: 9, name: '酉时', range: '17:00 – 18:59', label: '日入' },
    { idx: 10, name: '戌时', range: '19:00 – 20:59', label: '黄昏' },
    { idx: 11, name: '亥时', range: '21:00 – 22:59', label: '人定' },
  ];
  // 由 23:00 起算的时辰序号 -> 该时辰代表的"真太阳时整数小时段"（取中段）
  function shiToHour(idx) {
    // 子时(0)覆盖 23,0；其余 idx 代表 [2*idx-1, 2*idx] 点
    if (idx === 0) return 23; // 用 23 点作为代表（真太阳时<23 仍可能归子）
    return 2 * idx - 1;
  }
  function shiToMinute() { return 30; }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    try {
      initIntro();
      buildShiOptions();
      buildProductOptions();
      initTabs();
      initForm();
      initPoster();
      initSharePreview();
      initResultActions();
      initArchive();
      updateResultAccess(false);
      renderRecentProfile();
      document.documentElement.dataset.appReady = 'true';
    } catch (error) {
      console.error(error);
      showBootError(`初始化失败：${error && error.message ? error.message : '未知错误'}`);
    }
  }

  function showBootError(message) {
    const reveal = () => {
      const intro = document.getElementById('intro');
      if (intro) intro.classList.add('is-gone');
      const panel = document.getElementById('boot-error');
      if (!panel) return;
      const detail = document.getElementById('boot-error-message');
      if (detail) detail.textContent = message;
      panel.hidden = false;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal, { once: true });
    else reveal();
  }

  /* ===== 进场太极八卦 ===== */
  function initIntro() {
    const el = document.getElementById('intro');
    if (!el) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preview = new URLSearchParams(window.location.search).get('intro') === '1';
    let seen = false;
    try { seen = localStorage.getItem('tianshu.intro.seen') === '1'; } catch (_) {}
    // 普通访问直接进入核心任务；品牌开屏仅作为显式预览，不再拦住首次排盘。
    if (!preview || seen || reduced) {
      el.classList.add('is-gone');
      el.setAttribute('aria-hidden', 'true');
      return;
    }
    el.classList.remove('is-gone');
    el.removeAttribute('aria-hidden');
    const skipBtn = document.getElementById('intro-skip');
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      el.classList.add('is-out');
      setTimeout(() => {
        el.classList.add('is-gone');
        el.setAttribute('aria-hidden', 'true');
      }, 450);
      try { localStorage.setItem('tianshu.intro.seen', '1'); } catch (_) {}
    };
    skipBtn && skipBtn.addEventListener('click', hide);
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('.intro-inner')) {
        // 点画面也可进入（除了要等动画时）
        if (e.target === skipBtn) return;
        if (el.classList.contains('is-ready')) hide();
      }
    });
    // 按钮立即可用；若用户未操作，开屏也会自动退出。
    requestAnimationFrame(() => el.classList.add('is-ready'));
    setTimeout(hide, 4000);
  }

  function buildShiOptions() {
    const sel = document.getElementById('f-shi');
    sel.innerHTML = SHICHEN.map(s =>
      `<option value="${s.idx}">${s.name} · ${s.label}（${s.range}）</option>`).join('');
    sel.value = '6';
    updateShiHint();
    sel.addEventListener('change', updateShiHint);
  }
  function updateShiHint() {
    const s = SHICHEN[+document.getElementById('f-shi').value];
    document.getElementById('shi-range').textContent = `${s.name}（${s.range}）`;
    document.getElementById('shi-solar').textContent = ` · 约 ${pad(shiToHour(s.idx))}:${pad(shiToMinute())}`;
  }

  function buildProductOptions() {
    const focus = document.getElementById('f-focus');
    focus.innerHTML = T.FOCUS.map(item => `<option value=${item.key}>${item.label}</option>`).join('');
    const city = document.getElementById('f-city');
    // 按省份分组：直辖市/港澳台归入「中国」，其余按 region 归组，组内只显城市名。
    const groups = [];
    const groupMap = new Map();
    T.CITIES.forEach(item => {
      const key = item.region || '其他';
      if (!groupMap.has(key)) { groupMap.set(key, []); groups.push(key); }
      groupMap.get(key).push(item);
    });
    const order = ['中国', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆', '内蒙古', '广西', '台湾', '其他'];
    const sorted = groups.slice().sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    city.insertAdjacentHTML('beforeend', sorted.map(region => {
      const opts = groupMap.get(region).map(item =>
        `<option value=${item.id}>${item.name}</option>`).join('');
      return `<optgroup label=${region}>${opts}</optgroup>`;
    }).join(''));
  }

  /* ===== 导航 ===== */
  function initTabs() {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    tabs.forEach((button, index) => {
      button.id = `tab-${button.dataset.page}`;
      button.tabIndex = index === 0 ? 0 : -1;
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
      }
      button.addEventListener('click', () => go(button.dataset.page));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const enabled = tabs.filter(tab => !tab.disabled);
        const currentIndex = enabled.indexOf(button);
        let next = currentIndex;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = enabled.length - 1;
        else if (event.key === 'ArrowRight') next = (currentIndex + 1) % enabled.length;
        else next = (currentIndex - 1 + enabled.length) % enabled.length;
        enabled[next].focus();
        go(enabled[next].dataset.page, { focusTab: true });
      });
    });
    document.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => go(b.dataset.goto)));
  }
  function updateResultAccess(ready) {
    ['paipan', 'dayun', 'read', 'fun'].forEach(page => {
      const tab = document.querySelector(`.tab[data-page="${page}"]`);
      if (!tab) return;
      const moduleReady = !((page === 'dayun' || page === 'read') && !I) && !(page === 'fun' && !F);
      const locked = !ready || !moduleReady;
      tab.disabled = false;
      tab.classList.toggle('locked', locked);
      tab.setAttribute('aria-disabled', 'false');
      tab.setAttribute('aria-label', locked ? `${tab.textContent}，生成报告后可查看` : tab.textContent);
      tab.title = !ready ? '先生成报告即可查看' : (!moduleReady ? '该静态组件未成功加载' : '');
    });
    document.querySelectorAll('[data-goto="dayun"], [data-goto="read"], [data-goto="fun"]').forEach(button => {
      const page = button.dataset.goto;
      const moduleReady = !((page === 'dayun' || page === 'read') && !I) && !(page === 'fun' && !F);
      button.disabled = !moduleReady;
      button.setAttribute('aria-disabled', String(!moduleReady));
    });
  }
  function go(page, options = {}) {
    if ((page === 'paipan' || page === 'dayun' || page === 'read' || page === 'fun') && !current) {
      toast('完成排盘后即可查看');
      go('input');
      const first = document.getElementById('f-year');
      if (first) first.focus();
      return;
    }
    if (((page === 'dayun' || page === 'read') && !I) || (page === 'fun' && !F)) {
      toast('该模块未成功加载，核心命盘仍可继续使用');
      return;
    }
    document.querySelectorAll('.tab').forEach(t => {
      const active = t.dataset.page === page;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (!target) return;
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
    if (page === 'paipan') renderPaipan(current);
    if (page === 'dayun') renderDayun(current);
    if (page === 'read') renderRead(current);
    if (page === 'archive') renderProfiles();
    if (page === 'fun') renderFun(current);
  }

  /* ===== 录入 ===== */
  function initForm() {
    // 历法切换
    document.getElementById('cal-lunar').addEventListener('change', () => showLeap(true));
    document.getElementById('cal-solar').addEventListener('change', () => showLeap(false));

    document.getElementById('btn-now').addEventListener('click', fillNow);
    document.getElementById('btn-example').addEventListener('click', fillExample);
    document.querySelectorAll('input[name=timePrecision]').forEach(input =>
      input.addEventListener('change', updateTimeMode));
    document.getElementById('f-time').addEventListener('change', updateExactTimeHint);
    document.getElementById('f-city').addEventListener('change', applyCity);
    document.getElementById('f-lon').addEventListener('input', markCityCustom);
    document.querySelectorAll('#form input, #form select').forEach(control => {
      control.addEventListener('input', () => clearFieldError(control));
      control.addEventListener('change', () => clearFieldError(control));
    });

    document.getElementById('form').addEventListener('submit', e => {
      e.preventDefault();
      doPai();
    });
    updateTimeMode();
  }

  function updateTimeMode() {
    const exact = document.querySelector('input[name=timePrecision]:checked').value === 'exact';
    document.getElementById('row-exact-time').hidden = !exact;
    document.getElementById('row-shichen').hidden = exact;
    if (exact) updateExactTimeHint();
  }

  function updateExactTimeHint() {
    const parsed = T.parseTime(document.getElementById('f-time').value);
    const hint = document.getElementById('time-hint');
    hint.textContent = parsed
      ? `钟表时间 ${T.formatClock(parsed.hour, parsed.minute)} · 属${SHICHEN[T.zhiIndexFromMinutes(parsed.hour * 60 + parsed.minute)].name}`
      : '请输入出生证明或家人记录中的钟表时间。';
  }

  function applyCity() {
    const city = T.CITIES.find(item => item.id === document.getElementById('f-city').value);
    if (!city) {
      document.getElementById('city-note').textContent = '未确认地点时按当前经度计算；可在高级设置中手动输入。';
      return;
    }
    document.getElementById('f-lon').value = city.longitude;
    document.getElementById('f-tz').value = city.tz;
    document.getElementById('city-note').textContent = `${city.region} · ${city.name}，经度 ${city.longitude}°，UTC${city.tz >= 0 ? '+' : ''}${city.tz}`;
  }

  function markCityCustom() {
    const cityEl = document.getElementById('f-city');
    const selected = T.CITIES.find(item => item.id === cityEl.value);
    if (selected && Math.abs(Number(document.getElementById('f-lon').value) - selected.longitude) > 0.001) {
      cityEl.value = '';
      document.getElementById('city-note').textContent = '已使用手动经度，请同时确认时区。';
    }
  }
  function showLeap(on) {
    document.getElementById('row-leap').hidden = !on;
    const isLunar = document.getElementById('cal-lunar').checked;
    document.getElementById('lbl-year').textContent = isLunar ? '农历年' : '出生年';
    document.getElementById('lbl-month').textContent = isLunar ? '农历月' : '出生月';
    document.getElementById('lbl-day').textContent = isLunar ? '农历日' : '出生日';
  }
  function fillNow() {
    const n = new Date();
    document.getElementById('cal-solar').checked = true;
    showLeap(false);
    document.getElementById('f-year').value = n.getFullYear();
    document.getElementById('f-month').value = n.getMonth() + 1;
    document.getElementById('f-day').value = n.getDate();
    document.querySelector('input[name=timePrecision][value=exact]').checked = true;
    document.getElementById('f-time').value = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    const h = n.getHours();
    const idx = h === 23 ? 0 : Math.min(11, Math.floor((h + 1) / 2));
    document.getElementById('f-shi').value = String(idx);
    updateShiHint();
    updateTimeMode();
  }

  function fillExample() {
    document.getElementById('cal-solar').checked = true;
    showLeap(false);
    document.getElementById('f-year').value = 1990;
    document.getElementById('f-month').value = 6;
    document.getElementById('f-day').value = 15;
    document.querySelector('input[name=timePrecision][value=exact]').checked = true;
    document.getElementById('f-time').value = '15:30';
    document.getElementById('f-city').value = 'beijing';
    applyCity();
    updateTimeMode();
    showStatus('已载入示例，可直接排盘或修改。', 'ok');
  }

  function doPai() {
    clearFieldErrors();
    const name = document.getElementById('f-name').value.trim();
    const gender = document.querySelector('input[name=gender]:checked').value;
    const isLunar = document.getElementById('cal-lunar').checked;
    const isLeap = document.getElementById('f-leap').checked;
    let year = parseInt(document.getElementById('f-year').value, 10);
    let month = parseInt(document.getElementById('f-month').value, 10);
    let day = parseInt(document.getElementById('f-day').value, 10);
    const shiIdx = +document.getElementById('f-shi').value;
    const timePrecision = document.querySelector('input[name=timePrecision]:checked').value;
    const exactTime = T.parseTime(document.getElementById('f-time').value);
    let hour = timePrecision === 'exact' && exactTime ? exactTime.hour : shiToHour(shiIdx);
    let minute = timePrecision === 'exact' && exactTime ? exactTime.minute : shiToMinute();
    const longitude = parseFloat(document.getElementById('f-lon').value);
    const tz = parseFloat(document.getElementById('f-tz').value);
    const useTrueSolar = document.getElementById('f-tst').checked;
    const ziDayRule = (document.querySelector('input[name=ziRule]:checked') || {}).value || 'next';
    const cityId = document.getElementById('f-city').value;
    const city = T.CITIES.find(item => item.id === cityId);
    const focus = document.getElementById('f-focus').value;

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      const target = !Number.isInteger(year) ? 'f-year' : (!Number.isInteger(month) ? 'f-month' : 'f-day');
      fieldError(target, '请填写完整的出生年月日。'); return false;
    }
    if (!isLunar && !T.isValidSolarDate(year, month, day)) {
      fieldError('f-day', '这个公历日期不存在，请检查年月日。'); return false;
    }
    if (timePrecision === 'exact' && !exactTime) {
      fieldError('f-time', '请选择准确的出生时间。'); return false;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(tz) || tz < -12 || tz > 14) {
      const target = !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ? 'f-lon' : 'f-tz';
      const advanced = document.getElementById(target).closest('details');
      if (advanced) advanced.open = true;
      fieldError(target, '请检查经度和时区设置。'); return false;
    }

    currentFormInput = {
      name, gender, calendar: isLunar ? 'lunar' : 'solar', year, month, day,
      lunarLeap: isLeap, hour, minute, timePrecision, shiIdx,
      longitude, tz, useTrueSolar, ziDayRule, cityId, cityName: city ? city.name : '', focus,
    };

    let lunarLabel = '';
    if (isLunar) {
      const solar = P.lunarToSolar(year, month, day, isLeap);
      if (!solar) { fieldError('f-day', '该农历日期不存在，可能无此闰月或超出支持范围。'); return false; }
      lunarLabel = `农历 ${year}年${isLeap ? '闰' : ''}${month}月${day}日`;
      year = solar.y; month = solar.m; day = solar.d;
    }
    const today = new Date();
    if (Date.UTC(year, month - 1, day) > Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) {
      fieldError('f-year', '出生日期不能晚于今天。'); return false;
    }

    try {
      current = P.fullChart({
        year, month, day, hour, minute, gender,
        longitude, tz, useTrueSolar, ziDayRule, name, lunarLabel,
      });
      current.lunar = P.solarToLunar(year, month, day);
      current.input.name = name;
      current.input.lunarLabel = lunarLabel;
      const actualShiIdx = T.zhiIndexFromMinutes(current.solarInfo ? current.solarInfo.totalMin : hour * 60 + minute);
      current.input.shiName = SHICHEN[actualShiIdx].name;
      current.input.clockLabel = T.formatClock(hour, minute);
      current.input.ziDayRule = ziDayRule;
      current._formInput = currentFormInput;
      currentAccuracy = T.buildAccuracy(current, { timePrecision, cityConfirmed: Boolean(cityId), useTrueSolar });
      currentInsights = T.buildInsights(current, focus);
      updateResultAccess(true);
      showStatus('排盘完成。', 'ok');
      go('paipan');
      return true;
    } catch (e) {
      showStatus('排盘出错：' + e.message, 'error');
      console.error(e);
      return false;
    }
  }

  function clearFieldError(control) {
    if (!control) return;
    control.removeAttribute('aria-invalid');
    const field = control.closest('.field');
    if (!field) return;
    field.classList.remove('has-error');
    const message = field.querySelector('.field-error');
    if (message) {
      if (control.getAttribute('aria-describedby') === message.id) control.removeAttribute('aria-describedby');
      message.remove();
    }
  }

  function clearFieldErrors() {
    document.querySelectorAll('#form [aria-invalid="true"]').forEach(clearFieldError);
  }

  function fieldError(id, message) {
    const control = document.getElementById(id);
    showStatus(message, 'error');
    if (!control) return;
    const field = control.closest('.field');
    control.setAttribute('aria-invalid', 'true');
    if (field) {
      field.classList.add('has-error');
      const error = document.createElement('p');
      error.className = 'field-error';
      error.id = `${id}-error`;
      error.textContent = message;
      field.appendChild(error);
      control.setAttribute('aria-describedby', error.id);
    }
    control.focus();
  }

  function showStatus(message, type) {
    const el = document.getElementById('form-status');
    if (!el) return;
    el.textContent = message;
    el.className = `form-status ${type || ''}`;
  }

  /* ===== 命盘渲染 ===== */
  function renderPaipan(r) {
    const genderText = r.input.gender === 'male' ? '男命 · 乾造' : '女命 · 坤造';
    const nameText = T.escapeHtml(r.input.name || '未署名');
    const lunar = r.lunar;
    const lunarStr = lunar ? `农历 ${lunar.yearGanZhi}年${lunar.isLeap ? '闰' : ''}${lunar.month}月${lunar.day}日 · 属${lunar.animal}` : '';
    renderInsightOverview(r);
    renderAccuracy(r);
    renderReflection();
    document.getElementById('idcard').innerHTML =
      `<span class="id-name">${nameText}</span>` +
      `<span class="id-tag">${genderText}</span>` +
      `<span class="id-solar">公历 ${r.input.year}年${r.input.month}月${r.input.day}日 ${r.input.clockLabel || ''} · ${r.input.shiName}</span>` +
      (lunarStr ? `<span class="id-tag sub">${lunarStr}</span>` : '') +
      `<span class="id-day">日主 ${r.dayMaster.gan}<i>${r.dayMaster.wuxing}</i>${r.dayMaster.yinyang}</span>`;

    // 四柱表：每列 = 一列（天干/藏干/十神/纳音）
    const colDefs = [
      { key: 'year', title: '年柱', sub: '祖上 · 少年' },
      { key: 'month', title: '月柱', sub: '父母 · 青年' },
      { key: 'day', title: '日柱', sub: '自身 · 配偶' },
      { key: 'hour', title: '时柱', sub: '子女 · 晚年' },
    ];
    const kw = r.kongwang.zhi;
    let html = '';
    // 表头
    html += `<div class="bt-col bt-head">四柱</div>`;
    colDefs.forEach(c => {
      html += `<div class="bt-col bt-head">
        <span class="h-main">${c.title}</span><span class="h-sub">${c.sub}</span>
      </div>`;
    });
    // 天干
    html += `<div class="bt-col bt-rowlabel">天干</div>`;
    colDefs.forEach(c => {
      const p = r.pillars[c.key];
      html += `<div class="bt-col">
        <span class="bt-gan wx-${p.ganWuxing}">${p.ganName}</span>
        <span class="bt-ten ${c.key === 'day' ? 'day-master' : ''}">${p.ganTenGod}</span>
      </div>`;
    });
    // 地支
    html += `<div class="bt-col bt-rowlabel">地支</div>`;
    colDefs.forEach(c => {
      const p = r.pillars[c.key];
      const isKong = kw.includes(p.zhiName);
      html += `<div class="bt-col">
        <span class="bt-zhi wx-${p.zhiWuxing}">${p.zhiName}</span>
        ${isKong ? '<span class="bt-kong">空亡</span>' : ''}
      </div>`;
    });
    // 藏干
    html += `<div class="bt-col bt-rowlabel">藏干</div>`;
    colDefs.forEach(c => {
      const p = r.pillars[c.key];
      html += `<div class="bt-col bt-cang">` +
        p.canggan.map(g => `<span>${g.gan}<i>${g.tenGod}</i></span>`).join('') +
        `</div>`;
    });
    // 纳音
    html += `<div class="bt-col bt-rowlabel">纳音</div>`;
    colDefs.forEach(c => {
      html += `<div class="bt-col bt-nayin">${r.pillars[c.key].nayin}</div>`;
    });
    // 喜忌（该柱干支五行相对喜用/忌神）
    const xi = r.useGod.xi, ji = r.useGod.ji;
    html += `<div class="bt-col bt-rowlabel">喜忌</div>`;
    colDefs.forEach(c => {
      const p = r.pillars[c.key];
      const isXi = xi.includes(p.ganWuxing) || xi.includes(p.zhiWuxing);
      const isJi = ji.includes(p.ganWuxing) || ji.includes(p.zhiWuxing);
      const t = isXi ? '<span class="pillar-tag xi">喜</span>'
        : (isJi ? '<span class="pillar-tag ji">忌</span>' : '<span class="pillar-tag neu">平</span>');
      html += `<div class="bt-col bt-favor">${t}</div>`;
    });
    document.getElementById('bazi-table').innerHTML = html;
    document.getElementById('mobile-pillar-grid').innerHTML = colDefs.map(c => {
      const p = r.pillars[c.key];
      return `<article class="mobile-pillar-card">
        <header><span>${c.title}</span><small>${c.sub}</small></header>
        <div class="mobile-pillar-gz"><b class="wx-${p.ganWuxing}">${p.ganName}</b><b class="wx-${p.zhiWuxing}">${p.zhiName}</b></div>
        <p>${c.key === 'day' ? '日主' : p.ganTenGod} · ${p.nayin}</p>
        <details><summary>藏干与十神</summary><div>${p.canggan.map(g => `<span>${g.gan} ${g.tenGod}</span>`).join('')}</div></details>
      </article>`;
    }).join('');

    // 真太阳时
    const sn = document.getElementById('solar-note');
    if (r.input.useTrueSolar && r.solarInfo) {
      const s = r.solarInfo;
      sn.innerHTML = `<span>真太阳时校正</span>` +
        `<span>经度差 <b>${s.lonDiff.toFixed(1)}</b> 分</span>` +
        `<span>均时差 <b>${s.eot.toFixed(1)}</b> 分</span>` +
        `<span>校正后约 <b>${pad(s.adjHour)}:${pad(s.adjMin)}</b>${s.dayShift ? `（跨日 ${s.dayShift > 0 ? '+' : ''}${s.dayShift}）` : ''}</span>` +
        `<span>当月节气 <b>${r.jieInfo.current ? r.jieInfo.current.name : ''}</b></span>` +
        `<span>子时 <b>${r.input.ziDayRule === 'same' ? '属当日' : '晚子归次日'}</b></span>`;
    } else {
      sn.innerHTML = `<span>未启用真太阳时</span>` +
        `<span>当月节气 <b>${r.jieInfo.current ? r.jieInfo.current.name : ''}</b></span>` +
        `<span>子时 <b>${r.input.ziDayRule === 'same' ? '属当日' : '晚子归次日'}</b></span>`;
    }

    document.getElementById('shensha-list').innerHTML = I.renderShenShaInline(r);
    document.getElementById('kongwang-list').innerHTML =
      kw.map(z => `<span class="kw">${z}</span>`).join('') +
      (r.kongwang.fallen.length ? `<p class="tri-fall">${r.kongwang.fallen.join('、')}</p>` : '');
    document.getElementById('relations-list').innerHTML = I.relationsText(r.relations);

    renderWuxing(r);
  }

  function renderWuxing(r) {
    const w = r.wuxingWeighted;
    const order = ['木', '火', '土', '金', '水'];
    const max = Math.max(...order.map(o => w[o]), 0.01);
    const total = order.reduce((s, o) => s + w[o], 0) || 1;
    document.getElementById('wx-bars').innerHTML = order.map(o => {
      const pct = (w[o] / max * 100);
      const ratio = (w[o] / total * 100).toFixed(0);
      return `<div class="wx-bar">
        <span class="wx-name wx-${o}">${o}</span>
        <span class="wx-track"><span class="wx-fill wx-${o}" style="width:${pct}%"></span></span>
        <span class="wx-val">${w[o].toFixed(1)}<i>${ratio}%</i></span>
      </div>`;
    }).join('');
    const st = r.strength;
    document.getElementById('wx-note').innerHTML =
      `日主 <b>${r.dayMaster.gan}${r.dayMaster.wuxing}</b> 生于 <b>${r.pillars.month.zhiName}</b>月（月令${st.state}），综合判定 <b>${st.level}</b>。`;
  }

  function renderInsightOverview(r) {
    currentInsights = currentInsights || T.buildInsights(r, currentFormInput && currentFormInput.focus);
    const view = currentInsights;
    const run = view.run
      ? `${view.run.name}大运 · ${view.run.startDate} 起`
      : '当前处于起运前阶段';
    const pillarNames = ['year', 'month', 'day', 'hour'].map(key => r.pillars[key].name);
    document.getElementById('insight-overview').innerHTML = `
      <div class="focus-switch" role="group" aria-label="切换关注主题">
        <span>这次先看</span>
        <div>${T.FOCUS.map(item => `<button type="button" data-result-focus="${item.key}" class="${item.key === view.focus ? 'active' : ''}" aria-pressed="${item.key === view.focus}">${item.label.replace('成长', '').replace('规划', '').replace('经营', '').replace('状态', '')}</button>`).join('')}</div>
      </div>
      <div class="signal-grid">
        <div class="signal-copy">
          <span class="insight-kicker">你的本命底色</span>
          <h2>${view.archetype}</h2>
          <p>${view.headline}</p>
          <details class="signal-basis">
            <summary>为什么这样判断</summary>
            <div>${view.evidence.map(item => `<span>${item}</span>`).join('')}</div>
            <small>${view.disclaimer}</small>
          </details>
        </div>
        <div class="chart-signature" aria-label="四柱命盘主视觉">
          <div class="signature-core"><small>核心符号</small><strong class="wx-${r.dayMaster.wuxing}">${r.dayMaster.gan}</strong><span>${r.dayMaster.yinyang}${r.dayMaster.wuxing}日主</span></div>
          <div class="signature-pillars">${pillarNames.map((name, index) => `<span><small>${['年', '月', '日', '时'][index]}</small><b>${name}</b></span>`).join('')}</div>
        </div>
      </div>
      <section class="current-stage">
        <header><span>${view.year ? view.year.year + ' 年主线' : '当前阶段'}</span><em>${run}</em></header>
        <h3>${view.stageHeadline}</h3>
        <p>${view.subhead}</p>
        <dl class="stage-lines">
          <div><dt>更值得投入</dt><dd>${view.opportunity}</dd></div>
          <div><dt>容易卡住</dt><dd>${view.risk}</dd></div>
        </dl>
      </section>`;

    document.querySelectorAll('[data-result-focus]').forEach(button => {
      button.addEventListener('click', () => setResultFocus(button.dataset.resultFocus));
    });
  }

  function setResultFocus(focus) {
    if (!current || !currentFormInput || !T.FOCUS.some(item => item.key === focus)) return;
    currentFormInput.focus = focus;
    const focusControl = document.getElementById('f-focus');
    if (focusControl) focusControl.value = focus;
    currentInsights = T.buildInsights(current, focus);
    renderInsightOverview(current);
    renderReflection();
  }

  function renderAccuracy(r) {
    currentAccuracy = currentAccuracy || T.buildAccuracy(r, {
      timePrecision: currentFormInput && currentFormInput.timePrecision,
      cityConfirmed: Boolean(currentFormInput && currentFormInput.cityId),
      useTrueSolar: r.input.useTrueSolar,
    });
    const a = currentAccuracy;
    const clock = r.input.clockLabel || T.formatClock(r.input.hour, r.input.minute);
    const correction = r.input.useTrueSolar
      ? `钟表时 ${clock} → 真太阳时 ${a.correctedLabel}（${a.correctionMinutes >= 0 ? '+' : ''}${a.correctionMinutes} 分）`
      : `使用钟表时间 ${clock}`;
    document.getElementById('accuracy-strip').innerHTML = `
      <div class="accuracy-head">
        <div><span class="accuracy-dot ${a.gradeClass}"></span><b>柱位稳定度：${a.grade}</b><small>${a.precisionLabel}</small></div>
        <span class="local-badge">本机计算 · v${a.version}</span>
      </div>
      <p>${correction}</p>
      <details class="accuracy-detail">
        <summary>查看时间依据与不确定性</summary>
        <div class="accuracy-grid">
          <span><b>出生地</b>${currentFormInput && currentFormInput.cityName ? currentFormInput.cityName : '未确认'} · ${r.input.longitude}°</span>
          <span><b>时区</b>UTC${r.input.tz >= 0 ? '+' : ''}${r.input.tz}</span>
          <span><b>子时规则</b>${r.input.ziDayRule === 'same' ? '子时属当日' : '晚子时归次日'}</span>
          <span><b>起运</b>${r.dayun.startAge}岁${r.dayun.startMonths ? r.dayun.startMonths + '个月' : ''}</span>
        </div>
        ${a.warnings.length ? `<ul class="accuracy-warnings">${a.warnings.map(w => `<li>${w}</li>`).join('')}</ul>` : '<p class="accuracy-ok">当前未发现明显时辰或节气边界风险。</p>'}
      </details>`;
  }

  /* ===== 大运流年 ===== */
  function renderDayun(r) {
    const dy = r.dayun;
    document.getElementById('dayun-intro').innerHTML =
      `${r.input.gender === 'male' ? '男' : '女'}命 · 大运自月柱 <b>${r.pillars.month.name}</b> ${dy.forward ? '顺' : '逆'}排 · <b>${dy.startAge}</b>岁${dy.startMonths ? dy.startMonths + '个月' : ''}起运 · 约 ${dy.runs[0].startDate}`;
    const xi = r.useGod.xi, ji = r.useGod.ji;
    const dayZhi = r.pillars.day.zhiName;
    const ctx = { dayZhi, relations: P.relations };
    document.getElementById('dayun-timeline').innerHTML = dy.runs.map((d, i) => {
      const isXi = xi.includes(d.ganWuxing) || xi.includes(d.zhiWuxing);
      const isJi = ji.includes(d.ganWuxing) || ji.includes(d.zhiWuxing);
      const tag = isXi ? '<span class="dun-tag xi">喜</span>' : (isJi ? '<span class="dun-tag ji">忌</span>' : '');
      const rd = I.genStageReading(d, r.useGod, ctx);
      // 展开只显示运势要点 + 宜做，不粘贴十神词典（词典在解读附录）
      return `<div class="tl-item">
        <div class="tl-node"></div>
        <div class="tl-card" data-dayun="${i}" role="button" tabindex="0">
          <div class="tl-age">${d.startAge}岁${d.startMonths ? d.startMonths + '个月' : ''}起 · ${d.startDate}</div>
          <div class="tl-gz"><span class="wx-${d.ganWuxing}">${d.ganName}</span><span class="wx-${d.zhiWuxing}">${d.zhiName}</span>${tag}
            <span class="lv-pill ${rd.levelCls}">${rd.level}</span>
          </div>
          <div class="tl-shen">${d.ganTenGod} · ${d.zhiTenGod}</div>
          <div class="tl-detail" hidden>
            <p class="tl-tone">${rd.summary}</p>
            <p><b>宜</b>：${rd.action}${rd.relNote ? ' · ' + rd.relNote : ''}</p>
          </div>
        </div>
      </div>`;
    }).join('');
    // 点击展开/折叠大运详情
    document.querySelectorAll('#dayun-timeline .tl-card').forEach(card => {
      const toggle = () => {
        const det = card.querySelector('.tl-detail');
        det.hidden = !det.hidden;
        card.classList.toggle('open', !det.hidden);
      };
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });

    // 当前所处大运区间（用于流年高亮）
    let curRun = null;
    const now = Date.now();
    dy.runs.forEach((d, index) => {
      const start = new Date(d.startDate + 'T00:00:00').getTime();
      const next = dy.runs[index + 1] ? new Date(dy.runs[index + 1].startDate + 'T00:00:00').getTime() : Infinity;
      if (now >= start && now < next) curRun = d;
    });
    const inCurRun = (y) => curRun && y >= curRun.startYear && y <= curRun.startYear + 9;
    if (curRun) {
      document.getElementById('dayun-intro').innerHTML +=
        `　·　当前行 <b>${curRun.ganName}${curRun.zhiName}</b> 运（${curRun.startDate} 起）`;
    }

    // 流年：点击查看该年详情（短句，不重复主题词典长文）
    document.getElementById('liunian-grid').innerHTML = r.liunian.map((n, i) => {
      const rel = n.relWithDayZhi.length ? `<span class="ln-rel">${n.relWithDayZhi.join('')}日支</span>` : '';
      const focus = I.TEN_GOD_FOCUS ? I.TEN_GOD_FOCUS[n.tenGod] : '';
      const detail = `${n.year}年 <b>${n.name}</b> · ${n.tenGod}${focus ? '（' + focus + '）' : ''}${rel ? '，' + n.relWithDayZhi.join('') + '日支' : ''}。${wxNoteFor(n, r)}`;
      const cls = [n.isCurrent ? 'current' : '', inCurRun(n.year) ? 'in-dayun' : ''].join(' ').trim();
      return `<div class="ln-cell ${cls}" data-liu="${i}" role="button" tabindex="0">
        <span class="ln-year">${n.year}</span>
        <span class="ln-gz"><i class="wx-${K.GAN_WUXING[K.TIANGAN.indexOf(n.gan)]}">${n.gan}</i><i class="wx-${K.ZHI_WUXING[K.DIZHI.indexOf(n.zhi)]}">${n.zhi}</i></span>
        <span class="ln-shen">${n.tenGod}</span>${rel}
        <div class="ln-detail" hidden>${detail}</div>
      </div>`;
    }).join('');
    document.querySelectorAll('#liunian-grid .ln-cell').forEach(cell => {
      const toggle = () => {
        const det = cell.querySelector('.ln-detail');
        det.hidden = !det.hidden;
        cell.classList.toggle('open', !det.hidden);
      };
      cell.addEventListener('click', toggle);
      cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }
  function wxNoteFor(n, r) {
    const xi = r.useGod.xi, ji = r.useGod.ji;
    const wxG = K.GAN_WUXING[K.TIANGAN.indexOf(n.gan)];
    const wxZ = K.ZHI_WUXING[K.DIZHI.indexOf(n.zhi)];
    if (xi.includes(wxG) || xi.includes(wxZ)) return '利喜用，宜把握。';
    if (ji.includes(wxG) || ji.includes(wxZ)) return '多犯忌，宜守成。';
    return '平年，稳扎稳打。';
  }

  /* ===== 解读 ===== */
  function renderRead(r) {
    document.getElementById('read-content').innerHTML = `
      ${I.renderOverviewSection(r)}
      <div class="read-card">
        <h3>格局与喜用</h3>
        <p>${I.genPatternText(r.pattern)}</p>
        <p>${I.genStrengthText(r.strength)}</p>
        ${I.genUseGodText(r.useGod)}
      </div>
      ${I.renderTemperamentSection(r)}
      ${I.renderPillarSection(r)}
      ${I.renderStageSection(r, P)}
      ${I.renderDomainSection(r, P)}
      ${I.renderLiunianSection(r)}
      ${I.renderPracticalSection(r)}
      ${I.renderMeaningSection(r, P)}
      <div class="read-card warn">
        <h3>温馨提示</h3>
        <p>命理为传统文化之一，所示为先天倾向，非定数。后天修身、积善、勤勉皆可改运。本解读由规则推演，仅供参考，切勿迷信。</p>
      </div>`;
    const toolbar = document.getElementById('read-toolbar');
    const cards = Array.from(document.querySelectorAll('#read-content .read-card'));
    const sections = cards.map((card, index) => enhanceReadCard(card, index));
    toolbar.innerHTML = sections.map(section =>
      `<button type="button" data-read-target="${section.id}" aria-controls="${section.id}">${T.escapeHtml(section.title)}</button>`).join('');
    toolbar.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      const card = document.getElementById(button.dataset.readTarget);
      const toggle = card && card.querySelector('.read-card-toggle');
      if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function enhanceReadCard(card, index) {
    const heading = card.querySelector(':scope > h3') || card.querySelector('h3');
    const title = heading ? heading.textContent.trim() : `章节 ${index + 1}`;
    const id = `read-section-${index}`;
    const bodyId = `${id}-body`;
    card.id = id;
    if (!heading) return { id, title };

    const body = document.createElement('div');
    body.className = 'read-card-body';
    body.id = bodyId;
    while (heading.nextSibling) body.appendChild(heading.nextSibling);
    card.appendChild(body);

    const expanded = index < 2;
    body.hidden = !expanded;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'read-card-toggle';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-controls', bodyId);
    toggle.innerHTML = `<span>${T.escapeHtml(title)}</span><small>${expanded ? '收起' : '展开'}</small>`;
    heading.textContent = '';
    heading.appendChild(toggle);
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.querySelector('small').textContent = open ? '展开' : '收起';
      body.hidden = open;
    });
    return { id, title };
  }

  function initResultActions() {
    document.getElementById('btn-save-current').addEventListener('click', saveCurrentProfile);
    document.getElementById('btn-share-summary').addEventListener('click', shareSummary);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-save-reflection').addEventListener('click', saveReflection);
    document.getElementById('btn-clear-reflection').addEventListener('click', clearReflection);
    document.getElementById('reflection-action').addEventListener('input', event => {
      document.getElementById('reflection-action-preview').textContent = event.target.value.trim() || '请写下一件准备验证的事。';
    });
  }

  function reflectionMonth(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function reflectionCycle(date = new Date()) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function savedCurrentProfile() {
    if (!currentFormInput) return null;
    const signature = T.profileSignature(currentFormInput);
    return T.readProfiles(localStorage).find(profile => profile.signature === signature) || null;
  }

  function readReflections() {
    try {
      const parsed = JSON.parse(localStorage.getItem(REFLECTION_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(validReflection).slice(0, REFLECTION_LIMIT) : [];
    } catch (_) { return []; }
  }

  function validReflection(item) {
    if (!item || typeof item.profileId !== 'string' || !/^p_[a-zA-Z0-9_]+$/.test(item.profileId)) return false;
    const legacyIdentity = /^\d{4}-\d{2}$/.test(item.month || '') && item.id === `${item.profileId}|${item.month}`;
    const cycleIdentity = /^\d{4}-\d{2}-\d{2}$/.test(item.cycle || '')
      && item.id === `${item.profileId}|${item.cycle}`
      && Number.isFinite(Date.parse(item.startedAt)) && Number.isFinite(Date.parse(item.dueAt))
      && Date.parse(item.dueAt) > Date.parse(item.startedAt);
    return Boolean(typeof item.id === 'string' && item.id.length <= 120
      && (legacyIdentity || cycleIdentity)
      && typeof item.action === 'string' && item.action.trim().length > 0 && item.action.length <= 160
      && typeof item.evidence === 'string' && item.evidence.length <= 400
      && ['planned', 'doing', 'done', 'adjusted'].includes(item.status)
      && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)));
  }

  function activeReflection(profile, records = readReflections(), now = new Date()) {
    if (!profile) return null;
    const nowValue = now.getTime();
    const profileRecords = records.filter(item => item.profileId === profile.id)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const activeCycle = profileRecords.find(item => item.cycle
      && Date.parse(item.startedAt) <= nowValue && nowValue <= Date.parse(item.dueAt));
    return activeCycle || profileRecords.find(item => item.month === reflectionMonth(now)) || null;
  }

  function writeReflections(records) {
    try {
      localStorage.setItem(REFLECTION_KEY, JSON.stringify(records.filter(validReflection).slice(0, REFLECTION_LIMIT)));
      return true;
    } catch (_) { return false; }
  }

  function renderReflection() {
    const action = document.getElementById('reflection-action');
    if (!action || !currentFormInput) return;
    const profile = savedCurrentProfile();
    const record = activeReflection(profile);
    const generatedAction = currentInsights && currentInsights.actions[0]
      ? currentInsights.actions[0].text : '从当前待办中只选一件事，写清完成标准，并在 7 天内完成第一版。';
    const actionText = record ? record.action : generatedAction;
    action.value = actionText;
    document.getElementById('reflection-action-preview').textContent = actionText;
    document.getElementById('reflection-editor').open = false;
    document.getElementById('reflection-status').value = record ? record.status : 'planned';
    document.getElementById('reflection-evidence').value = record ? record.evidence : '';
    document.getElementById('reflection-review').open = Boolean(record && (record.evidence || record.status === 'done' || record.status === 'adjusted'));
    const start = record && record.startedAt ? new Date(record.startedAt) : new Date();
    const end = record && record.dueAt ? new Date(record.dueAt) : addDays(start, 7);
    const range = `${start.getMonth() + 1}月${start.getDate()}日—${end.getMonth() + 1}月${end.getDate()}日`;
    document.getElementById('btn-save-reflection').textContent = record ? '更新这条行动' : '保存这条行动';
    document.getElementById('reflection-month').textContent = record
      ? `${range} · 仅保存在本机`
      : `${range} · 点击后仅保存在本机`;
  }

  function saveReflection() {
    if (!currentFormInput) { toast('请先完成排盘'); return; }
    const action = document.getElementById('reflection-action').value.trim();
    const evidence = document.getElementById('reflection-evidence').value.trim();
    const status = document.getElementById('reflection-status').value;
    if (!action) { document.getElementById('reflection-editor').open = true; document.getElementById('reflection-action').focus(); toast('行动内容不能为空'); return; }
    const existingProfile = savedCurrentProfile();
    const profile = existingProfile || T.saveProfile(localStorage, currentFormInput, currentFormInput.name || '未署名命主');
    if (!profile) { toast('保存失败，请检查浏览器存储权限'); return; }
    const records = readReflections();
    const now = new Date();
    const existingRecord = activeReflection(profile, records, now);
    const cycleRecord = existingRecord && existingRecord.cycle ? existingRecord : null;
    const startedAt = cycleRecord ? cycleRecord.startedAt : now.toISOString();
    const dueAt = cycleRecord ? cycleRecord.dueAt : addDays(now, 7).toISOString();
    const cycle = cycleRecord ? cycleRecord.cycle : reflectionCycle(now);
    const record = {
      id: cycleRecord ? cycleRecord.id : `${profile.id}|${cycle}`,
      profileId: profile.id,
      cycle, startedAt, dueAt,
      action: action.slice(0, 160), evidence: evidence.slice(0, 400), status, updatedAt: now.toISOString(),
    };
    const replacedIds = new Set([record.id, existingRecord && existingRecord.id].filter(Boolean));
    const next = [record, ...records.filter(item => !replacedIds.has(item.id))];
    if (!writeReflections(next)) { toast('保存失败，请检查浏览器存储权限'); return; }
    if (!existingProfile) { renderRecentProfile(); }
    renderReflection();
    toast(existingProfile ? '本周行动已保存在当前浏览器' : '已建立本机档案并保存本周行动');
  }

  function clearReflection() {
    if (!currentFormInput) return;
    const profile = savedCurrentProfile();
    if (!profile) { renderReflection(); return; }
    const records = readReflections();
    const record = activeReflection(profile, records);
    if (!record) { renderReflection(); return; }
    if (!confirm('清除这张命盘的本周行动？')) return;
    writeReflections(records.filter(item => item.id !== record.id));
    renderReflection();
    toast('本周行动已清除');
  }

  function saveCurrentProfile() {
    if (!current || !currentFormInput) { toast('请先完成排盘'); return; }
    const saved = T.saveProfile(localStorage, currentFormInput, currentFormInput.name || '未署名命主');
    if (!saved) { toast('保存失败，请检查浏览器存储权限'); return; }
    toast('已保存到本地档案');
    renderProfiles();
    renderRecentProfile();
  }

  function shareSummary() {
    if (!current) { toast('请先完成排盘'); return; }
    pendingShareText = T.shareText(current, currentInsights, window.location.href);
    const modal = document.getElementById('share-modal');
    document.getElementById('share-preview-text').textContent = pendingShareText;
    const confirmButton = document.getElementById('btn-share-confirm');
    confirmButton.textContent = navigator.share ? '确认并分享' : '复制并关闭';
    lastModalFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.share-panel').focus();
  }

  function initSharePreview() {
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    modal.querySelectorAll('[data-share-close]').forEach(element => element.addEventListener('click', closeSharePreview));
    document.getElementById('btn-share-confirm').addEventListener('click', deliverShareSummary);
    document.getElementById('btn-share-copy').addEventListener('click', async () => {
      await copyShareText();
      closeSharePreview();
    });
    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); closeSharePreview(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const panel = modal.querySelector('.share-panel');
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  async function deliverShareSummary() {
    try {
      if (navigator.share) await navigator.share({ title: '天枢 · 命盘速览', text: pendingShareText });
      else await copyShareText();
      closeSharePreview();
    } catch (e) {
      if (e && e.name !== 'AbortError') { await copyShareText(); closeSharePreview(); }
    }
  }

  async function copyShareText() {
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(pendingShareText); toast('脱敏摘要已复制'); return; } catch (_) {}
    }
    fallbackCopy(pendingShareText);
    toast('脱敏摘要已复制');
  }

  function closeSharePreview() {
    const modal = document.getElementById('share-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (lastModalFocus && typeof lastModalFocus.focus === 'function') lastModalFocus.focus();
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
  }

  function toast(message) {
    const el = document.getElementById('toast');
    clearTimeout(toastTimer);
    el.textContent = message; el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 180); }, 2200);
  }

  function initArchive() {
    document.getElementById('btn-export-profiles').addEventListener('click', exportProfiles);
    document.getElementById('f-import-profiles').addEventListener('change', importProfiles);
    document.getElementById('btn-resume-profile').addEventListener('click', () => {
      if (!recentProfile) return;
      applyFormInput(recentProfile.input);
      doPai();
    });
    document.getElementById('btn-clear-profiles').addEventListener('click', () => {
      if (!confirm('确认清空当前浏览器中的全部命盘档案？')) return;
      T.clearProfiles(localStorage);
      try { localStorage.removeItem(REFLECTION_KEY); } catch (_) {}
      renderProfiles(); renderRecentProfile(); toast('档案与行动记录已清空');
    });
  }

  function renderRecentProfile() {
    const panel = document.getElementById('recent-resume');
    if (!panel) return;
    recentProfile = T.readProfiles(localStorage)[0] || null;
    panel.hidden = !recentProfile;
    if (!recentProfile) return;
    const input = recentProfile.input;
    const meta = document.getElementById('recent-resume-meta');
    meta.textContent = `${recentProfile.label || '未署名命主'} · ${input.year}-${pad(input.month)}-${pad(input.day)} · ${input.cityName || '地点未确认'}`;
  }

  function renderProfiles() {
    const root = document.getElementById('profile-list');
    const profiles = T.readProfiles(localStorage);
    if (!profiles.length) {
      root.innerHTML = `<div class="archive-empty"><b>还没有保存的命盘</b><p>完成排盘后点击“保存到档案”，无需账号即可在本机复访。</p><button type="button" class="primary" data-goto="input">去录入</button></div>`;
      root.querySelector('[data-goto]').addEventListener('click', () => go('input'));
      return;
    }
    root.innerHTML = profiles.map(profile => {
      const p = profile.input;
      const date = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
      const city = p.cityName || '地点未确认';
      return `<article class="profile-card" data-profile="${profile.id}">
        <div class="profile-main"><span class="profile-avatar">${T.escapeHtml((profile.label || '命').slice(0, 1))}</span><div>
          <h3>${T.escapeHtml(profile.label)}</h3>
          <p>${date} · ${T.formatClock(p.hour, p.minute)} · ${p.gender === 'female' ? '坤造' : '乾造'}</p>
          <small>${T.escapeHtml(city)} · ${p.timePrecision === 'exact' ? '精确时分' : '时辰估算'}</small>
        </div></div>
        <div class="profile-actions"><button type="button" data-action="load">打开</button><button type="button" data-action="edit">编辑</button><button type="button" class="danger" data-action="delete">删除</button></div>
      </article>`;
    }).join('');
    root.querySelectorAll('.profile-card').forEach(card => {
      const profile = profiles.find(item => item.id === card.dataset.profile);
      card.querySelector('[data-action=load]').addEventListener('click', () => { applyFormInput(profile.input); doPai(); });
      card.querySelector('[data-action=edit]').addEventListener('click', () => { applyFormInput(profile.input); go('input'); toast('已载入，可修改后重新排盘'); });
      card.querySelector('[data-action=delete]').addEventListener('click', () => {
        if (!confirm(`删除“${profile.label}”的本地档案？`)) return;
        T.removeProfile(localStorage, profile.id);
        writeReflections(readReflections().filter(item => item.profileId !== profile.id));
        renderProfiles(); renderRecentProfile();
      });
    });
  }

  function applyFormInput(p) {
    document.getElementById('f-name').value = p.name || '';
    document.querySelector(`input[name=gender][value=${p.gender}]`).checked = true;
    document.getElementById(p.calendar === 'lunar' ? 'cal-lunar' : 'cal-solar').checked = true;
    showLeap(p.calendar === 'lunar');
    document.getElementById('f-year').value = p.year;
    document.getElementById('f-month').value = p.month;
    document.getElementById('f-day').value = p.day;
    document.getElementById('f-leap').checked = Boolean(p.lunarLeap);
    document.querySelector(`input[name=timePrecision][value=${p.timePrecision || 'exact'}]`).checked = true;
    document.getElementById('f-time').value = T.formatClock(p.hour, p.minute);
    document.getElementById('f-shi').value = String(p.shiIdx == null ? T.zhiIndexFromMinutes(p.hour * 60 + p.minute) : p.shiIdx);
    document.getElementById('f-city').value = p.cityId || '';
    document.getElementById('f-lon').value = p.longitude;
    document.getElementById('f-tz').value = p.tz;
    document.getElementById('f-tst').checked = p.useTrueSolar !== false;
    document.querySelector(`input[name=ziRule][value=${p.ziDayRule || 'next'}]`).checked = true;
    document.getElementById('f-focus').value = p.focus || 'overall';
    updateShiHint(); updateTimeMode(); applyCity();
  }

  function exportProfiles() {
    const profiles = T.readProfiles(localStorage);
    if (!profiles.length) { toast('暂无可导出的档案'); return; }
    const profileIds = new Set(profiles.map(profile => profile.id));
    const reflections = readReflections().filter(record => profileIds.has(record.profileId));
    const blob = new Blob([JSON.stringify({ app: '天枢', schemaVersion: 1, version: T.VERSION, exportedAt: new Date().toISOString(), profiles, reflections }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `天枢命盘档案_${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  async function importProfiles(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    let previousProfiles = null;
    let previousReflections = null;
    let storageChanged = false;
    try {
      previousProfiles = localStorage.getItem(T.PROFILE_KEY);
      previousReflections = localStorage.getItem(REFLECTION_KEY);
      const allowedType = !file.type || file.type === 'application/json' || file.type === 'text/json' || file.type === 'text/plain';
      if (!allowedType || !/\.json$/i.test(file.name || '')) throw new Error('请选择 JSON 档案文件');
      if (file.size > 256 * 1024) throw new Error('文件超过 256 KB，已拒绝读取');
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) {
        if (!data || data.app !== '天枢') throw new Error('这不是天枢导出的档案');
        // 兼容此前没有 schemaVersion 的官方导出，同时拒绝未知的新结构。
        if (data.schemaVersion != null && data.schemaVersion !== 1) throw new Error('档案结构版本不受支持');
        const major = Number(String(data.version || '').split('.')[0]);
        if (!Number.isInteger(major) || major > Number(String(T.VERSION).split('.')[0])) throw new Error('档案来自更高版本，请先更新天枢');
      }
      const list = Array.isArray(data) ? data : data.profiles;
      if (!Array.isArray(list)) throw new Error('文件中没有档案列表');
      if (!list.length) throw new Error('档案列表为空');
      const candidates = list.slice(0, 30);
      const imported = T.importProfilesAtomic(localStorage, candidates);
      storageChanged = true;
      const count = imported.profiles.length;
      const profileIdMap = new Map();
      candidates.forEach((item, index) => {
        if (item && typeof item.id === 'string' && imported.profiles[index]) profileIdMap.set(item.id, imported.profiles[index].id);
      });
      const importedReflections = Array.isArray(data && data.reflections) ? data.reflections.map(item => {
        const mappedId = item && profileIdMap.get(item.profileId);
        const recordKey = item && (item.cycle || item.month);
        return mappedId && recordKey ? Object.assign({}, item, { profileId: mappedId, id: `${mappedId}|${recordKey}` }) : null;
      }).filter(validReflection).slice(0, REFLECTION_LIMIT) : [];
      if (importedReflections.length) {
        const existing = readReflections();
        const importedIds = new Set(importedReflections.map(item => item.id));
        if (!writeReflections(importedReflections.concat(existing.filter(item => !importedIds.has(item.id))))) throw new Error('行动记录写入失败');
      }
      renderProfiles(); renderRecentProfile();
      toast(`已导入 ${count} 份档案${importedReflections.length ? `、${importedReflections.length} 条行动记录` : ''}${list.length > 30 ? '（最多保留 30 份）' : ''}`);
    } catch (e) {
      if (storageChanged) {
        try {
          if (previousProfiles == null) localStorage.removeItem(T.PROFILE_KEY); else localStorage.setItem(T.PROFILE_KEY, previousProfiles);
          if (previousReflections == null) localStorage.removeItem(REFLECTION_KEY); else localStorage.setItem(REFLECTION_KEY, previousReflections);
        } catch (_) {}
      }
      toast('导入失败：' + e.message);
    }
  }

  /* ===== 趣味 · 古今人物相似度 ===== */
  function renderFun(r) {
    if (!F || !F.match) {
      document.getElementById('fun-list').innerHTML =
        '<p class="fun-empty">趣味模块未加载，请检查 figures.js</p>';
      document.getElementById('fun-actions').hidden = true;
      return;
    }
    const result = F.match(r, { top: 8, category: funCategory || undefined });
    lastFunResult = result;
    const us = result.userSummary;

    // 用户侧摘要
    if (us) {
      document.getElementById('fun-summary').innerHTML =
        `<div class="fun-you">
          <span class="fun-you-label">你的命盘</span>
          <span class="fun-you-pillars">
            <b>${us.pillars.year}</b>
            <b>${us.pillars.month}</b>
            <b class="day">${us.pillars.day}</b>
            <b>${us.pillars.hour}</b>
          </span>
          <span class="fun-you-meta">
            日主 <b>${us.dayMaster}${us.dayWx}</b>
            · ${us.pattern || '—'}
            · ${us.strength}
            ${us.xi && us.xi.length ? ' · 喜 ' + us.xi.join('') : ''}
          </span>
          <span class="fun-you-count">对照库 ${result.total} 人</span>
        </div>`;
    } else {
      document.getElementById('fun-summary').innerHTML = '';
    }

    // 分类筛选
    const cats = result.categories || F.CATEGORIES || [];
    document.getElementById('fun-filters').innerHTML = cats.map(c =>
      `<button type="button" class="fun-chip${(c.key || '') === funCategory ? ' active' : ''}" data-cat="${c.key || ''}">${c.label}</button>`
    ).join('');
    document.querySelectorAll('#fun-filters .fun-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        funCategory = btn.dataset.cat || '';
        renderFun(r);
      });
    });

    // 匹配列表
    const actions = document.getElementById('fun-actions');
    if (result.error) {
      document.getElementById('fun-list').innerHTML =
        `<p class="fun-empty">${result.error}</p>`;
      actions.hidden = true;
    } else if (!result.matches.length) {
      document.getElementById('fun-list').innerHTML =
        '<p class="fun-empty">该分类下暂无足够对照，试试「全部」</p>';
      actions.hidden = true;
    } else {
      actions.hidden = false;
      document.getElementById('fun-list').innerHTML = result.matches.map((m, i) => {
        const rank = i + 1;
        const rankCls = rank === 1 ? 'gold' : (rank === 2 ? 'silver' : (rank === 3 ? 'bronze' : ''));
        const alias = m.alias ? `<span class="fun-alias">${m.alias}</span>` : '';
        const tags = (m.tags || []).map(t => `<span class="fun-tag">${t}</span>`).join('');
        const reasons = (m.reasons || []).map(t => `<li>${t}</li>`).join('');
        const barW = Math.max(8, Math.min(100, m.score));
        return `<article class="fun-card ${rankCls}" data-rank="${rank}">
          <div class="fun-rank">${rank <= 3 ? '第' + rank + '名' : '#' + rank}</div>
          <div class="fun-main">
            <div class="fun-head">
              <h3 class="fun-name">${m.name}${alias}</h3>
              <span class="fun-score"><i style="width:${barW}%"></i><em>${m.score}</em></span>
            </div>
            <div class="fun-meta">
              <span class="fun-era">${m.era}</span>
              <span class="fun-cat">${m.categoryLabel || m.category}</span>
              <span class="fun-dm">日主 ${m.dayMaster}${m.dayWx}</span>
              <span class="fun-pat">${m.pattern || ''}</span>
            </div>
            <div class="fun-pillars">
              <span>${m.pillars.year}</span>
              <span>${m.pillars.month}</span>
              <span class="day">${m.pillars.day}</span>
              <span>${m.pillars.hour}</span>
            </div>
            <p class="fun-vibe">${m.vibe}</p>
            ${reasons ? `<ul class="fun-reasons">${reasons}</ul>` : ''}
            <div class="fun-tags">${tags}</div>
            <p class="fun-note">${m.note || ''}</p>
          </div>
        </article>`;
      }).join('');
    }

    document.getElementById('fun-disclaimer').textContent =
      result.disclaimer || (F.DISCLAIMER || '');
  }

  /* ===== 分享海报 ===== */
  function initPoster() {
    const modal = document.getElementById('poster-modal');
    if (!modal) return;
    document.getElementById('btn-poster').addEventListener('click', openPoster);
    document.getElementById('btn-poster-save').addEventListener('click', savePoster);
    document.getElementById('btn-poster-copy').addEventListener('click', copyPoster);
    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', closePoster);
    });
    document.addEventListener('keydown', e => {
      if (modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closePoster(); return; }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      const panel = modal.querySelector('.poster-panel');
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function openPoster() {
    if (!current || !lastFunResult || !lastFunResult.matches || !lastFunResult.matches.length) {
      alert('请先排盘并查看趣味匹配结果');
      return;
    }
    drawPoster(current, lastFunResult);
    const modal = document.getElementById('poster-modal');
    lastModalFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    const panel = modal.querySelector('.poster-panel');
    if (panel) panel.focus();
  }

  function closePoster() {
    const modal = document.getElementById('poster-modal');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    if (lastModalFocus && typeof lastModalFocus.focus === 'function') lastModalFocus.focus();
  }

  function posterFileName() {
    const top = lastFunResult && lastFunResult.matches[0] ? lastFunResult.matches[0].name : '像谁';
    return `天枢_我最像${top}.png`;
  }

  function savePoster() {
    const canvas = document.getElementById('poster-canvas');
    try {
      const a = document.createElement('a');
      a.download = posterFileName();
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert('保存失败：' + e.message);
    }
  }

  async function copyPoster() {
    const canvas = document.getElementById('poster-canvas');
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        alert('已复制到剪贴板');
      } else {
        // 降级：打开新窗口
        const w = window.open();
        if (w) {
          w.document.write('<img src="' + canvas.toDataURL('image/png') + '" style="max-width:100%">');
        } else {
          alert('当前浏览器不支持复制图片，请用「保存图片」');
        }
      }
    } catch (e) {
      alert('复制失败，请改用「保存图片」：' + (e.message || e));
    }
  }

  function drawPoster(r, fun) {
    const canvas = document.getElementById('poster-canvas');
    const W = 720, H = 1280;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const us = fun.userSummary;
    const top = fun.matches.slice(0, 4);
    const shareUrl = T.shareUrl ? T.shareUrl(window.location.href) : '';
    let siteLabel = '天枢 · 本地隐私排盘';
    try { if (shareUrl) siteLabel = new URL(shareUrl).host; } catch (_) {}

    // 配色
    const paper = '#f7f2e7';
    const paper2 = '#fffdf8';
    const ink = '#2a2622';
    const ink2 = '#6b6256';
    const verm = '#9e2b25';
    const gold = '#b08635';
    const line = '#e4d9c2';

    // 背景
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
    // 微纹理光晕
    const g1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 20, W * 0.2, H * 0.15, 280);
    g1.addColorStop(0, 'rgba(176,134,53,0.08)');
    g1.addColorStop(1, 'rgba(176,134,53,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.85, H * 0.85, 20, W * 0.85, H * 0.85, 320);
    g2.addColorStop(0, 'rgba(158,43,37,0.06)');
    g2.addColorStop(1, 'rgba(158,43,37,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // 外框双线
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(176,134,53,0.45)';
    ctx.strokeRect(38, 38, W - 76, H - 76);

    // 顶部品牌
    ctx.fillStyle = verm;
    ctx.font = '700 42px "STKaiti","KaiTi","Songti SC",serif';
    ctx.textAlign = 'center';
    ctx.fillText('天 枢', W / 2, 96);
    ctx.fillStyle = ink2;
    ctx.font = '18px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('古今人物相似度 · 趣味对照', W / 2, 128);

    // 分隔线
    drawOrnamentLine(ctx, 90, 148, W - 90, gold);

    // 用户卡片：默认脱敏，不写姓名、出生日期、地点或完整四柱。
    roundRect(ctx, 70, 168, W - 140, 168, 12, paper2, line);
    ctx.fillStyle = gold;
    ctx.font = '700 16px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PRIVATE SUMMARY · 脱敏摘要', 92, 198);

    ctx.fillStyle = verm;
    ctx.font = '700 30px "STKaiti","KaiTi",serif';
    ctx.fillText(`日主 ${us.dayMaster}${us.dayWx}`, 92, 244);
    ctx.fillStyle = ink;
    ctx.font = '700 25px "STKaiti","KaiTi",serif';
    ctx.fillText(`${us.pattern || '格局待定'} · ${us.strength || '强弱待定'}`, 92, 286);
    ctx.fillStyle = ink2;
    ctx.font = '15px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('不含姓名、出生日期、时间、地点与完整四柱', 92, 316);

    // 最像 TA
    const best = top[0];
    const y = 360;
    ctx.textAlign = 'center';
    ctx.fillStyle = gold;
    ctx.font = '16px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('✦  最 像  ✦', W / 2, y);

    ctx.fillStyle = verm;
    ctx.font = '700 56px "STKaiti","KaiTi",serif';
    ctx.fillText(best.name, W / 2, y + 64);

    if (best.alias) {
      ctx.fillStyle = ink2;
      ctx.font = '20px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.fillText(best.alias + ' · ' + best.era, W / 2, y + 98);
    } else {
      ctx.fillStyle = ink2;
      ctx.font = '20px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.fillText(best.era + ' · ' + (best.categoryLabel || best.category), W / 2, y + 98);
    }

    // 相似度大数字
    ctx.fillStyle = gold;
    ctx.font = '700 72px "STKaiti","KaiTi",serif';
    ctx.fillText(String(best.score), W / 2, y + 178);
    ctx.fillStyle = ink2;
    ctx.font = '18px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('相似度', W / 2, y + 208);

    // 进度条
    const barX = 120, barW = W - 240, barY = y + 230;
    ctx.fillStyle = '#efe7d6';
    roundRect(ctx, barX, barY, barW, 14, 7, '#efe7d6', null);
    const fillW = Math.max(12, Math.min(barW, best.score / 100 * barW));
    const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    grad.addColorStop(0, 'rgba(176,134,53,0.7)');
    grad.addColorStop(1, 'rgba(158,43,37,0.85)');
    roundRect(ctx, barX, barY, fillW, 14, 7, grad, null);

    // 气质一句话
    ctx.fillStyle = ink;
    ctx.font = '20px "Noto Sans SC","Microsoft YaHei",sans-serif';
    wrapText(ctx, best.vibe || '', 90, y + 280, W - 180, 30, 2);

    // 相似理由
    let ry = y + 350;
    ctx.textAlign = 'left';
    (best.reasons || []).slice(0, 3).forEach((reason, i) => {
      ctx.fillStyle = gold;
      ctx.font = '18px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.fillText('✦', 90, ry + i * 32);
      ctx.fillStyle = ink2;
      ctx.fillText(reason, 118, ry + i * 32);
    });

    // Top 榜
    const listTop = 850;
    drawOrnamentLine(ctx, 90, listTop - 24, W - 90, gold);
    ctx.textAlign = 'center';
    ctx.fillStyle = verm;
    ctx.font = '700 22px "STKaiti","KaiTi",serif';
    ctx.fillText('相似榜 · TOP ' + Math.min(4, top.length), W / 2, listTop);

    top.forEach((m, i) => {
      const rowY = listTop + 28 + i * 48;
      // 排名圆点
      ctx.beginPath();
      ctx.arc(100, rowY - 6, 14, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#c9a227' : (i === 1 ? '#8a8f98' : (i === 2 ? '#b87333' : ink2));
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 14px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), 100, rowY - 1);

      ctx.textAlign = 'left';
      ctx.fillStyle = ink;
      ctx.font = '700 22px "STKaiti","KaiTi",serif';
      ctx.fillText(m.name, 130, rowY);
      ctx.fillStyle = ink2;
      ctx.font = '15px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.fillText((m.era || '') + ' · 日主' + m.dayMaster + m.dayWx, 130, rowY + 20);

      ctx.textAlign = 'right';
      ctx.fillStyle = verm;
      ctx.font = '700 24px "STKaiti","KaiTi",serif';
      ctx.fillText(String(m.score), W - 90, rowY + 4);
    });

    // 页脚：运行时地址 + 可扫描二维码，形成图片回流闭环。
    if (shareUrl) {
      ctx.textAlign = 'center';
      ctx.fillStyle = verm;
      ctx.font = '700 14px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.fillText('扫码测同款', W - 110, H - 238);
      drawQrCode(ctx, shareUrl, W - 190, H - 225, 160);
    }
    const shortSite = siteLabel.length > 34 ? siteLabel.slice(0, 33) + '…' : siteLabel;
    ctx.textAlign = 'left';
    ctx.fillStyle = verm;
    ctx.font = '700 18px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('测同款 · 天枢隐私排盘', 86, H - 118);
    ctx.fillStyle = ink2;
    ctx.font = '14px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText(shortSite, 86, H - 88);
    ctx.textAlign = 'left';
    ctx.font = '12px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('人物生辰多为通行说法，相似度属启发式打分，仅供娱乐', 86, H - 36);
  }

  /* 固定 Version 8-L 的离线 QR 编码器：足够容纳 Pages 运行时 URL，不发送任何网络请求。 */
  function drawQrCode(ctx, text, x, y, boxSize) {
    let matrix;
    try { matrix = buildQrMatrix(text); } catch (_) { return false; }
    const quiet = 4;
    const count = matrix.length + quiet * 2;
    const scale = Math.max(1, Math.floor(boxSize / count));
    const size = count * scale;
    const left = Math.round(x + (boxSize - size) / 2);
    const top = Math.round(y + (boxSize - size) / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(left, top, size, size);
    ctx.fillStyle = '#1f1c19';
    matrix.forEach((row, rowIndex) => row.forEach((dark, columnIndex) => {
      if (dark) ctx.fillRect(left + (columnIndex + quiet) * scale, top + (rowIndex + quiet) * scale, scale, scale);
    }));
    return true;
  }

  function buildQrMatrix(value) {
    const QR = globalThis.TianshuQR;
    if (!QR || typeof QR.create !== 'function') throw new Error('二维码模块未加载');
    const qr = QR.create(String(value || ''), { errorCorrectionLevel: 'L' });
    const size = qr.modules.size;
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, column) => qr.modules.get(row, column)));
  }

  function drawOrnamentLine(ctx, x1, y, x2, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    // 中点菱形
    const mx = (x1 + x2) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(mx, y - 5);
    ctx.lineTo(mx + 5, y);
    ctx.lineTo(mx, y + 5);
    ctx.lineTo(mx - 5, y);
    ctx.closePath();
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    if (!text) return y;
    const chars = String(text).split('');
    let line = '';
    let lines = 0;
    ctx.textAlign = 'center';
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x + maxWidth / 2, y + lines * lineHeight);
        line = chars[i];
        lines++;
        if (lines >= maxLines) {
          // 截断
          return y + lines * lineHeight;
        }
      } else {
        line = test;
      }
    }
    if (line && lines < maxLines) {
      ctx.fillText(line, x + maxWidth / 2, y + lines * lineHeight);
    }
    return y + (lines + 1) * lineHeight;
  }

  function pad(n) { return String(n).padStart(2, '0'); }
})();
