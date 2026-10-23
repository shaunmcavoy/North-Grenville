// One edge function for the customer and staff portals. Route = last path segment, e.g. /functions/v1/portal/signing
import { admin, button, caller, cors, corsAuth, dataUrlToBytes, emailShell, ensureUser, escapeHtml, firstNameOf, FROM, json, jsonAuth, logEvent, loginLink, money, REPLY_TO, sendEmail, SITE_URL } from "../_shared/common.ts";
import { buildAgreementPdf, sha256Hex, toBase64 } from "../_shared/pdf.ts";
import { createDepositInvoice, invoiceBalance, qbAuthUrl, qbConfigured, qbDisconnect, qbExchange, qbLists, qbStatus } from "../_shared/qb.ts";

// ---- login-link ----
// POST {email, next?}  Emails a one-tap sign-in link. Always answers "ok" so it never reveals who has an account.

async function route_login_link(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(req, { error: "Please enter a valid email address." }, 400);
  const next = String(body.next ?? "").startsWith("/") ? String(body.next) : "";
  const db = admin();

  let { data: prof } = await db.from("profiles").select("id,full_name,role,active").eq("email", email).maybeSingle();
  if (!prof) {
    const { data: isAdmin } = await db.rpc("is_admin_email", { e: email });
    if (isAdmin) {
      await db.auth.admin.createUser({ email, email_confirm: true });
      ({ data: prof } = await db.from("profiles").select("id,full_name,role,active").eq("email", email).maybeSingle());
    }
  }
  if (!prof || !prof.active) return json(req, { ok: true });

  const link = await loginLink(email, next);
  const isStaff = prof.role !== "customer";
  const why = isStaff
    ? "This keeps every deal, agreement and delivery in one place, so nothing falls through the cracks and every customer gets the same great experience."
    : "Your portal keeps everything about your hot tub in one place: your agreement, your tub's details, delivery and, later, your warranty and care reminders. No digging through emails, and you can always reach me directly.";
  await sendEmail({
    from: FROM, to: email, reply_to: REPLY_TO,
    subject: "Your sign-in link for North Grenville Hot Tubs",
    html: emailShell({
      preheader: "Tap to sign in. The link works once and expires in an hour.",
      body: `<p>Hi ${firstNameOf(prof.full_name)},</p><p>Here's your link to sign in. It works once and expires in an hour.</p>
${button(link, "Sign in")}<p style="color:#6e5d4f">${why}</p>
<p style="color:#6e5d4f;font-size:14px">If you didn't ask for this, ignore this email. Nobody can sign in without this link.</p><p>Blaine</p>`,
    }),
    text: `Sign in to North Grenville Hot Tubs: ${link}\n\nThe link works once and expires in an hour. If you didn't ask for this, ignore this email.`,
  });
  return json(req, { ok: true });
}

// ---- invite-staff ----
// POST {email, full_name, phone?}  Admins only. Creates a salesperson login and emails them a welcome with a sign-in link.

async function route_invite_staff(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await caller(req);
  if (!me || me.profile.role !== "admin") return jsonAuth(req, { error: "Only Blaine or an admin can add team members." }, 403);
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const name = String(b.full_name ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !name) return jsonAuth(req, { error: "Enter a name and a valid email." }, 400);
  const id = await ensureUser(email, name, "staff");
  await admin().from("profiles").update({ role: "staff", full_name: name, phone: String(b.phone ?? "") || null, active: true }).eq("id", id);
  const link = await loginLink(email, "/staff/");
  await sendEmail({
    from: FROM, to: email, reply_to: REPLY_TO, subject: "Welcome to the North Grenville Hot Tubs team",
    html: emailShell({
      preheader: "Your staff account is ready.",
      body: `<p>Hi ${firstNameOf(name)},</p><p>You've been added to the North Grenville Hot Tubs team. Your staff portal is where you write up sales, get agreements signed and follow each tub through to delivery.</p>
${button(link, "Open the staff portal")}
<p style="color:#6e5d4f">We run every sale through the portal so every customer gets the same honest, simple experience, and so you can always see where your deals and commission stand.</p>
<p>Next time, just go to northgrenvillehottubs.ca/login and enter this email.</p><p>Blaine</p>`,
    }),
  });
  return jsonAuth(req, { ok: true, id });
}

// ---- send-for-signature ----
// POST {sale_id, rep_signature (PNG data URL), email_customer: boolean}
// The salesperson signs as company representative and locks the agreement. Returns a link for the customer to sign.

async function route_send_for_signature(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await caller(req);
  if (!me || !["admin", "staff"].includes(me.profile.role)) return jsonAuth(req, { error: "Please sign in as staff." }, 401);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  const { data: sale } = await db.from("sales").select("*, customers(*)").eq("id", String(b.sale_id ?? "")).maybeSingle();
  if (!sale) return jsonAuth(req, { error: "Sale not found." }, 404);
  if (me.profile.role !== "admin" && sale.salesperson_id !== me.user.id) return jsonAuth(req, { error: "This isn't your sale." }, 403);
  if (!["draft", "awaiting_customer"].includes(sale.status)) return jsonAuth(req, { error: "This agreement is already signed." }, 409);

  const c = sale.customers;
  const missing = [];
  if (!c?.name) missing.push("customer name");
  if (!c?.email) missing.push("customer email");
  if (!sale.tub_model && !sale.sauna_model) missing.push("a hot tub or sauna model");
  if (Number(sale.total) <= 0) missing.push("pricing");
  if (Number(sale.deposit) > Number(sale.total)) missing.push("a deposit no bigger than the total");
  if (missing.length) return jsonAuth(req, { error: `Before sending, please add ${missing.join(", ")}.` }, 400);

  let patch: Record<string, unknown> = {};
  if (sale.status === "draft") {
    const sig = dataUrlToBytes(String(b.rep_signature ?? ""));
    if (!sig) return jsonAuth(req, { error: "Please sign in the box first." }, 400);
    const path = `${sale.id}/rep-signature.png`;
    const up = await db.storage.from("agreements").upload(path, sig, { contentType: "image/png", upsert: true });
    if (up.error) return jsonAuth(req, { error: "Couldn't save the signature. Try again." }, 500);
    const { data: tv } = await db.rpc("current_terms_version");
    patch = {
      status: "awaiting_customer", rep_signature_path: path, rep_signed_at: new Date().toISOString(),
      rep_name: me.profile.full_name || me.profile.email, terms_version: tv,
    };
  }
  const token = crypto.randomUUID();
  patch = { ...patch, sign_token: token, sign_token_expires: new Date(Date.now() + 14 * 86400_000).toISOString() };
  const { error } = await db.from("sales").update(patch).eq("id", sale.id);
  if (error) return jsonAuth(req, { error: "Couldn't update the sale." }, 500);
  await logEvent(sale.id, sale.status === "draft" ? "rep_signed" : "link_resent", me.user.id);

  const signUrl = `${SITE_URL}/sign/?t=${token}`;
  if (b.email_customer) {
    const what = [sale.tub_model && `${sale.tub_make ?? ""} ${sale.tub_model} hot tub`, sale.sauna_model && `${sale.sauna_model} sauna`].filter(Boolean).join(" and ");
    await sendEmail({
      from: FROM, to: c.email, reply_to: REPLY_TO, subject: `Your North Grenville Hot Tubs agreement is ready to sign`,
      html: emailShell({
        preheader: "Review your agreement and sign online in a couple of minutes.",
        body: `<p>Hi ${escapeHtml(firstNameOf(c.name))},</p>
<p>Thank you for choosing us for your ${escapeHtml(what.trim())}. Your sales agreement is ready. Please read it over and sign online. It takes a couple of minutes on your phone or computer.</p>
${button(signUrl, "Review and sign")}
<p style="color:#6e5d4f">We do this online so you have a clear copy of everything we agreed, in writing, with nothing left to memory. As soon as you sign, you'll get a copy by email along with your pre-delivery guide and owner's manual, so you can start getting ready for your tub.</p>
<p>If anything doesn't look right, don't sign. Just reply or call me at (613) 292-1786 and we'll fix it.</p><p>Blaine</p>`,
      }),
    });
    await logEvent(sale.id, "link_emailed", me.user.id, { to: c.email });
  }
  return jsonAuth(req, { ok: true, sign_url: signUrl });
}

// ---- signing ----
// GET ?t=token  -> agreement details for the customer to review.
// POST {t, signature, typed_name, agree:true} -> customer signs; PDF is created, account made, welcome email sent.

const PUBLIC_FIELDS = ["number","status","sale_date","tub_make","tub_model","shell_colour","siding","water_care","stereo","starter_kit","steps","lifter","spa_cover","other","est_delivery","hot_tub_value","sauna_make","sauna_model","sauna_electrical","sauna_total","notes","delivery_fee","tax_rate","tax","total","deposit","balance","rep_name","rep_signed_at","terms_version"];

async function load(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const { data } = await admin().from("sales").select("*, customers(*)").eq("sign_token", token).maybeSingle();
  return data;
}

async function route_signing(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const db = admin();

  if (req.method === "GET") {
    const sale = await load(new URL(req.url).searchParams.get("t") ?? "");
    if (!sale) return json(req, { error: "This signing link isn't valid. Ask Blaine for a new one." }, 404);
    if (sale.status !== "awaiting_customer") return json(req, { error: "This agreement has already been signed.", signed: true }, 409);
    if (new Date(sale.sign_token_expires) < new Date()) return json(req, { error: "This signing link has expired. Ask Blaine for a new one." }, 410);
    const { data: terms } = await db.from("agreement_terms").select("*").eq("version", sale.terms_version).single();
    const out: Record<string, unknown> = {};
    for (const k of PUBLIC_FIELDS) out[k] = sale[k];
    const c = sale.customers;
    out.customer = { name: c.name, address: c.address, city_pc: c.city_pc, cell: c.cell, email: c.email, heard_about: c.heard_about };
    out.terms = terms;
    return json(req, out);
  }

  const b = await req.json().catch(() => ({}));
  const sale = await load(String(b.t ?? ""));
  if (!sale || sale.status !== "awaiting_customer" || new Date(sale.sign_token_expires) < new Date())
    return json(req, { error: "This signing link isn't valid any more. Ask Blaine for a new one." }, 410);
  if (b.agree !== true) return json(req, { error: "Please tick the box to confirm you agree." }, 400);
  const typed = String(b.typed_name ?? "").trim().slice(0, 120);
  if (typed.length < 2) return json(req, { error: "Please type your full name." }, 400);
  const sig = dataUrlToBytes(String(b.signature ?? ""));
  if (!sig) return json(req, { error: "Please draw your signature in the box." }, 400);

  const c = sale.customers;
  const now = new Date().toISOString();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);
  const custPath = `${sale.id}/customer-signature.png`;
  await db.storage.from("agreements").upload(custPath, sig, { contentType: "image/png", upsert: true });
  const repSig = sale.rep_signature_path
    ? new Uint8Array(await (await db.storage.from("agreements").download(sale.rep_signature_path)).data!.arrayBuffer())
    : null;
  const { data: terms } = await db.from("agreement_terms").select("*").eq("version", sale.terms_version).single();
  const signed = { ...sale, customer_signed_at: now, customer_typed_name: typed, customer_sign_ip: ip, customer_sign_ua: ua };
  const pdfBytes = await buildAgreementPdf({ sale: signed, customer: c, terms, repSig, custSig: sig });
  const pdfPath = `${sale.id}/agreement-${sale.number}.pdf`;
  await db.storage.from("agreements").upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  const hash = await sha256Hex(pdfBytes);

  // Customer account (so they can use the portal)
  const userId = await ensureUser(c.email, c.name, "customer");
  if (!c.user_id) await db.from("customers").update({ user_id: userId }).eq("id", c.id);

  await db.from("sales").update({
    status: "signed", customer_signed_at: now, customer_typed_name: typed, customer_sign_ip: ip, customer_sign_ua: ua,
    customer_signature_path: custPath, agreement_pdf_path: pdfPath, agreement_sha256: hash, sign_token: null,
  }).eq("id", sale.id);
  await logEvent(sale.id, "customer_signed", userId, { ip, sha256: hash });

  await afterSigned(sale, c, pdfBytes, "online");

  return json(req, { ok: true, number: sale.number });
}

// Everything that happens once an agreement is signed, online or on paper:
// QuickBooks deposit invoice, welcome email with the guides and portal, and a notice to the salesperson and admins.
async function afterSigned(sale: any, c: any, pdfBytes: Uint8Array, method: "online" | "paper") {
  const db = admin();
  // Deposit invoice in QuickBooks (if connected), so the welcome email can carry a Pay now button.
  let payLink: string | null = null;
  try {
    const st = await qbStatus();
    if (st.connected) {
      const r = await createDepositInvoice({ ...sale, status: "signed" }, c);
      payLink = r?.link ?? null;
      if (r) await logEvent(sale.id, "qb_invoice_created", null, { invoice: r.invoiceId });
    }
  } catch (e) {
    console.error("qb invoice", e);
    await logEvent(sale.id, "qb_invoice_failed", null, { error: String(e) });
  }

  // Welcome to the family
  const portal = await loginLink(c.email, "/portal/");
  const what = sale.tub_model ? `${sale.tub_model} hot tub` : `${sale.sauna_model} sauna`;
  try {
    await sendEmail({
      from: FROM, to: c.email, reply_to: REPLY_TO, subject: "Welcome to the North Grenville Hot Tubs family",
      html: emailShell({
        preheader: "Your signed agreement, pre-delivery guide and owner's manual are attached.",
        body: `<p>Hi ${escapeHtml(firstNameOf(c.name))},</p>
<p>Welcome to the family, and thank you for trusting us with your ${escapeHtml(what)}. ${method === "paper" ? `You have your signed paper copy, and a digital copy of agreement #${sale.number} is attached so it's always easy to find.` : `Your signed agreement (#${sale.number}) is attached for your records.`}</p>
<p style="font-family:Georgia,serif;font-size:20px;margin:26px 0 6px">What to read first</p>
<p><b>Your pre-delivery guide (attached).</b> Please read this before we book your delivery. A solid, level base, the right power from a licensed electrician and a clear path to the backyard are what make delivery day smooth, and they protect your warranty. Ten minutes now saves a rescheduled delivery later.</p>
<p><b>Your owner's manual (attached).</b> Keep it handy. It walks you through start-up, water care and the simple weekly routine that keeps your water clean and your tub lasting for years, without a cupboard full of chemicals.</p>
<p style="font-family:Georgia,serif;font-size:20px;margin:26px 0 6px">Your customer portal</p>
<p>We've set up your own portal with your tub's details and your agreement. As we go, it's where you'll schedule delivery, register your serial number for warranty, and send me questions directly.</p>
${button(portal, "Open my portal")}
<p style="color:#6e5d4f;font-size:14px">That button signs you in once. Next time, go to northgrenvillehottubs.ca/login and enter this email.</p>
<p style="font-family:Georgia,serif;font-size:20px;margin:26px 0 6px">Your deposit</p>
${payLink
  ? `<p>Your deposit is ${money(sale.deposit)}. Paying it confirms your order with Platinum Spas so your tub can be built and shipped to us. You can pay securely online by card or bank transfer through QuickBooks:</p>${button(payLink, "Pay my deposit")}<p style="color:#6e5d4f;font-size:14px">Your remaining balance of ${money(sale.balance)} is due before delivery.</p>`
  : `<p>Your deposit is ${money(sale.deposit)} and your remaining balance is ${money(sale.balance)}, due before delivery. Paying the deposit confirms your order with Platinum Spas so your tub can be built and shipped to us. I'll be in touch about payment.</p>`}
<p style="color:#6e5d4f">We're a small family business, and we don't think of this as a one-time sale. You'll see us for filters, advice and service for years, so our job is to make sure you love this tub. Call or text me any time at (613) 292-1786.</p>
<p>Blaine</p>`,
      }),
      attachments: [
        { filename: `North Grenville Sales Agreement #${sale.number}.pdf`, content: toBase64(pdfBytes) },
        { filename: "North Grenville Pre-Delivery Guide.pdf", path: `${SITE_URL}/assets/docs/north-grenville-pre-delivery-guide.pdf` },
        { filename: "North Grenville Owner's Manual.pdf", path: `${SITE_URL}/assets/docs/north-grenville-owners-manual.pdf` },
      ],
    });
    await logEvent(sale.id, "welcome_sent", null, { to: c.email });
  } catch (e) {
    console.error("welcome email failed", e);
    await logEvent(sale.id, "welcome_failed", null, { error: String(e) });
  }

  // Let the salesperson and admins know
  try {
    const { data: rep } = await db.from("profiles").select("email").eq("id", sale.salesperson_id).single();
    const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").eq("active", true);
    const to = [...new Set([rep?.email, ...(admins ?? []).map((a) => a.email)].filter(Boolean))] as string[];
    if (to.length) await sendEmail({
      from: FROM, to, subject: `Signed: agreement #${sale.number}, ${c.name}`,
      html: emailShell({ preheader: `${c.name} signed agreement #${sale.number}.`, body:
        `<p>${escapeHtml(c.name)} ${method === "paper" ? "signed on paper:" : "just signed"} agreement #${sale.number} for the ${escapeHtml(what)}. Total ${money(sale.total)}, deposit ${money(sale.deposit)}.</p>
<p>They've been sent their signed copy, pre-delivery guide, owner's manual and a link to their portal.</p>${button(`${SITE_URL}/staff/#sale-${sale.id}`, "Open in staff portal")}` }),
      attachments: [{ filename: `Agreement #${sale.number}.pdf`, content: toBase64(pdfBytes) }],
    });
  } catch (e) { console.error("staff notice failed", e); }

}

// What a sale still needs before it can be signed (online or on paper).
function missingForSigning(sale: any) {
  const c = sale.customers, missing: string[] = [];
  if (!c?.name) missing.push("customer name");
  if (!c?.email) missing.push("customer email");
  if (!sale.tub_model && !sale.sauna_model) missing.push("a hot tub or sauna model");
  if (Number(sale.total) <= 0) missing.push("pricing");
  if (Number(sale.deposit) > Number(sale.total)) missing.push("a deposit no bigger than the total");
  return missing;
}

async function staffSale(req: Request, saleId: string) {
  const me = await caller(req);
  if (!me || !["admin", "staff"].includes(me.profile.role)) return { err: jsonAuth(req, { error: "Please sign in as staff." }, 401) };
  const { data: sale } = await admin().from("sales").select("*, customers(*)").eq("id", saleId).maybeSingle();
  if (!sale) return { err: jsonAuth(req, { error: "Sale not found." }, 404) };
  if (me.profile.role !== "admin" && sale.salesperson_id !== me.user.id) return { err: jsonAuth(req, { error: "This isn't your sale." }, 403) };
  return { me, sale };
}

// ---- agreement-print ----
// POST {sale_id}  Staff. Signed sale: returns the signed copy. Unsigned sale: returns a printable copy with blank
// signature and date lines, for signing in person on paper. Response: {pdf: base64}.
async function route_agreement_print(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const b = await req.json().catch(() => ({}));
  const r = await staffSale(req, String(b.sale_id ?? ""));
  if (r.err) return r.err;
  const { me, sale } = r;
  const db = admin();
  if (sale.agreement_pdf_path) {
    const f = await db.storage.from("agreements").download(sale.agreement_pdf_path);
    if (f.error || !f.data) return jsonAuth(req, { error: "Couldn't load the signed agreement." }, 500);
    return jsonAuth(req, { pdf: toBase64(new Uint8Array(await f.data.arrayBuffer())), signed: true });
  }
  const missing = missingForSigning(sale);
  if (missing.length) return jsonAuth(req, { error: `Before printing, please add ${missing.join(", ")}.` }, 400);
  const { data: tv } = await db.rpc("current_terms_version");
  const version = sale.terms_version ?? tv;
  const { data: terms } = await db.from("agreement_terms").select("*").eq("version", version).single();
  const repName = sale.rep_name ?? (me!.profile.full_name || me!.profile.email);
  const pdfBytes = await buildAgreementPdf({ sale: { ...sale, rep_name: repName, terms_version: version }, customer: sale.customers, terms, mode: "paper-blank" });
  await logEvent(sale.id, "printed_for_paper", me!.user.id);
  return jsonAuth(req, { pdf: toBase64(pdfBytes), signed: false });
}

// ---- paper-signed ----
// POST {sale_id, photos?: [dataUrl jpeg/png]}  Staff. Records that the agreement was signed in person on paper,
// stores a record PDF (with photos of the signed pages), then runs the same welcome steps as an online signing.
async function route_paper_signed(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const b = await req.json().catch(() => ({}));
  const r = await staffSale(req, String(b.sale_id ?? ""));
  if (r.err) return r.err;
  const { me, sale } = r;
  if (!["draft", "awaiting_customer"].includes(sale.status)) return jsonAuth(req, { error: "This agreement is already signed." }, 409);
  const missing = missingForSigning(sale);
  if (missing.length) return jsonAuth(req, { error: `Before marking it signed, please add ${missing.join(", ")}.` }, 400);
  if (b.confirm !== true) return jsonAuth(req, { error: "Please confirm both of you signed the paper copies." }, 400);

  const db = admin();
  const photos: { bytes: Uint8Array; type: string }[] = [];
  const rawPhotos = Array.isArray(b.photos) ? b.photos.slice(0, 6) : [];
  for (const d of rawPhotos) {
    const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(d));
    if (!m) return jsonAuth(req, { error: "Photos must be JPG or PNG images." }, 400);
    const bin = atob(m[2]);
    if (bin.length > 4_000_000) return jsonAuth(req, { error: "One of the photos is too large. Try again." }, 400);
    photos.push({ bytes: Uint8Array.from(bin, (ch) => ch.charCodeAt(0)), type: m[1] });
  }
  const photoPaths: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const path = `${sale.id}/paper-page-${i + 1}.${photos[i].type === "image/png" ? "png" : "jpg"}`;
    await db.storage.from("agreements").upload(path, photos[i].bytes, { contentType: photos[i].type, upsert: true });
    photoPaths.push(path);
  }

  const now = new Date().toISOString();
  const c = sale.customers;
  const { data: tv } = await db.rpc("current_terms_version");
  const version = sale.terms_version ?? tv;
  const { data: terms } = await db.from("agreement_terms").select("*").eq("version", version).single();
  const repName = sale.rep_name ?? (me!.profile.full_name || me!.profile.email);
  const signed = { ...sale, rep_name: repName, rep_signed_at: sale.rep_signed_at ?? now, customer_signed_at: now, customer_typed_name: c.name, terms_version: version };
  const pdfBytes = await buildAgreementPdf({ sale: signed, customer: c, terms, mode: "paper-signed", photos });
  const pdfPath = `${sale.id}/agreement-${sale.number}.pdf`;
  await db.storage.from("agreements").upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  const hash = await sha256Hex(pdfBytes);

  const userId = await ensureUser(c.email, c.name, "customer");
  if (!c.user_id) await db.from("customers").update({ user_id: userId }).eq("id", c.id);

  const { error } = await db.from("sales").update({
    status: "signed", signing_method: "paper", rep_name: repName, rep_signed_at: signed.rep_signed_at, terms_version: version,
    customer_signed_at: now, customer_typed_name: c.name, agreement_pdf_path: pdfPath, agreement_sha256: hash,
    paper_photo_paths: photoPaths, sign_token: null,
  }).eq("id", sale.id);
  if (error) return jsonAuth(req, { error: "Couldn't update the sale." }, 500);
  await logEvent(sale.id, "paper_signed", me!.user.id, { photos: photoPaths.length, sha256: hash });

  await afterSigned({ ...signed, status: "signed" }, c, pdfBytes, "paper");
  return jsonAuth(req, { ok: true, number: sale.number });
}

// ---- agreement-pdf ----
// POST {sale_id}  Returns a short-lived download link for the signed agreement, if the caller is allowed to see that sale.

async function route_agreement_pdf(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await caller(req);
  if (!me) return jsonAuth(req, { error: "Please sign in." }, 401);
  const b = await req.json().catch(() => ({}));
  // Uses the caller's own permissions: if they can't see the sale, this returns nothing.
  const { data: sale } = await me.userDb.from("sales").select("id, agreement_pdf_path").eq("id", String(b.sale_id ?? "")).maybeSingle();
  if (!sale?.agreement_pdf_path) return jsonAuth(req, { error: "No signed agreement yet." }, 404);
  const { data } = await admin().storage.from("agreements").createSignedUrl(sale.agreement_pdf_path, 300, { download: true });
  return jsonAuth(req, { url: data?.signedUrl });
}


// ---- QuickBooks (admins) ----
async function adminOnly(req: Request) {
  const me = await caller(req);
  return me && me.profile.role === "admin" ? me : null;
}

async function route_qb_status(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await adminOnly(req);
  if (!me) return jsonAuth(req, { error: "Admins only." }, 403);
  if (!qbConfigured()) return jsonAuth(req, { configured: false, connected: false });
  const st = await qbStatus();
  const db = admin();
  const item = (await db.rpc("setting_get", { k: "qb_deposit_item_id" })).data;
  const tax = (await db.rpc("setting_get", { k: "qb_deposit_tax_code_id" })).data;
  let lists = null, listError = null;
  if (st.connected) { try { lists = await qbLists(); } catch (e) { listError = String((e as Error).message); } }
  return jsonAuth(req, { configured: true, ...st, item_id: item, tax_code_id: tax, lists, list_error: listError });
}

async function route_qb_connect(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await adminOnly(req);
  if (!me) return jsonAuth(req, { error: "Admins only." }, 403);
  if (!qbConfigured()) return jsonAuth(req, { error: "Add QB_CLIENT_ID and QB_CLIENT_SECRET in Supabase first." }, 400);
  const { data: state } = await admin().rpc("qb_state_new", { uid: me.user.id });
  return jsonAuth(req, { url: qbAuthUrl(state) });
}

async function route_qb_callback(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const back = (s: string) => new Response(null, { status: 302, headers: { Location: `${SITE_URL}/staff/?qb=${s}#team` } });
  if (q.get("error")) return back("cancelled");
  const { data: uid } = await admin().rpc("qb_state_take", { s: q.get("state") ?? "" });
  if (!uid || !q.get("code") || !q.get("realmId")) return back("failed");
  try { await qbExchange(q.get("code")!, q.get("realmId")!, uid); return back("connected"); }
  catch (e) { console.error(e); return back("failed"); }
}

async function route_qb_settings(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await adminOnly(req);
  if (!me) return jsonAuth(req, { error: "Admins only." }, 403);
  const b = await req.json().catch(() => ({}));
  const db = admin();
  if (b.disconnect) { await qbDisconnect(); return jsonAuth(req, { ok: true }); }
  if (b.item_id !== undefined) await db.rpc("setting_put", { k: "qb_deposit_item_id", v: String(b.item_id ?? "") });
  if (b.tax_code_id !== undefined) await db.rpc("setting_put", { k: "qb_deposit_tax_code_id", v: String(b.tax_code_id ?? "") });
  return jsonAuth(req, { ok: true });
}

// Staff: create (or re-create) the deposit invoice for a signed sale and email the pay link.
async function route_qb_invoice(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsAuth(req) });
  const me = await caller(req);
  if (!me || !["admin", "staff"].includes(me.profile.role)) return jsonAuth(req, { error: "Please sign in as staff." }, 401);
  const b = await req.json().catch(() => ({}));
  const { data: visible } = await me.userDb.from("sales").select("id").eq("id", String(b.sale_id ?? "")).maybeSingle();
  if (!visible) return jsonAuth(req, { error: "Sale not found." }, 404);
  const db = admin();
  const { data: sale } = await db.from("sales").select("*, customers(*)").eq("id", visible.id).single();
  if (sale.status !== "signed") return jsonAuth(req, { error: "A deposit invoice is only created after the customer signs." }, 409);
  let r = sale.qb_deposit_invoice_id ? { invoiceId: sale.qb_deposit_invoice_id, link: sale.qb_invoice_link } : null;
  if (!r) r = await createDepositInvoice(sale, sale.customers);
  if (!r) return jsonAuth(req, { error: "This sale has no deposit." }, 400);
  await logEvent(sale.id, "qb_invoice_created", me.user.id, { invoice: r.invoiceId });
  if (b.email_customer && r.link) {
    const c = sale.customers;
    await sendEmail({
      from: FROM, to: c.email, reply_to: REPLY_TO, subject: `Your deposit for agreement #${sale.number}`,
      html: emailShell({ preheader: "Pay your deposit securely online.", body:
        `<p>Hi ${escapeHtml(firstNameOf(c.name))},</p><p>Here's the link to pay your ${money(sale.deposit)} deposit. Paying it confirms your order with Platinum Spas so your tub can be built and shipped to us.</p>
${button(r.link, "Pay my deposit")}<p style="color:#6e5d4f">You can pay by card or bank transfer through QuickBooks. Your remaining balance of ${money(sale.balance)} is due before delivery. Questions? Call or text me at (613) 292-1786.</p><p>Blaine</p>` }),
    });
    await logEvent(sale.id, "pay_link_emailed", me.user.id, { to: c.email });
  }
  return jsonAuth(req, { ok: true, link: r.link });
}

// Scheduled: checks open deposit invoices and marks paid ones.
async function route_qb_sync(req: Request): Promise<Response> {
  const db = admin();
  const { data: ok } = await db.rpc("check_cron_secret", { s: req.headers.get("x-cron-secret") ?? "" });
  if (ok !== true) return new Response("Forbidden", { status: 403 });
  const st = await qbStatus();
  if (!st.connected) return new Response(JSON.stringify({ skipped: "not connected" }));
  const { data: open } = await db.from("sales").select("*, customers(*)").eq("status", "signed").not("qb_deposit_invoice_id", "is", null).limit(100);
  const paid = [];
  for (const sale of open ?? []) {
    try {
      const { balance } = await invoiceBalance(sale.qb_deposit_invoice_id);
      if (balance > 0) continue;
      const now = new Date().toISOString();
      await db.from("sales").update({ status: "deposit_paid", deposit_paid_at: now }).eq("id", sale.id).eq("status", "signed");
      await logEvent(sale.id, "deposit_paid", null, { invoice: sale.qb_deposit_invoice_id });
      paid.push(sale.number);
      const c = sale.customers;
      const what = sale.tub_model ? `${sale.tub_model} hot tub` : `${sale.sauna_model} sauna`;
      const portal = await loginLink(c.email, "/portal/");
      await sendEmail({
        from: FROM, to: c.email, reply_to: REPLY_TO, subject: "Deposit received. Your tub is on order.",
        html: emailShell({ preheader: "Thank you. Here's what happens next.", body:
          `<p>Hi ${escapeHtml(firstNameOf(c.name))},</p><p>Thank you, we've received your ${money(sale.deposit)} deposit. Your ${escapeHtml(what)} is now on order with Platinum Spas.</p>
<p style="font-family:Georgia,serif;font-size:20px;margin:24px 0 6px">What to do while you wait</p>
<p>This is the perfect time to get your spot ready using your pre-delivery guide: a solid, level base, power run by a licensed electrician, and a clear path to the backyard. Having these done before the tub arrives is what makes delivery day quick and stress-free, and it protects your warranty.</p>
${button(portal, "Open my portal")}
<p style="color:#6e5d4f">I'll be in touch to book your delivery as your tub gets closer. Your remaining balance of ${money(sale.balance)} is due before delivery. Questions any time? Call or text me at (613) 292-1786.</p><p>Blaine</p>` }),
      });
      const { data: rep } = await db.from("profiles").select("email").eq("id", sale.salesperson_id).single();
      const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").eq("active", true);
      const to = [...new Set([rep?.email, ...(admins ?? []).map((a) => a.email)].filter(Boolean))] as string[];
      if (to.length) await sendEmail({ from: FROM, to, subject: `Deposit paid: agreement #${sale.number}, ${c.name}`,
        html: emailShell({ preheader: "Deposit received in QuickBooks.", body: `<p>${escapeHtml(c.name)} paid the ${money(sale.deposit)} deposit on agreement #${sale.number}. Time to place the order with Platinum Spas.</p>${button(`${SITE_URL}/staff/#sale-${sale.id}`, "Open in staff portal")}` }) });
    } catch (e) { console.error("sync", sale.number, e); }
  }
  return new Response(JSON.stringify({ checked: (open ?? []).length, paid }), { headers: { "Content-Type": "application/json" } });
}

const ROUTES: Record<string, (req: Request) => Promise<Response>> = {
  "login-link": route_login_link, "invite-staff": route_invite_staff, "send-for-signature": route_send_for_signature,
  "signing": route_signing, "agreement-pdf": route_agreement_pdf,
  "agreement-print": route_agreement_print, "paper-signed": route_paper_signed,
  "qb-status": route_qb_status, "qb-connect": route_qb_connect, "qb-callback": route_qb_callback,
  "qb-settings": route_qb_settings, "qb-invoice": route_qb_invoice, "qb-sync": route_qb_sync,
};
Deno.serve(async (req) => {
  const name = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const fn = ROUTES[name];
  if (!fn) return new Response("Not found", { status: 404, headers: corsAuth(req) });
  try { return await fn(req); }
  catch (e) { console.error(name, e); return jsonAuth(req, { error: "Something went wrong on our end. Please try again." }, 500); }
});
