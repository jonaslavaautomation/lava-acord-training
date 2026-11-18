/*
# Training samples (watermarked example forms) — ACORD 27 only

The ACORD Assistant can generate a sample of the current fillable ACORD 27, filled with the practice scenario's
correct answers and watermarked "TRAINING PURPOSES ONLY", so trainers can check that each answer lands in the right box.

- get_training_sample() is staff-only (trainers and admins): it returns answer-key values, which trainees must never see.
- Only the forms in the allow-list below can be sampled (currently ACORD 27).
- Nothing is stored: the browser builds the PDF in memory and deletes it after 20 minutes.

Run after 20261111120000_auto_answer_keys.sql (which adds the sample_value column). Safe to run more than once.
*/

CREATE OR REPLACE FUNCTION public.get_training_sample(p_module_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pdf public.training_materials;
  v_values jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_module_id IS DISTINCT FROM '27' THEN RAISE EXCEPTION 'SAMPLE_NOT_AVAILABLE'; END IF;

  SELECT * INTO v_pdf FROM public.training_materials WHERE module_id = p_module_id AND material_type = 'pdf' AND is_current;
  IF v_pdf.id IS NULL THEN RAISE EXCEPTION 'NO_PDF'; END IF;

  SELECT coalesce(jsonb_object_agg(m.pdf_field_name,
           CASE
             WHEN r.sample_value IS NOT NULL THEN r.sample_value
             WHEN m.match_type = 'present' THEN to_char(now() AT TIME ZONE 'America/New_York', 'MM/DD/YYYY')
             ELSE split_part(m.expected_value, '|', 1)
           END), '{}'::jsonb)
    INTO v_values
    FROM public.pdf_field_mappings m
    LEFT JOIN lava_private.answer_key_rules r
      ON r.module_id = m.module_id AND m.scenario_fact_key = 'auto:' || r.rule_key
   WHERE m.material_id = v_pdf.id AND m.is_scored
     AND (coalesce(m.expected_value, '') <> '' OR m.match_type = 'present' OR r.sample_value IS NOT NULL);

  IF v_values = '{}'::jsonb THEN RAISE EXCEPTION 'GRADING_NOT_CONFIGURED'; END IF;

  RETURN jsonb_build_object(
    'module_id', p_module_id,
    'material_id', v_pdf.id,
    'file_name', v_pdf.file_name,
    'values', v_values);
END $$;

REVOKE EXECUTE ON FUNCTION public.get_training_sample(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_training_sample(text) TO authenticated;
