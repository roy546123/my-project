"""Initial migration: python scripts/import_excel.py /path/to/file.xlsx [--replace]."""
import argparse
from pathlib import Path
import sys

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.app import commit_import
from backend.excel import parse_workbook

parser=argparse.ArgumentParser(description='모아로 투자관리 엑셀 가져오기')
parser.add_argument('file',type=Path)
parser.add_argument('--replace',action='store_true',help='기존 데이터를 백업한 뒤 교체')
args=parser.parse_args()
parsed=parse_workbook(args.file.read_bytes())
result=commit_import(parsed,args.file.name,args.replace)
print(f"보유자산 {len(parsed['holdings'])}개, 일별 기록 {len(parsed['snapshots'])}개, DCA 계획 {len(parsed['plans'])}개를 가져왔습니다.")
if result['backup']:
    print('교체 전 자동 백업:',result['backup'])
