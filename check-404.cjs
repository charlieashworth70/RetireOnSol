const { chromium } = require('playwright');

(async () => {
  console.log('🔍 Checking for 404 errors on RetireOnSol...\n');
  
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const failedRequests = [];
  
  // Capture all failed requests
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'Unknown'
    });
  });
  
  await page.goto('https://charlieashworth70.github.io/RetireOnSol/', { 
    waitUntil: 'networkidle' 
  });
  
  // Wait a bit for any lazy-loaded resources
  await page.waitForTimeout(3000);
  
  console.log('═══════════════════════════════════════');
  if (failedRequests.length === 0) {
    console.log('✅ No failed requests!');
  } else {
    console.log(`❌ Found ${failedRequests.length} failed request(s):\n`);
    failedRequests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.url}`);
      if (req.status) {
        console.log(`   Status: ${req.status} ${req.statusText}`);
      }
      if (req.error) {
        console.log(`   Error: ${req.error}`);
      }
      console.log('');
    });
  }
  console.log('═══════════════════════════════════════');
  
  await browser.close();
})();
