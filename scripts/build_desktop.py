"""Prepare checked-in Windows UI with local OCR. No user data is packaged."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public' / 'ocr'
ASSETS.mkdir(parents=True, exist_ok=True)
for filename in ['worker.min.js', 'worker.min.js.LICENSE.txt']:
    shutil.copyfile(ROOT / 'node_modules/tesseract.js/dist' / filename, ASSETS / filename)
shutil.copyfile(ROOT / 'node_modules/tesseract.js/LICENSE.md', ASSETS / 'TESSERACT-JS-LICENSE.txt')
shutil.copyfile(ROOT / 'node_modules/tesseract.js-core/LICENSE', ASSETS / 'TESSERACT-CORE-LICENSE.txt')
for kind in ['lstm', 'simd-lstm', 'relaxedsimd-lstm']:
    for suffix in ['wasm.js', 'wasm']:
        filename = f'tesseract-core-{kind}.{suffix}'
        shutil.copyfile(ROOT / 'node_modules/tesseract.js-core' / filename, ASSETS / filename)
for lang, expected in {
    'kor': '6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2',
    'eng': '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2',
}.items():
    local = ROOT / '.data/tessdata' / f'{lang}.traineddata'
    content = local.read_bytes() if local.exists() else urlopen(f'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/{lang}.traineddata', timeout=60).read()
    if hashlib.sha256(content).hexdigest() != expected:
        raise RuntimeError(f'{lang} OCR model checksum does not match')
    (ASSETS / f'{lang}.traineddata').write_bytes(content)
(ASSETS / 'NOTICE.txt').write_text('Tesseract.js and Tesseract.js-core are distributed under Apache-2.0.\nLanguage models: tesseract-ocr/tessdata_fast 4.1.0, Apache-2.0.\nhttps://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0\n', encoding='utf-8')
subprocess.run(['npm.cmd' if __import__('os').name == 'nt' else 'npm', 'run', 'build'], cwd=ROOT, check=True)
target = ROOT / 'desktop/web'
if target.exists():
    shutil.rmtree(target)
shutil.copytree(ROOT / 'dist', target)
manifest = {str(p.relative_to(target)): hashlib.sha256(p.read_bytes()).hexdigest() for p in target.rglob('*') if p.is_file()}
(ROOT / 'desktop/manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Windows UI prepared: {len(manifest)} files. User database excluded.')
