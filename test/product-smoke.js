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
ok(insights.technicalHeadline.includes('七杀格') && insights.technicalHeadline.includes('身弱'), '速览读取真实格局与强弱');
ok(!/格|日主/.test(insights.headline), '首屏身份句已翻译为白话');
ok(Boolean(insights.archetype) && Boolean(insights.stageHeadline), '总览提供清晰的本命角色与当前阶段标题');
ok(insights.actions[0].text.includes('交付物') && insights.actions[0].text.includes('7 天内'), '事业主题直接给出具体七天行动');
const otherChart = Plus.fullChart({
  year: 1988, month: 8, day: 8, hour: 12, minute: 0,
  gender: 'male', longitude: 120, tz: 8, useTrueSolar: false, ziDayRule: 'next',
});
const otherInsights = Product.buildInsights(otherChart, 'career', new Date('2026-07-16T12:00:00+08:00'));
ok(insights.actions[0].text !== otherInsights.actions[0].text, '行动建议随命盘流年结构变化');
const sampleDates = [[1972, 2, 5], [1976, 1, 10], [1980, 4, 22], [1984, 2, 2], [1988, 8, 8], [1990, 6, 15], [1992, 10, 12], [1995, 12, 20], [1998, 3, 3], [2000, 1, 1], [2002, 9, 9], [2004, 5, 18]];
const sampleFocus = ['overall', 'career', 'wealth', 'relationship', 'wellbeing'];
const sampleActions = sampleDates.map((date, index) => {
  const sample = Plus.fullChart({
    year: date[0], month: date[1], day: date[2], hour: (index * 2) % 24, minute: 30,
    gender: index % 2 ? 'female' : 'male', longitude: 120, tz: 8, useTrueSolar: false, ziDayRule: 'next',
  });
  const view = Product.buildInsights(sample, sampleFocus[index % sampleFocus.length], new Date('2026-07-16T12:00:00+08:00'));
  return view.actions.map(action => `${action.text}|${action.evidence}`).join('\n');
});
ok(new Set(sampleActions).size >= 10, '12 组命盘/运年/关注方向产生足够差异化行动');
const shared = Product.shareText(chart, insights, 'https://example.com/bazi/?birth=private#result');
ok(shared.includes('https://example.com/bazi/') && !shared.includes('birth=private'), '分享回流链接去除敏感查询参数');
ok(!shared.includes('1990') && !shared.includes('四柱：'), '默认分享不包含出生日期和完整四柱');
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

const atomicStorage = {
  value: null, writes: 0,
  getItem() { return this.value; },
  setItem(_key, value) { this.value = value; this.writes++; },
};
Product.saveProfile(atomicStorage, {
  name: '原档案', gender: 'male', calendar: 'solar', year: 1990, month: 6, day: 15,
  hour: 12, minute: 0, longitude: 120, tz: 8, timePrecision: 'exact',
}, '原档案');
const beforeInvalidBatch = atomicStorage.value;
let rejectedMixedBatch = false;
try {
  Product.importProfilesAtomic(atomicStorage, [
    { input: { gender: 'female', calendar: 'solar', year: 1988, month: 8, day: 8, hour: 8, minute: 8, longitude: 120, tz: 8 } },
    { input: { gender: 'male', calendar: 'solar', year: 2023, month: 2, day: 29, hour: 12, minute: 0, longitude: 120, tz: 8 } },
  ]);
} catch (_) { rejectedMixedBatch = true; }
ok(rejectedMixedBatch && atomicStorage.value === beforeInvalidBatch, '混合非法批次被整批拒绝且不改原档案');
const writesBeforeBatch = atomicStorage.writes;
const importedBatch = Product.importProfilesAtomic(atomicStorage, [
  { input: { gender: 'female', calendar: 'solar', year: 1988, month: 8, day: 8, hour: 8, minute: 8, longitude: 120, tz: 8 } },
  { input: { gender: 'male', calendar: 'solar', year: 2000, month: 1, day: 1, hour: 12, minute: 0, longitude: 120, tz: 8 } },
]);
ok(importedBatch.profiles.length === 2 && atomicStorage.writes === writesBeforeBatch + 1, '有效批次完整校验后只写入一次');

console.log(`\n通过 ${passed} 项\n`);
