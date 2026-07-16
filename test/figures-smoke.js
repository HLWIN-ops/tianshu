/**
 * 古今人物相似度 · 冒烟测试
 * 运行：node test/figures-smoke.js
 */
'use strict';
const path = require('path');
const Bazi = require(path.join(__dirname, '..', 'js', 'engine.js'));
Bazi.plus = require(path.join(__dirname, '..', 'js', 'engine-plus.js'));
const F = require(path.join(__dirname, '..', 'js', 'figures.js'));

let failed = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓', msg);
  else { failed++; console.log('  ✗', msg); }
}

console.log('\n==== figures smoke ====');
ok(F.FIGURES_COUNT >= 40, '人物库人数 >= 40  (got ' + F.FIGURES_COUNT + ')');
const n = F.warmup();
ok(n >= 30, 'warmup 成功人数 >= 30  (got ' + n + ')');

const r = Bazi.plus.fullChart({
  year: 1990, month: 6, day: 15, hour: 15, minute: 30,
  gender: 'male', longitude: 120, tz: 8, useTrueSolar: false, ziDayRule: 'next',
});
const m = F.match(r, { top: 5 });
ok(m.matches && m.matches.length === 5, 'Top5 匹配');
ok(m.userSummary && m.userSummary.dayMaster === '辛', '用户日主辛');
ok(m.matches[0].score >= m.matches[4].score, '按分数降序');
ok(m.matches.every(x => x.reasons && x.reasons.length >= 0), '每条有 reasons 字段');
ok(!!m.disclaimer, '有免责声明');

console.log('\nTop matches for 1990-06-15:');
m.matches.forEach(x => {
  console.log(' ', x.score, x.name, x.dayMaster + x.dayWx, '|', (x.reasons || []).join(' · '));
});

// 分类过滤
const m2 = F.match(r, { top: 3, category: '科学' });
ok(m2.matches.every(x => x.category === '科学'), '分类过滤·科学');

console.log('\n==============================');
console.log(failed ? `失败 ${failed}` : '全部通过');
console.log('==============================\n');
process.exit(failed ? 1 : 0);
