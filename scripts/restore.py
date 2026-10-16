"""Restore a downloaded SQLite backup with the server stopped."""
import argparse
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
parser=argparse.ArgumentParser(description='모아 데이터 복원 (서버를 먼저 종료해 주세요)')
parser.add_argument('backup',type=Path)
args=parser.parse_args()
if not args.backup.is_file():
    parser.error('백업 파일이 없습니다.')
with sqlite3.connect(f'{args.backup.resolve().as_uri()}?mode=ro',uri=True) as source:
    if source.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
        parser.error('백업 파일의 무결성 검사에 실패했습니다.')
    tables={r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if not {'holdings','plans','trades','snapshots','meta'}.issubset(tables):
        parser.error('모아의 백업 파일이 아닙니다.')
    from backend.app import DB,backup
    if args.backup.resolve()==DB.resolve():
        parser.error('현재 사용 중인 데이터베이스를 복원 원본으로 지정할 수 없습니다.')
    saved=backup()
    with sqlite3.connect(DB) as dest:
        source.backup(dest)
print('복원을 완료했습니다. 복원 전 데이터 백업:',saved)
