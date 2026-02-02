import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  console.log('Loading RetireOnSol...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  await page.waitForTimeout(3000);
  
  // Check Plan settings for JitoSOL
  console.log('\nChecking Plan settings...');
  const hasJitoSOL = await page.evaluate(() => {
    const jitoInput = document.getElementById('currentJitoSOL');
    return jitoInput ? jitoInput.value : 'not found';
  });
  console.log(`Current JitoSOL input value: ${hasJitoSOL}`);
  
  // Enable JitoSOL staking if it exists
  const jitoToggleExists = await page.locator('input[type="checkbox"]').count();
  console.log(`Found ${jitoToggleExists} checkboxes`);
  
  // Look for JitoSOL toggle specifically
  const jitoSection = await page.locator('.inflation-section').count();
  console.log(`Found ${jitoSection} inflation-style sections`);
  
  // Try setting JitoSOL amount to trigger Jupiter swap visibility
  console.log('\nSetting JitoSOL amount to 10...');
  await page.evaluate(() => {
    const input = document.getElementById('currentJitoSOL');
    if (input) {
      input.value = '10';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  
  await page.waitForTimeout(1000);
  
  console.log('\nActivating plan via Monitor tab...');
  await page.click('button:has-text("Monitor")');
  await page.waitForTimeout(2000);
  
  // Check if Jupiter swap placeholder appears
  console.log('\nLooking for Jupiter swap section...');
  const jupiterPlaceholder = await page.locator('.jupiter-swap-placeholder').count();
  console.log(`Jupiter swap placeholders found: ${jupiterPlaceholder}`);
  
  if (jupiterPlaceholder > 0) {
    console.log('✅ Found Jupiter swap section!');
    
    // Try clicking the swap button
    const swapBtn = await page.locator('button.jupiter-swap-btn').first();
    if (await swapBtn.isVisible()) {
      console.log('Clicking swap button...');
      await swapBtn.click();
      await page.waitForTimeout(5000);
      
      // Check if plugin script loaded
      const scripts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script')).map(s => s.src).filter(src => src.includes('jup'));
      });
      console.log('\nJupiter-related scripts:', scripts);
      
      // Check window.Jupiter
      const jupiterObj = await page.evaluate(() => typeof window.Jupiter);
      console.log(`window.Jupiter type: ${jupiterObj}`);
    }
  } else {
    console.log('❌ Jupiter swap section not visible - checking why...');
    
    // Debug: Check MonitorAccum state
    const debugInfo = await page.evaluate(() => {
      return {
        currentTab: document.querySelector('.main-tab-btn.active')?.textContent,
        connected: document.querySelector('.import-wallet-btn')?.textContent,
        html: document.querySelector('.monitor-accum')?.innerHTML?.substring(0, 200)
      };
    });
    console.log('\nDebug info:', JSON.stringify(debugInfo, null, 2));
  }
  
  await page.screenshot({ path: '/root/.openclaw/workspace/RetireOnSol/jupiter-visibility-test.png', fullPage: true });
  console.log('\n📸 Screenshot saved');
  
  console.log('\nLeaving browser open for 10 seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
})();
