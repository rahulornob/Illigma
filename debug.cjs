const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', error => {
    console.log(`Page Error: ${error.message}`);
    console.log(`Stack Trace: ${error.stack}`);
  });
  await page.goto('http://localhost:5174');
  // Wait for the app to load
  await page.waitForTimeout(1000);
  // Click type tool
  await page.getByRole("button", { name: "Type tool", exact: true }).click();
  await page.mouse.click(150, 150);
  await page.getByRole('textbox', {name: 'Edit canvas text'}).fill('Test text');
  await page.getByRole('textbox', {name: 'Edit canvas text'}).press('ControlOrMeta+Enter');
  
  await browser.close();
})();
