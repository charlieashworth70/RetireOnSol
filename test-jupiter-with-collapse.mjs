import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture Jupiter logs
  const jupiterLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Jupiter]')) {
      jupiterLogs.push(text);
      console.log(`  ${text}`);
    }
  });
  
  console.log('1. Loading RetireOnSol demo mode...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  await page.waitForTimeout(3000);
  
  console.log('2. Collapsing demo panel...');
  const demoPanel = await page.locator('.demo-panel').first();
  if (await demoPanel.isVisible()) {
    // Click the header to collapse
    await demoPanel.locator('div').first().click();
    await page.waitForTimeout(500);
    console.log('   ✅ Demo panel collapsed');
  }
  
  console.log('3. Going to Plan → Grow...');
  await page.click('button:has-text("Plan")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Grow")');
  await page.waitForTimeout(1000);
  
  console.log('4. Setting JitoSOL to 10...');
  await page.fill('#currentJitoSOL', '10');
  await page.waitForTimeout(500);
  
  console.log('5. Scrolling to Execute Plan button...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  console.log('6. Clicking Execute Plan...');
  const executeBtn = await page.locator('button.execute-plan-btn');
  if (await executeBtn.isVisible()) {
    await executeBtn.click();
    await page.waitForTimeout(1500);
    console.log('   ✅ Modal should be open');
    
    console.log('7. Looking for modal and confirm button...');
    await page.waitForTimeout(1000); // Wait for modal animation
    
    // Try different selectors
    const allButtons = await page.$$eval('button', btns => 
      btns.map(b => ({ text: b.textContent, visible: b.offsetParent !== null }))
    );
    const confirmButtons = allButtons.filter(b => b.text?.includes('Confirm') || b.text?.includes('Execute'));
    console.log('   Found confirm-like buttons:', confirmButtons.length);
    
    if (confirmButtons.length > 0) {
      // Click the last button with "Execute" or "Confirm" in it
      await page.locator('button').filter({ hasText: /Confirm|Execute/ }).last().click();
      console.log('   ✅ Clicked confirm button');
      
      // Wait for modal to close
      console.log('   Waiting for modal to close...');
      await page.waitForSelector('.cancel-modal-overlay', { state: 'hidden', timeout: 5000 }).catch(() => {
        console.log('   ⚠️ Modal did not close, continuing anyway');
      });
      await page.waitForTimeout(1000);
    } else {
      console.log('   ⚠️ No confirm button found');
    }
  } else {
    console.log('   ❌ Execute Plan button not visible');
  }
  
  console.log('8. Going to Monitor → Accum...');
  await page.click('button:has-text("Monitor")');
  await page.waitForTimeout(2000);
  
  const accumBtn = await page.locator('button:has-text("Accum")').first();
  if (await accumBtn.isVisible()) {
    await accumBtn.click();
    await page.waitForTimeout(2000);
  }
  
  console.log('9. Looking for Jupiter swap button...');
  const swapBtn = await page.locator('button.jupiter-swap-btn').first();
  const btnVisible = await swapBtn.isVisible();
  
  if (btnVisible) {
    console.log('   ✅ Jupiter swap button found!');
    console.log('10. Clicking swap button...');
    await swapBtn.click();
    
    console.log('\n=== Waiting 15 seconds for Jupiter Plugin... ===\n');
    await page.waitForTimeout(15000);
    
    // Check results
    const result = await page.evaluate(() => {
      const container = document.getElementById('integrated-terminal');
      const stillLoading = container?.textContent?.includes('Loading Jupiter');
      return {
        hasJupiterWindow: typeof window.Jupiter !== 'undefined',
        stillLoading,
        containerContent: container?.textContent?.substring(0, 100),
      };
    });
    
    console.log('\n=== RESULTS ===');
    console.log('window.Jupiter exists:', result.hasJupiterWindow ? '✅ YES' : '❌ NO');
    console.log('Still loading:', result.stillLoading ? '❌ STUCK' : '✅ LOADED');
    
    if (jupiterLogs.length > 0) {
      console.log('\nJupiter console logs:');
      jupiterLogs.forEach(log => console.log('  ' + log));
    } else {
      console.log('\n⚠️ No Jupiter logs found - script may not have loaded');
    }
    
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/jupiter-collapsed-test.png',
      fullPage: true 
    });
    console.log('\n📸 Screenshot: jupiter-collapsed-test.png');
    
  } else {
    console.log('   ❌ Jupiter swap button NOT visible');
    const state = await page.evaluate(() => ({
      monitorAccumExists: !!document.querySelector('.monitor-accum'),
      activePlanExists: !!document.querySelector('.plan-activated-banner'),
      fundingStatus: document.querySelector('.funding-status')?.className,
    }));
    console.log('   State:', state);
  }
  
  console.log('\nLeaving browser open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('Test complete!');
})();
