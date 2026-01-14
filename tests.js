/**
 * 自动化测试脚本 - 检查前端页面渲染和错误
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false, // 显示浏览器窗口
    slowMo: 1000     // 慢速执行以便观察
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // 收集console日志
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[Browser Console ${type}]`, text);
  });

  // 收集页面错误
  page.on('pageerror', error => {
    console.error('[Browser Error]', error.message);
    console.error(error.stack);
  });

  // 收集网络请求
  page.on('request', request => {
    console.log('[Network Request]', request.method(), request.url());
  });

  page.on('response', response => {
    const status = response.status();
    if (status >= 400) {
      console.error('[Network Error]', status, response.url());
    } else {
      console.log('[Network Response]', status, response.url());
    }
  });

  try {
    console.log('=== 开始测试 ===');
    console.log('正在打开页面: http://localhost:5173');

    // 等待页面加载完成
    await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('页面加载完成');

    // 等待5秒让React渲染
    await page.waitForTimeout(5000);

    // 截图
    await page.screenshot({
      path: 'screenshots/initial-state.png',
      fullPage: true
    });
    console.log('已保存截图: screenshots/initial-state.png');

    // 检查是否有基金行
    const fundRows = await page.$$('.fund-row');
    console.log(`\n找到 ${fundRows.length} 个基金行`);

    // 检查每个基金行的状态
    for (let i = 0; i < fundRows.length; i++) {
      const row = fundRows[i];
      const text = await row.textContent();
      console.log(`\n基金 ${i + 1}:`, text?.substring(0, 200));

      // 检查是否有图表容器
      const charts = await row.$$('.trend-chart-container');
      console.log(`  - 图表容器数量: ${charts.length}`);

      // 检查是否有canvas元素
      const canvases = await row.$$('canvas');
      console.log(`  - Canvas元素数量: ${canvases.length}`);

      if (canvases.length > 0) {
        for (let j = 0; j < canvases.length; j++) {
          const canvas = canvases[j];
          const box = await canvas.boundingBox();
          console.log(`    Canvas ${j + 1}:`, box ? `${box.width}x${box.height}` : '不可见');
        }
      }
    }

    // 检查是否有"加载中"提示
    const loadingTexts = await page.$$eval('*', elements =>
      elements
        .filter(el => el.textContent?.includes('加载中'))
        .map(el => el.textContent)
    );
    if (loadingTexts.length > 0) {
      console.log('\n发现"加载中"提示:', loadingTexts);
    }

    // 检查浏览器控制台错误数量
    const errors = await page.evaluate(() => {
      // 尝试获取React DevTools错误
      const errors = [];
      return errors;
    });

    // 等待30秒以便观察
    console.log('\n等待30秒以便观察页面...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('测试失败:', error);
    await page.screenshot({
      path: 'screenshots/error-state.png',
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('\n=== 测试结束 ===');
  }
})();
