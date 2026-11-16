import type { NextRequest } from "next/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabaseClient.ts";
import { sanitizeSelfRegistrationRole } from "./validations.ts";
export { sanitizeSelfRegistrationRole };

export type AppRole = "donor" | "hospital" | "blood_bank" | "admin";

export interface AuthVerificationResult {
  authenticated: boolean;
  user: User | null;
  role: AppRole;
  isVerifiedFacility: boolean;
  error?: string;
}

export interface RoleVerificationResult {
  authorized: boolean;
  user: User | null;
  role: AppRole;
  error?: string;
}

/**
 * Extracts the bearer token from the Authorization header or cookies.
 * Does NOT accept arbitrary unverified test headers.
 */
export function extractBearerToken(req: NextRequest | { headers: Headers | { get(name: string): string | null }; cookies?: { get(name: string): { value?: string } | undefined } }): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim();
  }

  // Fallback to Supabase auth cookie if present
  if (req.cookies && typeof req.cookies.get === "function") {
    const cookieToken =
      req.cookies.get("sb-access-token")?.value ||
      req.cookies.get("supabase-auth-token")?.value;
    if (cookieToken) return cookieToken;
  }

  return null;
}

/**
 * Creates a server-side Supabase client scoped to an optional bearer token.
 * Never leaks service-role keys to browser code.
 */
export function createServerClient(token?: string | null): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
}

/**
 * Resolves user role strictly from server-controlled metadata or app_roles.
 * NEVER trusts client-supplied user_metadata.role.
 */
export function resolveServerRole(user: User): { role: AppRole; isVerifiedFacility: boolean } {
  // ONLY server-set app_metadata is trusted; user_metadata is client-writable at signup and strictly ignored
  const serverRole = user.app_metadata?.role as string | undefined;
  const isVerified = Boolean(user.app_metadata?.is_verified);

  if (serverRole === "admin") {
    return { role: "admin", isVerifiedFacility: true };
  }

  if (serverRole === "hospital") {
    return { role: "hospital", isVerifiedFacility: isVerified };
  }

  if (serverRole === "blood_bank") {
    return { role: "blood_bank", isVerifiedFacility: isVerified };
  }

  // Safe default: all users are ordinary donors unless explicitly elevated by server-side processes
  return { role: "donor", isVerifiedFacility: false };
}

/**
 * Verifies the caller's authentication status from the incoming request.
 * Completely purged of test header backdoors.
 */
export async function verifyAuth(req: NextRequest | any): Promise<AuthVerificationResult> {
  const token = extractBearerToken(req);

  if (!token) {
    return {
      authenticated: false,
      user: null,
      role: "donor",
      isVerifiedFacility: false,
      error: "Missing authorization token. Please sign in.",
    };
  }

  if (!isSupabaseConfigured) {
    return {
      authenticated: false,
      user: null,
      role: "donor",
      isVerifiedFacility: false,
      error: "Authentication service not configured. Set NEXT_PUBLIC_SUPABASE_URL in .env.local",
    };
  }

  try {
    const client = createServerClient(token);
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      return {
        authenticated: false,
        user: null,
        role: "donor",
        isVerifiedFacility: false,
        error: error?.message || "Invalid or expired session token.",
      };
    }

    const { role, isVerifiedFacility } = resolveServerRole(data.user);

    return {
      authenticated: true,
      user: data.user,
      role,
      isVerifiedFacility,
    };
  } catch (err: any) {
    return {
      authenticated: false,
      user: null,
      role: "donor",
      isVerifiedFacility: false,
      error: err.message || "Failed to verify authentication.",
    };
  }
}

/**
 * Verifies that the caller is authenticated AND possesses one of the required roles.
 * Never trusts user_metadata.
 */
export async function verifyRole(
  req: NextRequest | any,
  allowedRoles: AppRole[]
): Promise<RoleVerificationResult> {
  const auth = await verifyAuth(req);

  if (!auth.authenticated || !auth.user) {
    return {
      authorized: false,
      user: null,
      role: "donor",
      error: auth.error || "Authentication required.",
    };
  }

  if (!allowedRoles.includes(auth.role)) {
    return {
      authorized: false,
      user: auth.user,
      role: auth.role,
      error: `Access denied. Required role: [${allowedRoles.join(", ")}], your role: [${auth.role}].`,
    };
  }

  // If facility role requested, ensure facility is verified
  if ((auth.role === "hospital" || auth.role === "blood_bank") && !auth.isVerifiedFacility && !allowedRoles.includes("donor")) {
    return {
      authorized: false,
      user: auth.user,
      role: auth.role,
      error: "Facility account is pending administrative verification.",
    };
  }

  return {
    authorized: true,
    user: auth.user,
    role: auth.role,
  };
}
