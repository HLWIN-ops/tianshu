/* ============================================================
 * 八字排盘 扩展引擎  engine-plus
 * 在 CC-opus engine.js 之上扩展：
 *   - 五行加权统计（藏干 本/中/余 加权）
 *   - 空亡（旬空）
 *   - 神煞（天乙/文昌/桃花/驿马/华盖/天医/太极/禄/羊刃）
 *   - 冲刑破害合会（地支关系）
 *   - 日主旺衰（月令旺相休囚死 + 生扶克泄耗）
 *   - 格局判定（八格 + 组合格局）
 *   - 喜用神 / 忌神
 *   - 流年（逐年干支 + 十神 + 与日支关系）
 *   - 农历 <-> 公历 转换（1900-2100，标准农历表）
 * ------------------------------------------------------------
 * 兼容浏览器（经典 script，挂载到 Bazi.plus）与 Node（module.exports）。
 * ============================================================ */
(function () {
  'use strict';

  let BaziRef;
  if (typeof module !== 'undefined' && module.exports) {
    BaziRef = require('./engine.js');
  } else {
    BaziRef = Bazi; // 浏览器：引擎在 engine.js 顶层 const，作为全局词法绑定可直接引用
  }
  const C = BaziRef.constants;
  const TIANGAN = C.TIANGAN;
  const DIZHI = C.DIZHI;
  const GAN_WUXING = C.GAN_WUXING;
  const ZHI_WUXING = C.ZHI_WUXING;
  const GAN_YINYANG = C.GAN_YINYANG;
  const ZHI_YINYANG = C.ZHI_YINYANG;
  const ZHI_CANGGAN = C.ZHI_CANGGAN;
  const tenGod = BaziRef.util.tenGod;

  // 五行生克（本文件内备用）
  const WX = ['木', '火', '土', '金', '水'];
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
  const KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };     // 我克
  const SHENG_WO = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' }; // 生我
  const KE_WO = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };   // 克我
  const woKe = (wx) => KE[wx];   // 我克
  const woSheng = (wx) => SHENG[wx]; // 我生

  /* ============== 1. 五行加权统计 ============== */
  // 天干 +1.0；地支本气 +1.0，中气 +0.5，余气 +0.3（参照 HY3 权重思路）。
  function countWuxingWeighted(pillars) {
    const count = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    const list = [pillars.year, pillars.month, pillars.day, pillars.hour];
    const weights = [1.0, 0.5, 0.3];
    for (const p of list) {
      // 天干
      count[GAN_WUXING[p.gan]] += 1.0;
      // 藏干
      const cang = ZHI_CANGGAN[p.zhi];
      for (let i = 0; i < cang.length; i++) {
        const gi = TIANGAN.indexOf(cang[i]);
        count[GAN_WUXING[gi]] += weights[i];
      }
    }
    return count;
  }

  /* ============== 2. 空亡（旬空） ============== */
  // 60甲子分六旬；返回该旬空缺的两个地支名。
  function kongwang(ganZhiIdx) {
    const xun = Math.floor(((ganZhiIdx % 60) + 60) % 60 / 10); // 0-5
    const startZhi = [0, 10, 8, 6, 4, 2][xun]; // 甲子,甲戌,甲申,甲午,甲辰,甲寅
    const k1 = (startZhi + 10) % 12;
    const k2 = (startZhi + 11) % 12;
    return [DIZHI[k1], DIZHI[k2]];
  }
  // 以日柱为基（命理最常用），并标注四柱地支是否“落空亡”。
  function dayKongwang(result) {
    const idx = result.pillars.day.index;
    const kw = kongwang(idx);
    const pillars = ['年', '月', '日', '时'];
    const keys = ['year', 'month', 'day', 'hour'];
    const fallen = [];
    result.pillars && keys.forEach((k, i) => {
      const z = DIZHI[result.pillars[k].zhi];
      if (kw.includes(z)) fallen.push(pillars[i] + '柱' + z + '空');
    });
    return { zhi: kw, fallen };
  }

  /* ============== 3. 神煞 ============== */
  // 各神煞依据：日干 / 年支 / 日支 / 月支 查表，命中四柱地支则记录。
  // 返回 [{name, zhi, pillar}]，pillar 为 年/月/日/时。
  function findShenSha(result) {
    const dayGan = result.pillars.day.gan;
    const dayGanName = TIANGAN[dayGan];
    const yearZhi = result.pillars.year.zhiName;
    const monthZhi = result.pillars.month.zhiName;
    const dayZhi = result.pillars.day.zhiName;
    const hourZhi = result.pillars.hour.zhiName;
    const all = [yearZhi, monthZhi, dayZhi, hourZhi];
    const pillarNames = ['年', '月', '日', '时'];

    // 查某神煞（给定目标地支列表）在所驻地支与哪个宫位匹配
    function match(name, targetZhiList) {
      const out = [];
      targetZhiList.forEach(zh => {
        const idx = all.indexOf(zh);
        if (idx >= 0) out.push({ name, zhi: zh, pillar: pillarNames[idx] });
      });
      return out;
    }

    const res = [];
    // 天乙贵人（日干）
    const ty = {
      甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
      乙: ['子', '申'], 己: ['子', '申'],
      丙: ['亥', '酉'], 丁: ['亥', '酉'],
      壬: ['卯', '巳'], 癸: ['卯', '巳'],
      辛: ['寅', '午'],
    }[dayGanName] || [];
    res.push(...match('天乙贵人', ty));

    // 文昌（日干）
    const wc = {
      甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉',
      庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
    }[dayGanName];
    if (wc) res.push(...match('文昌', [wc]));

    // 太极贵人（日干）
    const taiji = {
      甲: ['子', '午'], 乙: ['子', '午'],
      丙: ['卯', '酉'], 丁: ['卯', '酉'],
      戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
      庚: ['寅', '亥'], 辛: ['寅', '亥'],
      壬: ['巳', '申'], 癸: ['巳', '申'],
    }[dayGanName] || [];
    res.push(...match('太极贵人', taiji));

    // 桃花/咸池（年支或日支）
    const taohuaMap = {
      申: '酉', 子: '酉', 辰: '酉',
      寅: '卯', 午: '卯', 戌: '卯',
      亥: '子', 卯: '子', 未: '子',
      巳: '午', 酉: '午', 丑: '午',
    };
    res.push(...match('桃花', [taohuaMap[yearZhi], taohuaMap[dayZhi]]));

    // 驿马（年支或日支）
    const yimaMap = {
      申: '寅', 子: '寅', 辰: '寅',
      寅: '申', 午: '申', 戌: '申',
      亥: '巳', 卯: '巳', 未: '巳',
      巳: '亥', 酉: '亥', 丑: '亥',
    };
    res.push(...match('驿马', [yimaMap[yearZhi], yimaMap[dayZhi]]));

    // 华盖（年支或日支）
    const huagaiMap = {
      寅: '戌', 午: '戌', 戌: '戌',
      申: '辰', 子: '辰', 辰: '辰',
      巳: '丑', 酉: '丑', 丑: '丑',
      亥: '未', 卯: '未', 未: '未',
    };
    res.push(...match('华盖', [huagaiMap[yearZhi], huagaiMap[dayZhi]]));

    // 天医（月支前一位地支）
    const tianyiMap = ['丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子'];
    res.push(...match('天医', [tianyiMap[monthZhi]]));

    // 禄神（日干临官地支）
    const luMap = {
      甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午',
      庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
    };
    if (luMap[dayGanName]) res.push(...match('禄神', [luMap[dayGanName]]));

    // 羊刃（日干禄后一位）
    const yangMap = {
      甲: '卯', 乙: '辰', 丙: '午', 戊: '午', 丁: '未', 己: '未',
      庚: '酉', 辛: '戌', 壬: '子', 癸: '丑',
    };
    if (yangMap[dayGanName]) res.push(...match('羊刃', [yangMap[dayGanName]]));

    return res;
  }

  /* ============== 4. 地支关系（冲刑破害合会） ============== */
  const CHONG = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
  const LIUHE = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
  const SANHE = [['申', '子', '辰'], ['亥', '卯', '未'], ['寅', '午', '戌'], ['巳', '酉', '丑']];
  const SANHUI = [['寅', '卯', '辰'], ['巳', '午', '未'], ['申', '酉', '戌'], ['亥', '子', '丑']];
  const SANXING = [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯'], ['辰', '午', '酉', '亥']];
  const LIUHAI = [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']];
  const LIUPO = [['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']];

  function hasPair(a, b, groups) {
    return groups.some(g => g.includes(a) && g.includes(b));
  }
  function inGroup(a, b, groups) {
    return groups.find(g => g.includes(a) && g.includes(b));
  }
  // 返回两个地支之间的关系数组（可能多项）
  function relations(a, b) {
    const out = [];
    if (a === b) return out;
    if (hasPair(a, b, CHONG)) out.push('冲');
    if (hasPair(a, b, LIUHE)) out.push('合');
    if (inGroup(a, b, SANHE)) out.push('三合');
    if (inGroup(a, b, SANHUI)) out.push('三会');
    if (inGroup(a, b, SANXING)) out.push('刑');
    if (hasPair(a, b, LIUHAI)) out.push('害');
    if (hasPair(a, b, LIUPO)) out.push('破');
    return out;
  }
  // 四柱地支两两关系
  function pillarRelations(result) {
    const keys = ['year', 'month', 'day', 'hour'];
    const pillars = ['年', '月', '日', '时'];
    const zhis = keys.map(k => DIZHI[result.pillars[k].zhi]);
    const out = [];
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const rel = relations(zhis[i], zhis[j]);
        if (rel.length) out.push({ a: pillars[i], b: pillars[j], az: zhis[i], bz: zhis[j], type: rel });
      }
    }
    return out;
  }

  /* ============== 5. 日主旺衰 ============== */
  // 月令旺相休囚死：以月支五行(M)为令。
  function monthState(dayWx, monthWx) {
    if (dayWx === monthWx) return { name: '旺', val: 5 };
    if (SHENG[monthWx] === dayWx) return { name: '相', val: 3 };
    if (SHENG_WO[monthWx] === dayWx) return { name: '休', val: 1 };
    if (KE[monthWx] === dayWx) return { name: '囚', val: -1 };
    if (KE_WO[monthWx] === dayWx) return { name: '死', val: -2 };
    return { name: '中', val: 0 };
  }
  function dayMasterStrength(result) {
    const dayGan = result.pillars.day.gan;
    const dayWx = GAN_WUXING[dayGan];
    const monthWx = ZHI_WUXING[result.pillars.month.zhi];
    const w = countWuxingWeighted(result.pillars);
    const state = monthState(dayWx, monthWx);
    const support = (w[dayWx] || 0) + (w[SHENG_WO[dayWx]] || 0); // 同我 + 生我
    const drain = (w[woSheng(dayWx)] || 0) + (w[KE_WO[dayWx]] || 0) + (w[woKe(dayWx)] || 0);
    const denom = support + drain;
    const ratio = denom > 0 ? support / denom : 0;
    // 综合：月令(归一 -2..5 -> 0..1) 与 生扶比 各半
    const composite = 0.5 * (state.val + 2) / 7 + 0.5 * ratio;
    let level;
    if (composite >= 0.62) level = '身强';
    else if (composite <= 0.38) level = '身弱';
    else level = '中和';
    const cong = ratio < 0.12 || (ratio > 0.92 && state.name === '旺'); // 疑似从格/专旺
    let note = '';
    if (level === '身强') note = '印比有力，自身气盛，宜克、泄、耗。';
    else if (level === '身弱') note = '财官食伤偏重，自身气弱，宜生、扶。';
    else note = '日主中和，进退有度，宜顺势而为。';
    if (cong) note += '命局五行极端，疑似从格（专旺或从弱），须特殊取用。';
    return {
      state: state.name, monthWx, ratio: +ratio.toFixed(2),
      composite: +composite.toFixed(2), level, cong, note,
      support: +support.toFixed(1), drain: +drain.toFixed(1),
    };
  }

  /* ============== 6. 格局判定 ============== */
  function getPattern(result) {
    const dayGan = result.pillars.day.gan;
    const monthZhi = result.pillars.month.zhi;
    const allGan = [result.pillars.year.gan, result.pillars.month.gan, result.pillars.day.gan, result.pillars.hour.gan];
    // 月支藏干十神
    const monthCang = ZHI_CANGGAN[monthZhi];
    const monthShenList = monthCang.map(g => tenGod(dayGan, TIANGAN.indexOf(g)));
    // 四柱天干透出十神
    const TianShen = allGan.map(g => tenGod(dayGan, g)).filter(s => s && s !== '比肩' && s !== '劫财');
    // 取格：月支藏干中，若其十神透出天干，则取之；否则取本气十神。
    let primary = null;
    for (const shen of monthShenList) {
      if (TianShen.includes(shen)) { primary = shen; break; }
    }
    if (!primary) primary = monthShenList[0]; // 本气

    // 禄刃格
    const luMap = { 甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
    const yangMap = { 甲: '卯', 乙: '辰', 丙: '午', 戊: '午', 丁: '未', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
    let gridName;
    if (luMap[TIANGAN[dayGan]] === DIZHI[monthZhi]) gridName = '建禄格';
    else if (yangMap[TIANGAN[dayGan]] === DIZHI[monthZhi]) gridName = '羊刃格';
    else {
      const map = {
        '正官': '正官格', '七杀': '七杀格', '正财': '正财格', '偏财': '偏财格',
        '食神': '食神格', '伤官': '伤官格', '正印': '正印格', '偏印': '偏印格',
        '比肩': '比肩格', '劫财': '劫财格',
      };
      gridName = map[primary] || (primary + '格');
    }

    // 组合格局
    const has = (s) => TianShen.includes(s);
    const combos = [];
    if (has('食神') && has('七杀')) combos.push('食神制杀');
    if (has('伤官') && has('七杀')) combos.push('伤官制杀');
    if (has('七杀') && (has('正印') || has('偏印'))) combos.push('杀印相生');
    if (has('伤官') && (has('正财') || has('偏财'))) combos.push('伤官生财');
    if (has('食神') && (has('正财') || has('偏财'))) combos.push('食神生财');
    if (has('正官') && (has('正财') || has('偏财'))) combos.push('财官相生');
    if (has('正官') && (has('正印') || has('偏印'))) combos.push('官印相生');
    if (has('正印') && has('比肩')) combos.push('印比护身');

    return { primary, gridName, combos, tianShen: TianShen };
  }

  /* ============== 7. 喜用神 ============== */
  function useGod(result, strength, pattern) {
    const dayWx = GAN_WUXING[result.pillars.day.gan];
    const L = strength.level;
    let xi, ji;
    if (L === '身强') {
      xi = [KE_WO[dayWx], woSheng(dayWx), woKe(dayWx)]; // 克、泄、耗
      ji = [SHENG_WO[dayWx], dayWx];
    } else if (L === '身弱') {
      xi = [SHENG_WO[dayWx], dayWx]; // 生、扶
      ji = [KE_WO[dayWx], woSheng(dayWx), woKe(dayWx)];
    } else {
      xi = [SHENG_WO[dayWx], dayWx, KE_WO[dayWx]];
      ji = [woSheng(dayWx), woKe(dayWx)];
    }
    xi = uniq(xi); ji = uniq(ji);
    return { xi, ji, dayWx };
  }
  function uniq(arr) { return [...new Set(arr)]; }

  /* ============== 8. 流年 ============== */
  // fromYear 起算 count 年；currentYear 标“今年”。
  function liuNian(result, fromYear, count, currentYear) {
    const dayGan = result.pillars.day.gan;
    const dayZhi = DIZHI[result.pillars.day.zhi];
    const out = [];
    const fy = Math.round(fromYear);
    for (let i = 0; i < count; i++) {
      const y = fy + i;
      const ganIdx = ((y - 4) % 10 + 10) % 10;
      const zhiIdx = ((y - 4) % 12 + 12) % 12;
      const zhi = DIZHI[zhiIdx];
      out.push({
        year: y,
        gan: TIANGAN[ganIdx],
        zhi,
        name: TIANGAN[ganIdx] + zhi,
        tenGod: tenGod(dayGan, ganIdx),
        zhiTenGod: tenGod(dayGan, TIANGAN.indexOf(ZHI_CANGGAN[zhiIdx][0])),
        relWithDayZhi: relations(zhi, dayZhi),
        isCurrent: (currentYear && y === currentYear),
      });
    }
    return out;
  }

  /* ============== 9. 农历 <-> 公历 转换（1900-2100） ============== */
  // 标准农历数据表（每一年一个十六进制数，编码闰月与大小月）。
  const lunarInfo = [
    0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, //1900-1909
    0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, //1910-1919
    0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, //1920-1929
    0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, //1930-1939
    0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, //1940-1949
    0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, //1950-1959
    0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, //1960-1969
    0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, //1970-1979
    0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, //1980-1989
    0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0, //1990-1999
    0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, //2000-2009
    0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, //2010-2019
    0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, //2020-2029
    0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, //2030-2039
    0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, //2040-2049
    0x14b63, 0x09370, 0x049f8, 0x04970, 0x064b0, 0x168a6, 0x0ea50, 0x06b20, 0x1a6c4, 0x0aae0, //2050-2059
    0x0a2e0, 0x0d2e3, 0x0c960, 0x0d557, 0x0d4a0, 0x0da50, 0x05d55, 0x056a0, 0x0a6d0, 0x055d4, //2060-2069
    0x052d0, 0x0a9b8, 0x0a950, 0x0b4a0, 0x0b6a6, 0x0ad50, 0x055a0, 0x0aba4, 0x0a5b0, 0x052b0, //2070-2079
    0x0b273, 0x06930, 0x07337, 0x06aa0, 0x0ad50, 0x14b55, 0x04b60, 0x0a570, 0x054e4, 0x0d160, //2080-2089
    0x0e968, 0x0d520, 0x0daa0, 0x16aa6, 0x056d0, 0x04ae0, 0x0a9d4, 0x0a2d0, 0x0d150, 0x0f250, //2090-2099
    0x0d520 //2100
  ];
  const GanCn = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const nStr1 = ["日", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const Animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];

  function lYearDays(y) { let s = leapDays(y); for (let i = 0x8000; i > 0x8; i >>= 1) s += (lunarInfo[y - 1900] & i) ? 30 : 29; return s; }
  function leapMonth(y) { return lunarInfo[y - 1900] & 0xf; }
  function leapDays(y) { if (leapMonth(y)) return (lunarInfo[y - 1900] & 0x10000) ? 30 : 29; return 0; }
  function monthDays(y, m) { return (lunarInfo[y - 1900] & (0x10000 >> m)) ? 30 : 29; }

  // 农历(y,m,d, isLeap) -> 公历 {y,m,d}
  function lunarToSolar(ly, lm, ld, isLeap) {
    let leap = leapMonth(ly);
    let offset = 0;
    for (let i = 1900; i < ly; i++) offset += lYearDays(i);
    for (let m = 1; m < lm; m++) {
      offset += monthDays(ly, m);
      if (leap && m === leap && !isLeap) offset += leapDays(ly);
    }
    if (isLeap && leap !== lm) return null; // 该年无此闰月
    if (isLeap) offset += monthDays(ly, lm); // 进入闰月：先加本月常规天数
    if (ld > monthDays(ly, lm) + (isLeap && leap === lm ? leapDays(ly) : 0)) return null;
    offset += ld - 1;
    // 基准 1900-01-31(UTC) 为农历1900正月初一
    const base = Date.UTC(1900, 0, 31);
    const d = new Date(base + offset * 86400000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }

  // 公历(y,m,d) -> 农历 {year, month, day, isLeap, animal, yearGanZhi}
  function solarToLunar(y, m, d) {
    const base = Date.UTC(1900, 0, 31);
    const obj = Date.UTC(y, m - 1, d);
    let offset = Math.round((obj - base) / 86400000);
    let ly = 1900;
    while (ly < 2100) {
      const days = lYearDays(ly);
      if (offset < days) break;
      offset -= days;
      ly++;
    }
    const leap = leapMonth(ly);
    let isLeap = false;
    let month = 1;
    for (; month <= 12; month++) {
      const md = monthDays(ly, month);
      if (offset < md) break;
      offset -= md;
      if (leap && month === leap) {
        const lmd = leapDays(ly);
        if (offset < lmd) { isLeap = true; break; }
        offset -= lmd;
      }
    }
    if (month > 12) { month = 12; offset = monthDays(ly, 12) - 1; }
    const day = offset + 1;
    return {
      year: ly, month, day, isLeap,
      animal: Animals[(ly - 4) % 12],
      yearGanZhi: GanCn[(ly - 4) % 10] + DIZHI[(ly - 4) % 12],
    };
  }

  /* ============== 总排盘（一站式结果） ============== */
  // 在 engine.chart() 基础上补全：加权五行、空亡、神煞、关系、旺衰、格局、喜用、流年。
  function fullChart(opts) {
    const r = BaziRef.chart(opts);
    const currentYear = opts.currentYear || (new Date().getFullYear());
    r.wuxingWeighted = countWuxingWeighted(r.pillars);
    r.kongwang = dayKongwang(r);
    r.shensha = findShenSha(r);
    r.relations = pillarRelations(r);
    r.strength = dayMasterStrength(r);
    r.pattern = getPattern(r);
    r.useGod = useGod(r, r.strength, r.pattern);
    // 补全大运每步五行（引擎 calcDayun 只给了 gan/zhi 序号，未附五行）
    r.dayun.runs.forEach(step => {
      step.ganWuxing = GAN_WUXING[step.gan];
      step.zhiWuxing = ZHI_WUXING[step.zhi];
    });
    // 流年：从起运岁那年起到当前年+12
    const fromYear = opts.year + r.dayun.startAge;
    const toCurrent = Math.max(0, currentYear - fromYear);
    const count = Math.min(120, Math.max(12, toCurrent + 12));
    r.liunian = liuNian(r, fromYear, count, currentYear);
    r._currentYear = currentYear;
    return r;
  }

  /* ============== API 暴露 ============== */
  const API = {
    countWuxingWeighted, kongwang, dayKongwang,
    findShenSha, relations, pillarRelations,
    monthState, dayMasterStrength, getPattern, useGod,
    liuNian, fullChart,
    lunarToSolar, solarToLunar, lunarInfo,
    lYearDays, leapMonth, leapDays, monthDays,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    Bazi.plus = API;
  }
})();
