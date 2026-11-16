/*
# Trainee quick start (no student login)

Trainees no longer create an account. On the start screen they type their first name, last name,
insurance agency and trainer, and the app signs them in with a Supabase *anonymous* session.
That session is a real user id, so every existing security rule, the knowledge check, the
assessment attempts and the grading keep working unchanged.

Only the administrator (and trainers you create) sign in with email + password, at /admin.

Supabase dashboard step (required): Authentication -> Sign In / Providers -> enable
"Allow anonymous sign-ins".

- Adds first_name, last_name, agency_name, trainer_name to profiles.
- New-user trigger fills them from the start screen; anonymous users are always students
  (they can never become the bootstrap administrator). The agency is used as the cohort.
- update_trainee_details() lets a trainee correct their details later (Settings page).
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trainer_name text;

CREATE OR REPLACE FUNCTION lava_private.clean_text(p text, p_max integer) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(left(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), p_max), '')
$$;

CREATE OR REPLACE FUNCTION lava_private.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text := 'student';
  v_anon boolean := coalesce((to_jsonb(NEW) ->> 'is_anonymous')::boolean, false);
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_first text := lava_private.clean_text(v_meta ->> 'first_name', 60);
  v_last text := lava_private.clean_text(v_meta ->> 'last_name', 60);
  v_agency text := lava_private.clean_text(v_meta ->> 'agency_name', 120);
  v_trainer text := lava_private.clean_text(v_meta ->> 'trainer_name', 120);
  v_full text;
BEGIN
  -- Bootstrap: while there is no administrator, the first *email* account becomes one.
  -- Anonymous trainees are always students. Role is never taken from user-supplied metadata.
  IF NOT v_anon AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    v_role := 'admin';
  END IF;

  v_full := coalesce(
    lava_private.clean_text(concat_ws(' ', v_first, v_last), 120),
    lava_private.clean_text(v_meta ->> 'full_name', 120),
    NULLIF(split_part(coalesce(NEW.email, ''), '@', 1), ''),
    'Trainee');

  INSERT INTO public.profiles (id, email, full_name, role, cohort, first_name, last_name, agency_name, trainer_name)
  VALUES (NEW.id, NEW.email, v_full, v_role, left(v_agency, 60), v_first, v_last, v_agency, v_trainer)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_trainee_details(p_first_name text, p_last_name text, p_agency_name text, p_trainer_name text)
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.profiles;
  v_first text := lava_private.clean_text(p_first_name, 60);
  v_last text := lava_private.clean_text(p_last_name, 60);
  v_agency text := lava_private.clean_text(p_agency_name, 120);
  v_trainer text := lava_private.clean_text(p_trainer_name, 120);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF v_first IS NULL OR v_last IS NULL OR v_agency IS NULL OR v_trainer IS NULL THEN RAISE EXCEPTION 'DETAILS_REQUIRED'; END IF;
  UPDATE public.profiles
     SET first_name = v_first, last_name = v_last, agency_name = v_agency, trainer_name = v_trainer,
         full_name = v_first || ' ' || v_last,
         cohort = CASE WHEN cohort IS NULL OR cohort = left(agency_name, 60) THEN left(v_agency, 60) ELSE cohort END
   WHERE id = auth.uid()
  RETURNING * INTO v;
  RETURN v;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_trainee_details(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_trainee_details(text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION lava_private.clean_text(text, integer) FROM PUBLIC, anon, authenticated;
