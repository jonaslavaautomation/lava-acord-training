/*
# Add ACORD 25 — Certificate of Liability Insurance (COI)

1. Adds the ACORD 25 module (seventh form). Its scenario is in src/data/modules.ts (Cascade Electric & Lighting /
   Westfield Development Group).
2. Allows watermarked training samples for the ACORD 25 as well as the ACORD 27 (get_training_sample stays staff-only).

After running this file, run these again so the ACORD 25 answer key and Knowledge Check are loaded:
  supabase/migrations/20261111120000_auto_answer_keys.sql
  supabase/migrations/20261112090000_knowledge_checks.sql
Safe to run more than once.
*/

INSERT INTO public.acord_modules (id, form_number, title, storage_folder, sort_order)
VALUES ('25', 'ACORD 25', 'Certificate of Liability Insurance', 'ACORD 25', 7)
ON CONFLICT (id) DO UPDATE SET
  form_number = EXCLUDED.form_number, title = EXCLUDED.title,
  storage_folder = EXCLUDED.storage_folder, sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION public.get_training_sample(p_module_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pdf public.training_materials;
  v_values jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_module_id IS NULL OR p_module_id NOT IN ('27', '25') THEN RAISE EXCEPTION 'SAMPLE_NOT_AVAILABLE'; END IF;

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
