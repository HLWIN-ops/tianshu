/**
 * 八字排盘 综合版 - 交互与渲染
 * 依赖：Bazi（engine.js）、Bazi.plus（engine-plus.js）、Bazi.interpret（interpret.js）、Bazi.figures（figures.js）
 */
(function () {
  'use strict';

  const P = Bazi.plus;
  const I = Bazi.interpret;
  const F = Bazi.figures;
  const T = Bazi.product;
  const K = Bazi.constants;
  let current = null; // fullChart 结果
  let currentFormInput = null;
  let currentAccuracy = null;
  let currentInsights = null;
  let funCategory = ''; // 趣味页分类过滤
  let lastFunResult = null; // 最近一次趣味匹配结果（供海报使用）
  let toastTimer = null;

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
    initIntro();
    buildShiOptions();
    buildProductOptions();
    initTabs();
    initForm();
    initPoster();
    initResultActions();
    initArchive();
  }

  /* ===== 进场太极八卦 ===== */
  function initIntro() {
    const el = document.getElementById('intro');
    if (!el) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seen = false;
    try { seen = localStorage.getItem('tianshu.intro.seen') === '1'; } catch (_) {}
    if (seen || reduced) {
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
    // 入场动画结束后允许点击；定时自动隐没
    setTimeout(() => el.classList.add('is-ready'), 300);
    setTimeout(hide, 1600);
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
    document.querySelectorAll('.tab').forEach(b =>
      b.addEventListener('click', () => go(b.dataset.page)));
    document.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => go(b.dataset.goto)));
  }
  function go(page) {
    if ((page === 'paipan' || page === 'dayun' || page === 'read' || page === 'fun') && !current) {
      alert('请先填写生辰并排盘'); return;
    }
    document.querySelectorAll('.tab').forEach(t => {
      const active = t.dataset.page === page;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (!target) return;
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      showStatus('请填写完整的出生年月日。', 'error'); return;
    }
    if (!isLunar && !T.isValidSolarDate(year, month, day)) {
      showStatus('这个公历日期不存在，请检查年月日。', 'error'); return;
    }
    if (timePrecision === 'exact' && !exactTime) {
      showStatus('请选择准确的出生时间。', 'error'); return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(tz) || tz < -12 || tz > 14) {
      showStatus('请检查经度和时区设置。', 'error'); return;
    }

    currentFormInput = {
      name, gender, calendar: isLunar ? 'lunar' : 'solar', year, month, day,
      lunarLeap: isLeap, hour, minute, timePrecision, shiIdx,
      longitude, tz, useTrueSolar, ziDayRule, cityId, cityName: city ? city.name : '', focus,
    };

    let lunarLabel = '';
    if (isLunar) {
      const solar = P.lunarToSolar(year, month, day, isLeap);
      if (!solar) { showStatus('该农历日期不存在，可能无此闰月或超出支持范围。', 'error'); return; }
      lunarLabel = `农历 ${year}年${isLeap ? '闰' : ''}${month}月${day}日`;
      year = solar.y; month = solar.m; day = solar.d;
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
      showStatus('排盘完成。', 'ok');
      go('paipan');
    } catch (e) {
      showStatus('排盘出错：' + e.message, 'error');
      console.error(e);
    }
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
      ? `<span>当前大运 <b>${view.run.name}</b> · ${view.run.startDate} 起</span>`
      : '<span>当前处于起运前阶段</span>';
    document.getElementById('insight-overview').innerHTML = `
      <div class="insight-kicker">命盘速览 · ${view.focusLabel}</div>
      <div class="insight-heading">
        <div><h2>${view.headline}</h2><p>${view.subhead}</p></div>
        <div class="insight-run">${run}</div>
      </div>
      <div class="insight-evidence">${view.evidence.map(item => `<span>${item}</span>`).join('')}</div>
      <div class="action-grid">${view.actions.map(item => `
        <article class="action-card"><b>${item.label}</b><p>${item.text}</p><details><summary>查看依据</summary><small>${item.evidence}</small></details></article>`).join('')}
      </div>
      <p class="insight-disclaimer">${view.disclaimer}</p>`;
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
        <div><span class="accuracy-dot ${a.gradeClass}"></span><b>排盘可信度：${a.grade}</b><small>${a.precisionLabel}</small></div>
        <span class="local-badge">本机计算 · v${a.version}</span>
      </div>
      <p>${correction}</p>
      <details class="accuracy-detail">
        <summary>查看排盘依据与边界提醒</summary>
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
    cards.forEach((card, index) => { card.id = `read-section-${index}`; });
    toolbar.innerHTML = cards.map((card, index) =>
      `<button type="button" data-read-target="read-section-${index}">${card.querySelector('h3') ? card.querySelector('h3').textContent.trim() : '章节'}</button>`).join('');
    toolbar.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      document.getElementById(button.dataset.readTarget).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function initResultActions() {
    document.getElementById('btn-save-current').addEventListener('click', saveCurrentProfile);
    document.getElementById('btn-share-summary').addEventListener('click', shareSummary);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
  }

  function saveCurrentProfile() {
    if (!current || !currentFormInput) { toast('请先完成排盘'); return; }
    const saved = T.saveProfile(localStorage, currentFormInput, currentFormInput.name || '未署名命主');
    if (!saved) { toast('保存失败，请检查浏览器存储权限'); return; }
    toast('已保存到本地档案');
    renderProfiles();
  }

  async function shareSummary() {
    if (!current) { toast('请先完成排盘'); return; }
    const text = T.shareText(current, currentInsights);
    try {
      if (navigator.share) await navigator.share({ title: '天枢 · 命盘速览', text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); toast('摘要已复制'); }
      else fallbackCopy(text);
    } catch (e) {
      if (e && e.name !== 'AbortError') { fallbackCopy(text); toast('摘要已复制'); }
    }
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
    document.getElementById('btn-clear-profiles').addEventListener('click', () => {
      if (!confirm('确认清空当前浏览器中的全部命盘档案？')) return;
      T.clearProfiles(localStorage); renderProfiles(); toast('档案已清空');
    });
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
        T.removeProfile(localStorage, profile.id); renderProfiles();
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
    const blob = new Blob([JSON.stringify({ app: '天枢', version: T.VERSION, exportedAt: new Date().toISOString(), profiles }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `天枢命盘档案_${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  async function importProfiles(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.profiles;
      if (!Array.isArray(list)) throw new Error('文件中没有档案列表');
      let count = 0;
      list.slice(0, 30).forEach(item => {
        const input = item && item.input ? item.input : item;
        if (T.validProfileInput(input) && T.saveProfile(localStorage, input, item.label)) count++;
      });
      renderProfiles(); toast(`已导入 ${count} 份有效档案`);
    } catch (e) { toast('导入失败：' + e.message); }
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
      el.addEventListener('click', () => { modal.hidden = true; });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
    });
  }

  function openPoster() {
    if (!current || !lastFunResult || !lastFunResult.matches || !lastFunResult.matches.length) {
      alert('请先排盘并查看趣味匹配结果');
      return;
    }
    drawPoster(current, lastFunResult);
    document.getElementById('poster-modal').hidden = false;
  }

  function posterFileName() {
    const name = (current && current.input && current.input.name) || '命主';
    const top = lastFunResult && lastFunResult.matches[0] ? lastFunResult.matches[0].name : '像谁';
    return `天枢_${name}_像${top}.png`;
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
    const top = fun.matches.slice(0, 5);
    const userName = (r.input && r.input.name) || '命主';
    const genderText = r.input.gender === 'male' ? '乾造' : '坤造';

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

    // 用户卡片
    roundRect(ctx, 70, 168, W - 140, 168, 12, paper2, line);
    ctx.fillStyle = gold;
    ctx.font = '700 16px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('YOUR BAZI · 你的命盘', 92, 198);

    ctx.fillStyle = verm;
    ctx.font = '700 30px "STKaiti","KaiTi",serif';
    ctx.fillText(userName + ' · ' + genderText, 92, 240);

    // 四柱
    const pillars = us.pillars;
    const pArr = [pillars.year, pillars.month, pillars.day, pillars.hour];
    const pLabels = ['年', '月', '日', '时'];
    ctx.font = '700 28px "STKaiti","KaiTi",serif';
    pArr.forEach((p, i) => {
      const x = 92 + i * 130;
      ctx.fillStyle = ink2;
      ctx.font = '14px "Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.fillText(pLabels[i], x, 272);
      ctx.fillStyle = i === 2 ? verm : ink;
      ctx.font = '700 30px "STKaiti","KaiTi",serif';
      ctx.fillText(p, x, 308);
    });

    // 日主摘要
    ctx.fillStyle = ink2;
    ctx.font = '16px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'right';
    const meta = `日主 ${us.dayMaster}${us.dayWx} · ${us.pattern || ''} · ${us.strength}`;
    ctx.fillText(meta, W - 92, 198);

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
    const listTop = 900;
    drawOrnamentLine(ctx, 90, listTop - 24, W - 90, gold);
    ctx.textAlign = 'center';
    ctx.fillStyle = verm;
    ctx.font = '700 22px "STKaiti","KaiTi",serif';
    ctx.fillText('相似榜 · TOP ' + Math.min(5, top.length), W / 2, listTop);

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

    // 页脚
    ctx.textAlign = 'center';
    ctx.fillStyle = ink2;
    ctx.font = '14px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('知命 · 安身  |  天枢八字 · 趣味对照', W / 2, H - 70);
    ctx.font = '12px "Noto Sans SC","Microsoft YaHei",sans-serif';
    ctx.fillText('人物生辰多为通行说法，相似度属启发式打分，仅供娱乐', W / 2, H - 48);
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
