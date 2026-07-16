/**
 * 天枢产品层：把计算结果变成可解释、可复访的用户体验。
 * 该文件不依赖 DOM，便于 Node 回归测试和离线运行。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (typeof Bazi !== 'undefined') Bazi.product = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '2.0.0';
  const PROFILE_KEY = 'tianshu.profiles.v1';
  const PROFILE_LIMIT = 30;
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火', 午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水' };
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 常用出生地离线预设：不上传地址，选择后只写入经度和时区。
  const CITIES = [
    { id: 'beijing', name: '北京', region: '中国', longitude: 116.407, tz: 8 },
    { id: 'shanghai', name: '上海', region: '中国', longitude: 121.474, tz: 8 },
    { id: 'guangzhou', name: '广州', region: '中国', longitude: 113.264, tz: 8 },
    { id: 'shenzhen', name: '深圳', region: '中国', longitude: 114.057, tz: 8 },
    { id: 'chengdu', name: '成都', region: '中国', longitude: 104.066, tz: 8 },
    { id: 'chongqing', name: '重庆', region: '中国', longitude: 106.551, tz: 8 },
    { id: 'hangzhou', name: '杭州', region: '中国', longitude: 120.155, tz: 8 },
    { id: 'wuhan', name: '武汉', region: '中国', longitude: 114.305, tz: 8 },
    { id: 'xian', name: '西安', region: '中国', longitude: 108.940, tz: 8 },
    { id: 'nanjing', name: '南京', region: '中国', longitude: 118.796, tz: 8 },
    { id: 'tianjin', name: '天津', region: '中国', longitude: 117.200, tz: 8 },
    { id: 'suzhou', name: '苏州', region: '中国', longitude: 120.585, tz: 8 },
    { id: 'zhengzhou', name: '郑州', region: '中国', longitude: 113.625, tz: 8 },
    { id: 'changsha', name: '长沙', region: '中国', longitude: 112.938, tz: 8 },
    { id: 'qingdao', name: '青岛', region: '中国', longitude: 120.383, tz: 8 },
    { id: 'shenyang', name: '沈阳', region: '中国', longitude: 123.431, tz: 8 },
    { id: 'dalian', name: '大连', region: '中国', longitude: 121.614, tz: 8 },
    { id: 'harbin', name: '哈尔滨', region: '中国', longitude: 126.642, tz: 8 },
    { id: 'changchun', name: '长春', region: '中国', longitude: 125.324, tz: 8 },
    { id: 'jinan', name: '济南', region: '中国', longitude: 117.120, tz: 8 },
    { id: 'fuzhou', name: '福州', region: '中国', longitude: 119.296, tz: 8 },
    { id: 'xiamen', name: '厦门', region: '中国', longitude: 118.089, tz: 8 },
    { id: 'kunming', name: '昆明', region: '中国', longitude: 102.833, tz: 8 },
    { id: 'guiyang', name: '贵阳', region: '中国', longitude: 106.630, tz: 8 },
    { id: 'nanning', name: '南宁', region: '中国', longitude: 108.320, tz: 8 },
    { id: 'haikou', name: '海口', region: '中国', longitude: 110.199, tz: 8 },
    { id: 'lanzhou', name: '兰州', region: '中国', longitude: 103.834, tz: 8 },
    { id: 'urumqi', name: '乌鲁木齐', region: '中国', longitude: 87.617, tz: 8 },
    { id: 'lhasa', name: '拉萨', region: '中国', longitude: 91.117, tz: 8 },
    { id: 'xining', name: '西宁', region: '中国', longitude: 101.778, tz: 8 },
    { id: 'taiyuan', name: '太原', region: '中国', longitude: 112.549, tz: 8 },
    { id: 'shijiazhuang', name: '石家庄', region: '中国', longitude: 114.514, tz: 8 },
    { id: 'hefei', name: '合肥', region: '中国', longitude: 117.227, tz: 8 },
    { id: 'nanchang', name: '南昌', region: '中国', longitude: 115.858, tz: 8 },
    { id: 'hongkong', name: '香港', region: '中国', longitude: 114.169, tz: 8 },
    { id: 'macau', name: '澳门', region: '中国', longitude: 113.543, tz: 8 },
    { id: 'taipei', name: '台北', region: '中国', longitude: 121.565, tz: 8 },
    { id: 'hohhot', name: '呼和浩特', region: '中国', longitude: 111.749, tz: 8 },
    { id: 'yinchuan', name: '银川', region: '中国', longitude: 106.230, tz: 8 },
  ];

  const FOCUS = [
    { key: 'overall', label: '整体节奏' },
    { key: 'career', label: '事业成长' },
    { key: 'wealth', label: '财务规划' },
    { key: 'relationship', label: '关系经营' },
    { key: 'wellbeing', label: '身心状态' },
  ];

  const FOCUS_ACTIONS = {
    overall: {
      lead: '把今年的重点收敛成一个可复盘的主线，每月只追踪一项关键进展。',
      caution: '遇到外部变化时先留出复核时间，再做不可逆的决定。',
      habit: '用一页记录持续观察：发生了什么、依据是什么、结果如何。',
    },
    career: {
      lead: '把能力沉淀为可展示的成果，优先争取有明确边界和反馈周期的任务。',
      caution: '重要承诺写清目标、资源与退出条件，避免只凭一时气势加码。',
      habit: '每周保留一个不被打扰的深度工作时段，形成可复用的方法。',
    },
    wealth: {
      lead: '先建立现金流和预算的可见性，再讨论扩张；把机会拆成小额可验证的试验。',
      caution: '不把命理提示当作投资依据，任何资金决定都应经过独立的风险评估。',
      habit: '固定记录收入、支出与风险敞口，让“感觉”回到可核对的数据上。',
    },
    relationship: {
      lead: '把关系中的期待说成具体请求，给彼此留下回应和调整的空间。',
      caution: '冲突期避免用单一标签解释对方，重要决定等情绪回落后再确认。',
      habit: '每周安排一次不带目的的交流，积累可被信任的日常。',
    },
    wellbeing: {
      lead: '优先稳住睡眠、饮食和运动这三个可控变量，再安排高强度目标。',
      caution: '传统命理不能替代医疗建议，任何不适应及时寻求专业帮助。',
      habit: '用可量化的轻量习惯记录精力变化，不追求一次性彻底改变。',
    },
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function isValidSolarDate(year, month, day, minYear = 1900, maxYear = 2100) {
    if (![year, month, day].every(Number.isInteger) || year < minYear || year > maxYear
      || month < 1 || month > 12 || day < 1) return false;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= days[month - 1];
  }
  function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hour = Number(match[1]), minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
  }
  function zhiIndexFromMinutes(total) {
    const minutes = ((total % 1440) + 1440) % 1440;
    return Math.floor((minutes / 60 + 1) / 2) % 12;
  }
  function formatClock(hour, minute) { return `${pad(hour)}:${pad(minute)}`; }
  function normalizeClock(total) {
    const value = ((Math.round(total) % 1440) + 1440) % 1440;
    return { hour: Math.floor(value / 60), minute: value % 60, total: value };
  }
  function circularDistance(a, b, cycle) {
    const d = Math.abs(a - b) % cycle;
    return Math.min(d, cycle - d);
  }
  function termDateValue(info) {
    if (!info || !info.date) return null;
    const d = info.date;
    return Date.UTC(d.y, d.m - 1, d.d, d.hour || 0, d.min || 0, d.sec || 0);
  }
  function buildAccuracy(chart, context = {}) {
    const input = chart && chart.input ? chart.input : {};
    const solar = chart && chart.solarInfo;
    const precision = context.timePrecision || 'exact';
    const exact = precision === 'exact';
    const correctionMinutes = solar ? Math.round((solar.lonDiff || 0) + (solar.eot || 0)) : 0;
    const corrected = solar ? normalizeClock(solar.totalMin) : normalizeClock((input.hour || 0) * 60 + (input.minute || 0));
    const rawTotal = (input.hour || 0) * 60 + (input.minute || 0);
    const rawZhi = zhiIndexFromMinutes(rawTotal);
    const correctedZhi = zhiIndexFromMinutes(corrected.total);
    const boundaryDistances = [];
    for (let h = 1; h <= 23; h += 2) boundaryDistances.push(circularDistance(corrected.total, h * 60, 1440));
    const boundaryMinutes = Math.min(...boundaryDistances);
    const warnings = [];
    if (!exact) warnings.push('只知道时辰：页面以该时辰中段估算，时柱附近结论应视为候选而非定论。');
    if (context.useTrueSolar && !context.cityConfirmed) warnings.push('出生地尚未确认：真太阳时仍按当前经度计算，建议选择城市或填写经度。');
    if (exact && boundaryMinutes <= 20) warnings.push(`真太阳时距时辰边界约 ${Math.round(boundaryMinutes)} 分钟，建议核对出生记录。`);
    if (exact && rawZhi !== correctedZhi) warnings.push(`真太阳时校正使时辰从「${ZHI[rawZhi]}」移到「${ZHI[correctedZhi]}」，请确认出生地与时区。`);
    if (solar && solar.dayShift) warnings.push('真太阳时跨越了公历日界，日柱按校正后的日期计算。');
    const birthValue = Date.UTC(input.year, (input.month || 1) - 1, input.day || 1, input.hour || 0, input.minute || 0);
    const termValues = [termDateValue(chart.jieInfo && chart.jieInfo.prev), termDateValue(chart.jieInfo && chart.jieInfo.current), termDateValue(chart.jieInfo && chart.jieInfo.next)].filter(Number.isFinite);
    const termMinutes = termValues.length ? Math.min(...termValues.map(v => Math.abs(v - birthValue) / 60000)) : Infinity;
    if (termMinutes <= 120) warnings.push(`出生时刻距离节气切换约 ${Math.round(termMinutes)} 分钟，月柱可能处于流派临界。`);
    let grade = '高';
    let gradeClass = 'high';
    if (!exact || (context.useTrueSolar && !context.cityConfirmed)) { grade = '中'; gradeClass = 'medium'; }
    if (warnings.some(w => /边界|移到|跨越|切换/.test(w))) { grade = '需复核'; gradeClass = 'review'; }
    return {
      version: VERSION,
      grade,
      gradeClass,
      precisionLabel: exact ? '精确到分钟' : '时辰中位估算',
      correctedLabel: formatClock(corrected.hour, corrected.minute),
      correctionMinutes,
      rawZhi: ZHI[rawZhi],
      correctedZhi: ZHI[correctedZhi],
      boundaryMinutes: Math.round(boundaryMinutes),
      termMinutes: Number.isFinite(termMinutes) ? Math.round(termMinutes) : null,
      warnings,
      localOnly: true,
    };
  }

  function currentRun(chart, now = new Date()) {
    const runs = chart && chart.dayun && chart.dayun.runs;
    if (!runs || !runs.length) return null;
    const nowValue = now.getTime();
    let active = null;
    runs.forEach((run, idx) => {
      const start = Date.UTC(run.startYear, (run.startMonth || 1) - 1, run.startDay || 1);
      const next = runs[idx + 1]
        ? Date.UTC(runs[idx + 1].startYear, (runs[idx + 1].startMonth || 1) - 1, runs[idx + 1].startDay || 1)
        : Infinity;
      if (nowValue >= start && nowValue < next) active = run;
    });
    return active;
  }

  function buildInsights(chart, focus = 'overall', now = new Date()) {
    const safeFocus = FOCUS_ACTIONS[focus] ? focus : 'overall';
    const day = chart && chart.dayMaster ? chart.dayMaster : { gan: '—', wuxing: '—', yinyang: '' };
    const useGod = chart && chart.useGod ? chart.useGod : { xi: [], ji: [] };
    const pattern = chart && chart.pattern ? chart.pattern : { gridName: '待定' };
    const strength = chart && chart.strength ? chart.strength : { level: '待定' };
    const year = (chart && chart.liunian || []).find(n => n.isCurrent) || (chart && chart.liunian || [])[0];
    const run = currentRun(chart, now);
    const action = FOCUS_ACTIONS[safeFocus];
    const yearGanWx = year ? GAN_WX[year.gan] : '';
    const yearZhiWx = year ? ZHI_WX[year.zhi] : '';
    const xiHit = year && useGod.xi && (useGod.xi.includes(yearGanWx) || useGod.xi.includes(yearZhiWx));
    const jiHit = year && useGod.ji && (useGod.ji.includes(yearGanWx) || useGod.ji.includes(yearZhiWx));
    const signal = xiHit && !jiHit ? '顺势' : (jiHit && !xiHit ? '审慎' : '平衡');
    const theme = year && year.tenGod ? year.tenGod : '本命结构';
    const evidence = [
      `日主 ${day.gan}${day.wuxing}${day.yinyang || ''}`,
      `${pattern.gridName || '格局待定'} · ${strength.level || '强弱待定'}`,
      useGod.xi && useGod.xi.length ? `喜用 ${useGod.xi.join('、')}` : '喜用待定',
    ];
    const actions = [
      { label: '主线', text: action.lead, evidence: `今年干支五行${yearGanWx || '—'}、${yearZhiWx || '—'}，主题偏向「${theme}」，当前判断为${signal}。` },
      { label: '边界', text: action.caution, evidence: xiHit ? '流年与喜用有交集，仍需以现实信息和风险边界为先。' : (jiHit ? '流年与忌神有交集，适合放慢节奏、保留备选。' : '流年与喜忌交集不明显，适合用小步试错获得反馈。') },
      { label: '习惯', text: action.habit, evidence: '把命理提示转成可观察行为，避免把结构倾向当作确定事件。' },
    ];
    return {
      focus: safeFocus,
      focusLabel: (FOCUS.find(f => f.key === safeFocus) || FOCUS[0]).label,
      headline: `${day.gan}${day.wuxing}日主 · ${pattern.gridName || '格局待定'} · ${strength.level || '强弱待定'}`,
      subhead: year ? `${year.year} · ${year.name} · ${theme}主题 · ${signal}` : '当前流年待定',
      year,
      run,
      evidence,
      actions,
      disclaimer: '这是基于命盘结构的年度观察清单，不是事件预言；请用现实信息验证每一步。',
    };
  }

  function normalizeInput(input) {
    const src = input || {};
    const out = {
      name: String(src.name || '').trim().slice(0, 30),
      gender: src.gender === 'female' ? 'female' : 'male',
      calendar: src.calendar === 'lunar' ? 'lunar' : 'solar',
      year: Number(src.year), month: Number(src.month), day: Number(src.day),
      lunarLeap: Boolean(src.lunarLeap),
      hour: Number(src.hour), minute: Number(src.minute),
      timePrecision: src.timePrecision === 'shichen' ? 'shichen' : 'exact',
      shiIdx: Number.isInteger(Number(src.shiIdx)) ? Number(src.shiIdx) : 8,
      longitude: Number(src.longitude), tz: Number(src.tz),
      useTrueSolar: src.useTrueSolar !== false,
      ziDayRule: src.ziDayRule === 'same' ? 'same' : 'next',
      cityId: String(src.cityId || ''), cityName: String(src.cityName || ''),
      focus: FOCUS_ACTIONS[src.focus] ? src.focus : 'overall',
      lunarLabel: String(src.lunarLabel || '').slice(0, 60),
      shiName: String(src.shiName || '').slice(0, 10),
    };
    if (!Number.isFinite(out.longitude)) out.longitude = 120;
    if (!Number.isFinite(out.tz)) out.tz = 8;
    if (!Number.isFinite(out.hour)) out.hour = 12;
    if (!Number.isFinite(out.minute)) out.minute = 0;
    return out;
  }
  function validProfileInput(input) {
    const p = normalizeInput(input);
    if (p.calendar === 'solar' && !isValidSolarDate(p.year, p.month, p.day)) return false;
    if (p.calendar === 'lunar' && (p.year < 1900 || p.year > 2100 || p.month < 1 || p.month > 12 || p.day < 1 || p.day > 30)) return false;
    return p.hour >= 0 && p.hour <= 23 && p.minute >= 0 && p.minute <= 59
      && p.longitude >= -180 && p.longitude <= 180 && p.tz >= -12 && p.tz <= 14;
  }
  function profileSignature(input) {
    const p = normalizeInput(input);
    return [p.name, p.gender, p.calendar, p.year, p.month, p.day, p.lunarLeap, p.hour, p.minute, p.timePrecision, p.shiIdx, p.longitude, p.tz, p.useTrueSolar, p.ziDayRule].join('|');
  }
  function readProfiles(storage) {
    try {
      const raw = storage && storage.getItem(PROFILE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(p => p && p.input && validProfileInput(p.input)).slice(0, PROFILE_LIMIT) : [];
    } catch (_) { return []; }
  }
  function writeProfiles(storage, list) {
    if (!storage) return false;
    try { storage.setItem(PROFILE_KEY, JSON.stringify(list.slice(0, PROFILE_LIMIT))); return true; } catch (_) { return false; }
  }
  function saveProfile(storage, input, label) {
    const p = normalizeInput(input);
    if (!validProfileInput(p)) return null;
    const list = readProfiles(storage);
    const signature = profileSignature(p);
    const now = new Date().toISOString();
    const found = list.find(item => item.signature === signature);
    const profile = found || { id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: now };
    profile.input = p;
    profile.signature = signature;
    profile.label = String(label || p.name || '未署名命主').trim().slice(0, 30);
    profile.updatedAt = now;
    const next = [profile, ...list.filter(item => item.id !== profile.id)];
    return writeProfiles(storage, next) ? profile : null;
  }
  function removeProfile(storage, id) {
    const list = readProfiles(storage).filter(item => item.id !== id);
    return writeProfiles(storage, list);
  }
  function clearProfiles(storage) { return writeProfiles(storage, []); }
  function shareText(chart, insights) {
    if (!chart || !chart.pillars) return '';
    const p = chart.pillars;
    const lines = [
      '天枢 · 命盘速览',
      `四柱：${p.year.name} ${p.month.name} ${p.day.name} ${p.hour.name}`,
      insights ? insights.headline : '',
      insights ? insights.subhead : '',
      insights && insights.actions[0] ? `主线：${insights.actions[0].text}` : '',
      '本地计算 · 传统文化参考，不作确定性预言',
    ];
    return lines.filter(Boolean).join('\n');
  }

  return {
    VERSION, PROFILE_KEY, CITIES, FOCUS,
    escapeHtml, isValidSolarDate, parseTime, zhiIndexFromMinutes, formatClock,
    buildAccuracy, buildInsights, normalizeInput, validProfileInput, profileSignature,
    readProfiles, saveProfile, removeProfile, clearProfiles, shareText,
  };
});
