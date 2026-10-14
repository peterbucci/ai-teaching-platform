"""Render human review guides from the authored content records."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
def read(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8'))
def human(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return '; '.join(human(v) for v in value)
    if isinstance(value, dict):
        return '; '.join(k.replace('_',' ') + ': ' + human(v) for k,v in value.items())
    return str(value)
def bullets(items):
    if isinstance(items, dict):
        return ['- **'+k.replace('_',' ')+':** '+human(v) for k,v in items.items()]
    return ['- '+human(v) for v in items]

passages = {p['id']:p for p in read('passages.json')['passages']}
def refs(ids):
    return ', '.join(f"[{pid} source lines {passages[pid]['start_line']} to {passages[pid]['end_line']}]({passages[pid]['url']})" for pid in ids)

concept_doc=read('concepts.json')
bank=read('question-bank.json')
concepts=concept_doc['concepts']
questions=bank['questions']
out=['# Network Performance Concepts and Questions', '',
    'This guide presents the five draft concepts and fifteen original questions for teacher review. All assessment support comes from the assigned subsection. Expected answers describe acceptable reasoning; equivalent accurate wording should receive credit.', '',
    '**Review status:** pending teacher approval. Source checks and calculation checks do not make this an educationally validated assessment.', '',
    '[Package overview](README.md) · [Assigned reading](reading.md) · [Diagnostic demonstration](DEMO_GUIDE.md)', '',
    '## Scoring principles', '']
out += bullets(bank.get('scoring_policy', []))
out += ['', '## Source details that affect assessment', '',
    '- The source initially uses bandwidth and throughput loosely, then distinguishes link capacity from measured performance. Assess the distinction in reasoning; do not reject an otherwise correct answer for vocabulary alone.',
    '- Specify one-way or round-trip delay. Twice one-way delay is an assumption for a symmetric example, not a universal RTT rule.',
    '- Use finite packets and stated assumptions. Do not assess the source\'s one-bit simplification as an exact physical rule.',
    '- The large-transfer source example has a units typo: use bits divided by bits per second. Its result, 20 seconds for 25 decimal MB over 10 Mbps, is correct.',
    '- Queuing questions use explicitly supplied waiting times and the simplified delay model. Advanced queue models, multi-hop aggregation and processing delay are outside this assignment.', '',
    '## Concepts for teacher approval', '']
for i,c in enumerate(concepts,1):
    title=c.get('title',c.get('name',c.get('label',c['id'].replace('_',' ').capitalize())))
    out += [f'### Concept {i} {title}', '', f"Identifier: `{c['id']}`. Review status: `{c.get('review_status','pending_teacher_review')}`.", '']
    out += bullets(c.get('learning_objectives',c.get('objectives',[])))
    misconceptions=c.get('misconceptions',c.get('misconception_definitions',c.get('common_misconceptions',[])))
    if misconceptions:
        out += ['', '**Possible misconception categories**', '']
        for m in misconceptions:
            if isinstance(m,dict):
                out += ['- **'+m.get('id',m.get('misconception_id','Category'))+'** — '+human(m.get('description',m.get('definition',m)))]
            else: out += ['- '+human(m)]
    if c.get('source_passage_ids'): out += ['', refs(c['source_passage_ids'])]
    out += ['']
for i,q in enumerate(questions,1):
    out += [f"## Question {i} {q['concept_id'].replace('_',' ').capitalize()}", '',
        f"Identifier: `{q['id']}`.", '', '**Prompt**', '', q['prompt'], '',
        '**Expected answer**', '', human(q['expected_answer']), '', '**Required reasoning**', '']
    out += bullets(q['required_reasoning'])
    out += ['', '**Acceptable alternatives**', ''] + bullets(q['acceptable_variations'])
    out += ['', '**Partial credit**', '', human(q['partial_credit_guidance'])]
    if q.get('assumptions'): out += ['', '**Assumptions**', ''] + bullets(q['assumptions'])
    if q.get('embedded_scaffolding'):
        out += ['', '**Support supplied in the question**', ''] + bullets(q['embedded_scaffolding'])
        out += ['', 'A supplied relationship or formula cannot count as independent recall of that relationship.']
    out += ['', '**Optional hint**', '', q['hint'], '', '**Synthetic response examples**', '']
    out += bullets(q['example_responses'])
    out += ['', '**Potential hypotheses:** '+', '.join('`'+x+'`' for x in q['misconception_ids'])+'. These are candidates requiring evidence, not automatic labels.', '', refs(q['source_passage_ids']), '']
(ROOT/'REVIEW_GUIDE.md').write_text('\n'.join(out),encoding='utf-8')

sequence=read('diagnostic-sequence.json')
out=['# Network Performance Diagnostic Demonstration', '',
    'This demonstration tests whether a student distinguishes transmission delay from propagation delay. It contains alternative paths for correct, unclear and mistaken answers. All example students and responses are fictional.', '',
    '[Package overview](README.md) · [Question review](REVIEW_GUIDE.md) · [Assigned reading](reading.md)', '',
    '## Demonstration flow', '',
    'Teacher approves the prepared assignment → student answers the cable-length question → the tutor follows the evidence → any feedback is tied to the assigned passages → fresh retests are stored → the teacher can inspect the resulting evidence.', '',
    'For rehearsal, use the supported-hypothesis example below. For testing, also exercise the cases where the hypothesis is rejected or remains uncertain. The actual AI integration still needs to be tested against these expected outcomes.', '',
    '## Interpretation rules', ''] + bullets(sequence['interpretation_rules']) + ['']
for n in sequence['nodes']:
    out += [f"## {n['node_id'].replace('-',' ')} {n['kind'].replace('_',' ').capitalize()}", '']
    if n.get('prompt'): out += [n['prompt'], '']
    if n.get('expected_answer'): out += ['**Expected answer:** '+human(n['expected_answer']), '']
    if n.get('feedback'): out += [n['feedback'], '']
    if n.get('tailoring'): out += ['**Tailoring:** '+n['tailoring'], '']
    if n.get('feedback_variants'): out += bullets(n['feedback_variants']) + ['']
    for key in ('routing_priority','result_rules'):
        if n.get(key):
            out += ['**Routes**', '']
            for route in n[key]: out += ['- '+human(route)]
            out += ['']
    if n.get('policy'): out += bullets(n['policy'])+[''] if isinstance(n['policy'],list) else [n['policy'],'']
    if n.get('next_node_id'): out += ['Next: `'+n['next_node_id']+'`.','']
    if n.get('terminal_action'): out += [n['terminal_action'],'']
    if n.get('teacher_effect'): out += [n['teacher_effect'],'']
    if n.get('source_passage_ids'): out += [refs(n['source_passage_ids']),'']
out += ['## Synthetic rehearsal examples','']
for t in sequence['synthetic_example_transcripts']:
    out += ['### '+t['fixture_id'].replace('-',' '),'', t['purpose'],'']
    for turn in t['turns']:
        text=turn.get('student_response',turn.get('tutor_intervention',turn.get('performance_outcome','')))
        out += ['- **'+turn['node_id']+'** — '+text]
        extra={k:v for k,v in turn.items() if k in ['overall_correctness','per_concept_correctness','hypothesis_status_after','performance_outcome']}
        if extra: out[-1]+=' ('+human(extra)+')'
    out += ['', '**Expected dashboard change:** '+t['expected_dashboard_effect'],'']
    if t.get('prohibited_conclusion'): out += ['**Do not conclude:** '+t['prohibited_conclusion'],'']
out += ['## Additional acceptance cases',''] + bullets(sequence['additional_acceptance_cases']) + ['','## Evidence integration','',
    'The complete proposed record contract and aggregation examples are in [evidence-spec.json](evidence-spec.json). Record correctness separately for each assessed concept. A partially correct joint answer can contain a correct propagation explanation and an incorrect transmission explanation.', '',
    'Record all assistance actually displayed before each attempt, including formulas or relationships supplied within the prompt itself. Retests after feedback remain in the assisted immediate category. Keep hypothetical counts and transcripts labeled as synthetic. Source or evaluator failures add no correctness judgment.', '']
(ROOT/'DEMO_GUIDE.md').write_text('\n'.join(out),encoding='utf-8')
print('Built review and demonstration guides from structured content.')
