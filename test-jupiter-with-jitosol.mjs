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
  await page.waitForTimeout(1000);
  
  console.log('3. Clicking Monitor tab...');
  await page.click('button:has-text("Monitor")');
  await page.waitForTimeout(2000);
  
  console.log('4. Checking for Jupiter swap section...');
  const jupiterCount = await page.locator('.jupiter-swap-placeholder').count();
  console.log(`   Jupiter swap sections found: ${jupiterCount}`);
  
  if (jupiterCount > 0) {
    console.log('✅ Jupiter swap section is visible!');
    
    console.log('5. Clicking swap button...');
    await page.click('button.jupiter-swap-btn');
    await page.waitForTimeout(8000);
    
    // Check if script loaded
    const scripts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script'))
        .map(s => s.src)
        .filter(src => src.includes('jup'));
    });
    console.log('   Jupiter scripts loaded:', scripts.length > 0 ? scripts : 'NONE');
    
    // Check window.Jupiter
    const jupiterExists = await page.evaluate(() => typeof window.Jupiter);
    console.log(`   window.Jupiter: ${jupiterExists}`);
    
    // Check if terminal container exists
    const terminalVisible = await page.locator('#integrated-terminal').isVisible();
    console.log(`   Terminal container visible: ${terminalVisible}`);
    
    // Look for any errors
    await page.screenshot({ 
      path: '/root/.openclaw/workspace/RetireOnSol/jupiter-opened.png',
      fullPage: true 
    });
    console.log('   📸 Screenshot saved: jupiter-opened.png');
    
  } else {
    console.log('❌ Jupiter swap section NOT visible');
    console.log('   Debugging...');
    
    const debug = await page.evaluate(() => {
      const monitorAccum = document.querySelector('.monitor-accum');
      return {
        monitorAccumExists: !!monitorAccum,
        innerHTML: monitorAccum?.innerHTML.substring(0, 500)
      };
    });
    console.log('   Debug:', JSON.stringify(debug, null, 2));
  }
  
  console.log('\nLeaving browser open for 15 seconds...');
  await page.waitForTimeout(15000);
  
  await browser.close();
  console.log('Done!');
})();
