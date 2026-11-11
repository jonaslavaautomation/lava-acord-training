# LAVA ACORD Training Simulator — File-Based Materials & Fillable PDF Upgrade

## Setup (required before anything works)

1. **Apply the migrations** in `supabase/migrations/` in filename order (Bolt's Supabase integration, `supabase db push`, or paste each file into the Supabase SQL editor):
   - `20261110200837_create_training_materials_schema.sql` (existing prototype)
   - `20261111090000_secure_materials_pdf_assessments.sql` (new: roles, storage, RLS, grading, attempts)
   - `20261111090100_seed_scenario_facts.sql` (new: answer-key source data moved out of the browser bundle)
2. **Create the first account** on the sign-in page. **The first account ever created becomes the Administrator**, and everyone after that is a Student. Create your own admin account before you share the app.
3. Promote trainers in **Users & Roles**.
4. Supabase dashboard → **Storage → Settings → Upload file size limit**: raise it for videos (the default on the Free plan is 50 MB; Pro allows much larger).
5. Supabase dashboard → **Authentication**: choose whether email confirmation is required.
6. For each ACORD module, go to **Training Materials** and upload the video(s) and the fillable PDF, then configure the answer key.

## How it works

| Area | Implementation |
|---|---|
| Storage | Private bucket `lava-acord-training` with the paths `ACORD 125/Videos/…`, `ACORD 125/Fillable PDF/…` and `ACORD 125/Supporting Materials/…` (the same for 126/127/130/140). Files are served through short-lived signed URLs. Only trainers and admins can write to the bucket. |
| Completed copies | Private bucket `assessment-submissions`, path `<student id>/ACORD ###/<attempt id>.pdf`. A student can read only their own folder. Staff can read all of them. |
| Uploads | TUS resumable uploads in 6 MB chunks, with real byte progress, cancel, and automatic retry/resume. Files are not stored as Base64 or in the database. |
| Versioning | Replacing a file inserts a new version (v1, v2, …) and archives the previous one. Trainers can restore or delete any version. When a new PDF version is uploaded, the answer-key mappings carry over to fields with the same name. |
| PDF validation | Checks the `%PDF` header, opens the file with PDF.js, detects password protection, XFA forms, encryption (owner restrictions) and flattened PDFs (no AcroForm fields), and warns the trainer about each. |
| PDF filling | PDF.js renders the real pages. Real HTML inputs sit exactly over each AcroForm widget: text, multi-line, date (MM/DD/YYYY), checkbox, radio, dropdown, max-length and read-only. The viewer has multi-page scrolling, a page selector, zoom (buttons, Ctrl+wheel, fit width) and draft autosave. A review screen jumps to any field before submission. |
| Working copy | Each attempt downloads its own in-memory copy of the master PDF version it started on. pdf-lib writes the completed copy to a new file, and the master object is never written. |
| Flattened PDFs | The trainer is notified. In the **Field Designer** the trainer drags rectangles on the pages to create fields (text, date, checkbox or dropdown). In the completed copy these values are stamped at the rectangles. |
| Field mapping | For each PDF field the trainer sets: a scenario fact (optional quick pick), a label, the expected answer, a match rule (exact / contains / any-of / keywords / present), points, required, a missing-information rule (blank = missing / must stay blank / optional), a coaching tip, and whether the field is scored. |
| Grading | Grading runs in Postgres (`submit_assessment`). Answer keys (`pdf_field_mappings`, `scenario_facts`, `assessment_grading_details`) can be read only by staff. Expected answers are hidden from the student until they pass (≥ 80%) or use their final attempt. |
| Attempts | `start_assessment` enforces: a video exists, all required videos are completed, the PDF has fields, an answer key is configured, and fewer than 3 attempts have been submitted. An in-progress attempt is resumed instead of creating a new one. Completion time is calculated from server timestamps. |
| Video tracking | The player sends the watched segments. `record_video_progress` credits at most about 2× the real time since the last heartbeat (and at most 30 s per call). It measures against the duration recorded at upload and marks the video complete at 95% coverage. Students cannot mark a video complete. |

## Verification performed
- **Database:** all migrations were applied (and re-applied, to check idempotency) to a local PostgreSQL 16 with Supabase-style stubs for auth, roles and storage. Scripted tests impersonated an admin, a trainer and two students to check role bootstrap and escalation attempts, RLS on every table and on storage paths, answer-key invisibility, video-progress plausibility caps, attempt start/resume/cap, grading (normalization, dates, checkboxes, expect-blank, optional), redaction and reveal, and version promotion on delete.
- **Browser (Chromium/Playwright):** fixtures were a generated multi-page fillable test PDF, a flattened test PDF, a non-PDF file and a test video. Checks covered filling every field type, zoom and page navigation, value retention, the completed-copy contents and the master's hash being unchanged, the Field Designer's coordinate round-trip, and the full student journey (dashboard → video → Generate → PDF → review → submit → results → completed-copy upload) plus the trainer materials page. The browser tests used a mocked Supabase API, so these flows have not yet been run against your live project.

## Features fully implemented (in code, verified as above)
- Training Materials dashboard for trainers and admins: uploads, previews, replace, delete, version history, upload dates and module association.
- Uploads with drag-and-drop, filename, size, real progress, status and cancel.
- Multiple video lessons per module, each with a required/optional flag.
- Server-verified video completion, which gates the **Generate Form and Scenario** button.
- Interactive filling of the actual uploaded PDF, a review step, autosave, and a completed copy for each attempt.
- Flattened-PDF detection plus the Field Designer workflow.
- Field-mapping editor and server-side grading. Score, time, mistakes and feedback are shown on the results page, and the completed PDF can be downloaded.
- Maximum of 3 attempts (initial + 2 retakes) enforced in the database. Staff can reset a student's attempts.
- Supabase Auth sign-in, sign-up and password reset. Student / trainer / admin roles, plus a Users & Roles page.
- Trainer dashboard now uses real data. The mock student data and YouTube placeholders were removed.

## Requires Supabase configuration
- Applying the migrations, the storage upload size limit, and the auth email settings (see Setup).
- The resumable-upload size ceiling depends on your Supabase plan.

## Requires the uploaded ACORD PDFs
- No assessment can start for a module until a trainer uploads its PDF and maps at least one field. The 114 seeded scenario facts (taken from the previous answer keys) make mapping faster, but PDF field names differ between ACORD editions, so the trainer must make the actual connections.
- Rendering has been tested only with generated test PDFs. Real ACORD PDFs still need to be tested.

## Still pending / known limitations
- **Encrypted ACORD PDFs:** many official ACORD files carry owner-password restrictions. They render and grade normally, but pdf-lib may be unable to write the completed copy. The upload screen flags this, and the attempt is still graded and stored. An unsecured copy, or a server-side PDF service, would solve it.
- **XFA-only forms are not supported**. Upload the AcroForm version instead.
- Grading uses the field values the browser submits (the same values written into the completed copy). It does not re-parse the uploaded PDF.
- Video tracking is a server-side plausibility check, not DRM. A determined user scripting the API would still have to spend at least half the video's length in real time.
- Assessment scenarios are still the fixed emails in `src/data/modules.ts`, one per module. Randomized or trainer-edited scenarios are not built yet.
- All modules are visible to every student. There is no per-student assignment yet.
- The completed copy is generated in the browser after grading. If that upload fails, the result is kept and the results page shows "Completed PDF copy unavailable".
- The JS bundle is about 1.4 MB because of PDF.js and pdf-lib. It could be code-split.
- Pre-existing lint warnings (unused imports) remain in pages that were not changed.
