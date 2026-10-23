// QuickBooks Online: connection, customers and deposit invoices.
import { admin, payTerms } from "./common.ts";

const ENV = Deno.env.get("QB_ENV") === "sandbox" ? "sandbox" : "production";
const API = ENV === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QB_REDIRECT = `${Deno.env.get("SUPABASE_URL")}/functions/v1/portal/qb-callback`;
const MINOR = "minorversion=75";

export const qbConfigured = () => !!(Deno.env.get("QB_CLIENT_ID") && Deno.env.get("QB_CLIENT_SECRET"));
const basic = () => "Basic " + btoa(`${Deno.env.get("QB_CLIENT_ID")}:${Deno.env.get("QB_CLIENT_SECRET")}`);

export function qbAuthUrl(state: string) {
  const q = new URLSearchParams({
    client_id: Deno.env.get("QB_CLIENT_ID")!, response_type: "code", scope: "com.intuit.quickbooks.accounting",
    redirect_uri: QB_REDIRECT, state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const tid = r.headers.get("intuit_tid") ?? "";
    console.error("qb token error", r.status, d.error, `intuit_tid=${tid}`);
    // A dead refresh token can't be fixed by retrying: clear the connection so the Team tab asks Blaine to reconnect.
    if (body.grant_type === "refresh_token" && (d.error === "invalid_grant" || r.status === 400 || r.status === 401)) {
      await admin().rpc("qb_clear");
      throw new Error("The QuickBooks connection has expired. An admin needs to reconnect it in the staff portal (Team tab).");
    }
    throw new Error(`QuickBooks sign-in failed: ${d.error_description || d.error || r.status}${tid ? ` (intuit_tid ${tid})` : ""}`);
  }
  return d as { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in: number };
}
const expiresAt = (s: number) => new Date(Date.now() + (s - 60) * 1000).toISOString();

export async function qbExchange(code: string, realmId: string, userId: string | null) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: QB_REDIRECT });
  await admin().rpc("qb_put", { p: {
    realm_id: realmId, access_token: t.access_token, refresh_token: t.refresh_token,
    access_expires: expiresAt(t.expires_in), refresh_expires: expiresAt(t.x_refresh_token_expires_in), connected_by: userId,
  } });
  try {
    const info = await qbGet(`/companyinfo/${realmId}`);
    await admin().rpc("qb_put", { p: { realm_id: realmId, company_name: info.CompanyInfo?.CompanyName,
      access_token: t.access_token, refresh_token: t.refresh_token, access_expires: expiresAt(t.expires_in) } });
  } catch (e) { console.error("company info", e); }
}

async function conn(forceRefresh = false) {
  const { data } = await admin().rpc("qb_get");
  if (!data) throw new Error("QuickBooks isn't connected yet.");
  if (!forceRefresh && new Date(data.access_expires) > new Date()) return data;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  const next = { ...data, access_token: t.access_token, refresh_token: t.refresh_token,
    access_expires: expiresAt(t.expires_in), refresh_expires: expiresAt(t.x_refresh_token_expires_in) };
  await admin().rpc("qb_put", { p: next });
  return next;
}

async function qb(method: string, path: string, body?: unknown) {
  const sep = path.includes("?") ? "&" : "?";
  const send = (c: any) => fetch(`${API}/v3/company/${c.realm_id}${path}${sep}${MINOR}`, {
    method, headers: { Authorization: `Bearer ${c.access_token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let r = await send(await conn());
  // Access token rejected early (revoked or clock drift): refresh once and retry.
  if (r.status === 401) r = await send(await conn(true));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const f = d?.Fault?.Error?.[0];
    const tid = r.headers.get("intuit_tid") ?? "";
    console.error("qb api error", method, path, r.status, JSON.stringify(d?.Fault ?? d).slice(0, 800), `intuit_tid=${tid}`);
    throw new Error(`QuickBooks: ${f ? `${f.Message} ${f.Detail ?? ""}` : r.status}${tid ? ` (intuit_tid ${tid})` : ""}`);
  }
  return d;
}
export const qbGet = (path: string) => qb("GET", path);
export const qbQuery = (sql: string) => qbGet(`/query?query=${encodeURIComponent(sql)}`).then((d) => d.QueryResponse ?? {});
const qstr = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// Disconnect: revoke the tokens at Intuit, then forget them here.
export async function qbDisconnect() {
  const { data } = await admin().rpc("qb_get");
  if (data?.refresh_token) {
    try {
      await fetch("https://developer.api.intuit.com/v2/oauth2/tokens/revoke", {
        method: "POST",
        headers: { Authorization: basic(), "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token: data.refresh_token }),
      });
    } catch (e) { console.error("qb revoke", e); }
  }
  await admin().rpc("qb_clear");
}

export async function qbStatus() {
  const { data } = await admin().rpc("qb_get");
  return data ? { connected: true, company: data.company_name, realm: data.realm_id } : { connected: false };
}

// Items (products/services) and tax codes, for the settings screen.
export async function qbLists() {
  const items = (await qbQuery("select Id, Name, Type, Active from Item where Active = true maxresults 200")).Item ?? [];
  const taxes = (await qbQuery("select Id, Name, Active from TaxCode where Active = true maxresults 100")).TaxCode ?? [];
  return {
    items: items.filter((i: any) => i.Type !== "Category").map((i: any) => ({ id: i.Id, name: i.Name, type: i.Type })),
    taxCodes: taxes.map((t: any) => ({ id: t.Id, name: t.Name })),
  };
}

async function findOrCreateCustomer(c: any) {
  const display = `${c.name} (${c.email})`.slice(0, 100);
  const found = (await qbQuery(`select Id from Customer where DisplayName = '${qstr(display)}'`)).Customer?.[0];
  if (found) return found.Id as string;
  const [given, ...rest] = String(c.name).trim().split(/\s+/);
  const body: any = {
    DisplayName: display, GivenName: given?.slice(0, 100), FamilyName: rest.join(" ").slice(0, 100) || undefined,
    PrimaryEmailAddr: { Address: c.email }, Notes: "Created by northgrenvillehottubs.ca",
  };
  if (c.cell) body.PrimaryPhone = { FreeFormNumber: c.cell };
  if (c.address) body.BillAddr = { Line1: c.address, City: c.city_pc ?? undefined, CountrySubDivisionCode: "ON", Country: "Canada" };
  return (await qb("POST", "/customer", body)).Customer.Id as string;
}

// Creates the deposit invoice for a signed sale, lets the customer pay online, and returns its pay link.
export async function createDepositInvoice(sale: any, customer: any) {
  if (Number(sale.deposit) <= 0) return null;
  const db = admin();
  const { data: itemId } = await db.rpc("setting_get", { k: "qb_deposit_item_id" });
  const { data: taxId } = await db.rpc("setting_get", { k: "qb_deposit_tax_code_id" });
  if (!itemId) throw new Error("Choose the QuickBooks item for deposits in the staff portal (Team tab) first.");
  const custId = sale.qb_customer_id || await findOrCreateCustomer(customer);
  const what = sale.tub_model ? `${sale.tub_make ?? ""} ${sale.tub_model} hot tub`.trim() : `${sale.sauna_model} sauna`;
  const p = payTerms(sale);
  const line: any = {
    DetailType: "SalesItemLineDetail", Amount: Number(sale.deposit),
    Description: p.full
      ? `Payment in full for ${what}, sales agreement #${sale.number}.`
      : `Deposit for ${what}, sales agreement #${sale.number}. Non-refundable per agreement. Remaining balance due before delivery.`,
    SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: Number(sale.deposit), ...(taxId ? { TaxCodeRef: { value: taxId } } : {}) },
  };
  // Only the payment methods Blaine agreed with the customer are offered on the pay page.
  const card = sale.pay_methods !== "bank", bank = sale.pay_methods !== "card";
  const inv = (await qb("POST", "/invoice", {
    CustomerRef: { value: custId }, Line: [line], DocNumber: `NG${sale.number}-${p.full ? "F" : "D"}`,
    BillEmail: { Address: customer.email }, AllowOnlineCreditCardPayment: card, AllowOnlineACHPayment: bank,
    CustomerMemo: { value: p.full
      ? `Thank you for choosing North Grenville Hot Tubs. This payment completes your order for your ${what}. Questions? Call or text Blaine at (613) 292-1786.`
      : `Thank you for choosing North Grenville Hot Tubs. This deposit confirms your order for your ${what}. Questions? Call or text Blaine at (613) 292-1786.` },
    PrivateNote: `Website sale #${sale.number} (${p.full ? "paid in full" : "deposit"}, ${sale.pay_methods ?? "both"})`,
  })).Invoice;
  let link: string | null = null;
  try { link = (await qbGet(`/invoice/${inv.Id}?include=invoiceLink`)).Invoice?.InvoiceLink ?? null; } catch (e) { console.error("invoice link", e); }
  await db.from("sales").update({ qb_customer_id: custId, qb_deposit_invoice_id: inv.Id, qb_invoice_link: link }).eq("id", sale.id);
  return { invoiceId: inv.Id as string, link };
}

export async function invoiceBalance(id: string) {
  const inv = (await qbGet(`/invoice/${id}`)).Invoice;
  return { balance: Number(inv.Balance), total: Number(inv.TotalAmt) };
}
