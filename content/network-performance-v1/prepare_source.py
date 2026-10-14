"""Build traceable excerpts from the preserved upstream snapshot; no network access."""
from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parent
REVISION = '5deec5e741e2b8c0bc44566108a24cb783c2c7de'
BASE = f'https://github.com/SystemsApproach/book/blob/{REVISION}'
SOURCE_URL = BASE + '/foundation/performance.rst'

def write_json(name, data):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

data = (ROOT / 'upstream/performance.rst').read_bytes()
lines = data.decode('utf-8').splitlines(keepends=True)
assert lines[13].strip() == '1.5.1 Bandwidth and Latency'
assert lines[187].startswith('1.5.2 Delay')
excerpt = ''.join(lines[13:187])
(ROOT / 'reading-original.rst').write_bytes(excerpt.encode('utf-8'))

ranges = [
    ('P01', 17, 25, 'Bandwidth and bit transmission time'),
    ('P02', 27, 33, 'Bandwidth terminology'),
    ('P03', 35, 46, 'Available data rate and measured throughput'),
    ('P04', 48, 54, 'Application bandwidth requirements'),
    ('P05', 56, 70, 'Link and channel bandwidth'),
    ('P06', 83, 92, 'One way latency and round trip time'),
    ('P07', 94, 107, 'Propagation transmission and queuing'),
    ('P08', 109, 121, 'Delay equations and definitions'),
    ('P09', 123, 134, 'Small messages and latency'),
    ('P10', 136, 145, 'Large transfers and bandwidth'),
    ('P11', 155, 167, 'Interpreting the performance figure'),
    ('P12', 169, 175, 'Latency terminology in context'),
    ('P13', 177, 186, 'An illustration of waiting for a response'),
]
passages = []
for pid, start, end, label in ranges:
    raw = ''.join(lines[start-1:end])
    passages.append(dict(id=pid, label=label, source_id='peterson_davie_1_5_1',
        source_commit=REVISION, upstream_path='foundation/performance.rst',
        start_line=start, end_line=end, url=f'{SOURCE_URL}#L{start}-L{end}',
        text=raw, sha256=hashlib.sha256(raw.encode('utf-8')).hexdigest()))
write_json('passages.json', dict(schema_version='1.0', assignment_id='network_performance_v1',
    source_id='peterson_davie_1_5_1', source_commit=REVISION,
    policy='Only these passages from section 1.5.1 are assigned. Do not ingest the rest of upstream/performance.rst into the tutor.',
    passages=passages))

manifest = dict(schema_version='1.0', package_id='network-performance-v1',
    assignment_id='network_performance_v1', title='Network Performance',
    created_on='2026-10-13', source_title='Computer Networks: A Systems Approach',
    authors=['Larry Peterson', 'Bruce Davie'], copyright='Elsevier, 2012',
    source_id='peterson_davie_1_5_1', source_section='1.5.1 Bandwidth and Latency',
    source_commit=REVISION, source_url=SOURCE_URL, source_line_range=[14,187],
    license_id='CC-BY-4.0', license_url='https://creativecommons.org/licenses/by/4.0/',
    upstream_license_url=BASE+'/LICENSE', upstream_readme_url=BASE+'/README.rst',
    source_sha256=hashlib.sha256(data).hexdigest(),
    excerpt_sha256=hashlib.sha256(excerpt.encode('utf-8')).hexdigest(),
    teacher_review=dict(status='pending_teacher_review', approved_by=None, approved_at=None),
    validation_scope='Source provenance, package structure, calculations, and editorial review; not empirical educational validation or a live AI evaluation.',
    assigned_passage_ids=[p['id'] for p in passages],
    source_transformations=[
        'reading-original.rst is an exact contiguous UTF-8 excerpt of upstream lines 14 through 187.',
        'passages.json preserves exact paragraph spans and source line numbers.',
        'reading.md reflows paragraphs, renders RST roles and adds navigation. Figure images and captions are omitted and their positions marked. Two separately labeled project notes flag a source simplification and a units typo; they are not textbook passages.',
        'Questions, objectives, hypotheses and demonstration text are newly authored and kept in separate files.'
    ],
    source_cautions=[
        'The upstream README sentence about derivative works conflicts with the CC BY 4.0 LICENSE adaptation grant. Both source files are retained; this package does not settle that legal inconsistency.',
        'The source initially uses bandwidth/throughput loosely before distinguishing available rate from measured performance. Accept accurate explanations rather than penalizing synonyms alone.',
        'The source uses latency generically. Every assessment specifies one-way latency or RTT explicitly.',
        'The one-bit simplification in P08 is not assessed. Use finite packets and stated assumptions.',
        'P10 contains a dimensional typo in the original displayed calculation: its denominator says 10 x 10^6 Mbps where 10 x 10^6 bits/s is intended. The 20-second result is correct. Preserve the source but use dimensionally correct arithmetic in assessment.',
        'The source uses a simplified three-component delay model. Processing, multi-hop aggregation and advanced queuing models are outside assessment scope.',
        'Queuing is introduced briefly. Questions use given waiting times, basic definition and delay arithmetic; traffic-dependent queue theory is not inferred from this excerpt.'
    ])
write_json('manifest.json', manifest)

def display_text(raw):
    s = raw.strip()
    s = re.sub(r':numref:`Figure\s+%s\s+<([^>]+)>`', lambda m: f'[the referenced figure]({SOURCE_URL})', s, flags=re.S)
    s = re.sub(r'\\\s*:sup:`([^`]+)`', lambda m: f'<sup>{m.group(1)}</sup>', s)
    s = s.replace('``', '`')
    if s.startswith('::'):
        pre, remainder = s[2:].strip().split('\n\n', 1)
        pre = '\n'.join(line.strip() for line in pre.splitlines())
        return '```text\n'+pre+'\n```\n\n'+' '.join(remainder.splitlines())
    return ' '.join(s.splitlines())

out = ['# Network Performance Reading', '',
    'Assigned excerpt from **Computer Networks: A Systems Approach**, Larry Peterson and Bruce Davie, section 1.5.1, **Bandwidth and Latency**. Copyright Elsevier, 2012. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).', '',
    f'[Fixed source version]({SOURCE_URL}#L14-L187). [Attribution and reuse notes](ATTRIBUTION.md).', '',
    'This text view preserves the excerpt wording while reflowing paragraphs and displaying source markup. Figure images and captions are omitted and marked below. The exact source excerpt is available in [reading-original.rst](reading-original.rst). Passage labels and headings are navigation added for this demo. Two separately labeled project notes identify a source simplification and a units typo.', '']
for p in passages:
    out += [f"## {p['id']} {p['label']}", '', display_text(p['text']), '',
        f"[Source lines {p['start_line']} to {p['end_line']}]({p['url']})", '']
    if p['id'] in ('P05','P10'):
        out += ['*Figure and caption omitted from this text view; see the fixed source version.*', '']
    if p['id'] == 'P08':
        out += ['**Project teaching note, separate from the source:** The one-bit sentence is a simplification and is not an assessment rule for this lesson. Our questions use finite packets and the stated transmission formula. A finite link rate gives a nonzero time to transmit a bit.', '']
    if p['id'] == 'P10':
        out += ['**Project editorial note, separate from the source:** The original numerical expression has a units typo in its denominator. The intended calculation is `(25 x 10^6 bytes x 8 bits/byte) / (10 x 10^6 bits/s) = 20 seconds`. The original passage is retained above for traceability.', '']
(ROOT/'reading.md').write_text('\n'.join(out), encoding='utf-8')
print(f'Prepared {len(passages)} traceable passages and exact section 1.5.1 excerpt.')
