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
  
  console.log('Waiting for page...');
  await page.waitForTimeout(5000);
  
  // Get all button texts
  const buttons = await page.$$eval('button', btns => 
    btns.map(b => ({ text: b.textContent.trim(), class: b.className }))
  );
  
  console.log('\nAll buttons on page:');
  buttons.forEach((b, i) => {
    console.log(`  ${i + 1}. "${b.text}" (${b.class})`);
  });
  
  // Check for "Monitor" tab
  console.log('\nLooking for Monitor tab...');
  const monitorTab = await page.locator('button:has-text("Monitor")').first();
  if (await monitorTab.isVisible()) {
    console.log('Found Monitor tab, clicking...');
    await monitorTab.click();
    await page.waitForTimeout(2000);
    
    const buttonsAfter = await page.$$eval('button', btns => 
      btns.map(b => ({ text: b.textContent.trim() }))
    );
    
    console.log('\nButtons after clicking Monitor:');
    buttonsAfter.forEach((b, i) => {
      console.log(`  ${i + 1}. "${b.text}"`);
    });
  }
  
  await page.screenshot({ path: '/root/.openclaw/workspace/RetireOnSol/page-state.png', fullPage: true });
  console.log('\nScreenshot saved');
  
  await page.waitForTimeout(5000);
  await browser.close();
})();
