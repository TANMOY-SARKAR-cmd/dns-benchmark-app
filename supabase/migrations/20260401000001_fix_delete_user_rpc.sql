CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Must delete profile first due to FK reference to auth.users
  DELETE FROM public.profiles WHERE id = v_uid;
  -- Delete monitor results before monitors to satisfy FK from monitor_results.monitor_id to monitors(id)
  DELETE FROM public.monitor_results WHERE user_id = v_uid::text;
  DELETE FROM public.monitors WHERE user_id = v_uid::text;
  DELETE FROM public.user_preferences WHERE user_id = v_uid::text;
  DELETE FROM public.dns_queries WHERE user_id = v_uid::text;
  DELETE FROM public.benchmark_results WHERE user_id = v_uid::text;
  -- Now safe to delete auth user
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
