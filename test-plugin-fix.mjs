import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track failed requests by domain
  const failedByDomain = {};
  page.on('requestfailed', request => {
    try {
      const url = new URL(request.url());
      const domain = url.hostname;
      failedByDomain[domain] = (failedByDomain[domain] || 0) + 1;
    } catch {}
  });
  
  console.log('Loading RetireOnSol (with Jupiter Plugin fix)...');
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/?demo=true', {
    waitUntil: 'networkidle',
    timeout: 60000
  });
  
  console.log('Waiting for page to settle...');
  await page.waitForTimeout(5000);
  
  console.log('\n=== Results ===');
  console.log('\nFailed Requests by Domain:');
  if (Object.keys(failedByDomain).length === 0) {
    console.log('✅ NO FAILED REQUESTS!');
  } else {
    for (const [domain, count] of Object.entries(failedByDomain)) {
      const oldEndpoints = ['quote-api.jup.ag', 'token.jup.ag', 'tokens.jup.ag', 'fe-api.jup.ag'];
      const isOldEndpoint = oldEndpoints.includes(domain);
      console.log(`  ${isOldEndpoint ? '❌' : '⚠️'}  ${domain}: ${count} failed request(s) ${isOldEndpoint ? '(OLD ENDPOINT!)' : ''}`);
    }
  }
  
  // Check if Plugin script loaded
  const pluginScript = await page.evaluate(() => {
    return !!document.querySelector('script[src*="plugin.jup.ag"]');
  });
  
  console.log(`\nJupiter Plugin script loaded: ${pluginScript ? '✅ YES' : '❌ NO'}`);
  
  // Check if window.Jupiter exists
  const jupiterExists = await page.evaluate(() => {
    return typeof window.Jupiter !== 'undefined';
  });
  
  console.log(`window.Jupiter available: ${jupiterExists ? '✅ YES' : '❌ NO'}`);
  
  await page.screenshot({ path: '/root/.openclaw/workspace/RetireOnSol/plugin-fix-test.png', fullPage: true });
  console.log('\n📸 Screenshot saved: plugin-fix-test.png');
  
  console.log('\nLeaving browser open for 10 seconds...');
  await page.waitForTimeout(10000);
  
  await browser.close();
})();
