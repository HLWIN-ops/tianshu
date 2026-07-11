/**
 * 八字排盘 综合版 - 交互与渲染
 * 依赖：Bazi（engine.js）、Bazi.plus（engine-plus.js）、Bazi.interpret（interpret.js）
 */
(function () {
  'use strict';

  const P = Bazi.plus;
  const I = Bazi.interpret;
  const K = Bazi.constants;
  let current = null; // fullChart 结果

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
    buildShiOptions();
    initTabs();
    initForm();
    initIntro();
  }

  /* ===== 进场太极八卦 ===== */
  function initIntro() {
    const el = document.getElementById('intro');
    if (!el) return;
    // 同会话内只播一次，刷新可再看；localStorage 可选
    const skipBtn = document.getElementById('intro-skip');
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      el.classList.add('is-out');
      setTimeout(() => {
        el.classList.add('is-gone');
        el.setAttribute('aria-hidden', 'true');
      }, 900);
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
    setTimeout(() => el.classList.add('is-ready'), 1200);
    setTimeout(hide, 3200);
  }

  function buildShiOptions() {
    const sel = document.getElementById('f-shi');
    sel.innerHTML = SHICHEN.map(s =>
      `<option value="${s.idx}">${s.name} · ${s.label}（${s.range}）</option>`).join('');
    sel.value = '8'; // 默认申时
    updateShiHint();
    sel.addEventListener('change', updateShiHint);
  }
  function updateShiHint() {
    const s = SHICHEN[+document.getElementById('f-shi').value];
    document.getElementById('shi-range').textContent = `${s.name}（${s.range}）`;
    document.getElementById('shi-solar').textContent = ` · 约 ${pad(shiToHour(s.idx))}:${pad(shiToMinute())}`;
  }

  /* ===== 导航 ===== */
  function initTabs() {
    document.querySelectorAll('.tab').forEach(b =>
      b.addEventListener('click', () => go(b.dataset.page)));
    document.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => go(b.dataset.goto)));
  }
  function go(page) {
    if ((page === 'paipan' || page === 'dayun' || page === 'read') && !current) {
      alert('请先填写生辰并排盘'); return;
    }
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'paipan') renderPaipan(current);
    if (page === 'dayun') renderDayun(current);
    if (page === 'read') renderRead(current);
  }

  /* ===== 录入 ===== */
  function initForm() {
    // 历法切换
    document.getElementById('cal-lunar').addEventListener('change', () => showLeap(true));
    document.getElementById('cal-solar').addEventListener('change', () => showLeap(false));

    document.getElementById('btn-now').addEventListener('click', fillNow);

    document.getElementById('form').addEventListener('submit', e => {
      e.preventDefault();
      doPai();
    });
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
    // 选最接近当前小时的时辰
    const h = n.getHours();
    const idx = h === 23 ? 0 : Math.min(11, Math.floor((h + 1) / 2));
    document.getElementById('f-shi').value = String(idx);
    updateShiHint();
    // 分钟不再单独输入，时辰选择器已涵盖
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
    const minute = 30; // 取该时辰中段，确保落在所属地支
    const longitude = parseFloat(document.getElementById('f-lon').value);
    const tz = parseInt(document.getElementById('f-tz').value, 10);
    const useTrueSolar = document.getElementById('f-tst').checked;
    const ziDayRule = (document.querySelector('input[name=ziRule]:checked') || {}).value || 'next';

    if (!year || !month || !day) { alert('请填写完整的出生年月日'); return; }
    if (month < 1 || month > 12 || day < 1 || day > 31) { alert('月日填写有误'); return; }

    // 时辰 -> 代表小时（用于排盘；真太阳时再校正）
    let hour = shiToHour(shiIdx);

    let lunarLabel = '';
    if (isLunar) {
      const solar = P.lunarToSolar(year, month, day, isLeap);
      if (!solar) { alert('该农历日期不存在（可能无此闰月或超出范围）'); return; }
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
      current.input.shiName = SHICHEN[shiIdx].name;
      current.input.ziDayRule = ziDayRule;
      go('paipan');
    } catch (e) {
      alert('排盘出错：' + e.message);
      console.error(e);
    }
  }

  /* ===== 命盘渲染 ===== */
  function renderPaipan(r) {
    const genderText = r.input.gender === 'male' ? '男命 · 乾造' : '女命 · 坤造';
    const nameText = r.input.name || '未署名';
    const lunar = r.lunar;
    const lunarStr = lunar ? `农历 ${lunar.yearGanZhi}年${lunar.isLeap ? '闰' : ''}${lunar.month}月${lunar.day}日 · 属${lunar.animal}` : '';
    document.getElementById('idcard').innerHTML =
      `<span class="id-name">${nameText}</span>` +
      `<span class="id-tag">${genderText}</span>` +
      `<span class="id-solar">公历 ${r.input.year}年${r.input.month}月${r.input.day}日 ${r.input.shiName}</span>` +
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

  /* ===== 大运流年 ===== */
  function renderDayun(r) {
    const dy = r.dayun;
    document.getElementById('dayun-intro').innerHTML =
      `${r.input.gender === 'male' ? '男' : '女'}命 · 大运自月柱 <b>${r.pillars.month.name}</b> ${dy.forward ? '顺' : '逆'}排 · <b>${dy.startAge}</b>岁${dy.startMonths ? dy.startMonths + '个月' : ''}起运`;
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
          <div class="tl-age">${d.startAge}–${d.startAge + 9} 岁 · ${d.startYear}年起</div>
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
    const curAge = r._currentYear - r.input.year;
    let curRun = null;
    dy.runs.forEach(d => { if (curAge >= d.startAge && curAge < d.startAge + 10) curRun = d; });
    const inCurRun = (y) => curRun && y >= curRun.startYear && y <= curRun.startYear + 9;
    if (curRun) {
      document.getElementById('dayun-intro').innerHTML +=
        `　·　当前行 <b>${curRun.ganName}${curRun.zhiName}</b> 运（${curRun.startAge}–${curRun.startAge + 9}岁）`;
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
  }

  function pad(n) { return String(n).padStart(2, '0'); }
})();
