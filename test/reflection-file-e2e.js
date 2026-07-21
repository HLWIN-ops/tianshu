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
      .map(selector => {
        const node = document.querySelector(selector);
        const hiddenByDetails = Boolean(node && node.closest('details:not([open])'));
        return { selector, rect: node?.getBoundingClientRect(), hidden: !node || node.offsetParent === null || hiddenByDetails };
      })
      .filter(item => item.rect && !item.hidden && item.rect.bottom > 0 && item.rect.top < window.innerHeight);
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

    const lede = await page.locator('.reflection-lede').innerText();
    assert.match(lede, /本周的 7 天任务.*今天能开始.*照着做 7 天.*第 7 天看结果.*跳过/s, '必须用白话说明本周要做什么、持续多久，以及何时判断结果');
    assert.match(await page.locator('.reflection-payoff').innerText(), /继续用.*改一下.*不采用/s, '未开始时也必须直接说明七天后的三种结果');
    assert.match(await page.locator('#reflection-criterion-preview').innerText(), /第 7 天.*结果|反馈|记录/s, '默认卡面必须直接显示怎样才算完成');
    await capture(page, 'mobile-empty-report');
    assert.equal(await page.locator('#reflection-editor').getAttribute('open'), null, '默认态只展示生成结果，不应先让用户填写表单');
    await page.locator('#reflection-editor > summary').click();
    await page.locator('#reflection-subject').fill('完成作品集首页并请一位同行评审');
    assert.match(await page.locator('#reflection-action').inputValue(), /作品集首页.*7 天/, '填写真实事情后应生成对应做法');
    assert.match(await page.locator('#reflection-criterion').inputValue(), /第 7 天.*反馈/, '必须给出可判断的完成标准');
    await page.locator('#reflection-criterion').fill('第 7 天交付首页，并收到两条可执行反馈。');
    assert.equal(await page.locator('#reflection-criterion').inputValue(), '第 7 天交付首页，并收到两条可执行反馈。', '用户修改完成标准后不得被系统覆盖');
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
    assert.equal(await page.locator('#reflection-status option[value=done]').isDisabled(), true, 'T+0 不得选择最终结论');
    assert.equal(await page.locator('#reflection-status option[value=adjusted]').isDisabled(), true, 'T+0 不得选择调整或放弃');
    assert.equal(await page.locator('#btn-save-reflection-review').innerText(), '保存进度', 'T+0 主按钮只能保存进度');
    await page.evaluate(() => {
      const control = document.querySelector('#reflection-status');
      control.querySelector('option[value=done]').disabled = false;
      control.value = 'done';
    });
    await page.locator('#reflection-evidence').fill('提前记录的事实不应直接结案。');
    await page.locator('#btn-save-reflection-review').click();
    await page.waitForFunction(() => /先按本周清单做满 7 天/.test(document.querySelector('#toast')?.textContent || ''));
    assert.equal(await page.locator('#btn-new-reflection').isHidden(), true, '到期前不得生成结论或开启下一轮');
    assert.equal(await page.locator('#reflection-status').inputValue(), 'planned', '拒绝提前结案后必须回滚可见状态');
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
    assert.equal(await page.locator('#reflection-status option[value=done]').isDisabled(), false, 'T+8 应解锁最终结论');
    assert.equal(await page.locator('#btn-save-reflection-review').innerText(), '得出结论', 'T+8 主按钮应生成结论');

    await page.locator('#reflection-status').selectOption('done');
    await page.locator('#reflection-evidence').fill('交付了首页初版，收到同行两条具体修改意见。');
    await page.locator('#btn-save-reflection-review').click();
    assert.match(await page.locator('#reflection-outcome').innerText(), /现实中有用.*可以保留/s, '事实支持时应生成保留结论');
    assert.equal(await page.locator('#btn-new-reflection').isVisible(), true, '完成复盘后才能开启下一轮');

    await page.locator('#btn-new-reflection').click();
    await page.locator('#reflection-editor > summary').click();
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

    await page.evaluate(({ profileKey, reflectionKey }) => {
      const profile = JSON.parse(localStorage.getItem(profileKey) || '[]')[0];
      const legacy = {
        id: `${profile.id}|2026-06`, profileId: profile.id, month: '2026-06',
        action: '旧版记录：完成一项可验收的小行动', evidence: '', status: 'planned',
        updatedAt: '2026-06-30T10:00:00.000Z',
      };
      localStorage.setItem(reflectionKey, JSON.stringify([legacy]));
    }, { profileKey: PROFILE_KEY, reflectionKey: REFLECTION_KEY });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await openSavedChart(page);
    assert.equal(await page.locator('#reflection-card').getAttribute('data-state'), 'due', '旧版月记录必须直接进入待复盘态');
    assert.match(await page.locator('#reflection-progress-label').innerText(), /旧版记录.*可复盘/, '旧版记录不得伪造新的七天周期');
    assert.match(await page.locator('#reflection-month').innerText(), /2026年6月.*旧版记录.*已到复盘时间/, '旧版记录必须保留原月份并说明状态');
    assert.equal(await page.locator('#reflection-review').getAttribute('open'), '', '旧版记录应自动展开复盘');
    assert.equal(await page.locator('#reflection-status option[value=done]').isDisabled(), false, '旧版记录应允许补写最终结论');
    await page.locator('#reflection-status').selectOption('done');
    await page.locator('#reflection-evidence').fill('旧版行动已经完成，并留下一个可核对的结果。');
    await page.locator('#btn-save-reflection-review').click();
    assert.equal(await page.locator('#reflection-card').getAttribute('data-state'), 'done', '旧版记录补写事实后应完成迁移闭环');
    assert.match(await page.locator('#reflection-outcome').innerText(), /现实中有用.*可以保留/s, '旧版记录应生成明确结论');

    await page.evaluate(({ profileKey, reflectionKey }) => {
      const profile = JSON.parse(localStorage.getItem(profileKey) || '[]')[0];
      const cycle = '2026-08-20-legacy';
      const vague = {
        id: `${profile.id}|${cycle}`, profileId: profile.id, cycle,
        startedAt: '2026-08-20T02:00:00.000Z', dueAt: '2026-08-27T02:00:00.000Z',
        subject: '交出一个能给别人看的第一版',
        action: '围绕“交出一个能给别人看的第一版”，只选一个最小结果，今天写清完成标准，并在 7 天内做出可展示版本。',
        criterion: '第 7 天能展示一个真实结果。', evidence: '', status: 'planned',
        updatedAt: '2026-08-20T02:00:00.000Z',
      };
      localStorage.setItem(reflectionKey, JSON.stringify([vague]));
    }, { profileKey: PROFILE_KEY, reflectionKey: REFLECTION_KEY });
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    await openSavedChart(page);
    const upgraded = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]')[0], REFLECTION_KEY);
    assert.equal(upgraded.planVersion, 2, '已保存的模糊旧任务必须自动升级到新版行动清单');
    assert.match(upgraded.subject, /打开备忘录.*最重要的一件事.*下一步.*一个人/s, '升级后必须给没有现成项目的用户一个可直接开始的产出');
    assert.doesNotMatch(await page.locator('#reflection-current-subject').innerText(), /^交出一个能给别人看的第一版$/, '界面不得继续显示旧版模糊任务');

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
