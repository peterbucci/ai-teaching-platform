"""Check content integrity and arithmetic; this is not an AI or learning evaluation."""
from pathlib import Path
from collections import Counter
from datetime import datetime
import ast
import hashlib
import json
import math
import operator
import re

ROOT = Path(__file__).resolve().parent
checks = []

def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))

def check(name, condition):
    checks.append({'check': name, 'passed': bool(condition)})

def sha(data):
    return hashlib.sha256(data).hexdigest()

def valid_approval_timestamp(value):
    try:
        return datetime.fromisoformat(value).utcoffset() is not None
    except (TypeError, ValueError):
        return False

def walk(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)

def calculate(expression, names):
    """Evaluate only literal numbers, named inputs and four arithmetic operators."""
    operations = {ast.Add: operator.add, ast.Sub: operator.sub,
                  ast.Mult: operator.mul, ast.Div: operator.truediv}
    def visit(node):
        if isinstance(node, ast.Expression): return visit(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float): return node.value
        if isinstance(node, ast.Name): return names[node.id]
        if isinstance(node, ast.BinOp) and type(node.op) in operations:
            return operations[type(node.op)](visit(node.left), visit(node.right))
        raise ValueError('Unsupported calculation')
    return visit(ast.parse(expression, mode='eval'))

manifest = read('manifest.json')
download = read('upstream/download-manifest.json')
for entry in download['files']:
    data = (ROOT / 'upstream' / entry['path']).read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    check('Upstream integrity: ' + entry['path'], len(data) == entry['bytes'] and
          sha(data) == entry['sha256'] and blob == entry['git_blob_sha'])
check('Pinned upstream commit', manifest['source_commit'] == download['commit'])
source = (ROOT / 'upstream/performance.rst').read_bytes()
check('Full source digest', sha(source) == manifest['source_sha256'])
source_lines = source.decode('utf-8').splitlines(keepends=True)
start, end = manifest['source_line_range']
excerpt = (ROOT / 'reading-original.rst').read_bytes()
check('Exact contiguous assigned excerpt', excerpt == ''.join(source_lines[start-1:end]).encode('utf-8'))
check('Assigned excerpt digest', sha(excerpt) == manifest['excerpt_sha256'])
passages = read('passages.json')['passages']
passage_ids = {p['id'] for p in passages}
check('Unique passage allowlist', len(passage_ids) == len(passages) and
      passage_ids == set(manifest['assigned_passage_ids']))
for passage in passages:
    a, b = passage['start_line'], passage['end_line']
    exact = ''.join(source_lines[a-1:b])
    check('Exact passage ' + passage['id'], start <= a <= b <= end and
          exact == passage['text'] and sha(exact.encode('utf-8')) == passage['sha256'] and
          manifest['source_commit'] in passage['url'])

concept_doc = read('concepts.json')
bank = read('question-bank.json')
sequence = read('diagnostic-sequence.json')
evidence = read('evidence-spec.json')
concepts = concept_doc['concepts']
questions = bank['questions']
concept_ids = {c['id'] for c in concepts}
question_ids = {q['id'] for q in questions}
check('Five unique concepts', len(concepts) == len(concept_ids) == 5)
check('Fifteen unique questions', len(questions) == len(question_ids) == 15)
check('Three questions per concept', Counter(q['concept_id'] for q in questions) ==
      Counter({c: 3 for c in concept_ids}))
misconceptions = [m for c in concepts for m in c['common_misconceptions']]
misconceptions += concept_doc['global_misconceptions']
misconception_ids = {m['id'] for m in misconceptions}
check('Unique misconception IDs', len(misconception_ids) == len(misconceptions))
review = manifest['teacher_review']
review_status = review.get('status')
check('Valid teacher review status', review_status in ('pending_teacher_review', 'approved'))
check('Teacher approval metadata',
      (review_status == 'pending_teacher_review' and
       all(key in review and review[key] is None for key in ('approved_by', 'approved_at'))) or
      (review_status == 'approved' and isinstance(review.get('approved_by'), str) and
       bool(review['approved_by'].strip()) and valid_approval_timestamp(review.get('approved_at'))))
for name, doc in [('concepts', concept_doc), ('bank', bank)]:
    check(name + ' consistent review status', doc.get('review_status') == review_status)
for concept in concepts:
    check(concept['id'] + ' consistent review status', concept.get('review_status') == review_status)
for name, doc in [('concepts', concept_doc), ('bank', bank), ('sequence', sequence), ('evidence', evidence)]:
    check(name + ' assignment identity', doc['assignment_id'] == manifest['assignment_id'])
    for item in walk(doc):
        for key in ('source_passage_ids',):
            if key in item:
                check(name + ' valid passage reference', isinstance(item[key], list) and bool(item[key]) and set(item[key]) <= passage_ids)
        if 'passage_id' in item:
            check(name + ' valid passage reference', item['passage_id'] in passage_ids)
        if 'concept_id' in item:
            check(name + ' valid concept reference', item['concept_id'] in concept_ids)
        if 'concept_ids' in item:
            check(name + ' valid concept references', set(item['concept_ids']) <= concept_ids)
        if 'misconception_ids' in item:
            check(name + ' valid misconception reference', set(item['misconception_ids']) <= misconception_ids)
        if 'hypothesis_id' in item:
            check(name + ' valid hypothesis reference', item['hypothesis_id'] in misconception_ids)
for question in questions:
    check(question['id'] + ' consistent review status', question.get('review_status') == review_status)
    check(question['id'] + ' nonempty prompt', isinstance(question.get('prompt'), str) and bool(question['prompt'].strip()))
    check(question['id'] + ' nonempty expected answer', isinstance(question.get('expected_answer'), str) and bool(question['expected_answer'].strip()))
    check(question['id'] + ' reasoning and source support', bool(question['required_reasoning']) and bool(question['source_passage_ids']))
    check(question['id'] + ' embedded assistance metadata present', isinstance(question.get('embedded_scaffolding'), list))
    for support in question.get('embedded_scaffolding', []):
        check(question['id'] + ' embedded assistance complete',
              support.get('type') in {'supplied_formula', 'supplied_relationship', 'answer_hint', 'unit_conversion_support'} and
              bool(support.get('supplied_content')) and bool(support.get('affected_rubric_criteria')))
    if 'numeric_check' in question:
        numeric = question['numeric_check']
        check(question['id'] + ' arithmetic', math.isclose(calculate(numeric['formula'], numeric['inputs']), numeric['result']))
check('Evidence source digest', evidence['source_provenance']['excerpt_sha256'] == manifest['excerpt_sha256'])

nodes = {node['node_id']: node for node in sequence['nodes']}
check('Unique diagnostic node IDs', len(nodes) == len(sequence['nodes']))
initial = next(q for q in questions if q['id'] == sequence['initial_question_id'])
check('Initial prompt matches bank', nodes[initial['id']]['prompt'] == initial.get('prompt'))
for item in walk(sequence):
    if 'input_at' in item:
        check('Valid acceptance-case input node', item['input_at'] in nodes)
    for key, value in item.items():
        if key.endswith('next_node_id') and value is not None:
            check('Valid diagnostic route ' + value, value in nodes)
for node_id, expected in {
    'D02': {'transmission_A_ms': 1000*8/8e6*1000, 'transmission_B_ms': 1000*8/8e6*1000,
            'propagation_A_ms': 200e3/2e8*1000, 'propagation_B_ms': 600e3/2e8*1000},
    'D05': {'small_packet_transmission_ms': 1000*8/8e6*1000,
            'large_packet_transmission_ms': 2000*8/8e6*1000, 'propagation_ms_each': 600e3/2e8*1000},
    'D06': {'transmission_ms_each': 3000*8/12e6*1000,
            'short_link_propagation_ms': 100e3/2e8*1000, 'long_link_propagation_ms': 400e3/2e8*1000}
}.items():
    for key, value in expected.items():
        check(node_id + ' ' + key, math.isclose(nodes[node_id]['expected_answer'][key], value))
for fixture in sequence['synthetic_example_transcripts']:
    check(fixture['fixture_id'] + ' valid turn nodes', all(t['node_id'] in nodes for t in fixture['turns']))
scenario = evidence['synthetic_before_after_scenario']
check('Dashboard example explicitly synthetic', scenario['synthetic'] is True)
for stage in ('before', 'after'):
    values = scenario[stage]
    check(stage + ' exclusive example counts sum to distinct students',
          sum(values['selected_episode_hypothesis_counts'].values()) == values['distinct_students_with_concept_evidence'])
    check(stage + ' assisted success is a supported subset',
          values['supported_students_correct_after_feedback'] <=
          values['supported_students_with_complete_scorable_immediate_retests'] <=
          values['selected_episode_hypothesis_counts']['supported'])
before, after = scenario['before'], scenario['after']
check('Only one synthetic student added', after['distinct_students_with_concept_evidence'] - before['distinct_students_with_concept_evidence'] == 1)
initial_keys = [k for k in before if k.startswith('first_initial_correct')]
check('Assisted success does not increase initial correctness', bool(initial_keys) and all(before[k] == after[k] for k in initial_keys))

for path in ROOT.glob('*.md'):
    for target in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        if '://' not in target and not target.startswith('#'):
            destination = target.split('#')[0]
            check(path.name + ' local link ' + destination, (ROOT / destination).exists())

result = {
    'status': 'passed' if all(c['passed'] for c in checks) else 'failed',
    'counts': {'concepts': len(concepts), 'questions': len(questions), 'passages': len(passages), 'checks': len(checks)}
}
print(json.dumps(result))
for failure in checks:
    if not failure['passed']: print('FAILED: ' + failure['check'])
raise SystemExit(0 if result['status'] == 'passed' else 1)
