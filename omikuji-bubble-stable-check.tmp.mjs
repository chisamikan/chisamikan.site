import { chromium } from 'playwright-core';

const outDir = 'C:\\Users\\chisa\\AppData\\Local\\Temp\\claude\\c--Users-chisa-Documents-chisamikan-site\\b5e5152c-ada7-4a15-86c1-3eaed916d223\\scratchpad';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 500, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

await page.goto('http://localhost:4321/this-page-does-not-exist', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#omikuji-draw', { timeout: 10000 });

// track intro avatar/triangle position over the typing duration
async function sampleIntro() {
  return page.evaluate(() => {
    const avatar = document.querySelector('#omikuji-intro .line-mock-avatar');
    const bubble = document.querySelector('#omikuji-intro .line-mock-bubble');
    const avatarRect = avatar.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const beforeStyle = getComputedStyle(bubble, '::before');
    return {
      avatarTop: avatarRect.top,
      bubbleTop: bubbleRect.top,
      bubbleHeight: bubbleRect.height,
      textLen: document.getElementById('omikuji-intro-message').textContent.length,
    };
  });
}

const introSamples = [];
for (let i = 0; i < 8; i++) {
  introSamples.push(await sampleIntro());
  await page.waitForTimeout(150);
}
console.log('INTRO_SAMPLES:', JSON.stringify(introSamples));

// draw and track the result bubble similarly
await page.click('#omikuji-draw');
await page.waitForSelector('#omikuji-result:not(.hidden)', { timeout: 5000 });

async function sampleResult() {
  return page.evaluate(() => {
    const avatar = document.getElementById('omikuji-line-avatar');
    const bubble = document.querySelector('#omikuji-line .line-mock-bubble');
    const avatarRect = avatar.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    return {
      avatarTop: avatarRect.top,
      bubbleTop: bubbleRect.top,
      bubbleHeight: bubbleRect.height,
      textLen: document.getElementById('omikuji-line-message').textContent.length,
    };
  });
}

const resultSamples = [];
for (let i = 0; i < 12; i++) {
  resultSamples.push(await sampleResult());
  await page.waitForTimeout(150);
}
console.log('RESULT_SAMPLES:', JSON.stringify(resultSamples));

await page.screenshot({ path: `${outDir}/404-bubble-stable-mid.png`, fullPage: false, clip: { x: 0, y: 380, width: 500, height: 320 } });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${outDir}/404-bubble-stable-full.png`, fullPage: false, clip: { x: 0, y: 380, width: 500, height: 320 } });

console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors));
await browser.close();
