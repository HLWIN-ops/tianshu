'use strict';

const Bazi = require('../js/engine');
const Plus = require('../js/engine-plus');
const Product = require('../js/product');
Bazi.plus = Plus;

let passed = 0;
function ok(value, label) {
  if (!value) throw new Error('FAIL: ' + label);
  passed++;
  console.log('  ✓ ' + label);
}

console.log('\n==== product smoke ====');
ok(Product.CITIES.length >= 35, '离线城市预设已加载');
ok(Product.isValidSolarDate(2024, 2, 29), '闰年日期合法');
ok(!Product.isValidSolarDate(2023, 2, 29), '非法公历日期被拒绝');
ok(Plus.lunarToSolar(2020, 4, 31, true) === null, '非法闰月日期被拒绝');
ok(Plus.solarToLunar(1900, 1, 1) === null, '农历表基准前日期被拒绝');

const chart = Plus.fullChart({
  year: 1990, month: 6, day: 15, hour: 15, minute: 30,
  gender: 'male', longitude: 116.407, tz: 8, useTrueSolar: true, ziDayRule: 'next',
});
const accuracy = Product.buildAccuracy(chart, { timePrecision: 'exact', cityConfirmed: true, useTrueSolar: true });
const insights = Product.buildInsights(chart, 'career', new Date('2026-07-16T12:00:00+08:00'));
ok(Boolean(accuracy.correctedLabel), '可信度包含真太阳时');
ok(insights.headline.includes('七杀格') && insights.headline.includes('身弱'), '速览读取真实格局与强弱');
ok(chart.dayun.runs[0].startDate === '1997-10-15', '起运月份落实为具体日期');

const storage = {
  value: null,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; },
};
const saved = Product.saveProfile(storage, {
  name: '测试', gender: 'male', calendar: 'solar', year: 1990, month: 6, day: 15,
  hour: 15, minute: 30, longitude: 116.407, tz: 8, timePrecision: 'exact',
}, '测试命盘');
ok(Boolean(saved) && Product.readProfiles(storage).length === 1, '本地档案可保存与读取');

console.log(`\n通过 ${passed} 项\n`);
