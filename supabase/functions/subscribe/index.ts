// POST {email, first_name?, consent: true, website?: ""}  (website is a honeypot and must be empty)
// Saves a pending subscriber and emails a confirmation link (double opt-in).
import { admin, button, cors, emailShell, escapeHtml, FROM, FUNCTIONS_URL, json, REPLY_TO, sendEmail } from "../_shared/common.ts";

const CONSENT_TEXT =
  "Yes, email me Blaine's new blog posts and occasional news from North Grenville Hot Tubs. I can unsubscribe any time.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Use POST" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: "Invalid request" }, 400); }

  if (body.website) return json(req, { ok: true }); // bot filled the honeypot; pretend success
  const email = String(body.email ?? "").trim().toLowerCase();
  const firstName = String(body.first_name ?? "").trim().slice(0, 60) || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    return json(req, { error: "Please enter a valid email address." }, 400);
  }
  if (body.consent !== true) return json(req, { error: "Please tick the box to agree to receive emails." }, 400);

  const db = admin();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  // Light rate limit: max 5 sign-ups per IP per hour.
  if (ip) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("subscribers").select("id", { count: "exact", head: true })
      .eq("consent_ip", ip).gte("created_at", since);
    if ((count ?? 0) >= 5) return json(req, { error: "Too many sign-ups from this connection. Try again later." }, 429);
  }

  const { data: existing } = await db.from("subscribers").select("id,status,token").ilike("email", email).maybeSingle();
  if (existing?.status === "confirmed") return json(req, { ok: true, already: true });

  const row = {
    email, first_name: firstName, status: "pending", consent_text: CONSENT_TEXT,
    consent_source: String(body.source ?? "blog").slice(0, 40), consent_ip: ip,
    consent_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300), created_at: new Date().toISOString(),
    unsubscribed_at: null,
  };
  const q = existing
    ? db.from("subscribers").update({ ...row, token: crypto.randomUUID() }).eq("id", existing.id).select("token").single()
    : db.from("subscribers").insert(row).select("token").single();
  const { data, error } = await q;
  if (error || !data) return json(req, { error: "Something went wrong. Please try again." }, 500);

  const confirmUrl = `${FUNCTIONS_URL}/confirm?token=${data.token}`;
  const hi = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
  try {
    await sendEmail({
      from: FROM, to: email, reply_to: REPLY_TO,
      subject: "Please confirm: Blaine's hot tub posts",
      html: emailShell({
        preheader: "One click to start getting Blaine's weekly posts.",
        body: `<p>${hi}</p><p>Thanks for signing up for my blog. Click below to confirm and you'll get each new post by email, usually on Mondays.</p>
${button(confirmUrl, "Yes, sign me up")}
<p style="color:#6e5d4f;font-size:14px">If you didn't sign up, just ignore this email and you won't hear from us.</p>
<p>Blaine</p>`,
      }),
      text: `${hi.replace(/<[^>]+>/g, "")}\n\nThanks for signing up for my blog. Confirm here: ${confirmUrl}\n\nIf you didn't sign up, ignore this email.\n\nBlaine\nNorth Grenville Hot Tubs, 5333 County Rd 19, Kemptville, ON`,
    });
  } catch (e) {
    console.error(e);
    return json(req, { error: "We couldn't send the confirmation email. Please try again later." }, 502);
  }
  return json(req, { ok: true });
});
