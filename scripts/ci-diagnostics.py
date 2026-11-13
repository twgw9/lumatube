import sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(errors='replace')
for line in text.splitlines()[-160:]:
    print('::error title=Android diagnostics::' + line[:700].replace('%','%25').replace('\r','%0D'))
