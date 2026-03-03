import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    await page.waitForTimeout(2000);
    
    console.log('Looking for refund-negotiation-sim element...');
    const simulationLink = await page.locator('text=refund-negotiation-sim').first();
    
    if (await simulationLink.isVisible()) {
      console.log('Found refund-negotiation-sim, clicking...');
      await simulationLink.click();
      
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    } else {
      console.log('refund-negotiation-sim not found as text');
    }
    
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: '/tmp/viewer-transcript.png',
      fullPage: true 
    });
    
    console.log('Screenshot saved to /tmp/viewer-transcript.png');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
