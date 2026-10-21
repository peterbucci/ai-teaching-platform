alter table public.interventions drop constraint interventions_type_check;
alter table public.interventions add constraint interventions_type_check check
  (type in ('hint', 'corrective_feedback', 'worked_example', 'neutral_clarification',
    'diagnostic_prompt_without_answer', 'fallback', 'reading'));
alter table public.interventions drop constraint interventions_check2;
alter table public.interventions add constraint intervention_learning_scope check
  (type = 'fallback' or (cardinality(source_passage_ids) > 0 and
    (type = 'reading' or cardinality(concept_ids) > 0)));
-- One passage opening per presented question; retries/resume reuse the same delivery.
create unique index reading_delivery_per_attempt on public.interventions
  (related_attempt_id, source_passage_ids) where type = 'reading';
