-- Run only on a dedicated development/test database after the migration.
-- All fixtures and helpers are rolled back. HTTP checks cover authorization separately.
begin;

create function public.issue3_assert(condition boolean, message text) returns void
language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function public.issue3_expect_failure(command text, expected_state text, message_part text default '') returns void
language plpgsql as $$
begin
  begin
    execute command;
  exception when others then
    if sqlstate = expected_state and position(message_part in sqlerrm) > 0 then return; end if;
    raise;
  end;
  raise exception 'Expected failure % did not occur: %', expected_state, command;
end;
$$;

insert into public.profiles(id, display_name) values
  ('00000000-0000-4000-8000-000000000101', 'SQL fixture teacher A'),
  ('00000000-0000-4000-8000-000000000102', 'SQL fixture teacher B'),
  ('00000000-0000-4000-8000-000000000201', 'SQL fixture student A'),
  ('00000000-0000-4000-8000-000000000202', 'SQL fixture student B'),
  ('00000000-0000-4000-8000-000000000203', 'SQL fixture student C');
insert into public.classes(id, teacher_id, name) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'Fixture class A'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000102', 'Fixture class B');
insert into public.enrollments values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201'),
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000202'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000203');
insert into public.assignments(id, class_id, title, content_ref, approved_concept_ids,
  approved_passage_ids, approved_misconception_ids, approval)
select assignment_id::uuid, class_id::uuid, 'SQL integrity fixture',
  jsonb_build_object('package_id', 'sql-fixture', 'content_version', '1', 'source_id', 'fixture',
    'source_commit', repeat('a', 40), 'excerpt_sha256', repeat('b', 64)),
  array['transmission_delay'], array['P07'], array['transmission_depends_on_distance', 'other_or_uncertain'],
  '{"status":"approved","approved_by":"SQL fixture","approved_at":"2026-10-15T00:00:00Z"}'::jsonb
from (values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301'),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000302')) v(assignment_id, class_id);
insert into public.sessions(id, student_id, assignment_id, class_id, data_origin, started_at) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000201',
   '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301', 'synthetic_fixture', clock_timestamp() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000202',
   '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000301', 'synthetic_fixture', clock_timestamp() - interval '10 minutes'),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000203',
   '00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000302', 'synthetic_fixture', clock_timestamp() - interval '10 minutes');
insert into public.attempts(id, session_id, sequence_index, root_attempt_id, question, intent, presented_at)
select attempt_id::uuid, s.id, 0, attempt_id::uuid,
  jsonb_build_object('origin', 'curated', 'question_id', 'SQL-01', 'sequence_id', null,
    'prompt_text', 'What determines transmission delay?', 'content_ref', a.content_ref,
    'concept_ids', array['transmission_delay'], 'source_passage_ids', array['P07'],
    'rubric', jsonb_build_object('version', '1', 'answer_guidance', 'Packet size divided by link rate.',
      'criteria', array['Size divided by rate'], 'acceptable_variations', array[]::text[], 'partial_credit_guidance', null),
    'embedded_scaffolding', '[]'::jsonb, 'generation', null),
  'initial_retrieval', clock_timestamp() - interval '9 minutes'
from (values ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000501'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000502'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000503')) v(attempt_id, session_id)
join public.sessions s on s.id = v.session_id::uuid join public.assignments a on a.id = s.assignment_id;

-- Database transactions also enforce provenance, links and immutable original data.
do $$
declare
  answer public.attempts;
  replay public.attempts;
  initial_evaluation jsonb;
  assistance jsonb := '{"intervention_ids":[],"assistance_level":"none_recorded","scaffolding_types":[],"independent_retrieval_eligible_by_concept":{"transmission_delay":true},"most_recent_content_assistance_at":null,"elapsed_since_content_assistance_seconds":null}';
begin
  select * into answer from public.submit_answer('00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000901', 'Packet size divided by link rate.', assistance, clock_timestamp());
  select * into replay from public.submit_answer(answer.id, answer.submission_key, answer.response_text,
    '{"intervention_ids":[]}'::jsonb, clock_timestamp());
  perform public.issue3_assert(answer is not distinct from replay, 'Matching retry must preserve timestamp and original assistance');
  perform public.issue3_expect_failure(format('select public.submit_answer(%L,%L,%L,%L,clock_timestamp())',
    answer.id, answer.submission_key, 'Changed response', assistance), 'P0001', 'different key or body');
  perform public.issue3_expect_failure(format('select public.submit_answer(%L,%L,%L,%L,clock_timestamp())',
    answer.id, '00000000-0000-4000-8000-000000000902', answer.response_text, assistance), 'P0001', 'different key or body');
  perform public.issue3_expect_failure(format('update public.attempts set response_text=%L where id=%L',
    'Changed response', answer.id), 'P0001', 'Submitted answers');
  perform public.issue3_expect_failure(format('update public.attempts set question=jsonb_set(question,''{prompt_text}'',''"Changed question"'') where id=%L',
    answer.id), 'P0001', 'presented question');
  perform public.issue3_expect_failure(format('select public.submit_answer(%L,%L,%L,%L,clock_timestamp()-interval ''2 minutes'')',
    '00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000903', 'Answer', assistance),
    'P0001', 'timestamp must be captured');

  initial_evaluation := jsonb_build_object('id', '00000000-0000-4000-8000-000000000801',
    'attempt_id', answer.id, 'validation_status', 'accepted', 'evaluator',
    jsonb_build_object('type', 'synthetic_fixture', 'model', null, 'version', 'sql-test-v1'),
    'evaluated_at', clock_timestamp(), 'supersedes_id', null, 'applied_result', null, 'failure_reason', null,
    'result', jsonb_build_object('per_concept_results', jsonb_build_array(jsonb_build_object(
      'concept_id', 'transmission_delay', 'correctness', 'correct', 'error_type', null,
      'rubric_criteria_met', array['Size divided by rate'], 'rubric_criteria_missing', array[]::text[])),
      'source_passage_ids', array['P07'], 'evidence_quotes', jsonb_build_array(jsonb_build_object(
        'response_id', answer.id, 'quote', answer.response_text, 'start_character', 0,
        'end_character', char_length(answer.response_text), 'interpretation', 'Uses size/rate.')),
      'reasoning_observed', 'Uses size/rate.', 'uncertainty_reason', null, 'proposed_next_action', 'END_SESSION'));
  perform public.save_evaluation(initial_evaluation);
  perform public.save_evaluation(initial_evaluation); -- exact retry is idempotent
  perform public.issue3_assert((select count(*) = 1 from public.evaluations where attempt_id = answer.id), 'Evaluation retry must not duplicate');
  perform public.save_evaluation(initial_evaluation || jsonb_build_object('id', '00000000-0000-4000-8000-000000000802',
    'validation_status', 'evaluation_failed', 'result', null, 'failure_reason', 'Fixture transport failure'));
  perform public.issue3_assert((select current_evaluation_id = '00000000-0000-4000-8000-000000000801'
    from public.attempts where id = answer.id), 'Failed evaluation must preserve accepted pointer');
  perform public.save_evaluation(initial_evaluation || jsonb_build_object('id', '00000000-0000-4000-8000-000000000803',
    'supersedes_id', '00000000-0000-4000-8000-000000000801'));
  perform public.issue3_expect_failure(format('select public.save_evaluation(%L::jsonb)',
    initial_evaluation || jsonb_build_object('id', '00000000-0000-4000-8000-000000000804',
      'supersedes_id', '00000000-0000-4000-8000-000000000801')), 'P0001', 'current accepted version');
  perform public.issue3_expect_failure(format('select public.save_evaluation(%L::jsonb)',
    jsonb_set(initial_evaluation || jsonb_build_object('id', '00000000-0000-4000-8000-000000000805',
      'supersedes_id', '00000000-0000-4000-8000-000000000803'), '{result,evidence_quotes,0,quote}', '"Invented quote"')),
    'P0001', 'quote does not match');
  perform public.issue3_expect_failure('update public.evaluations set failure_reason=''rewrite''', 'P0001', 'append-only');
  perform public.issue3_assert((select count(*) = 3 from public.evaluations where attempt_id = answer.id), 'Failed correction must not leave a row');
end;
$$;

select public.issue3_expect_failure($command$
  insert into public.sessions(id, student_id, assignment_id, class_id, data_origin) values
  ('00000000-0000-4000-8000-000000000504', '00000000-0000-4000-8000-000000000203',
   '00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000302', 'synthetic_fixture')
$command$, '23503');
select public.issue3_expect_failure($command$
  insert into public.attempts(id, session_id, sequence_index, parent_attempt_id, root_attempt_id, question, intent)
  select '00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000502', 1,
    id, id, question, 'diagnostic_followup' from public.attempts where id='00000000-0000-4000-8000-000000000601'
$command$, '23503');
select public.issue3_expect_failure($command$
  insert into public.attempts(id, session_id, sequence_index, root_attempt_id, review_of_attempt_id, question, intent)
  select '00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000502', 1,
    '00000000-0000-4000-8000-000000000604', id, question, 'delayed_review'
  from public.attempts where id='00000000-0000-4000-8000-000000000601'
$command$, 'P0001', 'same student and assignment');
select public.issue3_expect_failure($command$
  insert into public.attempts(id, session_id, sequence_index, root_attempt_id, question, intent)
  select '00000000-0000-4000-8000-000000000604', session_id, 1, '00000000-0000-4000-8000-000000000604',
    jsonb_set(question, '{source_passage_ids}', '["NOT-ASSIGNED"]'), 'initial_retrieval'
  from public.attempts where id='00000000-0000-4000-8000-000000000601'
$command$, 'P0001', 'approved content references');
select public.issue3_expect_failure('update public.assignments set content_ref=''{}''', 'P0001', 'immutable');

insert into public.interventions(id, session_id, related_attempt_id, related_evaluation_id, type,
  text_shown, concept_ids, source_passage_ids, content_ref)
select '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000803', 'corrective_feedback',
  'Transmission delay is packet size divided by link rate.', array['transmission_delay'], array['P07'], content_ref
from public.assignments where id='00000000-0000-4000-8000-000000000401';
update public.interventions set delivery_status='displayed', visible_at=clock_timestamp()
where id='00000000-0000-4000-8000-000000000701';
select public.issue3_expect_failure('update public.interventions set visible_at=clock_timestamp()', 'P0001', 'immutable');
select public.issue3_expect_failure($command$
  select public.submit_answer('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000903',
    'Answer', '{"intervention_ids":["00000000-0000-4000-8000-000000000701"]}', clock_timestamp())
$command$, 'P0001', 'displayed before submission in this session');

do $$
declare
  outcome jsonb := '{"root_attempt_id":"00000000-0000-4000-8000-000000000601","concept_ids":["transmission_delay"],"hypothesis_instance_id":null,"latest_hypothesis_status":null,"outcome":"correct_initial_without_content_assistance","supporting_attempt_ids":["00000000-0000-4000-8000-000000000601"],"intervention_ids":[],"recorded_at":"2026-10-15T00:00:00Z","next_review_at":null,"review_policy_version":"sql-test-v1","review_reason":"SQL fixture only"}';
  finished public.sessions;
  replay public.sessions;
begin
  perform public.issue3_expect_failure(format('select public.finish_session(%L,%L,%L::jsonb,%L)',
    '00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000601',
    jsonb_set(outcome, '{supporting_attempt_ids}', '["00000000-0000-4000-8000-000000000602"]'), 'completed'),
    'P0001', 'belong to this episode');
  select * into finished from public.finish_session('00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000601', outcome, 'completed');
  select * into replay from public.finish_session(finished.id, '00000000-0000-4000-8000-000000000601', outcome, 'completed');
  perform public.issue3_assert((finished is not distinct from replay) and finished.ended_at is not null, 'Completion must be atomic and idempotent');
end;
$$;

rollback;
select 'Evidence constraints and atomic persistence checks passed; fixtures rolled back.' as result;
