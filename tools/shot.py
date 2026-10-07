import sys, time, subprocess, os
from playwright.sync_api import sync_playwright

# usage: shot.py out.png [steps] [query] [w] [h]
out = sys.argv[1]
steps = int(sys.argv[2]) if len(sys.argv) > 2 else 60
query = sys.argv[3] if len(sys.argv) > 3 else 'snap'
w = int(sys.argv[4]) if len(sys.argv) > 4 else 390
h = int(sys.argv[5]) if len(sys.argv) > 5 else 844

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--directory', 'dist'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=float(os.environ.get('DSF','1')))
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        pg.goto(f'http://localhost:8765/index.html?{query}', wait_until='load')
        pg.wait_for_function('window.__game !== undefined', timeout=180000)
        if steps:
            print(pg.evaluate(f'JSON.stringify(window.__game.step({steps}))'))
        pg.wait_for_timeout(1500)
        pg.screenshot(path=out)
        for l in logs[-15:]:
            print(l)
        b.close()
finally:
    srv.terminate()
