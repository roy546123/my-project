import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


class DesktopTests(unittest.TestCase):
    def test_bundle_manifest_and_windows_entrypoint(self):
        manifest = json.loads((ROOT / 'desktop/manifest.json').read_text())
        for name, expected in manifest.items():
            self.assertEqual(hashlib.sha256((ROOT / 'desktop/web' / name).read_bytes()).hexdigest(), expected, name)
        self.assertTrue((ROOT / '모아 시작.bat').is_file())
        self.assertTrue((ROOT / 'scripts/windows-start.ps1').read_bytes().startswith(b'\xef\xbb\xbf'))

    def test_start_reopen_port_conflict_and_data_survives_restart(self):
        with tempfile.TemporaryDirectory(prefix='moa-desktop-') as tmp, socket.socket() as occupied:
            occupied.bind(('127.0.0.1', 0))
            occupied.listen(1)
            env = {**os.environ, 'INVEST_DATA_DIR': tmp, 'INVEST_WEB_DIR': str(ROOT / 'desktop/web')}
            command = [sys.executable, str(ROOT / 'scripts/desktop.py'), '--no-browser', '--port', str(occupied.getsockname()[1])]
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

            def wait_ready(process):
                for _ in range(100):
                    self.assertIsNone(process.poll(), 'Desktop process exited during startup')
                    try:
                        port = json.loads((Path(tmp) / 'running.json').read_text())['port']
                        url = f'http://127.0.0.1:{port}'
                        with opener.open(url + '/api/health', timeout=1) as response:
                            if json.load(response)['application'] == 'moa-invest':
                                return url
                    except (OSError, ValueError, KeyError):
                        pass
                    time.sleep(.1)
                self.fail('Desktop server did not start')

            process = subprocess.Popen(command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                url = wait_ready(process)
                self.assertNotEqual(int(url.rsplit(':',1)[1]), occupied.getsockname()[1])
                with opener.open(url + '/') as response:
                    self.assertEqual(response.status, 200)
                repeated = subprocess.run(command, env=env, capture_output=True, timeout=15)
                self.assertEqual(repeated.returncode, 0, repeated.stderr)
                req = urllib.request.Request(url + '/api/holdings', data=json.dumps(dict(broker='test', account='test', name='QLD', ticker='QLD', cost=10000, value=12000)).encode(), headers={'Content-Type':'application/json'})
                with opener.open(req) as response:
                    self.assertEqual(response.status, 200)
            finally:
                process.terminate()
                process.wait(timeout=10)
            second = subprocess.Popen(command, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                url = wait_ready(second)
                with opener.open(url + '/api/state') as response:
                    holdings = json.load(response)['holdings']
                self.assertEqual(len(holdings),1)
                self.assertEqual(holdings[0]['value'],12000)
            finally:
                second.terminate()
                second.wait(timeout=10)
