import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})

await page.setContent(`<!doctype html>
<html>
  <head>
    <style>
      body { margin: 0; background: #f8fafc; color: #111827; font-family: Inter, "Segoe UI", Arial, sans-serif; }
      .top { height: 64px; display: flex; align-items: center; padding: 0 48px; background: #fff; border-bottom: 1px solid #e5e7eb; font-size: 20px; font-weight: 650; }
      .layout { display: flex; gap: 72px; padding: 36px 56px; }
      .nav { width: 220px; padding-top: 20px; }
      .nav h2 { color: #64748b; font-size: 15px; letter-spacing: .08em; text-transform: uppercase; }
      .nav div { margin: 5px 0; padding: 12px 14px; border-radius: 8px; color: #475569; }
      .nav .active { background: #e0e7ff; color: #312e81; font-weight: 650; }
      .main { width: 680px; }
      h1 { margin: 0 0 7px; font-size: 28px; }
      .desc { margin-bottom: 28px; color: #64748b; }
      .line { height: 1px; margin-bottom: 25px; background: #e2e8f0; }
      .card { padding: 24px; background: #fff; border: 1px solid #dbe1ea; border-radius: 10px; box-shadow: 0 1px 2px #00000008; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 32px; }
      h3 { margin: 0 0 8px; font-size: 17px; }
      p { max-width: 480px; margin: 0; color: #64748b; font-size: 14px; line-height: 1.5; }
      .switch { box-sizing: border-box; flex: none; width: 48px; height: 26px; padding: 3px; border-radius: 999px; background: #4f46e5; }
      .knob { width: 20px; height: 20px; margin-left: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px #0003; }
    </style>
  </head>
  <body>
    <div class="top">Service Admin</div>
    <div class="layout">
      <aside class="nav"><h2>Settings</h2><div>Appearance</div><div class="active">Startup</div></aside>
      <main class="main">
        <h1>Startup</h1>
        <div class="desc">Control what Service Lasso starts when its runtime launches.</div>
        <div class="line"></div>
        <section class="card"><div class="row"><div><h3>Start enabled services automatically</h3><p>Applies on the next runtime launch. It never stops services that are already running.</p></div><div class="switch"><div class="knob"></div></div></div></section>
      </main>
    </div>
  </body>
</html>`)

await page.screenshot({
  path: 'public/images/settings-startup.png',
  fullPage: true,
})
await browser.close()
