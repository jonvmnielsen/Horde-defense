# Balance simulation: plays whole levels headless with simple bots and prints the outcome.
# usage: python3 tools/sim.py [level] [troop] [bots...]
import sys, time, subprocess, json
from playwright.sync_api import sync_playwright
level = int(sys.argv[1]) if len(sys.argv) > 1 else 1
troop = int(sys.argv[2]) if len(sys.argv) > 2 else 12
bots = sys.argv[3:] or ['middle', 'left', 'smart']
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8767', '--directory', 'dist'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={'width': 390, 'height': 844})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8767/index.html?snap&pr=0.25', wait_until='load')
        pg.wait_for_function('window.__game !== undefined', timeout=180000)
        for bot in bots:
            r = pg.evaluate(f'JSON.stringify(window.__game.sim("{bot}", {level}, {troop}))')
            print(r)
        for e in errs: print('PAGEERROR', e)
        b.close()
finally:
    srv.terminate()
