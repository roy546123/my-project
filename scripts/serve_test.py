"""Run browser tests against disposable data, never the user's portfolio."""
from pathlib import Path
import os
import sys
import tempfile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
with tempfile.TemporaryDirectory(prefix='moa-browser-') as folder:
    os.environ['INVEST_DATA_DIR']=folder
    (Path(folder)/'tessdata').symlink_to(Path(__file__).resolve().parents[1]/'.data/tessdata',target_is_directory=True)
    import uvicorn
    uvicorn.run('backend.app:app',host='127.0.0.1',port=8011)
