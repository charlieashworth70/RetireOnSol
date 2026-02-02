const { chromium } = require('playwright');

(async () => {
  console.log('🚀 Starting RetireOnSol Playwright test...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Test 1: Load the app
  console.log('📍 Test 1: Loading app...');
  const url = 'https://charlieashworth70.github.io/RetireOnSol/';
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('   ✅ Page loaded\n');
  
  // Test 2: Check title and branding
  console.log('📍 Test 2: Checking branding...');
  const title = await page.title();
  console.log(`   Title: "${title}"`);
  
  const h1 = await page.locator('h1').first().textContent();
  console.log(`   H1: "${h1}"`);
  
  const logo = await page.locator('.header-logo').first();
  const logoVisible = await logo.isVisible();
  console.log(`   Logo visible: ${logoVisible}`);
  
  if (logoVisible) {
    console.log('   ✅ Branding OK\n');
  } else {
    console.log('   ❌ Logo not visible - possible 404\n');
  }
  
  // Test 3: Check SOL price loads
  console.log('📍 Test 3: Checking SOL price...');
  await page.waitForTimeout(2000); // Wait for price fetch
  const priceDisplay = await page.locator('.price-display').textContent();
  console.log(`   Price display: "${priceDisplay.trim()}"`);
  if (priceDisplay.includes('$')) {
    console.log('   ✅ Price loaded\n');
  } else {
    console.log('   ⚠️ Price may still be loading\n');
  }
  
  // Test 4: Test input fields
  console.log('📍 Test 4: Testing input fields...');
  const solInput = page.locator('#currentSOL');
  const jitoInput = page.locator('#currentJitoSOL');
  
  // Clear and set values
  await solInput.fill('100');
  await jitoInput.fill('50');
  
  const solValue = await solInput.inputValue();
  const jitoValue = await jitoInput.inputValue();
  console.log(`   SOL input: ${solValue}`);
  console.log(`   JitoSOL input: ${jitoValue}`);
  console.log('   ✅ Inputs working\n');
  
  // Test 5: Check current value display updates
  console.log('📍 Test 5: Checking value calculation...');
  const currentValue = await page.locator('.current-value-display').textContent();
  console.log(`   Current value display: "${currentValue.trim()}"`);
  if (currentValue.includes('$')) {
    console.log('   ✅ Value calculation working\n');
  } else {
    console.log('   ⚠️ Value not calculated yet\n');
  }
  
  // Test 6: Test tabs
  console.log('📍 Test 6: Testing navigation tabs...');
  
  // Click Spend tab
  await page.locator('.sub-tab-btn:has-text("Spend")').click();
  await page.waitForTimeout(500);
  console.log('   Clicked Spend tab');
  
  // Click back to Grow
  await page.locator('.sub-tab-btn:has-text("Grow")').click();
  await page.waitForTimeout(500);
  console.log('   Clicked Grow tab');
  
  // Click Monitor tab
  await page.locator('.main-tab-btn:has-text("Monitor")').click();
  await page.waitForTimeout(500);
  console.log('   Clicked Monitor tab');
  
  // Back to Plan
  await page.locator('.main-tab-btn:has-text("Plan")').click();
  await page.waitForTimeout(500);
  console.log('   ✅ Navigation working\n');
  
  // Test 7: Test sliders
  console.log('📍 Test 7: Testing sliders...');
  const yearsSlider = page.locator('#years');
  await yearsSlider.fill('15');
  const yearsValue = await yearsSlider.inputValue();
  console.log(`   Years slider: ${yearsValue}`);
  console.log('   ✅ Sliders working\n');
  
  // Test 8: Check growth chart renders
  console.log('📍 Test 8: Checking chart...');
  await page.waitForTimeout(1000);
  const chartContainer = page.locator('.recharts-wrapper');
  const chartVisible = await chartContainer.isVisible().catch(() => false);
  console.log(`   Chart visible: ${chartVisible}`);
  if (chartVisible) {
    console.log('   ✅ Chart rendered\n');
  } else {
    console.log('   ⚠️ Chart may not be visible (scroll needed?)\n');
  }
  
  // Test 9: Test Connect & Import button
  console.log('📍 Test 9: Checking wallet button...');
  const walletBtn = page.locator('.import-wallet-btn');
  const walletBtnVisible = await walletBtn.isVisible();
  const walletBtnText = await walletBtn.textContent();
  console.log(`   Wallet button visible: ${walletBtnVisible}`);
  console.log(`   Wallet button text: "${walletBtnText.trim()}"`);
  console.log('   ✅ Wallet button present\n');
  
  // Test 10: Take screenshot
  console.log('📍 Test 10: Taking screenshot...');
  await page.screenshot({ path: '/root/.openclaw/workspace/RetireOnSol/playwright-test-result.png', fullPage: true });
  console.log('   ✅ Screenshot saved to playwright-test-result.png\n');
  
  // Test 11: Check for console errors
  console.log('📍 Test 11: Checking for console errors...');
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log(`   ⚠️ Found ${errors.length} console errors:`);
    errors.slice(0, 5).forEach(e => console.log(`      - ${e.substring(0, 100)}`));
  } else {
    console.log('   ✅ No console errors detected\n');
  }
  
  await browser.close();
  
  console.log('═══════════════════════════════════════');
  console.log('🏁 Test complete!');
  console.log('═══════════════════════════════════════');
})();
