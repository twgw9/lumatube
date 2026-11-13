import sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(errors='replace')
lines = text.splitlines()
important = []
for i, line in enumerate(lines):
    if 'Error:' in line or line.startswith('e: ') or '* What went wrong' in line or 'Could not' in line or 'Lint found' in line:
        important.extend(lines[max(0,i-1):i+7])
message = '\n'.join(important + ['--- log tail ---'] + lines[-45:])[:50000]
print('::error title=Android diagnostics::' + message.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
