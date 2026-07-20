'use strict';

/**
 * 天枢关键用户旅程的真浏览器回归测试。
 *
 * 该脚本只在测试进程内启动一个绑定到 127.0.0.1 随机端口的静态文件
 * 服务器，并在测试结束（包括失败）时自动关闭。线上仍是纯静态 Cloudflare
 * Pages，不需要 Node 进程、固定端口或后端服务。
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const jsQR = require('jsqr');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const CAPTURE_SCREENSHOTS = process.env.CAPTURE_SCREENSHOTS === '1';
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
};

function readCloudflareWildcardHeaders() {
  const lines = fs.readFileSync(path.join(ROOT, '_headers'), 'utf8').split(/\r?\n/);
  const headers = {};
  let inWildcardBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inWildcardBlock = trimmed === '/*';
      continue;
    }
    if (!inWildcardBlock) continue;
    const separator = trimmed.indexOf(':');
    if (separator > 0) headers[trimmed.slice(0, separator)] = trimmed.slice(separator + 1).trim();
  }
  return headers;
}

const STATIC_HEADERS = readCloudflareWildcardHeaders();

function staticServer() {
  return http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url, `http://${HOST}`);
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/') pathname = '/index.html';

      // path.resolve + ROOT 边界检查可阻止 ../ 越界读取。
      const relativePath = pathname.replace(/^[/\\]+/, '');
      const filePath = path.resolve(ROOT, relativePath);
      const inRoot = filePath === ROOT || filePath.startsWith(ROOT + path.sep);
      if (!inRoot || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      response.writeHead(200, {
        ...STATIC_HEADERS,
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal server error');
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, resolve);
  });
  const address = server.address();
  return `http://${HOST}:${address.port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function assertNoRootOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const overflow = Math.max(metrics.scrollWidth, metrics.bodyScrollWidth) - metrics.clientWidth;
  assert.ok(overflow <= 1, `${label} 出现 ${overflow}px 页面级水平溢出：${JSON.stringify(metrics)}`);
}

async function capture(page, profileName, stage) {
  if (!CAPTURE_SCREENSHOTS) return;
  const directory = path.join(ROOT, 'test-results', 'screenshots');
  fs.mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, `${profileName}-${stage}.png`), fullPage: true });
}

async function captureElement(locator, profileName, stage) {
  if (!CAPTURE_SCREENSHOTS) return;
  const directory = path.join(ROOT, 'test-results', 'screenshots');
  fs.mkdirSync(directory, { recursive: true });
  await locator.screenshot({ path: path.join(directory, `${profileName}-${stage}.png`) });
}

async function exitIntro(page) {
  const intro = page.locator('#intro');
  await intro.waitFor({ state: 'visible' });
  // 使用 Playwright 的完整可操作性检查，避免回归成“看得到但点不开”。
  await page.locator('#intro-skip').click();
  await intro.waitFor({ state: 'hidden' });
  const seen = await page.evaluate(() => localStorage.getItem('tianshu.intro.seen'));
  assert.equal(seen, '1', '退出首屏后应记录本地首访状态');
}

async function assertInvalidDate(page) {
  await page.locator('#f-year').fill('2023');
  await page.locator('#f-month').fill('2');
  await page.locator('#f-day').fill('29');
  await page.locator('#f-time').fill('12:30');
  await page.locator('#form button[type=submit]').click();
  await page.locator('#form-status.error').waitFor({ state: 'visible' });
  assert.match(await page.locator('#form-status').innerText(), /日期不存在|检查年月日/);
  assert.equal(await page.locator('#f-day').getAttribute('aria-invalid'), 'true', '非法日期应落到具体字段');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'f-day', '非法日期应聚焦可修正字段');
  await page.locator('#page-input.active').waitFor({ state: 'visible' });

  await page.locator('#f-year').fill('2100');
  await page.locator('#f-month').fill('1');
  await page.locator('#f-day').fill('1');
  await page.locator('#form button[type=submit]').click();
  await page.waitForFunction(() => /不能晚于今天/.test(document.querySelector('#form-status')?.textContent || ''));
  assert.equal(await page.locator('#f-year').getAttribute('aria-invalid'), 'true', '未来日期应落到出生年字段');
}

async function createChart(page, name) {
  await page.locator('#btn-example').click();
  await page.locator('details.personalize > summary').click();
  await page.locator('#f-name').fill(name);
  await page.locator('#form button[type=submit]').click();
  await page.locator('#page-paipan.active').waitFor({ state: 'visible' });
  await page.locator('#insight-overview .signal-copy h2').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#bazi-table .bt-gan').count(), 4, '命盘应渲染四柱天干');
  assert.equal(await page.locator('#mobile-pillar-grid .mobile-pillar-card').count(), 4, '移动端专业盘应生成四张柱卡');
  assert.equal(await page.locator('#professional-vault').getAttribute('open'), null, '专业盘面默认应收起');
  assert.ok((await page.locator('#insight-overview').innerText()).trim().length > 20, '命盘首屏应有有效速览');
  await page.locator('#professional-vault > summary').click();
  assert.equal(await page.locator('#professional-vault').getAttribute('open'), '', '专业盘面入口应可点击展开');
  const professionalVisible = profileViewportWidth(page) <= 720
    ? await page.locator('#mobile-pillar-grid .mobile-pillar-card').first().isVisible()
    : await page.locator('#bazi-table .bt-gan').first().isVisible();
  assert.equal(professionalVisible, true, '展开专业盘后应在当前视口显示盘面内容');
  await page.locator('#professional-vault > summary').click();
}

function profileViewportWidth(page) {
  return page.viewportSize()?.width || 1024;
}

async function assertSharePreview(page, profileName) {
  await page.locator('#btn-share-summary').click();
  await page.locator('#share-modal').waitFor({ state: 'visible' });
  const text = await page.locator('#share-preview-text').innerText();
  const expectedUrl = await page.evaluate(() => Bazi.product.shareUrl(window.location.href));
  assert.ok(text.includes(expectedUrl), '分享预览应包含去参数的运行时地址');
  assert.ok(!text.includes(`E2E-${profileName}`), '分享预览不得包含本地称呼');
  assert.ok(!/1990|北京|四柱：|15:30/.test(text), '分享预览不得包含出生日期、地点、完整四柱或时刻');
  assert.match(text, /已隐藏姓名、出生日期、时间、地点与完整四柱/);
  await page.keyboard.press('Escape');
  await page.locator('#share-modal').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'btn-share-summary', '关闭分享预览后应恢复触发按钮焦点');
}

async function checkTabsAndPoster(page, viewportName) {
  const checks = [
    ['paipan', '#insight-overview'],
    ['dayun', '#dayun-timeline'],
    ['read', '#read-content .read-card'],
  ];

  for (const [tab, content] of checks) {
    await page.locator(`.tab[data-page=${tab}]`).click();
    await page.locator(`#page-${tab}.active`).waitFor({ state: 'visible' });
    await page.locator(content).first().waitFor({ state: 'visible' });
    if (tab === 'dayun') {
      assert.ok((await page.locator('#dayun-timeline .tl-preview').first().innerText()).trim().length > 8, '大运折叠态必须直接显示运势摘要');
      assert.match(await page.locator('#dayun-timeline .tl-toggle-label').first().innerText(), /查看.*建议/, '大运卡必须用文字说明可以查看建议');
      const currentRun = page.locator('#dayun-timeline .tl-card.active');
      if (await currentRun.count()) {
        assert.equal(await currentRun.first().getAttribute('aria-expanded'), 'true', '当前大运必须默认展开');
        assert.equal(await currentRun.first().locator('.tl-detail').isVisible(), true, '当前大运必须直接显示行动建议');
      }
    }
    if (tab === 'read') {
      const collapsedPreview = page.locator('#read-content .read-card-preview:not([hidden])').first();
      await collapsedPreview.waitFor({ state: 'visible' });
      assert.ok((await collapsedPreview.innerText()).trim().length > 8, '本命折叠章节必须显示内容摘要，不能只留空白标题');
    }
    await assertNoRootOverflow(page, `${viewportName}/${tab}`);
    if (CAPTURE_SCREENSHOTS) await page.waitForTimeout(260);
    await capture(page, viewportName, tab);
  }

  await page.locator('.tab[data-page=paipan]').focus();
  await page.keyboard.press('ArrowRight');
  await page.locator('#page-dayun.active').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.tab[data-page=dayun]').getAttribute('aria-selected'), 'true', '方向键应切换标签页');
  await page.locator('.tab[data-page=paipan]').click();
  await page.locator('[data-goto=fun]').click();
  await page.locator('#page-fun.active').waitFor({ state: 'visible' });
  await page.locator('#fun-list .fun-card').first().waitFor({ state: 'visible' });

  await page.locator('#btn-poster').click();
  await page.locator('#poster-modal').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#poster-modal').getAttribute('aria-hidden'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('poster-panel')), true, '弹层打开后焦点应进入对话框');
  const canvas = await page.locator('#poster-canvas').evaluate(element => ({
    width: element.width,
    height: element.height,
    pngLength: element.toDataURL('image/png').length,
  }));
  assert.deepEqual({ width: canvas.width, height: canvas.height }, { width: 720, height: 1280 });
  assert.ok(canvas.pngLength > 10_000, '海报 Canvas 应绘制出非空 PNG');
  const qrImage = await page.locator('#poster-canvas').evaluate(element => {
    const context = element.getContext('2d');
    const image = context.getImageData(510, 1025, 205, 215);
    return { width: image.width, height: image.height, data: Array.from(image.data) };
  });
  const decoded = jsQR(Uint8ClampedArray.from(qrImage.data), qrImage.width, qrImage.height, { inversionAttempts: 'attemptBoth' });
  const expectedShareUrl = await page.evaluate(() => Bazi.product.shareUrl(window.location.href));
  await captureElement(page.locator('#poster-canvas'), viewportName, 'poster');
  assert.equal(decoded && decoded.data, expectedShareUrl, '海报二维码应可解码到去参数的运行时地址');
  await assertNoRootOverflow(page, `${viewportName}/poster`);
  await page.keyboard.press('Escape');
  await page.locator('#poster-modal').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'btn-poster', '关闭弹层后应恢复触发按钮焦点');
}

async function saveAndReopenProfile(page, name, viewportName) {
  await page.locator('.tab[data-page=paipan]').click();
  const baziBeforeFocus = await page.locator('#bazi-table').textContent();
  const actionBeforeFocus = await page.locator('#reflection-action').inputValue();
  await page.locator('[data-result-focus=career]').click();
  const careerAction = await page.locator('#reflection-action').inputValue();
  assert.notEqual(careerAction, actionBeforeFocus, '结果页切换关注主题后应更新现实建议');
  assert.equal(await page.locator('#f-focus').inputValue(), 'career', '结果页主题切换应同步录入表单');
  assert.equal(await page.locator('#bazi-table').textContent(), baziBeforeFocus, '切换关注主题不得重新计算或改变四柱');
  await page.locator('[data-result-focus=overall]').click();
  const generatedAction = await page.locator('#reflection-action').inputValue();
  const previewAction = (await page.locator('#reflection-action-preview').innerText()).trim();
  assert.equal(generatedAction, previewAction, '系统应直接展示行动建议，而不是让用户从空白录入');
  assert.match(generatedAction, /7 天|7天|20 分钟|每天记录/, '系统建议应是具体可执行动作');
  assert.match(generatedAction, /从当前待办中选最重要的一件.*第一版.*发给一个人/s, '默认整体任务必须明确告诉用户选什么、产出什么、交给谁');
  assert.ok((await page.locator('#reflection-criterion-preview').innerText()).trim().length > 12, '行动卡必须直接显示完成标准');
  await page.locator('#reflection-editor > summary').click();
  await page.locator('#reflection-subject').fill('完成一个可验收的作品集首页');
  await page.locator('#reflection-action').fill('7 天内完成一个可验收的作品集首页');
  await page.locator('#btn-save-reflection').click();
  await page.locator('#reflection-review > summary').click();
  await page.locator('#reflection-status').selectOption('doing');
  await page.locator('#reflection-evidence').fill('先记录事实，再检查建议是否成立。');
  await page.locator('#btn-save-reflection-review').click();
  const reflectionRecord = await page.evaluate(() => JSON.parse(localStorage.getItem('tianshu.reflections.v1') || '[]')[0]);
  assert.match(reflectionRecord.cycle || '', /^\d{4}-\d{2}-\d{2}-[a-z0-9]{1,8}$/, '现实校验应以具体开始日期建立唯一周期');
  assert.ok(Date.parse(reflectionRecord.dueAt) > Date.parse(reflectionRecord.startedAt), '现实校验应保存结束日期');
  const reflectionCount = await page.evaluate(() => JSON.parse(localStorage.getItem('tianshu.reflections.v1') || '[]').length);
  assert.equal(reflectionCount, 1, '现实校验记录应保存在本机');
  await page.locator('#btn-save-current').click();
  await page.locator('.tab[data-page=archive]').click();
  const card = page.locator('#profile-list .profile-card').first();
  await card.waitFor({ state: 'visible' });
  assert.match(await card.innerText(), new RegExp(name));
  const savedCount = await page.evaluate(() => {
    const records = JSON.parse(localStorage.getItem('tianshu.profiles.v1') || '[]');
    return records.length;
  });
  assert.equal(savedCount, 1, '本地档案应写入一条有效记录');
  await assertNoRootOverflow(page, `${viewportName}/archive`);

  await card.locator('[data-action=reflection]').click();
  await page.locator('#page-paipan.active').waitFor({ state: 'visible' });
  await page.waitForTimeout(120);
  const resumeLayout = await page.evaluate(() => {
    const readRect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
    };
    const masthead = readRect('.masthead');
    const reflection = readRect('.reflection-card');
    const tabs = readRect('.tabs');
    const fields = ['#reflection-title', '#reflection-subject', '#reflection-status', '#btn-save-reflection-review']
      .map(selector => {
        const node = document.querySelector(selector);
        const hiddenByDetails = Boolean(node && node.closest('details:not([open])'));
        return { selector, rect: readRect(selector), hidden: !node || node.offsetParent === null || hiddenByDetails };
      })
      .filter(item => item.rect && !item.hidden && item.rect.bottom > 0 && item.rect.top < window.innerHeight);
    return {
      masthead, reflection, tabs, fields, viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      reflectionState: document.querySelector('#reflection-card')?.dataset.state,
      reviewOpen: document.querySelector('#reflection-review')?.open,
      activeElement: document.activeElement?.id,
    };
  });
  assert.ok(resumeLayout.reflection && resumeLayout.masthead && resumeLayout.reflection.top >= resumeLayout.masthead.bottom - 1,
    `${viewportName} 继续复盘标题不得被顶部栏遮挡：${JSON.stringify(resumeLayout)}`);
  if (resumeLayout.tabs && resumeLayout.tabs.top < resumeLayout.viewportHeight) {
    resumeLayout.fields.forEach(item => {
      const overlaps = item.rect.bottom > resumeLayout.tabs.top && item.rect.top < resumeLayout.tabs.bottom;
      assert.equal(overlaps, false, `${viewportName} ${item.selector} 不得被底部导航遮挡：${JSON.stringify(resumeLayout)}`);
    });
  }
  await page.locator('.tab[data-page=archive]').click();
  await page.locator('#page-archive.active').waitFor({ state: 'visible' });

  await page.locator('#f-import-profiles').setInputFiles({
    name: 'unknown-version.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: '天枢', schemaVersion: 99, version: '99.0.0', profiles: [] })),
  });
  await page.waitForFunction(() => /导入失败.*版本/.test(document.querySelector('#toast')?.textContent || ''));
  const countAfterBadImport = await page.evaluate(() => JSON.parse(localStorage.getItem('tianshu.profiles.v1') || '[]').length);
  assert.equal(countAfterBadImport, 1, '未知版本导入不得覆盖已有档案');

  await page.locator('#f-import-profiles').setInputFiles({
    name: 'oversized.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(257 * 1024, 0x20),
  });
  await page.waitForFunction(() => /导入失败.*256 KB/.test(document.querySelector('#toast')?.textContent || ''));

  await page.locator('#f-import-profiles').setInputFiles({
    name: 'wrong-type.json', mimeType: 'image/png', buffer: Buffer.from('{}'),
  });
  await page.waitForFunction(() => /导入失败.*JSON/.test(document.querySelector('#toast')?.textContent || ''));

  const toastBeforeBroken = await page.locator('#toast').innerText();
  await page.locator('#f-import-profiles').setInputFiles({
    name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken'),
  });
  await page.waitForFunction(previous => {
    const text = document.querySelector('#toast')?.textContent || '';
    return text !== previous && /导入失败/.test(text);
  }, toastBeforeBroken);

  await page.locator('#f-import-profiles').setInputFiles({
    name: 'empty.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: '天枢', schemaVersion: 1, version: '2.1.0', profiles: [] })),
  });
  await page.waitForFunction(() => /导入失败.*为空/.test(document.querySelector('#toast')?.textContent || ''));

  const mixedBatch = {
    app: '天枢', schemaVersion: 1, version: '2.1.0', profiles: [
      { input: { gender: 'female', calendar: 'solar', year: 1988, month: 8, day: 8, hour: 8, minute: 8, longitude: 120, tz: 8 } },
      { input: { gender: 'male', calendar: 'solar', year: 2023, month: 2, day: 29, hour: 12, minute: 0, longitude: 120, tz: 8 } },
    ],
  };
  await page.locator('#f-import-profiles').setInputFiles({
    name: 'mixed.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mixedBatch)),
  });
  await page.waitForFunction(() => /导入失败.*字段无效/.test(document.querySelector('#toast')?.textContent || ''));
  const countAfterAllBadImports = await page.evaluate(() => JSON.parse(localStorage.getItem('tianshu.profiles.v1') || '[]').length);
  assert.equal(countAfterAllBadImports, 1, '所有异常导入都不得改变原档案');

  await card.locator('[data-action=load]').click();
  await page.locator('#page-paipan.active').waitFor({ state: 'visible' });
  if (await page.locator('#professional-vault').getAttribute('open') === null) await page.locator('#professional-vault > summary').click();
  assert.match(await page.locator('#idcard').innerText(), new RegExp(name));
  assert.equal(await page.locator('#reflection-action').inputValue(), '7 天内完成一个可验收的作品集首页', '恢复命盘时应恢复现实校验');

  await page.locator('.tab[data-page=input]').click();
  await page.locator('#recent-resume').waitFor({ state: 'visible' });
  await page.locator('#btn-resume-profile').click();
  await page.locator('#page-paipan.active').waitFor({ state: 'visible' });
  if (await page.locator('#professional-vault').getAttribute('open') === null) await page.locator('#professional-vault > summary').click();
  assert.match(await page.locator('#idcard').innerText(), new RegExp(name), '首页最近档案应可一键继续');
}

async function assertCriticalDependencyRecovery(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await page.route('**/js/product.js', route => route.abort('failed'));
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.locator('#boot-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('#boot-error').innerText(), /product\.js|核心排盘组件|必要组件/);
    await page.locator('#intro').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#boot-error a').getAttribute('href'), 'index.html', '故障面板应提供恢复路径');
    console.log('  ✓ 核心脚本缺失时显示可恢复错误，不留下遮罩');
  } finally {
    await context.close();
  }
}

async function assertOptionalDependencyDegrades(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await page.route('**/js/figures.js', route => route.abort('failed'));
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.locator('#btn-example').click();
    await page.locator('#form button[type=submit]').click();
    await page.locator('#page-paipan.active #insight-overview').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-goto=fun]').isDisabled(), true, '人物库缺失时只应关闭人物对照模块');
    assert.equal(await page.locator('#boot-error').isHidden(), true, '非核心模块缺失不应让核心排盘失败');
    console.log('  ✓ 人物库脚本缺失时核心排盘继续可用');
  } finally {
    await context.close();
  }
}

async function assertTrustPages(browser, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    for (const [pathName, heading] of [['privacy.html', '隐私说明'], ['methodology.html', '方法与边界']]) {
      const response = await page.goto(`${baseUrl}/${pathName}`, { waitUntil: 'load' });
      assert.equal(response.status(), 200);
      assert.equal((await page.locator('h1').innerText()).trim(), heading);
      await assertNoRootOverflow(page, `trust/${pathName}`);
    }
    console.log('  ✓ 隐私与方法页面在移动端可达且无水平溢出');
  } finally {
    await context.close();
  }
}

async function runJourney(browser, baseUrl, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor || 1,
    isMobile: Boolean(profile.isMobile),
    hasTouch: Boolean(profile.hasTouch),
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const failedRequests = [];

  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => failedRequests.push(`${request.url()} · ${request.failure()?.errorText || 'unknown'}`));

  try {
    const documentResponse = await page.goto(baseUrl, { waitUntil: 'load' });
    const responseHeaders = documentResponse.headers();
    assert.match(responseHeaders['content-security-policy'] || '', /default-src 'self'/);
    assert.equal(responseHeaders['x-content-type-options'], 'nosniff');
    await page.locator('#intro').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#page-input.active').count(), 1, '普通访问不应被品牌开屏拦截');
    assert.equal(await page.locator('.tab[data-page=paipan]').isDisabled(), true, '排盘前报告标签必须原生禁用');
    assert.equal(await page.locator('.tab[data-page=paipan]').getAttribute('aria-disabled'), 'true', '排盘前报告标签必须暴露禁用状态');
    assert.equal(await page.locator('#page-input.active').count(), 1, '排盘前应留在录入页');
    if (profile.viewport.width <= 720) {
      const tabsBox = await page.locator('.tabs').boundingBox();
      assert.ok(tabsBox && tabsBox.y >= profile.viewport.height - 70, `${profile.name} 移动导航必须固定在视口底部：${JSON.stringify(tabsBox)}`);
    }
    await capture(page, profile.name, 'input');
    if (profile.name === 'mobile-390') {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await assertNoRootOverflow(page, `${profile.name}/text-zoom-200`);
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }

    await page.goto(`${baseUrl}/?intro=1`, { waitUntil: 'load' });
    await exitIntro(page);
    for (const id of ['#tab-paipan', '#tab-dayun', '#tab-read']) {
      assert.equal(await page.locator(id).isDisabled(), true, `${profile.name} 排盘前结果标签必须禁用`);
    }
    await assertNoRootOverflow(page, `${profile.name}/input`);
    await assertInvalidDate(page);
    const chartName = `E2E-${profile.name}`;
    await createChart(page, chartName);
    await assertNoRootOverflow(page, `${profile.name}/paipan`);
    await assertSharePreview(page, profile.name);
    await capture(page, profile.name, 'paipan');
    await checkTabsAndPoster(page, profile.name);
    await saveAndReopenProfile(page, chartName, profile.name);

    assert.deepEqual(pageErrors, [], `${profile.name} 捕获到浏览器异常：\n${pageErrors.join('\n')}`);
    assert.deepEqual(consoleErrors, [], `${profile.name} 捕获到 console.error：\n${consoleErrors.join('\n')}`);
    assert.deepEqual(failedResponses, [], `${profile.name} 存在加载失败资源：\n${failedResponses.join('\n')}`);
    assert.deepEqual(failedRequests, [], `${profile.name} 存在网络请求失败：\n${failedRequests.join('\n')}`);
    console.log(`  ✓ ${profile.name} 主链路、档案、海报、异常与溢出检查通过`);
  } finally {
    await context.close();
  }
}

async function main() {
  const server = staticServer();
  let browser;
  try {
    const baseUrl = await listen(server);
    browser = await chromium.launch({ headless: true });
    console.log('\n==== browser e2e ====');
    await runJourney(browser, baseUrl, {
      name: 'desktop',
      viewport: { width: 1440, height: 1000 },
    });
    await runJourney(browser, baseUrl, {
      name: 'mobile-320',
      viewport: { width: 320, height: 720 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await runJourney(browser, baseUrl, {
      name: 'mobile-360',
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await runJourney(browser, baseUrl, {
      name: 'mobile-390',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await assertOptionalDependencyDegrades(browser, baseUrl);
    await assertCriticalDependencyRecovery(browser, baseUrl);
    await assertTrustPages(browser, baseUrl);
    console.log('浏览器 E2E 全部通过\n');
  } finally {
    if (browser) await browser.close();
    await closeServer(server);
  }
}

main().catch(error => {
  console.error('\nE2E 失败：', error.stack || error);
  process.exitCode = 1;
});
