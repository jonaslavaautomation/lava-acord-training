/*
# LAVA ACORD Training — Materials, PDF Mappings & Storage Schema

## Overview
Creates the database tables needed to manage uploaded training videos, fillable ACORD PDF documents,
PDF field mappings for grading, and student assessment attempts. Also sets up two Supabase Storage
buckets: one for training videos and one for fillable PDFs, organized by ACORD module.

This is a single-tenant prototype (no auth screen yet), so policies use `TO anon, authenticated`
with `USING (true)` for read access — materials are intentionally shared. Write policies are also
open since the trainer/admin role distinction is UI-only at this stage. When auth is added later,
these policies will be tightened to role-based checks.

## New Tables

1. `training_materials` — Stores metadata for uploaded videos and PDFs
   - `id` (uuid PK)
   - `module_id` (text) — '125' | '126' | '127' | '130' | '140'
   - `material_type` (text) — 'video' | 'pdf'
   - `file_name` (text) — original filename
   - `file_size` (bigint) — bytes
   - `storage_path` (text) — path within the storage bucket
   - `storage_bucket` (text) — 'training-videos' | 'fillable-pdfs'
   - `mime_type` (text)
   - `version` (text) — version label, defaults to '1.0'
   - `is_fillable` (boolean) — for PDFs: whether AcroForm fields were detected
   - `field_count` (int) — number of detected AcroForm fields (0 for videos)
   - `uploaded_at` (timestamptz)
   - `uploaded_by` (text) — name of uploader (UI-only for now)

2. `pdf_field_mappings` — Maps PDF AcroForm field names to expected answers and scoring
   - `id` (uuid PK)
   - `module_id` (text) — which ACORD module
   - `material_id` (uuid FK -> training_materials)
   - `pdf_field_name` (text) — the actual AcroForm field name in the PDF
   - `pdf_field_type` (text) — 'text' | 'checkbox' | 'dropdown' | 'radio' | 'date'
   - `scenario_label` (text) — human-readable label for the scenario field
   - `expected_value` (text) — expected answer
   - `match_type` (text) — 'exact' | 'contains' | 'any-of' | 'present'
   - `points` (int) — scoring weight
   - `required` (boolean) — whether this field is required
   - `page_number` (int) — which PDF page the field appears on
   - `created_at` (timestamptz)

3. `assessment_attempts` — Records each student assessment attempt
   - `id` (uuid PK)
   - `module_id` (text)
   - `student_name` (text) — UI-only for now (no auth)
   - `attempt_number` (int)
   - `score` (int) — 0-100
   - `correct` (int)
   - `incorrect` (int)
   - `missing` (int)
   - `total_fields` (int)
   - `completion_time_min` (int)
   - `field_values` (jsonb) — the student's filled PDF field values
   - `field_results` (jsonb) — detailed grading results per field
   - `completed_at` (timestamptz)

## Storage Buckets
- `training-videos` — public bucket for MP4/WebM training videos
- `fillable-pdfs` — public bucket for fillable ACORD PDF documents

## Security
- RLS enabled on all tables
- `anon, authenticated` granted CRUD (single-tenant prototype, no auth screen)
- Storage buckets are public-read (students need to view videos/PDFs)
*/

-- ============================================================
-- Table: training_materials
-- ============================================================
CREATE TABLE IF NOT EXISTS training_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL,
  material_type text NOT NULL CHECK (material_type IN ('video', 'pdf')),
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  storage_bucket text NOT NULL,
  mime_type text,
  version text NOT NULL DEFAULT '1.0',
  is_fillable boolean DEFAULT false,
  field_count integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by text DEFAULT 'Trainer'
);

ALTER TABLE training_materials ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON training_materials TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_materials" ON training_materials;
CREATE POLICY "anon_select_materials" ON training_materials FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_materials" ON training_materials;
CREATE POLICY "anon_insert_materials" ON training_materials FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_materials" ON training_materials;
CREATE POLICY "anon_update_materials" ON training_materials FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_materials" ON training_materials;
CREATE POLICY "anon_delete_materials" ON training_materials FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_training_materials_module ON training_materials(module_id, material_type);

-- ============================================================
-- Table: pdf_field_mappings
-- ============================================================
CREATE TABLE IF NOT EXISTS pdf_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL,
  material_id uuid REFERENCES training_materials(id) ON DELETE CASCADE,
  pdf_field_name text NOT NULL,
  pdf_field_type text NOT NULL DEFAULT 'text',
  scenario_label text NOT NULL,
  expected_value text,
  match_type text NOT NULL DEFAULT 'contains',
  points integer NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  page_number integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pdf_field_mappings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON pdf_field_mappings TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_mappings" ON pdf_field_mappings;
CREATE POLICY "anon_select_mappings" ON pdf_field_mappings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_mappings" ON pdf_field_mappings;
CREATE POLICY "anon_insert_mappings" ON pdf_field_mappings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_mappings" ON pdf_field_mappings;
CREATE POLICY "anon_update_mappings" ON pdf_field_mappings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_mappings" ON pdf_field_mappings;
CREATE POLICY "anon_delete_mappings" ON pdf_field_mappings FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pdf_mappings_module ON pdf_field_mappings(module_id);

-- ============================================================
-- Table: assessment_attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id text NOT NULL,
  student_name text NOT NULL DEFAULT 'Trainee',
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  incorrect integer NOT NULL DEFAULT 0,
  missing integer NOT NULL DEFAULT 0,
  total_fields integer NOT NULL DEFAULT 0,
  completion_time_min integer NOT NULL DEFAULT 0,
  field_values jsonb DEFAULT '{}',
  field_results jsonb DEFAULT '[]',
  completed_at timestamptz DEFAULT now()
);

ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON assessment_attempts TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_attempts" ON assessment_attempts;
CREATE POLICY "anon_select_attempts" ON assessment_attempts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attempts" ON assessment_attempts;
CREATE POLICY "anon_insert_attempts" ON assessment_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attempts" ON assessment_attempts;
CREATE POLICY "anon_update_attempts" ON assessment_attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attempts" ON assessment_attempts;
CREATE POLICY "anon_delete_attempts" ON assessment_attempts FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_module ON assessment_attempts(module_id, student_name);

-- ============================================================
-- Storage Buckets (idempotent)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-videos', 'training-videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fillable-pdfs', 'fillable-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow anon + authenticated to read and upload
-- (will be tightened when auth roles are added)
DROP POLICY IF EXISTS "public_read_training_videos" ON storage.objects;
CREATE POLICY "public_read_training_videos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'training-videos');

DROP POLICY IF EXISTS "public_write_training_videos" ON storage.objects;
CREATE POLICY "public_write_training_videos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'training-videos');

DROP POLICY IF EXISTS "public_delete_training_videos" ON storage.objects;
CREATE POLICY "public_delete_training_videos" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'training-videos');

DROP POLICY IF EXISTS "public_read_fillable_pdfs" ON storage.objects;
CREATE POLICY "public_read_fillable_pdfs" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'fillable-pdfs');

DROP POLICY IF EXISTS "public_write_fillable_pdfs" ON storage.objects;
CREATE POLICY "public_write_fillable_pdfs" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'fillable-pdfs');

DROP POLICY IF EXISTS "public_delete_fillable_pdfs" ON storage.objects;
CREATE POLICY "public_delete_fillable_pdfs" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'fillable-pdfs');
