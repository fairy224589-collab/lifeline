import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("placeholder") &&
    supabaseUrl.startsWith("http")
);

export function getSupabaseConfigStatus(): { configured: boolean; message?: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      configured: false,
      message:
        "Supabase credentials missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are defined in .env.local",
    };
  }
  if (supabaseUrl.includes("placeholder") || supabaseAnonKey.includes("placeholder")) {
    return {
      configured: false,
      message:
        "Supabase credentials contain placeholder values. Replace them with your project credentials in .env.local",
    };
  }
  return { configured: true };
}

function initClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    // In dev / test or before initial setup, log a clear diagnostic warning
    if (typeof window !== "undefined") {
      console.warn(
        "[LifeLine Security Warning] Supabase client initialized without valid credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
      );
    }
    // Return a dummy endpoint with explicit non-routable host for offline safety rather than an arbitrary 3rd party domain
    return createClient("http://127.0.0.1:54321", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy", {
      auth: { persistSession: false },
    });
  }

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
    },
  });
}

export const supabase = initClient();
