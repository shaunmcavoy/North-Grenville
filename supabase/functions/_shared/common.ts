// Shared helpers for North Grenville Hot Tubs edge functions.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const SITE_URL = Deno.env.get("SITE_URL") ?? "https://northgrenvillehottubs.ca";
export const FUNCTIONS_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
export const FROM = Deno.env.get("EMAIL_FROM") ?? "Blaine at North Grenville Hot Tubs <info@northgrenvillehottubs.ca>";
export const REPLY_TO = "info@northgrenvillehottubs.ca";

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

const ALLOWED = [SITE_URL, "https://www.northgrenvillehottubs.ca", "https://shaunmcavoy.github.io"];
export function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : SITE_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
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
