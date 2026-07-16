/* ============================================================
 * 八字排盘核心引擎  bazi engine
 * 纯前端、无依赖。所有计算基于天文算法（儒略日 + 太阳黄经）。
 * ------------------------------------------------------------
 * 主要能力：
 *   - 儒略日 (JDN) 与公历互转
 *   - 太阳视黄经 -> 二十四节气精确时刻
 *   - 真太阳时校正（经度时差 + 均时差）
 *   - 年/月/日/时 四柱干支
 *   - 五行、十神、地支藏干、纳音
 *   - 起运与大运排列
 * ============================================================ */

const Bazi = (() => {
  'use strict';

  // ---------- 基础常量 ----------
  const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  // 天干五行 / 阴阳
  const GAN_WUXING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
  const GAN_YINYANG = ['阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴'];

  // 地支五行
  const ZHI_WUXING = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
  const ZHI_YINYANG = ['阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴'];

  // 地支藏干（本气、中气、余气）。索引对应 DIZHI。
  const ZHI_CANGGAN = [
    ['癸'],                // 子
    ['己', '癸', '辛'],    // 丑
    ['甲', '丙', '戊'],    // 寅
    ['乙'],                // 卯
    ['戊', '乙', '癸'],    // 辰
    ['丙', '庚', '戊'],    // 巳
    ['丁', '己'],          // 午
    ['己', '丁', '乙'],    // 未
    ['庚', '壬', '戊'],    // 申
    ['辛'],                // 酉
    ['戊', '辛', '丁'],    // 戌
    ['壬', '甲'],          // 亥
  ];

  // 五行生克关系
  const WUXING = ['木', '火', '土', '金', '水'];
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
  const KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };     // 我克

  // 六十甲子纳音
  const NAYIN = [
    '海中金', '海中金', '炉中火', '炉中火', '大林木', '大林木',
    '路旁土', '路旁土', '剑锋金', '剑锋金', '山头火', '山头火',
    '涧下水', '涧下水', '城头土', '城头土', '白蜡金', '白蜡金',
    '杨柳木', '杨柳木', '泉中水', '泉中水', '屋上土', '屋上土',
    '霹雳火', '霹雳火', '松柏木', '松柏木', '长流水', '长流水',
    '砂中金', '砂中金', '山下火', '山下火', '平地木', '平地木',
    '壁上土', '壁上土', '金箔金', '金箔金', '覆灯火', '覆灯火',
    '天河水', '天河水', '大驿土', '大驿土', '钗钏金', '钗钏金',
    '桑柘木', '桑柘木', '大溪水', '大溪水', '砂中土', '砂中土',
    '天上火', '天上火', '石榴木', '石榴木', '大海水', '大海水',
  ];

  // 二十四节气名（从春分 0° 起，每 15° 一个；这里按黄经排序）
  const JIEQI_NAMES = [
    '春分', '清明', '谷雨', '立夏', '小满', '芒种',
    '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
    '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
    '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
  ];

  // 十二节（划分月柱的“节”，非“气”）对应的太阳黄经度数
  // 立春315 惊蛰345 清明15 立夏45 芒种75 小暑105 立秋135 白露165 寒露195 立冬225 大雪255 小寒285
  // 月支：寅卯辰巳午未申酉戌亥子丑
  const MONTH_JIE = [
    { deg: 315, zhi: 2 },  // 立春 -> 寅月
    { deg: 345, zhi: 3 },  // 惊蛰 -> 卯月
    { deg: 15, zhi: 4 },   // 清明 -> 辰月
    { deg: 45, zhi: 5 },   // 立夏 -> 巳月
    { deg: 75, zhi: 6 },   // 芒种 -> 午月
    { deg: 105, zhi: 7 },  // 小暑 -> 未月
    { deg: 135, zhi: 8 },  // 立秋 -> 申月
    { deg: 165, zhi: 9 },  // 白露 -> 酉月
    { deg: 195, zhi: 10 }, // 寒露 -> 戌月
    { deg: 225, zhi: 11 }, // 立冬 -> 亥月
    { deg: 255, zhi: 0 },  // 大雪 -> 子月
    { deg: 285, zhi: 1 },  // 小寒 -> 丑月
  ];

  // ---------- 儒略日 ----------
  // 公历日期(UTC) -> 儒略日
  function toJulianDay(y, m, d, hour = 0, min = 0, sec = 0) {
    if (m <= 2) { y -= 1; m += 12; }
    const a = Math.floor(y / 100);
    const b = 2 - a + Math.floor(a / 4);
    const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1))
      + d + b - 1524.5;
    return jd + (hour + min / 60 + sec / 3600) / 24;
  }

  // 儒略日 -> 公历 {y,m,d,hour,min,sec}
  function fromJulianDay(jd) {
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let a = z;
    if (z >= 2299161) {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const day = b - d - Math.floor(30.6001 * e) + f;
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    const dayInt = Math.floor(day);
    const frac = day - dayInt;
    const totalSec = Math.round(frac * 86400);
    const hour = Math.floor(totalSec / 3600);
    const min = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    return { y: year, m: month, d: dayInt, hour, min, sec };
  }

  // ---------- 太阳视黄经 ----------
  // 输入儒略日(TD)，返回太阳视黄经（度，0-360）。低精度算法，精度约 0.01°。
  function solarLongitude(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    // 几何平黄经
    let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    // 平近点角
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const Mr = deg2rad(M);
    // 中心差
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr)
      + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr)
      + 0.000289 * Math.sin(3 * Mr);
    let trueLong = L0 + C;
    // 章动与光行差修正 -> 视黄经
    const omega = 125.04 - 1934.136 * T;
    const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(deg2rad(omega));
    return mod360(lambda);
  }

  function deg2rad(d) { return d * Math.PI / 180; }
  function mod360(x) { return ((x % 360) + 360) % 360; }

  // 求某目标黄经对应的儒略日（在给定年份附近）。用二分/牛顿逼近。
  // targetDeg: 目标黄经；approxJd: 起始猜测
  function solarTermJd(targetDeg, approxJd) {
    let jd = approxJd;
    for (let i = 0; i < 12; i++) {
      const lon = solarLongitude(jd);
      let diff = targetDeg - lon;
      // 处理跨 0/360
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      // 太阳每日约走 0.9856°
      jd += diff / 0.98565;
    }
    return jd; // TD ≈ UTC（忽略 ΔT，量级几十秒，对排盘无影响）
  }

  // 求某公历年内所有 12 个“节”的精确时刻（本地时间的儒略日）。
  // tzOffsetHours: 时区偏移（东八区为 8）
  function getMonthJieForYear(year, tzOffsetHours) {
    const result = [];
    for (const jie of MONTH_JIE) {
      // 估算该节气所在的大致日期：黄经每 15° 对应约半个月
      // 用一个粗略起点：该年年初 + (deg 相对春分的天数)
      // 更稳妥：直接给一个接近的儒略日猜测再迭代
      const approx = approxJdForDegInYear(jie.deg, year, tzOffsetHours);
      let jdUTC = solarTermJd(jie.deg, approx);
      result.push({
        deg: jie.deg,
        zhi: jie.zhi,
        jdLocal: jdUTC + tzOffsetHours / 24,
      });
    }
    // 按时间排序
    result.sort((a, b) => a.jdLocal - b.jdLocal);
    return result;
  }

  // 给定黄经度数与年份，估算一个接近的 UTC 儒略日作为迭代起点。
  function approxJdForDegInYear(deg, year, tzOffsetHours) {
    // 春分约在 3/20。黄经0°=3/20。每15°约+15.2天。
    // deg 从 0(春分) 起算天数
    const daysFromEquinox = (deg / 360) * 365.2422;
    const equinoxJd = toJulianDay(year, 3, 20, 12, 0, 0);
    let jd = equinoxJd + daysFromEquinox;
    // 若结果落到下一年而我们想要本年初的小寒/大寒等，做一次回绕修正在调用层处理
    return jd;
  }

  // ---------- 干支序号 ----------
  // 日柱：以儒略日整数推六十甲子。
  // 标定：2000-01-01 (JDN 2451545) = 戊午(54)；等价 (jdn + 49) % 60。
  // 注意：旧说「1984-02-02 为甲子」有误，该日实为丙寅(2)。
  function ganzhiIndexFromJDN(jdnInt) {
    let idx = (jdnInt + 49) % 60;
    if (idx < 0) idx += 60;
    return idx;
  }

  function jiazi(idx) {
    idx = ((idx % 60) + 60) % 60;
    return {
      index: idx,
      gan: idx % 10,
      zhi: idx % 12,
      ganName: TIANGAN[idx % 10],
      zhiName: DIZHI[idx % 12],
      name: TIANGAN[idx % 10] + DIZHI[idx % 12],
      nayin: NAYIN[idx],
    };
  }

  // ---------- 十神 ----------
  // 以日主(日干)为“我”，判断某天干相对日主的十神。
  function tenGod(dayGanIdx, targetGanIdx) {
    const meWx = GAN_WUXING[dayGanIdx];
    const meYy = GAN_YINYANG[dayGanIdx];
    const tWx = GAN_WUXING[targetGanIdx];
    const tYy = GAN_YINYANG[targetGanIdx];
    const same = meYy === tYy; // 同性
    if (tWx === meWx) {
      return same ? '比肩' : '劫财';
    }
    if (SHENG[meWx] === tWx) { // 我生 -> 食伤
      return same ? '食神' : '伤官';
    }
    if (KE[meWx] === tWx) { // 我克 -> 财
      return same ? '偏财' : '正财';
    }
    if (KE[tWx] === meWx) { // 克我 -> 官杀
      return same ? '七杀' : '正官';
    }
    if (SHENG[tWx] === meWx) { // 生我 -> 印
      return same ? '偏印' : '正印';
    }
    return '';
  }

  // 地支主气（本气）的十神
  function tenGodOfZhi(dayGanIdx, zhiIdx) {
    const mainGan = ZHI_CANGGAN[zhiIdx][0];
    const gi = TIANGAN.indexOf(mainGan);
    return tenGod(dayGanIdx, gi);
  }

  // ---------- 真太阳时 ----------
  // 均时差（分钟）：视太阳时 - 平太阳时。低精度公式。
  function equationOfTime(jd) {
    const T = (jd - 2451545.0) / 36525.0;
    const epsilon = deg2rad(23.4392911 - 0.0130042 * T);
    const L0 = deg2rad(mod360(280.46646 + 36000.76983 * T));
    const e = 0.016708634 - 0.000042037 * T;
    const M = deg2rad(357.52911 + 35999.05029 * T);
    const y = Math.tan(epsilon / 2) ** 2;
    const Etime = y * Math.sin(2 * L0)
      - 2 * e * Math.sin(M)
      + 4 * e * y * Math.sin(M) * Math.cos(2 * L0)
      - 0.5 * y * y * Math.sin(4 * L0)
      - 1.25 * e * e * Math.sin(2 * M);
    return Etime * 4 * 180 / Math.PI; // 弧度->分钟
  }

  // 计算真太阳时。
  // 输入：本地钟表时间(标准时区)，经度longitude(东经为正)，标准时区经度(如东八120°)
  // 返回：真太阳时的 {hour,min,...} 及总分钟数
  function trueSolarTime(y, mo, d, hh, mm, longitude, stdMeridian) {
    // 该时刻的 UTC 儒略日（用标准时区推 UTC 只为算均时差，误差可忽略）
    const jdApprox = toJulianDay(y, mo, d, hh, mm) - stdMeridian / 15 / 24;
    const eot = equationOfTime(jdApprox); // 分钟
    // 经度时差：每偏离标准经线1°，差4分钟
    const lonDiff = (longitude - stdMeridian) * 4; // 分钟
    const totalMin = hh * 60 + mm + lonDiff + eot;
    return { totalMin, eot, lonDiff };
  }

  // ---------- 时柱 ----------
  // 时支：由真太阳时的小时决定（23-1子，1-3丑…）
  function hourZhiFromMinutes(totalMin) {
    // 归一化到 0-1440
    let m = ((totalMin % 1440) + 1440) % 1440;
    const h = m / 60;
    // 子时 23:00-01:00
    // 每两小时一个时辰，从23点开始
    let idx = Math.floor((h + 1) / 2) % 12;
    return idx;
  }

  // 五鼠遁：由日干推子时天干起点
  // 甲己->甲子, 乙庚->丙子, 丙辛->戊子, 丁壬->庚子, 戊癸->壬子
  function hourGanZhi(dayGanIdx, hourZhiIdx) {
    const startGan = [(0), (2), (4), (6), (8)][dayGanIdx % 5]; // 甲丙戊庚壬
    const ganIdx = (startGan + hourZhiIdx) % 10;
    // 组合成六十甲子序号
    const idx = ganzhiFromGanZhi(ganIdx, hourZhiIdx);
    return jiazi(idx);
  }

  // 由天干序号与地支序号还原六十甲子序号
  function ganzhiFromGanZhi(ganIdx, zhiIdx) {
    for (let i = 0; i < 60; i++) {
      if (i % 10 === ganIdx && i % 12 === zhiIdx) return i;
    }
    return 0;
  }

  // 月柱天干（五虎遁）：由年干推寅月天干
  // 甲己->丙寅, 乙庚->戊寅, 丙辛->庚寅, 丁壬->壬寅, 戊癸->甲寅
  function monthGanZhi(yearGanIdx, monthZhiIdx) {
    const startGan = [(2), (4), (6), (8), (0)][yearGanIdx % 5]; // 丙戊庚壬甲
    // 寅=2 为该年正月起点，monthZhiIdx 相对寅的偏移
    let offset = (monthZhiIdx - 2 + 12) % 12;
    const ganIdx = (startGan + offset) % 10;
    const idx = ganzhiFromGanZhi(ganIdx, monthZhiIdx);
    return jiazi(idx);
  }

  // ---------- 主排盘函数 ----------
  /**
   * @param {Object} opts
   *   year,month,day,hour,minute : 公历（钟表本地时间）
   *   gender: 'male' | 'female'
   *   longitude: 出生地经度（东经正，默认120）
   *   tz: 时区偏移小时（默认8）
   *   useTrueSolar: 是否使用真太阳时（默认true）
   *   ziDayRule: 'next' | 'same'
   *     - 'next'（默认，晚子时）：有效时点 ≥23:00 时，日柱用次日
   *     - 'same'（子时属当日）：23:00–00:59 子时皆用当日日柱
   */
  function chart(opts) {
    const {
      year, month, day, hour, minute = 0,
      gender = 'male',
      longitude = 120,
      tz = 8,
      useTrueSolar = true,
      ziDayRule = 'next',
    } = opts;

    const leapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const monthLength = [31, leapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)
      || year < -9999 || year > 9999 || month < 1 || month > 12
      || day < 1 || day > monthLength[month - 1]) {
      throw new RangeError('出生日期不合法');
    }
    if (!Number.isInteger(hour) || !Number.isInteger(minute)
      || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new RangeError('出生时间不合法');
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new RangeError('出生经度应在 -180° 到 180° 之间');
    }
    if (!Number.isFinite(tz) || tz < -12 || tz > 14) {
      throw new RangeError('时区应在 UTC-12 到 UTC+14 之间');
    }

    const stdMeridian = tz * 15;

    // 1) 真太阳时校正
    let adjHour = hour, adjMin = minute, solarInfo = null;
    if (useTrueSolar) {
      const tst = trueSolarTime(year, month, day, hour, minute, longitude, stdMeridian);
      solarInfo = tst;
      let total = tst.totalMin;
      // 处理跨日
      let dayShift = 0;
      while (total < 0) { total += 1440; dayShift -= 1; }
      while (total >= 1440) { total -= 1440; dayShift += 1; }
      adjHour = Math.floor(total / 60);
      adjMin = Math.round(total % 60);
      // 四舍五入可能得到 60 分，进位到下一小时
      if (adjMin >= 60) {
        adjMin -= 60;
        adjHour += 1;
        if (adjHour >= 24) { adjHour -= 24; dayShift += 1; }
      }
      solarInfo.dayShift = dayShift;
      solarInfo.adjHour = adjHour;
      solarInfo.adjMin = adjMin;
    }

    // 2) 计算该出生时刻用于“定节气”的本地儒略日
    const birthJdLocal = toJulianDay(year, month, day, hour, minute) + 0 /*local*/;
    // 我们把“本地时间当作数值”处理：用 birthJdLocal 代表本地时刻的连续量。
    // 为求节气，需要本地时刻的儒略日（UTC + tz/24）。这里 toJulianDay 得到的是把
    // 本地钟表读数当 UTC 的 jd；真正 UTC = 该值 - tz/24。节气 jdLocal 已含 tz。
    const birthJdUTC = toJulianDay(year, month, day, hour, minute) - tz / 24;
    const birthJdLocalReal = birthJdUTC + tz / 24; // = toJulianDay(...) 本地数值

    // 3) 找出生时刻所处的“月节”区间 -> 定年柱与月柱
    // 收集 前一年、本年、后一年的节，保证覆盖立春附近边界
    let jies = [];
    for (const yy of [year - 1, year, year + 1]) {
      jies = jies.concat(getMonthJieForYear(yy, tz));
    }
    jies.sort((a, b) => a.jdLocal - b.jdLocal);

    // 找到 <= birth 的最后一个节
    let curJie = null, curIdx = -1;
    for (let i = 0; i < jies.length; i++) {
      if (jies[i].jdLocal <= birthJdLocalReal) { curJie = jies[i]; curIdx = i; }
      else break;
    }
    const nextJie = jies[curIdx + 1] || null;
    const prevJie = jies[curIdx - 1] || null;

    // 4) 年柱：以“立春”为界。找出生时刻所属的立春年。
    //    立春的黄经为 315°（寅月起点）。找 <= birth 的最近立春。
    const lichuns = jies.filter(j => j.deg === 315);
    let baziYear = year;
    // 该出生时刻在哪个立春之后
    let lastLichun = null;
    for (const lc of lichuns) {
      if (lc.jdLocal <= birthJdLocalReal) lastLichun = lc;
    }
    if (lastLichun) {
      const lcDate = fromJulianDay(lastLichun.jdLocal);
      baziYear = lcDate.y;
    } else {
      baziYear = year - 1;
    }
    // 年干支：以 1984 = 甲子年 为基准 (index 0)
    let yIdx = (baziYear - 1984) % 60;
    if (yIdx < 0) yIdx += 60;
    const yearGZ = jiazi(yIdx);

    // 5) 月柱：curJie.zhi 即月支；用五虎遁配天干
    const monthZhiIdx = curJie ? curJie.zhi : 2;
    const monthGZ = monthGanZhi(yearGZ.gan, monthZhiIdx);

    // 6) 日柱：用（可能因真太阳时跨日而调整过的）日期
    let dY = year, dM = month, dD = day;
    if (solarInfo && solarInfo.dayShift) {
      const shifted = fromJulianDay(toJulianDay(year, month, day, 12) + solarInfo.dayShift);
      dY = shifted.y; dM = shifted.m; dD = shifted.d;
    }
    // 子时换日规则（见 ziDayRule）
    let dayForPillar = { y: dY, m: dM, d: dD };
    const hourZhiIdx = hourZhiFromMinutes(useTrueSolar ? solarInfo.totalMin : hour * 60 + minute);
    const effHour = adjHour;
    // 晚子时（next，默认）：有效时 ≥23 点则日柱用次日
    // 子时属当日（same）：23 点仍用当日日柱
    if (ziDayRule !== 'same' && effHour >= 23) {
      const nx = fromJulianDay(toJulianDay(dY, dM, dD, 12) + 1);
      dayForPillar = { y: nx.y, m: nx.m, d: nx.d };
    }
    const dayJdn = Math.floor(toJulianDay(dayForPillar.y, dayForPillar.m, dayForPillar.d, 12) + 0.5);
    const dIdx = ganzhiIndexFromJDN(dayJdn);
    const dayGZ = jiazi(dIdx);

    // 7) 时柱
    const hourGZ = hourGanZhi(dayGZ.gan, hourZhiIdx);

    // 8) 四柱汇总 + 十神 + 藏干
    const pillars = { year: yearGZ, month: monthGZ, day: dayGZ, hour: hourGZ };
    const dayGan = dayGZ.gan;

    function decorate(gz, isDay) {
      const cang = ZHI_CANGGAN[gz.zhi].map(g => {
        const gi = TIANGAN.indexOf(g);
        return { gan: g, wuxing: GAN_WUXING[gi], tenGod: tenGod(dayGan, gi) };
      });
      return {
        ...gz,
        ganWuxing: GAN_WUXING[gz.gan],
        zhiWuxing: ZHI_WUXING[gz.zhi],
        ganYinYang: GAN_YINYANG[gz.gan],
        ganTenGod: isDay ? '日主' : tenGod(dayGan, gz.gan),
        zhiTenGod: tenGodOfZhi(dayGan, gz.zhi),
        canggan: cang,
      };
    }

    const result = {
      input: { year, month, day, hour, minute, gender, longitude, tz, useTrueSolar, ziDayRule },
      solarInfo,
      baziYear,
      pillars: {
        year: decorate(yearGZ, false),
        month: decorate(monthGZ, false),
        day: decorate(dayGZ, true),
        hour: decorate(hourGZ, false),
      },
      dayMaster: {
        gan: TIANGAN[dayGan],
        wuxing: GAN_WUXING[dayGan],
        yinyang: GAN_YINYANG[dayGan],
      },
      jieInfo: {
        current: curJie ? jieInfoObj(curJie) : null,
        next: nextJie ? jieInfoObj(nextJie) : null,
        prev: prevJie ? jieInfoObj(prevJie) : null,
      },
    };

    // 9) 五行统计
    result.wuxingCount = countWuxing(result.pillars);

    // 10) 大运
    result.dayun = calcDayun(result, opts, jies, curIdx, birthJdLocalReal);

    return result;
  }

  function jieInfoObj(j) {
    const dt = fromJulianDay(j.jdLocal);
    // 找节气名
    const name = degToJieName(j.deg);
    return { name, deg: j.deg, date: dt };
  }

  function degToJieName(deg) {
    const map = {
      315: '立春', 345: '惊蛰', 15: '清明', 45: '立夏', 75: '芒种', 105: '小暑',
      135: '立秋', 165: '白露', 195: '寒露', 225: '立冬', 255: '大雪', 285: '小寒',
    };
    return map[deg] || '';
  }

  // 五行计数（天干各1，地支藏干按本/中/余加权：本1、其余0.5——这里简单用本气1，藏干全计1可切换）
  function countWuxing(pillars) {
    const count = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    const list = [pillars.year, pillars.month, pillars.day, pillars.hour];
    for (const p of list) {
      count[GAN_WUXING[p.gan]] += 1;      // 天干
      count[ZHI_WUXING[p.zhi]] += 1;      // 地支本身五行
    }
    return count;
  }

  // ---------- 大运 ----------
  // 阳年男/阴年女 顺排；阴年男/阳年女 逆排。
  // 起运：从出生到下一个节(顺) / 上一个节(逆) 的天数 /3 = 岁数（3天=1年）。
  function calcDayun(result, opts, jies, curIdx, birthJd) {
    const { gender } = opts;
    const yearGanYinYang = GAN_YINYANG[result.pillars.year.gan]; // 阳/阴
    const isYangYear = yearGanYinYang === '阳';
    const forward = (isYangYear && gender === 'male') || (!isYangYear && gender === 'female');

    const nextJie = jies[curIdx + 1];
    const curJie = jies[curIdx];
    let daysToBoundary;
    if (forward) {
      daysToBoundary = (nextJie ? nextJie.jdLocal : birthJd) - birthJd;
    } else {
      daysToBoundary = birthJd - (curJie ? curJie.jdLocal : birthJd);
    }
    // 3天折1年 -> 起运岁
    const startAgeFloat = Math.max(0, daysToBoundary / 3);
    let startYears = Math.floor(startAgeFloat);
    let startMonths = Math.round((startAgeFloat - startYears) * 12);
    if (startMonths >= 12) {
      startYears += 1;
      startMonths -= 12;
    }

    // 把起运的“岁、月”落实到近似公历日期，供边界展示和当前大运判断。
    const firstMonthIndex = (opts.month - 1) + startMonths;
    const firstStartYear = opts.year + startYears + Math.floor(firstMonthIndex / 12);
    const firstStartMonth = ((firstMonthIndex % 12) + 12) % 12 + 1;
    const daysInStartMonth = new Date(Date.UTC(firstStartYear, firstStartMonth, 0)).getUTCDate();
    const firstStartDay = Math.min(opts.day, daysInStartMonth);

    // 大运干支：从月柱开始，顺/逆各推
    const monthIdx = result.pillars.month.index;
    const runs = [];
    const dayGan = result.pillars.day.gan;
    for (let i = 1; i <= 10; i++) {
      let idx = forward ? (monthIdx + i) : (monthIdx - i);
      idx = ((idx % 60) + 60) % 60;
      const gz = jiazi(idx);
      const startAge = startYears + i * 10 - 10; // 第1步大运开始年龄
      const startYear = firstStartYear + (i - 1) * 10;
      runs.push({
        step: i,
        ...gz,
        ganTenGod: tenGod(dayGan, gz.gan),
        zhiTenGod: tenGodOfZhi(dayGan, gz.zhi),
        startAge,
        startMonths,
        startAgeFloat: +(startAge + startMonths / 12).toFixed(2),
        startYear,
        startMonth: firstStartMonth,
        startDay: firstStartDay,
        startDate: `${startYear}-${String(firstStartMonth).padStart(2, '0')}-${String(firstStartDay).padStart(2, '0')}`,
      });
    }

    return {
      forward,
      startAge: startYears,
      startMonths,
      startAgeFloat: +startAgeFloat.toFixed(2),
      runs,
    };
  }

  // ---------- 导出 ----------
  return {
    chart,
    constants: {
      TIANGAN, DIZHI, GAN_WUXING, ZHI_WUXING, GAN_YINYANG, ZHI_YINYANG,
      ZHI_CANGGAN, NAYIN, JIEQI_NAMES,
    },
    util: {
      toJulianDay, fromJulianDay, solarLongitude, solarTermJd,
      jiazi, tenGod, trueSolarTime, equationOfTime, ganzhiIndexFromJDN,
    },
  };
})();

// 兼容 CommonJS（便于 node 下测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Bazi;
}
