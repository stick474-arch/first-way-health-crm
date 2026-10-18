/*
 * Supabase connection (optional).
 * Leave both values empty to run in LOCAL mode: data stays in this browser only.
 * Fill them in to run in CLOUD mode: shared team data, sign-in, realtime updates.
 *
 * Where to find them: Supabase dashboard → Project Settings → API Keys.
 * The publishable key (sb_publishable_…, or the legacy "anon" key) is designed to be public;
 * your data is protected by the Row Level Security policies in supabase/schema.sql
 * (only emails on the team allowlist can read or write).
 * NEVER put a secret / service_role key here.
 */
window.FWH_CONFIG = {
  supabaseUrl: 'https://kurhpncnnwecnpouszyi.supabase.co',
  supabaseAnonKey: 'sb_publishable_fQZ8YffL2hZJehRflXZFjg_NsyYHK4Q',
};
