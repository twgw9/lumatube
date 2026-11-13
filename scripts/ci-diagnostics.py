import sys
from pathlib import Path
lines = Path(sys.argv[1]).read_text(errors='replace').splitlines()[-140:]
text = '\n'.join(lines)[-50000:]
print('::error title=Android diagnostics::' + text.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
