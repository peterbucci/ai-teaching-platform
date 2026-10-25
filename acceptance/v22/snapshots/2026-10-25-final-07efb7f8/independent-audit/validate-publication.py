"""Validate a fresh published snapshot without changing its evidence files."""
import hashlib
import json
import re
import struct
import subprocess
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import unquote

root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
plan = json.loads((root / 'publication/PUBLICATION_PLAN.json').read_text(encoding='utf-8-sig'))
errors = []
counts = Counter()
image_dimensions = Counter()
for entry in plan['files']:
    if entry['decision'] != 'include':
        continue
    path = (root / entry['destination']).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        errors.append({'file':entry['destination'],'reason':'missing or escaping selected file'})
        continue
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != entry['published_sha256']:
        errors.append({'file':entry['destination'],'reason':'published hash mismatch'})
    counts['hashes'] += 1
    if path.suffix == '.json':
        try:
            json.loads(raw.decode('utf-8-sig'))
            counts['json'] += 1
        except ValueError:
            errors.append({'file':entry['destination'],'reason':'invalid JSON'})
    if path.suffix == '.png':
        if raw[:8] != b'\x89PNG\r\n\x1a\n' or len(raw)<24:
            errors.append({'file':entry['destination'],'reason':'invalid PNG signature'})
        else:
            dimensions = struct.unpack('>II', raw[16:24])
            image_dimensions['x'.join(map(str,dimensions))] += 1
            counts['png'] += 1
    if path.suffix in ('.mjs','.cjs','.js'):
        p = subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
        if p.returncode:
            errors.append({'file':entry['destination'],'reason':'JavaScript syntax failure','diagnostic':p.stderr[:500]})
        counts['scripts'] += 1

for path in sorted(root.glob('*.md')) + [root/'comparison-gallery.html']:
    source = path.read_text(encoding='utf-8-sig')
    if path.suffix == '.html':
        links = re.findall(r'(?:href|src)="([^"]+)"',source)
    else:
        links = re.findall(r'\]\(([^)]+)\)',source)
    for link in links:
        link = link.strip('<>')
        if re.match(r'^(?:https?:|mailto:|codex:|data:|#)',link):
            continue
        if re.match(r'^[A-Za-z]:[/\\]',link):
            errors.append({'file':path.name,'reason':'nonportable absolute link','target':link})
            continue
        target = unquote(link.split('#')[0].split('?')[0])
        if target and not (path.parent/target).is_file():
            errors.append({'file':path.name,'reason':'missing local link','target':target})
        counts['localLinks'] += 1

result = {'status':'passed' if not errors else 'failed','snapshot':str(root),'counts':dict(counts),'imageDimensions':dict(image_dimensions),'errors':errors,'scope':'Selected file hashes, JSON parse, PNG signature/dimensions, JavaScript syntax, top-level Markdown and gallery local links. Does not replace pixel or semantic review.'}
out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
sys.exit(bool(errors))
