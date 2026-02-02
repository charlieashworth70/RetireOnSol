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
  
  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (text.includes('[Jupiter]')) {
      console.log(`  ${text}`);
    }
  });
  
  console.log('1. Loading RetireOnSol (with retry fix)...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  await page.waitForTimeout(3000);
  
  console.log('2. Going to Plan → Grow...');
  await page.click('button:has-text("Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Grow")');
  await page.waitForTimeout(1000);
  
  console.log('3. Setting JitoSOL to 10...');
  await page.fill('#currentJitoSOL', '10');
  await page.waitForTimeout(500);
  
  console.log('4. Scrolling to Execute Plan...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  console.log('5. Clicking Execute Plan...');
  await page.click('button.execute-plan-btn');
  await page.waitForTimeout(1500);
  
  console.log('6. Confirming execution...');
  try {
    await page.waitForSelector('button:has-text("Confirm & Execute")', { timeout: 3000 });
    await page.click('button:has-text("Confirm & Execute")');
    await page.waitForTimeout(2000);
    console.log('   ✅ Plan executed');
  } catch (e) {
    console.log('   ⚠️ Modal issue, trying alternative flow');
  }
  
  console.log('7. Going to Monitor → Accum...');
  await page.click('button:has-text("Monitor")');
  await page.waitForTimeout(2000);
  
  const accumBtns = await page.locator('button:has-text("Accum")').all();
  if (accumBtns.length > 0) {
    await accumBtns[0].click();
    await page.waitForTimeout(2000);
  }
  
  console.log('8. Looking for Jupiter swap button...');
  const jupiterBtn = await page.locator('button.jupiter-swap-btn').first();
  const btnVisible = await jupiterBtn.isVisible();
  
  if (btnVisible) {
    console.log('   ✅ Jupiter swap button found!');
    console.log('9. Clicking swap button...');
    await jupiterBtn.click();
    
    console.log('\n=== Waiting 15 seconds for Jupiter Plugin to load... ===\n');
    await page.waitForTimeout(15000);
    
    // Check results
    const result = await page.evaluate(() => {
      const container = document.getElementById('integrated-terminal');
      const loadingText = container?.textContent?.includes('Loading Jupiter');
      const hasPlugin = typeof window.Jupiter !== 'undefined';
      return {
        hasWindow: hasPlugin,
        stillLoading: loadingText,
        containerHTML: container?.innerHTML?.substring(0, 200),
      };
    });
    
    console.log('\n=== RESULTS ===');
    console.log('window.Jupiter exists:', result.hasWindow ? '✅' : '❌');
    console.log('Still showing "Loading Jupiter...":', result.stillLoading ? '❌ (stuck)' : '✅ (loaded)');
    
    // Filter Jupiter logs
    const jupiterLogs = logs.filter(l => l.includes('[Jupiter]'));
    console.log('\nJupiter logs:', jupiterLogs.length > 0 ? jupiterLogs.join('\n') : '(none)');
    
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/jupiter-live-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot: jupiter-live-test.png');
    
  } else {
    console.log('   ❌ Jupiter swap button NOT visible');
    const state = await page.evaluate(() => ({
      hasMonitorAccum: !!document.querySelector('.monitor-accum'),
      activePlan: !!document.querySelector('.plan-activated-banner'),
    }));
    console.log('   Debug:', state);
  }
  
  console.log('\nLeaving browser open for 20 seconds for inspection...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('Test complete!');
})();
