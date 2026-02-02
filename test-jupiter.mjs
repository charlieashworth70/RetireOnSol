import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  const page = await context.newPage();
  
  // Listen for console logs
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });
  
  // Listen for failed requests
  page.on('requestfailed', request => {
    console.log(`❌ FAILED: ${request.url()}`);
  });
  
  console.log('Loading RetireOnSol...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  console.log('Waiting for page to settle...');
  await page.waitForTimeout(3000);
  
  console.log('Looking for Jupiter swap button...');
  const swapButton = await page.locator('button:has-text("Swap")').first();
  
  if (await swapButton.isVisible()) {
    console.log('Found swap button, clicking...');
    await swapButton.click();
    
    console.log('Waiting for Jupiter Terminal to load...');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: '/root/.openclaw/workspace/RetireOnSol/jupiter-test.png', fullPage: true });
    console.log('Screenshot saved: jupiter-test.png');
    
    // Check for errors in last 5 seconds
    console.log('\nChecking for network errors...');
    await page.waitForTimeout(2000);
    
  } else {
    console.log('❌ Swap button not found');
  }
  
  console.log('\nTest complete. Leaving browser open for 30 seconds...');
  await page.waitForTimeout(30000);
  
  await browser.close();
})();
