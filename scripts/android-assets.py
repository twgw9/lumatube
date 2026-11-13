"""Package local-only Android shell; block iframes that could access the JS interface."""
from pathlib import Path
root = Path('android/app/src/main/assets')
index = root / 'public/index.html'
csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https:; media-src https: blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'"
html = index.read_text().replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="'+csp+'">')
index.write_text(html)
# Frontend uses /assets/*.js and /logo.svg; put the bundle root at the asset-loader root.
import shutil
for child in (root / 'public').iterdir():
    destination = root / child.name
    if child.is_dir(): shutil.copytree(child, destination, dirs_exist_ok=True)
    else: shutil.copy2(child, destination)

shutil.rmtree(root / "public")
(root / "media/preview.mp4").unlink(missing_ok=True)
