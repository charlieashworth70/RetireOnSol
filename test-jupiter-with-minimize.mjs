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
  
  console.log('2. Looking for demo panel minimize button...');
  // Try to find and click any arrow/collapse button near demo controls
  const arrows = await page.locator('button:has-text("▼"), button:has-text("▲"), button:has-text("↓"), button:has-text("↑")').all();
  console.log(`   Found ${arrows.length} arrow button(s)`);
  
  if (arrows.length > 0) {
    console.log('   Clicking last arrow button (likely demo panel)...');
    await arrows[arrows.length - 1].click();
    await page.waitForTimeout(1000);
  }
  
  console.log('3. Setting JitoSOL target to 10...');
  await page.fill('#currentJitoSOL', '10');
  await page.waitForTimeout(500);
  
  console.log('4. Scrolling down to find Execute Plan button...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  
  console.log('5. Looking for Execute Plan button...');
  const executePlanBtn = await page.locator('button:has-text("Execute Plan")').count();
  console.log(`   Found ${executePlanBtn} Execute Plan button(s)`);
  
  if (executePlanBtn > 0) {
    console.log('   ✅ Execute Plan button visible!');
    await page.click('button:has-text("Execute Plan")');
    await page.waitForTimeout(2000);
    
    console.log('6. Confirming in modal...');
    const confirmBtn = await page.locator('.modal-actions button:has-text("Execute")').first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      console.log('   ✅ Plan executed!');
    }
    
    console.log('7. Going to Monitor → Accum...');
    await page.click('button:has-text("Monitor")');
    await page.waitForTimeout(2000);
    
    const accumBtn = await page.locator('button:has-text("Accum")').first();
    if (await accumBtn.isVisible()) {
      await accumBtn.click();
      await page.waitForTimeout(2000);
    }
    
    console.log('8. Checking for Jupiter swap button...');
    const jupiterCount = await page.locator('.jupiter-swap-placeholder').count();
    console.log(`   Jupiter swap sections found: ${jupiterCount}`);
    
    if (jupiterCount > 0) {
      console.log('   ✅ Jupiter swap section VISIBLE!');
      
      console.log('9. Clicking swap button...');
      await page.click('button.jupiter-swap-btn');
      await page.waitForTimeout(8000);
      
      // Check plugin loading
      const pluginStatus = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'))
          .map(s => s.src)
          .filter(s => s.includes('jup'));
        return {
          scriptsFound: scripts,
          jupiterType: typeof window.Jupiter,
          terminalVisible: !!document.getElementById('integrated-terminal'),
        };
      });
      
      console.log('\n   Plugin status:', JSON.stringify(pluginStatus, null, 2));
      
      await page.screenshot({ 
        path: '/root/.openclaw/workspace/RetireOnSol/jupiter-working.png',
        fullPage: true 
      });
      console.log('   📸 Screenshot: jupiter-working.png');
      
    } else {
      console.log('   ❌ Jupiter swap section still not visible');
    }
    
  } else {
    console.log('   ❌ Execute Plan button still not found after scrolling');
    
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/execute-btn-missing.png',
      fullPage: true 
    });
  }
  
  console.log('\nLeaving browser open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('Done!');
})();
