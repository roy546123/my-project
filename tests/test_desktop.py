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

    def test_background_survives_starter_exit_diagnoses_and_stops_with_key(self):
        with tempfile.TemporaryDirectory(prefix='moa-background-') as tmp:
            data = Path(tmp) / 'data'
            env = {**os.environ, 'INVEST_DATA_DIR': str(data), 'INVEST_WEB_DIR': str(ROOT / 'desktop/web')}
            command = [sys.executable, str(ROOT / 'scripts/desktop.py')]
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

            def run(*args):
                return subprocess.run(command + list(args), env=env, capture_output=True, timeout=30)

            try:
                start = run('--background', '--no-browser', '--port', '0')
                self.assertEqual(start.returncode, 0, start.stderr)
                status = json.loads((data / 'running.json').read_text())
                url = f"http://127.0.0.1:{status['port']}"
                with opener.open(url + '/api/health') as response:
                    self.assertEqual(json.load(response)['application'], 'moa-invest')
                repeated = run('--background', '--no-browser', '--port', '0')
                self.assertEqual(repeated.returncode, 0, repeated.stderr)
                self.assertEqual(json.loads((data / 'running.json').read_text())['pid'], status['pid'])
                req = urllib.request.Request(url + '/api/desktop/stop', method='POST', headers={'X-Moa-Desktop-Token':'wrong'})
                with self.assertRaises(urllib.error.HTTPError) as caught:
                    opener.open(req)
                self.assertEqual(caught.exception.code, 403)
                holding = dict(broker='test', account='test', name='PRIVATE_ASSET_DO_NOT_LOG', ticker='TEST', cost=987654321, value=987654320)
                request = urllib.request.Request(url + '/api/holdings', data=json.dumps(holding).encode(), headers={'Content-Type':'application/json'})
                with opener.open(request) as response:
                    self.assertEqual(response.status, 200)
                diagnostic = run('--diagnose')
                self.assertEqual(diagnostic.returncode, 0, diagnostic.stderr)
                report = (data.parent / 'logs/connection-check.txt').read_text(encoding='utf-8-sig')
                self.assertIn('서버 및 화면 파일 연결: 정상', report)
                self.assertNotIn('PRIVATE_ASSET_DO_NOT_LOG', report)
                self.assertNotIn('987654321', report)
                self.assertNotIn(status['token'], report)
                stopped = run('--stop')
                self.assertEqual(stopped.returncode, 0, stopped.stderr)
                with self.assertRaises(OSError):
                    opener.open(url + '/api/health', timeout=1)
                self.assertTrue((data / 'portfolio.sqlite3').is_file())
            finally:
                run('--stop')

    def test_missing_ocr_module_is_reported_before_a_server_is_started(self):
        import shutil
        with tempfile.TemporaryDirectory(prefix='moa-missing-') as tmp:
            folder = Path(tmp)
            shutil.copytree(ROOT / 'desktop', folder / 'desktop')
            manifest = json.loads((folder / 'desktop/manifest.json').read_text())
            module = next(name for name in manifest if name.startswith('assets/browserOcr-'))
            (folder / 'desktop/web' / module).unlink()
            env = {**os.environ, 'INVEST_DATA_DIR': str(folder / 'data'), 'INVEST_WEB_DIR': str(folder / 'desktop/web')}
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/desktop.py'), '--background', '--no-browser'], env=env, capture_output=True, text=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(module, result.stderr)
            self.assertFalse((folder / 'data/running.json').exists())
