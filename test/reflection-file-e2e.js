'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const INDEX_URL = pathToFileURL(path.join(ROOT, 'index.html')).href;
const REFLECTION_KEY = 'tianshu.reflections.v1';
const PROFILE_KEY = 'tianshu.profiles.v1';
const CAPTURE_SCREENSHOTS = process.env.CAPTURE_SCREENSHOTS === '1';

async function capture(page, name) {
  if (!CAPTURE_SCREENSHOTS) return;
  await page.waitForTimeout(300);
  const directory = path.join(ROOT, 'test-results', 'file-screenshots');
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

async function openSavedChart(page) {
  await page.locator('.tab[data-page=archive]').click();
  await page.locator('#profile-list .profile-card').first().waitFor({ state: 'visible' });
  await page.locator('#profile-list [data-action=reflection]').first().click();
  await page.locator('#page-paipan.active').waitFor({ state: 'visible' });
  const geometry = await page.evaluate(() => {
    const masthead = document.querySelector('.masthead')?.getBoundingClientRect();
    const reflection = document.querySelector('.reflection-card')?.getBoundingClientRect();
    const tabs = document.querySelector('.tabs')?.getBoundingClientRect();
    const activeFields = ['#reflection-title', '#reflection-subject', '#reflection-status', '#btn-save-reflection-review']
      .map(selector => ({ selector, rect: document.querySelector(selector)?.getBoundingClientRect() }))
      .filter(item => item.rect && item.rect.bottom > 0 && item.rect.top < window.innerHeight);
    return { masthead, reflection, tabs, activeFields, viewportHeight: window.innerHeight };
  });
  assert.ok(geometry.reflection && geometry.masthead && geometry.reflection.top >= geometry.masthead.bottom - 1,
    `继续复盘后试做卡标题不得被顶部栏遮挡：${JSON.stringify(geometry)}`);
  if (geometry.tabs && geometry.tabs.top < geometry.viewportHeight) {
    geometry.activeFields.forEach(item => {
      const overlaps = item.rect.bottom > geometry.tabs.top && item.rect.top < geometry.tabs.bottom;
      assert.equal(overlaps, false, `${item.selector} 不得被移动底栏遮挡：${JSON.stringify(geometry)}`);
    });
  }
}

async function main() {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: 'Asia/Shanghai',
      locale: 'zh-CN',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.clock.install({ time: new Date('2026-07-19T10:00:00+08:00') });
    await page.goto(INDEX_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    assert.equal(new URL(page.url()).protocol, 'file:', '验收必须直接通过 file:// 打开，不得依赖端口');
    for (const id of ['#tab-paipan', '#tab-dayun', '#tab-read']) {
      assert.equal(await page.locator(id).isDisabled(), true, `${id} 排盘前必须原生禁用`);
      assert.equal(await page.locator(id).getAttribute('aria-disabled'), 'true', `${id} 必须暴露禁用状态`);
    }

    await page.locator('#btn-example').click();
    await page.locator('details.personalize > summary').click();
    await page.locator('#f-name').fill('零端口闭环');
    await page.locator('#form button[type=submit]').click();
    await page.locator('#page-paipan.active').waitFor({ state: 'visible' });

    const purpose = await page.locator('.reflection-purpose').innerText();
    assert.match(purpose, /真实生活.*不是命令.*不会在后台通知你.*7 天后.*保留、调整或放弃/s, '功能必须先说清用途和结果');
    assert.match(await page.locator('.reflection-payoff').innerText(), /保留.*调整.*放弃/s, '未开始时也必须直接说明七天后的三种结果');
    await page.locator('#reflection-subject').fill('完成作品集首页并请一位同行评审');
    assert.match(await page.locator('#reflection-action').inputValue(), /作品集首页.*7 天/, '填写真实事情后应生成对应做法');
    assert.match(await page.locator('#reflection-criterion').inputValue(), /第 7 天.*反馈/, '必须给出可判断的完成标准');
    assert.equal(await page.locator('#reflection-review').isHidden(), true, '未开始前不应展示复盘表单');
    await page.locator('#btn-save-reflection').click();

    let records = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), REFLECTION_KEY);
    assert.equal(records.length, 1, 'T+0 必须保存一轮现实校验');
    assert.match(records[0].cycle, /^2026-07-19-[a-z0-9]{1,8}$/, '周期 ID 应允许同日多轮且能被重新读取');
    assert.equal(records[0].subject, '完成作品集首页并请一位同行评审');
    assert.equal(records[0].status, 'planned');
    assert.equal(await page.locator('#reflection-review').isVisible(), true, '开始后应出现事实记录入口');
    assert.match(await page.locator('#reflection-outcome').innerText(), /第 7 天回来得出结论|保留、调整或放弃/, '开始后应说明七天后得到什么');
    assert.equal(await page.locator('#btn-new-reflection').isHidden(), true, '得出结论前不能开启下一轮');
    await page.locator('#reflection-review > summary').click();
    await page.locator('#reflection-status').selectOption('done');
    await page.locator('#reflection-evidence').fill('提前记录的事实不应直接结案。');
    await page.locator('#btn-save-reflection-review').click();
    await page.waitForFunction(() => /先完成 7 天试做/.test(document.querySelector('#toast')?.textContent || ''));
    assert.equal(await page.locator('#btn-new-reflection').isHidden(), true, '到期前不得生成结论或开启下一轮');
    await capture(page, 'mobile-t0-report');

    const storedAction = records[0].action;
    await page.locator('[data-result-focus=career]').click();
    assert.equal(await page.locator('#reflection-action').inputValue(), storedAction, '切换关注主题不得覆盖进行中的现实校验');

    await page.clock.setFixedTime(new Date('2026-07-27T10:00:00+08:00'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await openSavedChart(page);
    assert.match(await page.locator('#reflection-month').innerText(), /已到复盘时间/, 'T+8 同一记录应自动进入待复盘态');
    assert.equal(await page.locator('#reflection-review').getAttribute('open'), '', 'T+8 复盘表单应自动展开');
    assert.equal(await page.locator('#reflection-subject').inputValue(), '完成作品集首页并请一位同行评审', 'T+8 不得丢失原记录');

    await page.locator('#reflection-status').selectOption('done');
    await page.locator('#reflection-evidence').fill('交付了首页初版，收到同行两条具体修改意见。');
    await page.locator('#btn-save-reflection-review').click();
    assert.match(await page.locator('#reflection-outcome').innerText(), /现实中有用.*可以保留/s, '事实支持时应生成保留结论');
    assert.equal(await page.locator('#btn-new-reflection').isVisible(), true, '完成复盘后才能开启下一轮');

    await page.locator('#btn-new-reflection').click();
    await page.locator('#reflection-subject').fill('完成作品集案例页初版');
    await page.locator('#btn-save-reflection').click();
    records = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), REFLECTION_KEY);
    assert.equal(records.length, 2, '完成上一轮后应可开始下一轮并保留历史');

    await page.clock.setFixedTime(new Date('2026-08-20T10:00:00+08:00'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await openSavedChart(page);
    assert.equal(await page.locator('.reflection-history-item').count(), 2, 'T+32 两轮历史都必须仍可查看');
    const completedHistory = page.locator('.reflection-history-item').filter({ hasText: '完成作品集首页并请一位同行评审' });
    await completedHistory.locator('summary').click();
    const historyText = await page.locator('#reflection-history').innerText();
    assert.match(historyText, /完成作品集首页.*有效.*值得保留/s, '历史应显示真实对象和结论');
    assert.match(historyText, /收到同行两条具体修改意见/, '历史应可查看事实记录');
    await capture(page, 'mobile-t32-history');

    await page.locator('.tab[data-page=archive]').click();
    const archiveText = await page.locator('#profile-list .profile-card').first().innerText();
    assert.match(archiveText, /已到期.*待复盘.*完成作品集案例页初版/s, '档案卡应显示当前事情、状态和截止信息');
    assert.equal(await page.locator('#profile-list [data-action=reflection]').count(), 1, '档案必须提供继续复盘入口');
    await capture(page, 'mobile-archive');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export-profiles').click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const exported = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
    assert.equal(exported.reflections.length, 2, '导出档案必须包含全部现实校验历史');

    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btn-clear-profiles').click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), PROFILE_KEY), '[]', '清空后档案应为空');
    await page.locator('#f-import-profiles').setInputFiles({
      name: 'tianshu-export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported)),
    });
    await page.waitForFunction(() => /已导入/.test(document.querySelector('#toast')?.textContent || ''));
    assert.equal(await page.locator('#profile-list .profile-card').count(), 1, '导入后应恢复档案');
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]').length, REFLECTION_KEY), 2, '导入后应恢复两轮历史');

    assert.deepEqual(errors, [], `file:// 旅程出现浏览器错误：\n${errors.join('\n')}`);
    await context.close();
    console.log('✓ file:// 零端口与 T+0/T+8/T+32 现实校验闭环通过');
  } finally {
    if (browser) await browser.close();
  }
}

main().catch(error => {
  console.error('file:// 现实校验 E2E 失败：', error.stack || error);
  process.exitCode = 1;
});
