import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('1. Loading RetireOnSol demo mode...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  await page.waitForTimeout(3000);
  
  console.log('2. Setting JitoSOL target to 10...');
  await page.fill('#currentJitoSOL', '10');
  await page.waitForTimeout(500);
  
  console.log('3. Scrolling to Execute Plan button...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  console.log('4. Clicking "Execute Plan" button...');
  const executeBtnCount = await page.locator('button:has-text("Execute Plan")').count();
  console.log(`   Found ${executeBtnCount} Execute Plan button(s)`);
  
  if (executeBtnCount > 0) {
    await page.click('button:has-text("Execute Plan")');
    await page.waitForTimeout(2000);
    
    // Confirm in modal
    console.log('5. Confirming execution...');
    const confirmBtn = await page.locator('button:has-text("Execute")').last();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      console.log('   ✅ Plan activated!');
    }
  } else {
    console.log('   ❌ Execute Plan button not found');
  }
  
  console.log('6. Clicking Monitor tab...');
  await page.click('button:has-text("Monitor")');
  await page.waitForTimeout(2000);
  
  console.log('7. Clicking Accum sub-tab...');
  const accumBtn = await page.locator('button:has-text("Accum")').first();
  if (await accumBtn.isVisible()) {
    await accumBtn.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('   Accum button not visible, checking current state...');
  }
  
  console.log('8. Checking for Jupiter swap section...');
  const jupiterCount = await page.locator('.jupiter-swap-placeholder').count();
  console.log(`   Jupiter swap sections found: ${jupiterCount}`);
  
  if (jupiterCount > 0) {
    console.log('✅ Jupiter swap section VISIBLE!');
    
    console.log('9. Clicking swap button...');
    await page.click('button.jupiter-swap-btn');
    await page.waitForTimeout(10000);
    
    // Check if plugin loaded
    const pluginCheck = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'))
        .map(s => s.src);
      const jupScripts = scripts.filter(s => s.includes('jup'));
      return {
        allScripts: scripts.length,
        jupScripts,
        jupiterType: typeof window.Jupiter,
        terminalExists: !!document.getElementById('integrated-terminal'),
      };
    });
    
    console.log('\n   Plugin check:', JSON.stringify(pluginCheck, null, 2));
    
    // Take screenshots
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/jupiter-full-test.png',
      fullPage: true 
    });
    console.log('   📸 Screenshot: jupiter-full-test.png');
    
  } else {
    console.log('❌ Jupiter swap section NOT visible');
    
    // Debug
    const state = await page.evaluate(() => {
      return {
        monitorAccumExists: !!document.querySelector('.monitor-accum'),
        fundingSection: document.querySelector('.funding-status')?.className,
        fundingText: document.querySelector('.funding-status')?.textContent?.substring(0, 100),
      };
    });
    console.log('   State:', JSON.stringify(state, null, 2));
    
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/jupiter-debug.png',
      fullPage: true 
    });
  }
  
  console.log('\nLeaving browser open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('Done!');
})();
