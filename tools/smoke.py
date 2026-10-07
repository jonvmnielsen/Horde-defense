import sys, time, subprocess
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--directory', 'dist'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={'width': 390, 'height': 844})
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        pg.goto('http://localhost:8766/index.html?pr=0.5', wait_until='load')
        pg.wait_for_function('window.__game !== undefined', timeout=180000)
        pg.mouse.move(195, 600); pg.mouse.down(); pg.mouse.move(80, 600, steps=5); pg.mouse.up()
        pg.wait_for_timeout(8000)
        print(pg.evaluate("JSON.stringify({t: window.__game.S.t.toFixed(1), troop: window.__game.S.troop.length, enemies: window.__game.S.enemies.length, cx: window.__game.S.cx.toFixed(2), gold: window.__game.S.gold})"))
        for l in logs: print(l)
        b.close()
finally:
    srv.terminate()
