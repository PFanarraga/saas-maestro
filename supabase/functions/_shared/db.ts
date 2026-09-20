// Shared DB access for the Shoply Edge Function.
// postgres.js connects over SUPABASE_DB_URL (injected by the platform).
// `prepare: false` is required for Supavisor transaction pool mode.
import postgres from "npm:postgres@3.4.7";

const connectionString = Deno.env.get("SUPABASE_DB_URL") ?? Deno.env.get("DATABASE_URL") ?? "";

if (!connectionString) {
  // Fail loudly at boot — the function is useless without a DB URL.
  console.error("[db] SUPABASE_DB_URL is not set");
}

export const sql = postgres(connectionString, {
  prepare: false,
  max: 8,
  idle_timeout: 20,
  connect_timeout: 10,
  // Return BIGINT (ms epochs) as JS numbers, not strings.
  // Inline type handler: `postgres.Bigint` is undefined under the Deno npm
  // interop and crashes at connection init (OIDs: int8 = 20).
  types: {
    bigint: { to: 20, from: [20], serialize: (x: any) => String(x), parse: (x: any) => Number(x) },
  },
});

// Admin client for Auth management
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";

export const getAdminClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    console.error("[db] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export type Row = Record<string, any>;

/** Thrown by guards; mapped to HTTP status codes by the router. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const UNAUTHENTICATED = () => new ApiError(401, "UNAUTHENTICATED");
export const FORBIDDEN = (msg = "FORBIDDEN") => new ApiError(403, msg);
export const NOT_FOUND = (msg = "Not found") => new ApiError(404, msg);
export const BAD_REQUEST = (msg: string) => new ApiError(400, msg);

export const now = () => Date.now();

/** snake_case row → camelCase object for a known set of prefixed columns. */
export function camelize<T = Row>(row: Row | null | undefined): T | null {
  if (!row) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    out[key] = v;
  }
  return out as T;
}

export function camelizeAll<T = Row>(rows: Row[]): T[] {
  return rows.map((r) => camelize<T>(r)!);
}

/**
 * Convex stored `undefined` as "field absent"; Postgres uses NULL. To keep the
 * frontend contract identical we drop null-valued keys from API payloads.
 * (null is still returned explicitly for nullable Convex fields like seo.)
 */
export function clean<T = Row>(obj: Row | null | undefined): T | null {
  if (obj === null || obj === undefined) return null;
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Sanitize text like src/convex/lib/auth.ts sanitizeText. */
export function sanitizeText(value: unknown, maxLen = 5000): string {
  return String(value ?? "").trim().slice(0, maxLen);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);
}

export function generateToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOrderNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function isHexColor(value: string | undefined | null): boolean {
  if (!value) return true;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}
