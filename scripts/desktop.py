"""Start the personal app, keep data across ZIP updates, and open the browser."""
from contextlib import contextmanager
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from urllib.parse import urljoin
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
        return url if info.get('application') == 'moa-invest' and info.get('profile') == expected else None
    except (OSError, ValueError, KeyError, urllib.error.URLError):
        return None


def bundle_id(web):
    manifest = web.parent / 'manifest.json'
    if not manifest.is_file():
        raise RuntimeError('화면 검증 파일이 없습니다. ZIP을 모두 압축 풀기 해 주세요.')
    return hashlib.sha256(manifest.read_bytes()).hexdigest()[:16]


def check_bundle(web):
    manifest = json.loads((web.parent / 'manifest.json').read_text())
    for name, digest in manifest.items():
        path = web / name
        if not path.resolve().is_relative_to(web.resolve()):
            raise RuntimeError('올바른 화면 파일 목록이 아닙니다.')
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise RuntimeError('화면 파일이 없거나 불완전합니다: ' + name + '\nZIP을 새 폴더에 모두 압축 풀기 해 주세요.')
    return manifest


def verify_connection(url, web):
    """Verify real HTTP and MIME responses, not just a PID or listening socket."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url + '/api/state', timeout=5) as response:
        state = json.load(response)
    if not all(isinstance(state.get(key), list) for key in ['holdings', 'snapshots', 'plans', 'trades']):
        raise RuntimeError('자산 서버가 올바른 응답을 반환하지 않았습니다.')
    with opener.open(url + '/', timeout=5) as response:
        if response.headers.get_content_type() != 'text/html':
            raise RuntimeError('프로그램 화면 응답 형식이 올바르지 않습니다.')
    manifest = json.loads((web.parent / 'manifest.json').read_text())
    for name in manifest:
        if not name.endswith(('.js', '.css', '.wasm')):
            continue
        request = urllib.request.Request(urljoin(url + '/', name), method='HEAD')
        with opener.open(request, timeout=5) as response:
            content_type = response.headers.get_content_type()
            allowed = ['text/javascript', 'application/javascript'] if name.endswith('.js') else ['application/wasm'] if name.endswith('.wasm') else ['text/css']
            if content_type not in allowed:
                raise RuntimeError('화면 파일 형식 오류: ' + name + ' (' + content_type + ')')


def diagnose(data, web):
    lines = ['모아 연결 진단', '개인 자산 금액과 종목명은 이 보고서에 포함하지 않습니다.']
    try:
        check_bundle(web)
        lines.append('화면 파일: 정상')
    except Exception as error:
        lines.append('화면 파일: ' + str(error))
    url = existing_url(data)
    if url:
        lines.append('실행 주소: ' + url)
        try:
            verify_connection(url, web)
            lines.append('서버 및 화면 파일 연결: 정상')
            lines.append('브라우저에서 위 실행 주소를 새 탭으로 열어 주세요.')
        except Exception as error:
            lines.append('서버 및 화면 파일 연결: 실패 - ' + str(error))
    else:
        lines.append('서버 연결: 실패 또는 아직 시작되지 않음')
        lines.append('이전 실행 창을 닫고 새 폴더의 모아 시작.bat을 실행해 주세요.')
    log_dir = data.parent / 'logs'
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / 'connection-check.txt'
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8-sig')
    print('\n'.join(lines) + '\n진단 파일: ' + str(path), flush=True)
    return path


def stop_instance(data):
    url = existing_url(data)
    if not url:
        print('실행 중인 모아 서버가 없습니다.', flush=True)
        return
    status = json.loads((data / 'running.json').read_text())
    if not status.get('token'):
        raise RuntimeError('이전 버전의 모아입니다. 이전 검은 실행 창을 직접 닫아 주세요.')
    request = urllib.request.Request(url + '/api/desktop/stop', method='POST', headers={'X-Moa-Desktop-Token': status['token']})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=5) as response:
        json.load(response)
    for _ in range(100):
        if not existing_url(data):
            with instance_lock(data / 'desktop.lock') as released:
                if released:
                    print('모아를 종료했습니다. 저장된 기록은 유지됩니다.', flush=True)
                    return
        time.sleep(.1)
    raise RuntimeError('서버 종료를 기다리는 중입니다. 잠시 후 다시 확인해 주세요.')


def start_background(data, web, args):
    bundle = bundle_id(web)
    url = existing_url(data)
    if url:
        status = json.loads((data / 'running.json').read_text())
        if status.get('bundle') != bundle:
            if status.get('token'):
                stop_instance(data)
                url = None
            else:
                raise RuntimeError('이전 버전의 모아가 실행 중입니다. 이전 검은 실행 창을 닫은 뒤 새 버전을 실행해 주세요.')
        else:
            verify_connection(url, web)
    if not url:
        logs = data.parent / 'logs'
        logs.mkdir(parents=True, exist_ok=True)
        output_path = logs / 'server.log'
        command = [sys.executable, str(ROOT / 'scripts/desktop.py'), '--no-browser', '--port', str(args.port)]
        options = {'creationflags': subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
        with output_path.open('a', encoding='utf-8') as output:
            child = subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT, close_fds=True, **options)
        try:
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                url = existing_url(data)
                if url:
                    status = json.loads((data / 'running.json').read_text())
                    if status.get('bundle') != bundle:
                        raise RuntimeError('이전 버전이 실행 중입니다. 이전 실행 창을 닫고 다시 시작해 주세요.')
                    verify_connection(url, web)
                    break
                if child.poll() is not None:
                    raise RuntimeError('서버가 시작 중 종료되었습니다. 기록 파일: ' + str(output_path))
                time.sleep(.1)
            else:
                raise RuntimeError('서버 연결 확인 시간이 초과되었습니다. 기록 파일: ' + str(output_path))
        except BaseException:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=10)
            raise
    print('모아가 준비됐습니다: ' + url, flush=True)
    print('이 창을 닫아도 모아는 계속 실행됩니다. 종료할 때는 모아 종료.bat을 누르세요.', flush=True)
    if not args.no_browser:
        webbrowser.open(url)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--background', action='store_true')
    parser.add_argument('--stop', action='store_true')
    parser.add_argument('--diagnose', action='store_true')
    args = parser.parse_args()
    data = profile_path()
    web = Path(os.environ.get('INVEST_WEB_DIR', ROOT / 'desktop' / 'web'))
    data.mkdir(parents=True, exist_ok=True)
    if args.diagnose:
        diagnose(data, web)
        return
    if args.stop:
        stop_instance(data)
        return
    if not (web / 'index.html').is_file():
        raise SystemExit('화면 파일이 없습니다. 최신 ZIP을 다시 내려받아 압축을 모두 풀어 주세요.')
    os.environ['INVEST_DATA_DIR'] = str(data)
    os.environ['INVEST_WEB_DIR'] = str(web)
    check_bundle(web)
    if args.background:
        try:
            start_background(data, web, args)
        except Exception:
            diagnose(data, web)
            raise
        return
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
        token = secrets.token_hex(32)
        bundle = bundle_id(web)
        app.state.desktop_bundle = bundle
        app.state.desktop_stop_token = token
        app.state.desktop_stop = lambda: setattr(server, 'should_exit', True)

        def open_when_ready():
            for _ in range(200):
                if server.started:
                    temporary = data / 'running.json.tmp'
                    temporary.write_text(json.dumps({'port': port, 'pid': os.getpid(), 'token': token, 'bundle': bundle}))
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
    try:
        main()
    except Exception as error:
        print('모아 실행 실패: ' + str(error), file=sys.stderr, flush=True)
        raise SystemExit(1)
