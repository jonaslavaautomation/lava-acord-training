/*
# LAVA ACORD Training — Secure materials, PDF form filling, server-side grading

Builds on 20261110200837_create_training_materials_schema.sql (prototype with fully open policies)
and replaces it with role-based security. Existing rows are preserved (ALTER, not DROP).

## Summary
1. Accounts & roles  — `profiles` (student | trainer | admin), linked to Supabase Auth.
                        The FIRST account ever created becomes `admin`; everyone after is `student`.
                        Admins promote trainers with `admin_set_role()`.
2. Modules           — `acord_modules` (125, 126, 127, 130, 140) with their storage folder names.
3. Storage           — private bucket `lava-acord-training`, organized as
                          ACORD 125/Videos/…            ACORD 125/Fillable PDF/…
                          ACORD 125/Supporting Materials/…   (same for 126/127/130/140)
                        private bucket `assessment-submissions`  <user_id>/<module>/<attempt_id>.pdf
                        Only trainers/admins can write training materials. Students read only.
4. Materials         — `training_materials` gains versioning (asset_key + version_number + is_current),
                        lesson ordering / required flag (multiple lessons per module), video duration,
                        PDF page count. Replacing a file inserts a new version and archives the old one.
5. PDF field catalog — `pdf_form_fields`: every interactive field (AcroForm-detected or trainer-drawn
                        for flattened PDFs) with page + rectangle. Readable by students (no answers).
6. Answer keys       — `pdf_field_mappings` + `scenario_facts`: STAFF ONLY. Students cannot select them.
7. Video progress    — `video_progress`, written only through `record_video_progress()` which
                        credits at most ~2x the elapsed wall-clock time between heartbeats.
8. Assessments       — `assessment_attempts` written only through `start_assessment()`,
                        `save_assessment_draft()`, `submit_assessment()`. Grading happens in the
                        database; max 3 attempts (initial + 2 retakes); expected answers are hidden
                        from students until they pass (>= 80%) or use their final attempt.
                        Full grading detail is kept in staff-only `assessment_grading_details`.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS lava_private;
REVOKE ALL ON SCHEMA lava_private FROM PUBLIC;

-- ============================================================
-- 1. Profiles & roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'trainer', 'admin')),
  cohort text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT role IN ('trainer', 'admin') FROM public.profiles WHERE id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION lava_private.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := 'student';
BEGIN
  -- Bootstrap: the very first account becomes the administrator.
  -- Role is never taken from user-supplied metadata.
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    v_role := 'admin';
  END IF;
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, coalesce(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(coalesce(NEW.email, ''), '@', 1)), v_role)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION lava_private.handle_new_user();

DROP POLICY IF EXISTS "profiles_select_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR public.is_staff());
-- No INSERT/UPDATE/DELETE policies: changes go through the RPCs below.

CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name text) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  UPDATE public.profiles SET full_name = left(btrim(coalesce(p_full_name, '')), 120)
  WHERE id = auth.uid() RETURNING * INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.profiles;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_role NOT IN ('student', 'trainer', 'admin') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  IF p_role <> 'admin' AND (SELECT role FROM public.profiles WHERE id = p_user_id) = 'admin'
     AND (SELECT count(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'LAST_ADMIN';
  END IF;
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id RETURNING * INTO v;
  IF v.id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_cohort(p_user_id uuid, p_cohort text) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.profiles;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.profiles SET cohort = NULLIF(left(btrim(coalesce(p_cohort, '')), 60), '') WHERE id = p_user_id RETURNING * INTO v;
  RETURN v;
END $$;

-- ============================================================
-- 2. ACORD modules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.acord_modules (
  id text PRIMARY KEY,
  form_number text NOT NULL,
  title text NOT NULL,
  storage_folder text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.acord_modules ENABLE ROW LEVEL SECURITY;

INSERT INTO public.acord_modules (id, form_number, title, storage_folder, sort_order) VALUES
  ('125', 'ACORD 125', 'Commercial Insurance Application', 'ACORD 125', 1),
  ('126', 'ACORD 126', 'Commercial General Liability Section', 'ACORD 126', 2),
  ('127', 'ACORD 127', 'Business Auto Section', 'ACORD 127', 3),
  ('130', 'ACORD 130', 'Workers Compensation Application', 'ACORD 130', 4),
  ('140', 'ACORD 140', 'Property Section', 'ACORD 140', 5)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "modules_select_authenticated" ON public.acord_modules;
CREATE POLICY "modules_select_authenticated" ON public.acord_modules FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Training materials (alter prototype table)
-- ============================================================
ALTER TABLE public.training_materials DROP CONSTRAINT IF EXISTS training_materials_material_type_check;
ALTER TABLE public.training_materials ADD CONSTRAINT training_materials_material_type_check
  CHECK (material_type IN ('video', 'pdf', 'supporting'));

ALTER TABLE public.training_materials
  ADD COLUMN IF NOT EXISTS asset_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS lesson_order integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric,
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS is_encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uploaded_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.training_materials ALTER COLUMN version DROP NOT NULL;
ALTER TABLE public.training_materials ALTER COLUMN version DROP DEFAULT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_materials_module_fk') THEN
    ALTER TABLE public.training_materials ADD CONSTRAINT training_materials_module_fk
      FOREIGN KEY (module_id) REFERENCES public.acord_modules(id);
  END IF;
END $$;

-- Prototype allowed several PDFs per module; keep only the newest as current before adding the unique index.
UPDATE public.training_materials t SET is_current = false
WHERE t.material_type = 'pdf' AND t.is_current AND EXISTS (
  SELECT 1 FROM public.training_materials n
  WHERE n.module_id = t.module_id AND n.material_type = 'pdf' AND n.is_current
    AND (n.uploaded_at > t.uploaded_at OR (n.uploaded_at = t.uploaded_at AND n.id > t.id)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_training_materials_one_current_pdf
  ON public.training_materials(module_id) WHERE material_type = 'pdf' AND is_current;
CREATE INDEX IF NOT EXISTS idx_training_materials_asset ON public.training_materials(asset_key, version_number);

-- Versioning: inserting a row with an existing asset_key creates the next version and archives the previous.
CREATE OR REPLACE FUNCTION lava_private.training_materials_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing uuid;
  v_next integer;
BEGIN
  IF NEW.material_type = 'pdf' THEN
    -- One fillable PDF slot per module: adopt the slot of the current PDF.
    SELECT asset_key INTO v_existing FROM public.training_materials
      WHERE module_id = NEW.module_id AND material_type = 'pdf' AND is_current LIMIT 1;
    IF v_existing IS NOT NULL THEN NEW.asset_key := v_existing; END IF;
  END IF;

  SELECT coalesce(max(version_number), 0) + 1 INTO v_next FROM public.training_materials WHERE asset_key = NEW.asset_key;
  NEW.version_number := v_next;
  IF NEW.version IS NULL OR btrim(NEW.version) = '' THEN NEW.version := 'v' || v_next; END IF;

  IF v_next > 1 THEN
    -- Inherit lesson metadata from the previous version unless supplied.
    SELECT coalesce(NEW.title, p.title), coalesce(NEW.description, p.description), p.lesson_order, p.is_required
      INTO NEW.title, NEW.description, NEW.lesson_order, NEW.is_required
      FROM public.training_materials p WHERE p.asset_key = NEW.asset_key ORDER BY p.version_number DESC LIMIT 1;
  END IF;

  NEW.is_current := true;
  NEW.uploaded_at := now();
  NEW.uploaded_by_id := auth.uid();
  NEW.uploaded_by := coalesce((SELECT NULLIF(full_name, '') FROM public.profiles WHERE id = auth.uid()), 'Trainer');

  UPDATE public.training_materials SET is_current = false WHERE asset_key = NEW.asset_key AND is_current;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_training_materials_before_insert ON public.training_materials;
CREATE TRIGGER trg_training_materials_before_insert BEFORE INSERT ON public.training_materials
  FOR EACH ROW EXECUTE FUNCTION lava_private.training_materials_before_insert();

-- Deleting the current version promotes the newest remaining version of the same asset.
CREATE OR REPLACE FUNCTION lava_private.training_materials_after_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_current THEN
    UPDATE public.training_materials SET is_current = true
    WHERE id = (SELECT id FROM public.training_materials WHERE asset_key = OLD.asset_key ORDER BY version_number DESC LIMIT 1);
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_training_materials_after_delete ON public.training_materials;
CREATE TRIGGER trg_training_materials_after_delete AFTER DELETE ON public.training_materials
  FOR EACH ROW EXECUTE FUNCTION lava_private.training_materials_after_delete();

CREATE OR REPLACE FUNCTION public.set_current_material(p_material_id uuid) RETURNS public.training_materials
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.training_materials;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO v FROM public.training_materials WHERE id = p_material_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'MATERIAL_NOT_FOUND'; END IF;
  UPDATE public.training_materials SET is_current = false WHERE asset_key = v.asset_key AND is_current AND id <> v.id;
  UPDATE public.training_materials SET is_current = true WHERE id = v.id RETURNING * INTO v;
  RETURN v;
END $$;

-- A student keeps access to the exact PDF version their own attempt was started on.
CREATE OR REPLACE FUNCTION lava_private.attempt_uses_material(p_material_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.assessment_attempts WHERE material_id = p_material_id AND user_id = auth.uid());
END $$;
GRANT USAGE ON SCHEMA lava_private TO authenticated;

-- Replace prototype "anyone can do anything" policies.
DROP POLICY IF EXISTS "anon_select_materials" ON public.training_materials;
DROP POLICY IF EXISTS "anon_insert_materials" ON public.training_materials;
DROP POLICY IF EXISTS "anon_update_materials" ON public.training_materials;
DROP POLICY IF EXISTS "anon_delete_materials" ON public.training_materials;
REVOKE ALL ON public.training_materials FROM anon;

DROP POLICY IF EXISTS "materials_select" ON public.training_materials;
CREATE POLICY "materials_select" ON public.training_materials FOR SELECT TO authenticated
  USING (is_current OR public.is_staff() OR lava_private.attempt_uses_material(id));
DROP POLICY IF EXISTS "materials_staff_insert" ON public.training_materials;
CREATE POLICY "materials_staff_insert" ON public.training_materials FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "materials_staff_update" ON public.training_materials;
CREATE POLICY "materials_staff_update" ON public.training_materials FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "materials_staff_delete" ON public.training_materials;
CREATE POLICY "materials_staff_delete" ON public.training_materials FOR DELETE TO authenticated
  USING (public.is_staff());

-- ============================================================
-- 4. PDF interactive field catalog (no answers here)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pdf_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.training_materials(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text'
    CHECK (field_type IN ('text', 'checkbox', 'radio', 'dropdown', 'date', 'signature', 'button', 'unknown')),
  source text NOT NULL DEFAULT 'acroform' CHECK (source IN ('acroform', 'custom')),
  page_number integer NOT NULL DEFAULT 1,
  rect numeric[] ,               -- [x1, y1, x2, y2] in PDF points (origin bottom-left)
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  multiline boolean NOT NULL DEFAULT false,
  max_length integer,
  read_only boolean NOT NULL DEFAULT false,
  tooltip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, field_name)
);
ALTER TABLE public.pdf_form_fields ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pdf_form_fields FROM anon;
CREATE INDEX IF NOT EXISTS idx_pdf_form_fields_material ON public.pdf_form_fields(material_id, page_number);

DROP POLICY IF EXISTS "form_fields_select" ON public.pdf_form_fields;
CREATE POLICY "form_fields_select" ON public.pdf_form_fields FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "form_fields_staff_insert" ON public.pdf_form_fields;
CREATE POLICY "form_fields_staff_insert" ON public.pdf_form_fields FOR INSERT TO authenticated WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "form_fields_staff_update" ON public.pdf_form_fields;
CREATE POLICY "form_fields_staff_update" ON public.pdf_form_fields FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS "form_fields_staff_delete" ON public.pdf_form_fields;
CREATE POLICY "form_fields_staff_delete" ON public.pdf_form_fields FOR DELETE TO authenticated USING (public.is_staff());

-- ============================================================
-- 5. Answer keys: scenario facts + PDF field mappings (STAFF ONLY)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scenario_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL REFERENCES public.acord_modules(id),
  fact_key text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  points integer NOT NULL DEFAULT 1,
  value_kind text NOT NULL DEFAULT 'text',
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (module_id, fact_key)
);
ALTER TABLE public.scenario_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scenario_facts FROM anon;
DROP POLICY IF EXISTS "facts_staff_all" ON public.scenario_facts;
CREATE POLICY "facts_staff_all" ON public.scenario_facts FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.pdf_field_mappings
  ADD COLUMN IF NOT EXISTS scenario_fact_key text,
  ADD COLUMN IF NOT EXISTS missing_rule text NOT NULL DEFAULT 'penalize',
  ADD COLUMN IF NOT EXISTS feedback_hint text,
  ADD COLUMN IF NOT EXISTS is_scored boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.pdf_field_mappings DROP CONSTRAINT IF EXISTS pdf_field_mappings_missing_rule_check;
ALTER TABLE public.pdf_field_mappings ADD CONSTRAINT pdf_field_mappings_missing_rule_check
  CHECK (missing_rule IN ('penalize', 'expect_blank', 'optional'));
ALTER TABLE public.pdf_field_mappings DROP CONSTRAINT IF EXISTS pdf_field_mappings_match_type_check;
ALTER TABLE public.pdf_field_mappings ADD CONSTRAINT pdf_field_mappings_match_type_check
  CHECK (match_type IN ('exact', 'contains', 'any-of', 'keywords', 'present'));
ALTER TABLE public.pdf_field_mappings ALTER COLUMN expected_value SET DEFAULT '';
UPDATE public.pdf_field_mappings SET expected_value = '' WHERE expected_value IS NULL;

-- Remove duplicate prototype rows before enforcing uniqueness.
DELETE FROM public.pdf_field_mappings a USING public.pdf_field_mappings b
  WHERE a.material_id = b.material_id AND a.pdf_field_name = b.pdf_field_name AND a.id < b.id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdf_field_mappings_material_field
  ON public.pdf_field_mappings(material_id, pdf_field_name);

DROP POLICY IF EXISTS "anon_select_mappings" ON public.pdf_field_mappings;
DROP POLICY IF EXISTS "anon_insert_mappings" ON public.pdf_field_mappings;
DROP POLICY IF EXISTS "anon_update_mappings" ON public.pdf_field_mappings;
DROP POLICY IF EXISTS "anon_delete_mappings" ON public.pdf_field_mappings;
REVOKE ALL ON public.pdf_field_mappings FROM anon;
DROP POLICY IF EXISTS "mappings_staff_all" ON public.pdf_field_mappings;
CREATE POLICY "mappings_staff_all" ON public.pdf_field_mappings FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Copy mappings between PDF versions (matching field names) when a trainer replaces a PDF.
CREATE OR REPLACE FUNCTION public.copy_field_mappings(p_from uuid, p_to uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO public.pdf_field_mappings (module_id, material_id, pdf_field_name, pdf_field_type, scenario_label,
      expected_value, match_type, points, required, page_number, scenario_fact_key, missing_rule, feedback_hint, is_scored)
  SELECT m.module_id, p_to, m.pdf_field_name, coalesce(f.field_type, m.pdf_field_type), m.scenario_label,
      m.expected_value, m.match_type, m.points, m.required, coalesce(f.page_number, m.page_number), m.scenario_fact_key,
      m.missing_rule, m.feedback_hint, m.is_scored
  FROM public.pdf_field_mappings m
  JOIN public.pdf_form_fields f ON f.material_id = p_to AND f.field_name = m.pdf_field_name
  WHERE m.material_id = p_from
  ON CONFLICT (material_id, pdf_field_name) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Students may learn WHICH fields are required (for the pre-submit review), never the answers.
CREATE OR REPLACE FUNCTION public.get_required_fields(p_material_id uuid) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pdf_field_name FROM public.pdf_field_mappings
  WHERE material_id = p_material_id AND required AND is_scored AND auth.uid() IS NOT NULL
$$;

-- ============================================================
-- 6. Video progress (server-validated)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.video_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_key uuid NOT NULL,
  module_id text NOT NULL REFERENCES public.acord_modules(id),
  material_id uuid REFERENCES public.training_materials(id) ON DELETE SET NULL,
  bucket_seconds integer NOT NULL DEFAULT 5,
  watched_buckets integer[] NOT NULL DEFAULT '{}',
  duration_seconds numeric,
  coverage numeric NOT NULL DEFAULT 0,         -- 0..100
  watched_seconds numeric NOT NULL DEFAULT 0,  -- total credited playback time
  last_position numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, asset_key)
);
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_progress FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.video_progress FROM authenticated;
DROP POLICY IF EXISTS "video_progress_select" ON public.video_progress;
CREATE POLICY "video_progress_select" ON public.video_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE OR REPLACE FUNCTION public.record_video_progress(
  p_material_id uuid, p_from numeric, p_to numeric, p_client_duration numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mat public.training_materials;
  v_row public.video_progress;
  v_dur numeric;
  v_bucket integer := 5;
  v_total_buckets integer;
  v_elapsed numeric;
  v_allowed numeric;
  v_from numeric;
  v_to numeric;
  v_new integer[];
  v_cov numeric;
  i integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  SELECT * INTO v_mat FROM public.training_materials WHERE id = p_material_id AND material_type = 'video';
  IF v_mat.id IS NULL THEN RAISE EXCEPTION 'VIDEO_NOT_FOUND'; END IF;

  SELECT * INTO v_row FROM public.video_progress WHERE user_id = v_uid AND asset_key = v_mat.asset_key FOR UPDATE;
  IF v_row.user_id IS NULL THEN
    INSERT INTO public.video_progress (user_id, asset_key, module_id, material_id, last_heartbeat_at)
    VALUES (v_uid, v_mat.asset_key, v_mat.module_id, v_mat.id, NULL)
    RETURNING * INTO v_row;
  END IF;

  -- Duration: trust the value measured at upload time; only fall back to the client when unknown.
  v_dur := coalesce(v_mat.duration_seconds, v_row.duration_seconds,
                    CASE WHEN p_client_duration > 0 AND p_client_duration < 86400 THEN p_client_duration END);
  IF v_dur IS NULL OR v_dur <= 0 THEN RAISE EXCEPTION 'VIDEO_DURATION_UNKNOWN'; END IF;
  v_total_buckets := greatest(1, ceil(v_dur / v_bucket)::integer);

  -- Plausibility: playback cannot advance faster than ~2x real time since the previous heartbeat,
  -- and a single heartbeat can credit at most 30 seconds.
  IF v_row.last_heartbeat_at IS NULL THEN
    v_allowed := 10;
  ELSE
    v_elapsed := extract(epoch FROM (clock_timestamp() - v_row.last_heartbeat_at));
    v_allowed := least(30, greatest(0, v_elapsed * 2.05));
  END IF;

  v_from := greatest(0, least(coalesce(p_from, 0), v_dur));
  v_to := greatest(v_from, least(coalesce(p_to, 0), v_dur));
  v_to := least(v_to, v_from + v_allowed);

  v_new := v_row.watched_buckets;
  IF v_to > v_from THEN
    FOR i IN floor(v_from / v_bucket)::integer .. greatest(floor(v_from / v_bucket)::integer, ceil(v_to / v_bucket)::integer - 1) LOOP
      -- A bucket counts when the watched segment covers its midpoint (clamped for the final partial bucket).
      IF i < v_total_buckets
         AND least(i * v_bucket + v_bucket / 2.0, v_dur - 0.001) BETWEEN v_from AND v_to
         AND NOT (i = ANY (v_new)) THEN
        v_new := array_append(v_new, i);
      END IF;
    END LOOP;
  END IF;

  v_cov := round(least(100, cardinality(v_new)::numeric * 100 / v_total_buckets), 2);

  UPDATE public.video_progress SET
    material_id = v_mat.id,
    duration_seconds = v_dur,
    watched_buckets = v_new,
    coverage = v_cov,
    watched_seconds = watched_seconds + (v_to - v_from),
    last_position = v_to,
    last_heartbeat_at = clock_timestamp(),
    completed = completed OR v_cov >= 95,
    completed_at = CASE WHEN NOT completed AND v_cov >= 95 THEN now() ELSE completed_at END
  WHERE user_id = v_uid AND asset_key = v_mat.asset_key
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('asset_key', v_row.asset_key, 'coverage', v_row.coverage,
    'completed', v_row.completed, 'credited', v_to - v_from, 'last_position', v_row.last_position);
END $$;

-- ============================================================
-- 7. Assessment attempts (alter prototype table)
-- ============================================================
ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.training_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_seconds integer,
  ADD COLUMN IF NOT EXISTS draft_values jsonb,
  ADD COLUMN IF NOT EXISTS completed_pdf_path text,
  ADD COLUMN IF NOT EXISTS feedback_revealed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS passed boolean NOT NULL DEFAULT false;
ALTER TABLE public.assessment_attempts DROP CONSTRAINT IF EXISTS assessment_attempts_status_check;
ALTER TABLE public.assessment_attempts ADD CONSTRAINT assessment_attempts_status_check CHECK (status IN ('in_progress', 'submitted'));
ALTER TABLE public.assessment_attempts ALTER COLUMN completed_at DROP DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_one_in_progress
  ON public.assessment_attempts(user_id, module_id) WHERE status = 'in_progress' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_number
  ON public.assessment_attempts(user_id, module_id, attempt_number) WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "anon_select_attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "anon_insert_attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "anon_update_attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "anon_delete_attempts" ON public.assessment_attempts;
REVOKE ALL ON public.assessment_attempts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.assessment_attempts FROM authenticated;
DROP POLICY IF EXISTS "attempts_select_own_or_staff" ON public.assessment_attempts;
CREATE POLICY "attempts_select_own_or_staff" ON public.assessment_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff());

CREATE TABLE IF NOT EXISTS public.assessment_grading_details (
  attempt_id uuid PRIMARY KEY REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
  results jsonb NOT NULL,
  graded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_grading_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assessment_grading_details FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.assessment_grading_details FROM authenticated;
DROP POLICY IF EXISTS "grading_details_staff" ON public.assessment_grading_details;
CREATE POLICY "grading_details_staff" ON public.assessment_grading_details FOR SELECT TO authenticated USING (public.is_staff());

-- ---------- grading helpers (private schema, not exposed through the API) ----------
CREATE OR REPLACE FUNCTION lava_private.norm_text(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(lower(btrim(coalesce(v, ''))), '\.(?!\d)', '', 'g'), '[$,\s]', '', 'g')
$$;

CREATE OR REPLACE FUNCTION lava_private.to_bool(v text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(btrim(coalesce(v, ''))) IN ('true', 'yes', 'y', 'on', 'checked', 'x', '1')
$$;

CREATE OR REPLACE FUNCTION lava_private.try_date(v text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t text := btrim(coalesce(v, ''));
BEGIN
  IF t ~ '^\d{4}-\d{1,2}-\d{1,2}$' THEN RETURN to_date(t, 'YYYY-MM-DD'); END IF;
  IF t ~ '^\d{1,2}[/-]\d{1,2}[/-]\d{4}$' THEN RETURN to_date(replace(t, '-', '/'), 'MM/DD/YYYY'); END IF;
  IF t ~ '^\d{1,2}[/-]\d{1,2}[/-]\d{2}$' THEN RETURN to_date(replace(t, '-', '/'), 'MM/DD/YY'); END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION lava_private.answer_matches(p_expected text, p_match text, p_given text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  g text := lava_private.norm_text(p_given);
  alt text;
  a text;
  tok text;
  all_ok boolean;
BEGIN
  IF p_match = 'present' THEN RETURN g <> ''; END IF;
  IF g = '' THEN RETURN false; END IF;
  FOREACH alt IN ARRAY string_to_array(coalesce(p_expected, ''), '|') LOOP
    a := lava_private.norm_text(alt);
    CONTINUE WHEN a = '';
    IF lava_private.try_date(alt) IS NOT NULL AND lava_private.try_date(alt) = lava_private.try_date(p_given) THEN RETURN true; END IF;
    IF p_match IN ('exact', 'any-of') AND g = a THEN RETURN true; END IF;
    IF p_match = 'contains' AND position(a IN g) > 0 THEN RETURN true; END IF;
    IF p_match = 'keywords' THEN
      all_ok := true;
      FOREACH tok IN ARRAY regexp_split_to_array(btrim(alt), '[,\s]+') LOOP
        CONTINUE WHEN lava_private.norm_text(tok) = '';
        IF position(lava_private.norm_text(tok) IN g) = 0 THEN all_ok := false; EXIT; END IF;
      END LOOP;
      IF all_ok THEN RETURN true; END IF;
    END IF;
  END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION lava_private.grade_values(p_material_id uuid, p_values jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  v_given text;
  v_is_bool boolean;
  v_blank boolean;
  v_exp text;
  v_exp_display text;
  v_status text;
  v_feedback text;
  v_earned numeric := 0;
  v_total numeric := 0;
  v_correct integer := 0;
  v_incorrect integer := 0;
  v_missing integer := 0;
  v_results jsonb := '[]'::jsonb;
BEGIN
  FOR m IN
    SELECT mp.*, coalesce(ff.field_type, mp.pdf_field_type) AS ftype, coalesce(ff.page_number, mp.page_number) AS page
    FROM public.pdf_field_mappings mp
    LEFT JOIN public.pdf_form_fields ff ON ff.material_id = mp.material_id AND ff.field_name = mp.pdf_field_name
    WHERE mp.material_id = p_material_id AND mp.is_scored AND mp.points > 0
    ORDER BY coalesce(ff.page_number, mp.page_number), mp.pdf_field_name
  LOOP
    v_given := coalesce(p_values->>m.pdf_field_name, '');
    v_is_bool := m.ftype = 'checkbox';
    v_blank := CASE WHEN v_is_bool THEN NOT lava_private.to_bool(v_given) ELSE btrim(v_given) = '' END;
    v_exp := coalesce(m.expected_value, '');
    v_exp_display := CASE WHEN v_is_bool THEN (CASE WHEN lava_private.to_bool(v_exp) THEN 'Checked' ELSE 'Unchecked' END) ELSE v_exp END;
    v_status := NULL;

    IF m.missing_rule = 'expect_blank' THEN
      v_exp_display := '(leave blank — not provided in the scenario)';
      v_status := CASE WHEN v_blank THEN 'correct' ELSE 'incorrect' END;
      v_feedback := CASE WHEN v_blank THEN 'Correct — this information was not in the scenario and was left blank.'
        ELSE 'This information was not provided in the scenario email. Do not invent data; leave it blank or flag it to the producer.' END;
    ELSIF v_is_bool THEN
      CONTINUE WHEN v_exp = '';
      IF lava_private.to_bool(v_given) = lava_private.to_bool(v_exp) THEN
        v_status := 'correct'; v_feedback := 'Correct — box ' || lower(v_exp_display) || ' as the scenario requires.';
      ELSIF lava_private.to_bool(v_exp) THEN
        v_status := 'missing'; v_feedback := 'This box should be checked based on the scenario email.';
      ELSE
        v_status := 'incorrect'; v_feedback := 'This box should not be checked — the scenario does not call for it.';
      END IF;
    ELSE
      CONTINUE WHEN v_exp = '' AND m.match_type <> 'present';
      IF v_blank THEN
        CONTINUE WHEN m.missing_rule = 'optional';
        v_status := 'missing';
        v_feedback := CASE WHEN m.required THEN 'Required field left empty. ' ELSE 'This field was left empty. ' END
          || 'The expected value is "' || v_exp_display || '". Review the scenario email for this information.';
      ELSIF lava_private.answer_matches(v_exp, m.match_type, v_given) THEN
        v_status := 'correct'; v_feedback := 'Correct — "' || v_exp_display || '" was properly captured.';
      ELSE
        v_status := 'incorrect';
        v_feedback := 'Entered "' || v_given || '" but expected "' || v_exp_display || '". Double-check the scenario email.';
      END IF;
    END IF;

    v_total := v_total + m.points;
    IF v_status = 'correct' THEN v_earned := v_earned + m.points; v_correct := v_correct + 1;
    ELSIF v_status = 'missing' THEN v_missing := v_missing + 1;
    ELSE v_incorrect := v_incorrect + 1; END IF;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'fieldId', m.pdf_field_name,
      'label', coalesce(NULLIF(m.scenario_label, ''), m.pdf_field_name),
      'status', v_status,
      'expected', v_exp_display,
      'given', CASE WHEN v_is_bool THEN (CASE WHEN lava_private.to_bool(v_given) THEN 'Checked' ELSE 'Unchecked' END)
                    WHEN btrim(v_given) = '' THEN '(blank)' ELSE v_given END,
      'feedback', v_feedback || coalesce(' Tip: ' || NULLIF(m.feedback_hint, ''), ''),
      'hint', NULLIF(m.feedback_hint, ''),
      'points', m.points,
      'earned', CASE WHEN v_status = 'correct' THEN m.points ELSE 0 END,
      'required', m.required,
      'page', m.page));
  END LOOP;

  RETURN jsonb_build_object(
    'score', CASE WHEN v_total > 0 THEN round(v_earned * 100 / v_total)::integer ELSE 0 END,
    'correct', v_correct, 'incorrect', v_incorrect, 'missing', v_missing,
    'total', v_correct + v_incorrect + v_missing, 'results', v_results);
END $$;

-- Student-facing version of the results: expected answers removed until feedback is revealed.
CREATE OR REPLACE FUNCTION lava_private.redact_results(p_results jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_agg(
    (r - 'expected' - 'feedback') || jsonb_build_object(
      'expected', NULL,
      'feedback', CASE r->>'status'
        WHEN 'correct' THEN 'Correct.'
        WHEN 'missing' THEN 'This field was left empty but the scenario contains this information.'
        ELSE 'The value entered does not match the scenario. Re-read the email carefully.' END
        || coalesce(' Tip: ' || (r->>'hint'), ''))
  ), '[]'::jsonb)
  FROM jsonb_array_elements(p_results) r
$$;

-- ---------- assessment RPCs ----------
CREATE OR REPLACE FUNCTION public.start_assessment(p_module_id text) RETURNS public.assessment_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pdf public.training_materials;
  v_attempt public.assessment_attempts;
  v_used integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.acord_modules WHERE id = p_module_id) THEN RAISE EXCEPTION 'MODULE_NOT_FOUND'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || p_module_id));

  -- Resume an attempt already in progress.
  SELECT * INTO v_attempt FROM public.assessment_attempts
    WHERE user_id = v_uid AND module_id = p_module_id AND status = 'in_progress';
  IF v_attempt.id IS NOT NULL THEN RETURN v_attempt; END IF;

  -- Video gate: at least one current video, and every required current video completed.
  IF NOT EXISTS (SELECT 1 FROM public.training_materials WHERE module_id = p_module_id AND material_type = 'video' AND is_current) THEN
    RAISE EXCEPTION 'NO_VIDEO';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.training_materials t
    LEFT JOIN public.video_progress vp ON vp.asset_key = t.asset_key AND vp.user_id = v_uid
    WHERE t.module_id = p_module_id AND t.material_type = 'video' AND t.is_current AND t.is_required
      AND coalesce(vp.completed, false) = false) THEN
    RAISE EXCEPTION 'VIDEO_INCOMPLETE';
  END IF;

  SELECT * INTO v_pdf FROM public.training_materials WHERE module_id = p_module_id AND material_type = 'pdf' AND is_current;
  IF v_pdf.id IS NULL THEN RAISE EXCEPTION 'NO_PDF'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pdf_form_fields WHERE material_id = v_pdf.id AND field_type NOT IN ('button', 'signature')) THEN
    RAISE EXCEPTION 'PDF_NOT_FILLABLE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pdf_field_mappings WHERE material_id = v_pdf.id AND is_scored AND points > 0
                   AND (coalesce(expected_value, '') <> '' OR match_type = 'present' OR missing_rule = 'expect_blank')) THEN
    RAISE EXCEPTION 'GRADING_NOT_CONFIGURED';
  END IF;

  SELECT count(*) INTO v_used FROM public.assessment_attempts WHERE user_id = v_uid AND module_id = p_module_id AND status = 'submitted';
  IF v_used >= 3 THEN RAISE EXCEPTION 'NO_ATTEMPTS_REMAINING'; END IF;

  INSERT INTO public.assessment_attempts (user_id, module_id, material_id, student_name, attempt_number, status, started_at,
      score, correct, incorrect, missing, total_fields, completion_time_min, field_values, field_results, completed_at)
  VALUES (v_uid, p_module_id, v_pdf.id, coalesce((SELECT NULLIF(full_name, '') FROM public.profiles WHERE id = v_uid), 'Trainee'),
      v_used + 1, 'in_progress', now(), 0, 0, 0, 0, 0, 0, '{}'::jsonb, '[]'::jsonb, NULL)
  RETURNING * INTO v_attempt;
  RETURN v_attempt;
END $$;

CREATE OR REPLACE FUNCTION public.save_assessment_draft(p_attempt_id uuid, p_values jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF jsonb_typeof(p_values) <> 'object' OR pg_column_size(p_values) > 512000 THEN RAISE EXCEPTION 'INVALID_VALUES'; END IF;
  UPDATE public.assessment_attempts SET draft_values = p_values
    WHERE id = p_attempt_id AND user_id = auth.uid() AND status = 'in_progress';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.submit_assessment(p_attempt_id uuid, p_values jsonb) RETURNS public.assessment_attempts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_attempt public.assessment_attempts;
  v_grade jsonb;
  v_secs integer;
  v_passed boolean;
  v_reveal boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object' OR pg_column_size(p_values) > 512000 THEN RAISE EXCEPTION 'INVALID_VALUES'; END IF;

  SELECT * INTO v_attempt FROM public.assessment_attempts WHERE id = p_attempt_id AND user_id = v_uid FOR UPDATE;
  IF v_attempt.id IS NULL THEN RAISE EXCEPTION 'ATTEMPT_NOT_FOUND'; END IF;
  IF v_attempt.status <> 'in_progress' THEN RAISE EXCEPTION 'ATTEMPT_ALREADY_SUBMITTED'; END IF;
  IF v_attempt.material_id IS NULL THEN RAISE EXCEPTION 'PDF_REMOVED'; END IF;

  v_grade := lava_private.grade_values(v_attempt.material_id, p_values);
  v_secs := greatest(1, extract(epoch FROM (now() - v_attempt.started_at))::integer);
  v_passed := (v_grade->>'score')::integer >= 80;
  v_reveal := v_passed OR v_attempt.attempt_number >= 3;

  INSERT INTO public.assessment_grading_details (attempt_id, results) VALUES (v_attempt.id, v_grade->'results')
    ON CONFLICT (attempt_id) DO UPDATE SET results = EXCLUDED.results, graded_at = now();

  UPDATE public.assessment_attempts SET
    status = 'submitted',
    submitted_at = now(),
    completed_at = now(),
    completion_seconds = v_secs,
    completion_time_min = greatest(1, round(v_secs / 60.0))::integer,
    field_values = p_values,
    draft_values = NULL,
    score = (v_grade->>'score')::integer,
    correct = (v_grade->>'correct')::integer,
    incorrect = (v_grade->>'incorrect')::integer,
    missing = (v_grade->>'missing')::integer,
    total_fields = (v_grade->>'total')::integer,
    passed = v_passed,
    feedback_revealed = v_reveal,
    field_results = CASE WHEN v_reveal THEN v_grade->'results' ELSE lava_private.redact_results(v_grade->'results') END
  WHERE id = v_attempt.id
  RETURNING * INTO v_attempt;

  IF v_reveal THEN
    -- Final attempt or passed: earlier attempts' feedback can now show the expected answers too.
    UPDATE public.assessment_attempts a SET field_results = d.results, feedback_revealed = true
    FROM public.assessment_grading_details d
    WHERE d.attempt_id = a.id AND a.user_id = v_uid AND a.module_id = v_attempt.module_id AND NOT a.feedback_revealed;
  END IF;

  RETURN v_attempt;
END $$;

CREATE OR REPLACE FUNCTION public.attach_completed_pdf(p_attempt_id uuid, p_path text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_path IS NULL OR split_part(p_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'INVALID_PATH'; END IF;
  UPDATE public.assessment_attempts SET completed_pdf_path = p_path
    WHERE id = p_attempt_id AND user_id = auth.uid() AND status = 'submitted';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.staff_reset_attempts(p_user_id uuid, p_module_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  DELETE FROM public.assessment_attempts WHERE user_id = p_user_id AND module_id = p_module_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ============================================================
-- 8. Storage buckets & policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('lava-acord-training', 'lava-acord-training', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES ('assessment-submissions', 'assessment-submissions', false, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, allowed_mime_types = ARRAY['application/pdf'];

-- Prototype buckets: make private; keep readable for existing objects.
UPDATE storage.buckets SET public = false WHERE id IN ('training-videos', 'fillable-pdfs');

DROP POLICY IF EXISTS "public_read_training_videos" ON storage.objects;
DROP POLICY IF EXISTS "public_write_training_videos" ON storage.objects;
DROP POLICY IF EXISTS "public_delete_training_videos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_fillable_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "public_write_fillable_pdfs" ON storage.objects;
DROP POLICY IF EXISTS "public_delete_fillable_pdfs" ON storage.objects;

DROP POLICY IF EXISTS "lava_training_read" ON storage.objects;
CREATE POLICY "lava_training_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('lava-acord-training', 'training-videos', 'fillable-pdfs'));
DROP POLICY IF EXISTS "lava_training_staff_insert" ON storage.objects;
CREATE POLICY "lava_training_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('lava-acord-training', 'training-videos', 'fillable-pdfs') AND public.is_staff());
DROP POLICY IF EXISTS "lava_training_staff_update" ON storage.objects;
CREATE POLICY "lava_training_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('lava-acord-training', 'training-videos', 'fillable-pdfs') AND public.is_staff());
DROP POLICY IF EXISTS "lava_training_staff_delete" ON storage.objects;
CREATE POLICY "lava_training_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('lava-acord-training', 'training-videos', 'fillable-pdfs') AND public.is_staff());

DROP POLICY IF EXISTS "submissions_insert_own" ON storage.objects;
CREATE POLICY "submissions_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assessment-submissions' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "submissions_select_own_or_staff" ON storage.objects;
CREATE POLICY "submissions_select_own_or_staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'assessment-submissions' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()));
DROP POLICY IF EXISTS "submissions_staff_delete" ON storage.objects;
CREATE POLICY "submissions_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'assessment-submissions' AND public.is_staff());

-- ============================================================
-- 9. Function privileges
-- ============================================================
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lava_private FROM PUBLIC;
-- Only this harmless predicate (about the caller's own attempts) is callable, because an RLS policy uses it.
GRANT EXECUTE ON FUNCTION lava_private.attempt_uses_material(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_role(), public.is_staff(), public.is_admin(),
  public.update_my_profile(text), public.admin_set_role(uuid, text), public.admin_set_cohort(uuid, text),
  public.set_current_material(uuid), public.copy_field_mappings(uuid, uuid), public.get_required_fields(uuid),
  public.record_video_progress(uuid, numeric, numeric, numeric), public.start_assessment(text),
  public.save_assessment_draft(uuid, jsonb), public.submit_assessment(uuid, jsonb),
  public.attach_completed_pdf(uuid, text), public.staff_reset_attempts(uuid, text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.app_role(), public.is_staff(), public.is_admin(),
  public.update_my_profile(text), public.admin_set_role(uuid, text), public.admin_set_cohort(uuid, text),
  public.set_current_material(uuid), public.copy_field_mappings(uuid, uuid), public.get_required_fields(uuid),
  public.record_video_progress(uuid, numeric, numeric, numeric), public.start_assessment(text),
  public.save_assessment_draft(uuid, jsonb), public.submit_assessment(uuid, jsonb),
  public.attach_completed_pdf(uuid, text), public.staff_reset_attempts(uuid, text)
  TO authenticated;

GRANT SELECT ON public.profiles, public.acord_modules, public.training_materials, public.pdf_form_fields,
  public.video_progress, public.assessment_attempts, public.assessment_grading_details TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_materials, public.pdf_form_fields,
  public.pdf_field_mappings, public.scenario_facts TO authenticated;
