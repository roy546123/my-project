"""Create the actual ZIP offered to nondeveloper Windows users."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
output = ROOT / 'releases/Moa-Windows.zip'
output.parent.mkdir(exist_ok=True)
files = [ROOT / name for name in ['모아 시작.bat', '처음 읽어주세요.txt', 'requirements.txt']]
files += [ROOT / 'scripts' / name for name in ['windows-start.ps1', 'desktop.py']]
files += sorted((ROOT / 'backend').glob('*.py'))
files += sorted(p for p in (ROOT / 'desktop').rglob('*') if p.is_file())
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        archive.write(path, 'Moa/' + path.relative_to(ROOT).as_posix())
with zipfile.ZipFile(output) as archive:
    if archive.testzip():
        raise RuntimeError('ZIP integrity check failed')
    assert 'Moa/모아 시작.bat' in archive.namelist()
    assert not any('/.data/' in name or name.endswith('.sqlite3') for name in archive.namelist())
print(f'Windows download: {output.relative_to(ROOT)} ({output.stat().st_size / 1048576:.1f} MB), no user data')
