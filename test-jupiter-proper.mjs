import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  // Capture network errors
  const failedRequests = [];
  page.on('requestfailed', request => {
    const url = request.url();
    failedRequests.push(url);
    console.log(`❌ FAILED: ${url}`);
  });
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[ERROR] ${msg.text()}`);
    }
  });
  
  console.log('1. Loading RetireOnSol...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  await page.waitForTimeout(3000);
  
  console.log('2. Clicking Monitor tab...');
  await page.click('button:has-text("Monitor")');
  await page.waitForTimeout(2000);
  
  console.log('3. Clicking Accum sub-tab...');
  await page.click('button:has-text("Accum")');
  await page.waitForTimeout(2000);
  
  console.log('4. Looking for Jupiter swap section...');
  const jupiterSection = await page.locator('.jupiter-swap-placeholder').first();
  
  if (await jupiterSection.isVisible()) {
    console.log('✅ Found Jupiter swap section');
    
    const swapButton = await page.locator('button.jupiter-swap-btn').first();
    if (await swapButton.isVisible()) {
      console.log('✅ Found swap button, clicking...');
      await swapButton.click();
      
      console.log('5. Waiting for Jupiter Terminal to initialize...');
      await page.waitForTimeout(8000);
      
      // Check if terminal loaded
      const terminal = await page.locator('#integrated-terminal').first();
      if (await terminal.isVisible()) {
        console.log('✅ Jupiter Terminal container visible');
      } else {
        console.log('❌ Jupiter Terminal container not found');
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: '/root/.openclaw/workspace/RetireOnSol/jupiter-terminal-test.png', 
        fullPage: true 
      });
      console.log('📸 Screenshot saved: jupiter-terminal-test.png');
      
    } else {
      console.log('❌ Swap button not visible');
    }
  } else {
    console.log('❌ Jupiter swap section not found');
  }
  
  console.log('\n6. Summary of failed requests:');
  if (failedRequests.length === 0) {
    console.log('✅ No failed requests!');
  } else {
    const uniqueFailed = [...new Set(failedRequests)];
    uniqueFailed.forEach(url => {
      console.log(`   - ${url}`);
    });
  }
  
  console.log('\nLeaving browser open for 20 seconds for inspection...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('Done!');
})();
