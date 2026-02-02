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
  
  console.log('2. Ensuring we are on Plan tab → Grow sub-tab...');
  await page.click('button:has-text("Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Grow")');
  await page.waitForTimeout(1000);
  
  console.log('3. Setting JitoSOL target to 10...');
  await page.fill('#currentJitoSOL', '10');
  await page.waitForTimeout(500);
  
  console.log('4. Scrolling down to Execute Plan button...');
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1000);
  
  console.log('5. Looking for Execute Plan button...');
  const executeBtnCount = await page.locator('button.execute-plan-btn').count();
  console.log(`   Found ${executeBtnCount} Execute Plan button(s)`);
  
  if (executeBtnCount === 0) {
    console.log('   ❌ Still not found. Checking state...');
    const state = await page.evaluate(() => {
      const executeContainer = document.querySelector('.execute-plan-container');
      return {
        executeContainerExists: !!executeContainer,
        executeContainerVisible: executeContainer ? window.getComputedStyle(executeContainer).display : 'N/A',
        planTab: document.querySelector('.sub-tab-btn.active')?.textContent,
        mainTab: document.querySelector('.main-tab-btn.active')?.textContent,
      };
    });
    console.log('   State:', JSON.stringify(state, null, 2));
    
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/execute-debug.png',
      fullPage: true 
    });
    
  } else {
    console.log('   ✅ Execute Plan button found!');
    await page.click('button.execute-plan-btn');
    await page.waitForTimeout(1000);
    
    console.log('6. Waiting for modal to appear...');
    try {
      await page.waitForSelector('.modal-overlay', { timeout: 5000 });
      console.log('   ✅ Modal appeared');
      
      await page.waitForTimeout(1000);
      
      console.log('   Looking for "Confirm & Execute" button...');
      const confirmBtn = await page.locator('button:has-text("Confirm & Execute")').first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
        console.log('   ✅ Plan executed!');
      } else {
        console.log('   ❌ "Confirm & Execute" button not visible');
        const allButtons = await page.$$eval('.modal button', btns => btns.map(b => b.textContent));
        console.log('   Modal buttons:', allButtons);
      }
    } catch (e) {
      console.log('   ❌ Modal did not appear:', e.message);
    }
    
    console.log('7. Going to Monitor → Accum...');
    await page.click('button:has-text("Monitor")');
    await page.waitForTimeout(2000);
    
    // Accum should be default, but click it anyway
    const accumBtns = await page.locator('button:has-text("Accum")').all();
    if (accumBtns.length > 0) {
      await accumBtns[0].click();
      await page.waitForTimeout(2000);
    }
    
    console.log('8. Checking for Jupiter swap section...');
    const jupiterCount = await page.locator('.jupiter-swap-placeholder').count();
    console.log(`   Jupiter swap sections found: ${jupiterCount}`);
    
    if (jupiterCount > 0) {
      console.log('   ✅ Jupiter swap section VISIBLE!');
      
      console.log('9. Clicking "Swap SOL → JitoSOL" button...');
      const swapBtn = await page.locator('button.jupiter-swap-btn').first();
      await swapBtn.click();
      await page.waitForTimeout(10000);
      
      // Check if Jupiter Plugin loaded
      const pluginCheck = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'))
          .map(s => s.src)
          .filter(s => s.includes('jup') || s.includes('plugin'));
        return {
          pluginScripts: scripts,
          windowJupiter: typeof window.Jupiter,
          terminalContainer: document.getElementById('integrated-terminal')?.innerHTML?.substring(0, 100),
        };
      });
      
      console.log('\n=== JUPITER PLUGIN STATUS ===');
      console.log(JSON.stringify(pluginCheck, null, 2));
      
      if (pluginCheck.windowJupiter !== 'undefined') {
        console.log('✅ window.Jupiter is available!');
      } else {
        console.log('❌ window.Jupiter is undefined - Plugin did not load');
      }
      
      await page.screenshot({ 
        path: '/root/.openclaw/workspace/RetireOnSol/jupiter-final-test.png',
        fullPage: true 
      });
      console.log('\n📸 Screenshot: jupiter-final-test.png');
      
    } else {
      console.log('   ❌ Jupiter swap section not visible');
      
      const monitorState = await page.evaluate(() => {
        return {
          monitorAccumExists: !!document.querySelector('.monitor-accum'),
          fundingStatus: document.querySelector('.funding-status')?.className,
          html: document.querySelector('.monitor-accum')?.innerHTML?.substring(0, 300),
        };
      });
      console.log('   Monitor state:', JSON.stringify(monitorState, null, 2));
    }
  }
  
  console.log('\nLeaving browser open for 20 seconds for manual inspection...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('Test complete!');
})();
