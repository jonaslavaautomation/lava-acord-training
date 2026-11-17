/*
# Add ACORD 27 — Evidence of Property Insurance

Adds the ACORD 27 module (sixth form). Its scenario is in src/data/modules.ts (BlueRidge Manufacturing /
First Carolina Bank, continuing the ACORD 140 client).

After running this file, run supabase/migrations/20261111120000_auto_answer_keys.sql again so the ACORD 27
answer-key rules are loaded. The training video and Knowledge Check questions are added later.
Safe to run more than once.
*/

INSERT INTO public.acord_modules (id, form_number, title, storage_folder, sort_order)
VALUES ('27', 'ACORD 27', 'Evidence of Property Insurance', 'ACORD 27', 6)
ON CONFLICT (id) DO UPDATE SET
  form_number = EXCLUDED.form_number, title = EXCLUDED.title,
  storage_folder = EXCLUDED.storage_folder, sort_order = EXCLUDED.sort_order;
