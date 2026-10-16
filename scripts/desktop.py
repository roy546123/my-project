"""Start the personal app, keep data across ZIP updates, and open the browser."""
from contextlib import contextmanager
import argparse
import hashlib
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parents[1]


def profile_path():
    if os.environ.get('INVEST_DATA_DIR'):
        return Path(os.environ['INVEST_DATA_DIR']).resolve()
    if os.name == 'nt':
        return Path(os.environ['LOCALAPPDATA']) / 'MoaInvest' / 'data'
    return ROOT / '.data'


@contextmanager
def instance_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        locked = False
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            locked = True
        except OSError:
            pass
        try:
            yield locked
        finally:
            if locked:
                handle.seek(0)
                if os.name == 'nt':
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle, fcntl.LOCK_UN)


def existing_url(data):
    try:
        status = json.loads((data / 'running.json').read_text())
        port = status['port']
        if type(port) is not int or not 1 <= port <= 65535:
            return None
        url = f'http://127.0.0.1:{port}'
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url + '/api/health', timeout=2) as response:
            info = json.load(response)
        expected = hashlib.sha256(str(data.resolve()).encode()).hexdigest()[:16]
        return url if info == {'application': 'moa-invest', 'profile': expected} else None
    except (OSError, ValueError, KeyError, urllib.error.URLError):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    data = profile_path()
    web = Path(os.environ.get('INVEST_WEB_DIR', ROOT / 'desktop' / 'web'))
    if not (web / 'index.html').is_file():
        raise SystemExit('화면 파일이 없습니다. 최신 ZIP을 다시 내려받아 압축을 모두 풀어 주세요.')
    os.environ['INVEST_DATA_DIR'] = str(data)
    os.environ['INVEST_WEB_DIR'] = str(web)
    sys.path.insert(0, str(ROOT))
    from backend.app import app, health
    import uvicorn
    if args.check:
        print(json.dumps({'ok': True, 'data': str(data), 'web': str(web), **health()}, ensure_ascii=False))
        return
    with instance_lock(data / 'desktop.lock') as locked:
        if not locked:
            for _ in range(100):
                url = existing_url(data)
                if url:
                    print('이미 실행 중인 모아를 엽니다: ' + url, flush=True)
                    if not args.no_browser:
                        webbrowser.open(url)
                    return
                time.sleep(.1)
            raise SystemExit('모아가 시작 중이거나 다른 실행 창이 열려 있습니다. 잠시 뒤 다시 실행해 주세요.')
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        if os.name == 'nt':
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            listener.bind(('127.0.0.1', args.port))
        except OSError:
            if args.port == 0:
                raise
            listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
        url = f'http://127.0.0.1:{port}'
        listener.listen(128)
        server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=port, log_level='warning'))

        def open_when_ready():
            for _ in range(200):
                if server.started:
                    temporary = data / 'running.json.tmp'
                    temporary.write_text(json.dumps({'port': port, 'pid': os.getpid()}))
                    temporary.replace(data / 'running.json')
                    print('\n모아가 열렸습니다: ' + url, flush=True)
                    print('이 창을 닫으면 프로그램이 종료됩니다. 기록한 데이터는 다음 실행 때도 유지됩니다.\n', flush=True)
                    if not args.no_browser:
                        webbrowser.open(url)
                    return
                if server.should_exit:
                    return
                time.sleep(.1)

        threading.Thread(target=open_when_ready, daemon=True).start()
        try:
            server.run(sockets=[listener])
        finally:
            server.should_exit = True
            listener.close()
            (data / 'running.json').unlink(missing_ok=True)


if __name__ == '__main__':
    main()
