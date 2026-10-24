// Shared helpers for North Grenville Hot Tubs edge functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const SITE_URL = Deno.env.get("SITE_URL") ?? "https://northgrenvillehottubs.ca";
export const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
export const FROM = Deno.env.get("EMAIL_FROM") ?? "Blaine at North Grenville Hot Tubs <info@northgrenvillehottubs.ca>";
export const REPLY_TO = "info@northgrenvillehottubs.ca";

// Uses the legacy keys while they work (until the end of 2026), then falls back to the new secret/publishable keys.
const keyFrom = (json: string, legacy: string) => {
  const l = Deno.env.get(legacy); if (l) return l;
  try { return JSON.parse(Deno.env.get(json) ?? "{}").default as string; } catch { return ""; }
};
export const SECRET_KEY = keyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
export const PUBLISHABLE_KEY = keyFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, SECRET_KEY, { auth: { persistSession: false } });

const ALLOWED = [SITE_URL, "https://www.northgrenvillehottubs.ca", "https://shaunmcavoy.github.io"];
export function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : SITE_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

export const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });

export const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to } });

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendEmail(payload: Record<string, unknown> | Record<string, unknown>[], batch = false) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const r = await fetch(`https://api.resend.com/emails${batch ? "/batch" : ""}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

// Branded email shell. Every email carries sender identity, mailing address and an unsubscribe link (CASL).
export function emailShell(opts: { preheader: string; body: string; unsubscribeUrl?: string }) {
  const unsub = opts.unsubscribeUrl
    ? `<p style="margin:8px 0 0"><a href="${opts.unsubscribeUrl}" style="color:#8a7765">Unsubscribe</a> from Blaine's emails.</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4ecdf;font-family:Helvetica,Arial,sans-serif;color:#2a2019">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4ecdf"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fbf7f0;border-radius:14px;overflow:hidden">
<tr><td style="background:#1d1611;padding:20px 28px">
<img src="${SITE_URL}/assets/img/logo.png" width="56" height="56" alt="North Grenville Hot Tubs" style="vertical-align:middle">
<span style="color:#f4ecdf;font-family:Georgia,serif;font-size:20px;vertical-align:middle;margin-left:12px">North Grenville Hot Tubs</span>
</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6">${opts.body}</td></tr>
<tr><td style="padding:18px 28px;background:#efe5d6;font-size:12px;line-height:1.5;color:#6e5d4f">
North Grenville Hot Tubs &amp; Saunas, 5333 County Rd 19, Kemptville, ON K0G 1J0<br>
Blaine McAvoy, owner. Call or text (613) 292-1786 &middot; info@northgrenvillehottubs.ca
${unsub}
</td></tr></table></td></tr></table></body></html>`;
}

export const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#c8a35b;color:#1d1611;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:999px;display:inline-block">${escapeHtml(label)}</a></p>`;

// ---------- Portal helpers ----------
export const LOGIN_URL = `${SITE_URL}/login/`;

// The signed-in caller, using their own token (so database rules apply), plus their profile.
export async function caller(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const db = admin();
  const { data } = await db.auth.getUser(token);
  if (!data?.user) return null;
  const { data: profile } = await db.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.active) return null;
  const userDb = createClient(Deno.env.get("SUPABASE_URL")!, PUBLISHABLE_KEY, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { user: data.user, profile, userDb };
}

export const corsAuth = (req: Request) => ({ ...cors(req), "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" });
export const jsonAuth = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsAuth(req) } });

export const money = (n: number | string | null | undefined) =>
  "$" + Number(n ?? 0).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Wording for what the customer pays when they sign: a deposit, or the whole amount.
export function payTerms(sale: { payment_type?: string; pay_methods?: string }) {
  const full = sale.payment_type === "full";
  const how = sale.pay_methods === "card" ? "by credit card" : sale.pay_methods === "bank" ? "by bank transfer" : "by card or bank transfer";
  return {
    full, how,
    noun: full ? "payment" : "deposit",            // "your deposit" / "your payment"
    label: full ? "Payment in full" : "Deposit",   // headings and invoice lines
    button: full ? "Pay my invoice" : "Pay my deposit",
    received: full ? "Payment received" : "Deposit received",
  };
}

export const firstNameOf =(name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "there";

// Magic sign-in link that lands on our own /login/ page (no redirect allow-list needed).
export async function loginLink(email: string, next = "") {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) throw error ?? new Error("Could not create login link");
  const q = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (next) q.set("next", next);
  return `${LOGIN_URL}?${q}`;
}

// Find or create a login for an email. New users get the role given (customer by default).
export async function ensureUser(email: string, fullName: string | null, role = "customer") {
  const db = admin();
  const { data: prof } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
  if (prof) return prof.id as string;
  const { data, error } = await db.auth.admin.createUser({
    email, email_confirm: true, user_metadata: { full_name: fullName, role },
  });
  if (error || !data.user) throw error ?? new Error("Could not create user");
  if (role !== "customer") await db.from("profiles").update({ role, full_name: fullName }).eq("id", data.user.id);
  return data.user.id;
}

export async function logEvent(saleId: string, kind: string, actor: string | null, detail: unknown = null) {
  await admin().from("sale_events").insert({ sale_id: saleId, kind, actor, detail });
}

export function dataUrlToBytes(d: string) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(d ?? "");
  if (!m) return null;
  const bin = atob(m[1]);
  if (bin.length > 400_000) return null;
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---- What was sold ----
// product_type is the main product. Hot tubs, swim spas and mini pools use tub_make/tub_model;
// a sauna on its own uses sauna_make/sauna_model. A sauna can also be added to a water product.
const NOUN: Record<string, string> = { hot_tub: "hot tub", swim_spa: "swim spa", mini_pool: "mini pool", sauna: "sauna" };
// deno-lint-ignore no-explicit-any
export function productNoun(sale: any): string { return NOUN[sale?.product_type ?? "hot_tub"] ?? "hot tub"; }
// deno-lint-ignore no-explicit-any
export function productMaker(sale: any): string {
  return sale?.product_type === "sauna" ? (sale.sauna_make || "Hekla") : (sale?.tub_make || "Platinum Spas");
}
// "Palma hot tub", "Platinum Spas Eros swim spa and Cube 160 sauna"
// deno-lint-ignore no-explicit-any
export function productWhat(sale: any, withMake = false): string {
  const sauna = sale?.product_type === "sauna";
  const main = sauna
    ? (sale.sauna_model ? `${withMake && sale.sauna_make ? sale.sauna_make + " " : ""}${sale.sauna_model} sauna` : "")
    : (sale?.tub_model ? `${withMake && sale.tub_make ? sale.tub_make + " " : ""}${sale.tub_model} ${productNoun(sale)}` : "");
  const addon = !sauna && sale?.sauna_model ? `${sale.sauna_model} sauna` : "";
  return [main, addon].filter(Boolean).join(" and ") || `your ${productNoun(sale)}`;
}
// Whether the O-Care registration belongs on this sale (water products using O-Care or no water care set yet).
// deno-lint-ignore no-explicit-any
export function usesOCare(sale: any): boolean {
  return ["hot_tub", "swim_spa"].includes(sale?.product_type ?? "hot_tub") && !!sale?.tub_model &&
    (!sale.water_care || /o.?care/i.test(String(sale.water_care)));
}

