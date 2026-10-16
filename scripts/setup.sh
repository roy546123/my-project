#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v tesseract >/dev/null || {
  echo 'Tesseract가 필요합니다. Ubuntu: sudo apt-get install tesseract-ocr / macOS: brew install tesseract'
  exit 1
}
python -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check --cache-dir .data/pip-cache -r requirements.txt
npm ci --cache .data/npm-cache --no-audit --no-fund
.venv/bin/python - <<'PY'
from pathlib import Path
from urllib.request import urlopen
import hashlib
folder=Path('.data/tessdata')
folder.mkdir(parents=True,exist_ok=True)
checksums={
 'kor':'6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2',
 'eng':'7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
}
for lang,expected in checksums.items():
 path=folder/f'{lang}.traineddata'
 if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==expected:
  continue
 url=f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/{lang}.traineddata'
 with urlopen(url,timeout=60) as response:
  content=response.read()
 if hashlib.sha256(content).hexdigest()!=expected:
  raise RuntimeError(f'{lang} 인식 모델의 체크섬이 일치하지 않습니다.')
 path.write_bytes(content)
print('한국어·영어 OCR 모델 준비 완료')
PY
npm run build
echo '설치 완료. npm start로 실행하세요.'
