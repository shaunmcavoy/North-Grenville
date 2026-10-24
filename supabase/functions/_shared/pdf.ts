// Builds the signed sales agreement PDF, laid out like the paper form, with a signing record at the end.
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import { money, payTerms, SITE_URL, balanceHow } from "./common.ts";

// Standard PDF fonts only cover basic Latin characters, so tidy up anything fancier.
const clean = (s: unknown) =>
  String(s ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/…/g, "...").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");

type Any = Record<string, any>;

// mode "online": e-signed copy with an electronic signing record.
// mode "paper-blank": printable copy with empty signature and date lines, for signing in person on paper.
// mode "paper-signed": the record kept after a paper signing, with photos of the signed pages appended.
export async function buildAgreementPdf(opts: {
  sale: Any; customer: Any; terms: Any; repSig?: Uint8Array | null; custSig?: Uint8Array | null;
  mode?: "online" | "paper-blank" | "paper-signed"; photos?: { bytes: Uint8Array; type: string }[];
}) {
  const { sale, customer, terms } = opts;
  const mode = opts.mode ?? "online";
  const pdf = await PDFDocument.create();
  pdf.setTitle(`North Grenville Hot Tubs Sales Agreement #${sale.number}`);
  pdf.setAuthor("North Grenville Hot Tubs & Saunas");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.16, 0.125, 0.1), muted = rgb(0.43, 0.36, 0.31), line = rgb(0.8, 0.75, 0.68), dark = rgb(0.11, 0.086, 0.067);

  let page = pdf.addPage([612, 792]);
  const W = 612, M = 44;
  let y = 792 - M;

  try {
    const logoBytes = new Uint8Array(await (await fetch(`${SITE_URL}/assets/img/logo.png`)).arrayBuffer());
    const logo = await pdf.embedPng(logoBytes);
    page.drawImage(logo, { x: M, y: y - 64, width: 64, height: 64 });
  } catch { /* logo optional */ }
  page.drawRectangle({ x: 150, y: y - 44, width: 230, height: 30, color: dark });
  page.drawText("SALES AGREEMENT", { x: 170, y: y - 35, size: 16, font: bold, color: rgb(1, 1, 1) });
  const addr = ["5333 County Road 19", "Kemptville, ON K0G 1J0", "Phone: (613) 292-1786"];
  addr.forEach((t, i) => page.drawText(t, { x: W - M - bold.widthOfTextAtSize(t, 9), y: y - 18 - i * 12, size: 9, font: bold, color: ink }));
  page.drawText(`Agreement #${sale.number}`, { x: 150, y: y - 60, size: 10, font, color: muted });
  y -= 84;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ink });
  y -= 18;

  const field = (label: string, value: unknown, x: number, w: number) => {
    page.drawText(label, { x, y, size: 8, font, color: muted });
    const v = clean(value) || "-";
    let size = 10;
    while (size > 6.5 && font.widthOfTextAtSize(v, size) > w - 4) size -= 0.5;
    page.drawText(v, { x, y: y - 13, size, font, color: ink, maxWidth: w - 4 });
    page.drawLine({ start: { x, y: y - 17 }, end: { x: x + w - 10, y: y - 17 }, thickness: 0.5, color: line });
  };
  const row = (cols: [string, unknown, number][]) => {
    let x = M; const total = W - 2 * M;
    cols.forEach(([l, v, frac]) => { field(l, v, x, total * frac); x += total * frac; });
    y -= 32;
  };
  const section = (t: string) => {
    page.drawRectangle({ x: M, y: y - 4, width: bold.widthOfTextAtSize(t, 10) + 14, height: 17, color: dark });
    page.drawText(t, { x: M + 7, y: y + 1, size: 10, font: bold, color: rgb(1, 1, 1) });
    y -= 26;
  };

  row([["Name", customer.name, 0.6], ["Date", sale.sale_date, 0.4]]);
  row([["Address", customer.address, 0.6], ["Sales person", sale.rep_name, 0.4]]);
  row([["City / Postal code", customer.city_pc, 0.6], ["Cell", customer.cell, 0.4]]);
  row([["Email", customer.email, 0.6], ["How did you hear about us?", customer.heard_about, 0.4]]);

  const kind = sale.product_type ?? "hot_tub";
  if (kind !== "sauna") {
    const title = { hot_tub: "HOT TUB", swim_spa: "SWIM SPA", mini_pool: "MINI POOL" }[kind as string] ?? "HOT TUB";
    const valueLabel = { hot_tub: "Hot tub value", swim_spa: "Swim spa value", mini_pool: "Mini pool value" }[kind as string] ?? "Hot tub value";
    section(title);
    row([["Make", sale.tub_make, 0.34], ["Model", sale.tub_model, 0.33], ["Estimated delivery time", sale.est_delivery, 0.33]]);
    row([["Shell colour", sale.shell_colour, 0.34], ["Siding", sale.siding, 0.33], ["Water care", sale.water_care, 0.33]]);
    row([["Stereo", sale.stereo, 0.34], ["Starter kit", sale.starter_kit, 0.33], ["Steps", sale.steps, 0.33]]);
    row([["Lifter", sale.lifter, 0.34], ["Cover", sale.spa_cover, 0.33], ["Other", sale.other, 0.33]]);
    if (["hot_tub", "swim_spa"].includes(kind) && sale.tub_model && (!sale.water_care || /o.?care/i.test(String(sale.water_care)))) {
      // Where to register O-Care, so it's on the customer's paper copy too.
      const total = W - 2 * M, x = M + total * 0.34;
      field(valueLabel, money(sale.hot_tub_value), M, total * 0.34);
      page.drawText("Register your O-Care for free delivery to your door:", { x, y, size: 8, font, color: muted });
      page.drawText("l.ead.me/bgkT4n  (choose Blaine McAvoy as your advisor)", { x, y: y - 13, size: 9.5, font: bold, color: ink });
      y -= 32;
    } else {
      row([[valueLabel, money(sale.hot_tub_value), 0.34], ["", "", 0.66]]);
    }
  }

  if (kind === "sauna" || sale.sauna_model || Number(sale.sauna_total) > 0) {
    section(kind === "sauna" ? "SAUNA" : "SAUNA (ADDED)");
    row([["Make", sale.sauna_make, 0.3], ["Model", sale.sauna_model, 0.3], ["Electrical", sale.sauna_electrical, 0.2], ["Price", money(sale.sauna_total), 0.2]]);
    if (kind === "sauna") row([["Estimated delivery time", sale.est_delivery, 0.5], ["Other", sale.other, 0.5]]);
  }

  // Notes + money column
  const notesTop = y;
  page.drawText("Notes (if in-stock unit, note SKU)", { x: M, y, size: 8, font, color: muted });
  page.drawRectangle({ x: M, y: y - 112, width: 330, height: 104, borderColor: line, borderWidth: 0.75 });
  const notes = clean(sale.notes);
  let ny = y - 20;
  for (const ln of wrap(notes, font, 9, 318).slice(0, 9)) { page.drawText(ln, { x: M + 6, y: ny, size: 9, font, color: ink }); ny -= 11; }
  const mx = W - M - 170;
  const sums: [string, string, boolean][] = [
    ["Total", money(Number(sale.hot_tub_value) + Number(sale.sauna_total)), false],
    ["Delivery", money(sale.delivery_fee), false],
    ["Subtotal", money(Number(sale.hot_tub_value) + Number(sale.sauna_total) + Number(sale.delivery_fee)), false],
    [`Tax (HST ${(Number(sale.tax_rate) * 100).toFixed(0)}%)`, money(sale.tax), false],
    ["Total", money(sale.total), true],
    [payTerms(sale).full ? "Paid in full" : "Deposit", money(sale.deposit), false],
    ["Balance", money(sale.balance), true],
  ];
  const payNote = payTerms(sale).full || Number(sale.balance) <= 0
    ? `Payment ${payTerms(sale).how}`
    : `Deposit ${payTerms(sale).how}. Balance ${balanceHow(sale)}.`;
  let sy = notesTop;
  for (const [l, v, b] of sums) {
    page.drawText(l.toUpperCase(), { x: mx, y: sy - 2, size: 8, font: bold, color: ink });
    const f = b ? bold : font;
    page.drawText(v, { x: W - M - f.widthOfTextAtSize(v, 10), y: sy - 2, size: 10, font: f, color: ink });
    page.drawLine({ start: { x: mx, y: sy - 7 }, end: { x: W - M, y: sy - 7 }, thickness: 0.5, color: line });
    sy -= 17;
  }
  page.drawText(payNote, { x: mx, y: sy - 2, size: 8, font, color: muted });
  sy -= 14;
  y = Math.min(y - 124, sy - 8);

  // Terms flow onto extra pages when they're long.
  const newPage = () => {
    page = pdf.addPage([612, 792]); y = 792 - M;
    page.drawText(`Sales agreement #${sale.number} (continued)`, { x: M, y, size: 9, font: bold, color: muted }); y -= 20;
  };
  for (const t of [terms.delivery_terms, terms.purchase_terms]) {
    for (const ln of wrap(clean(t), font, 8, W - 2 * M)) {
      if (y < M + 10) newPage();
      page.drawText(ln, { x: M, y, size: 8, font, color: ink }); y -= 10.5;
    }
    y -= 6;
  }
  y -= 6;
  // Keep the signature block together on one page.
  if (y < M + (mode === "online" ? 90 : 130)) newPage();

  const sigBox = async (label: string, img: Uint8Array | null | undefined, name: string, when: string, x: number) => {
    if (img) {
      try {
        const png = await pdf.embedPng(img);
        const s = Math.min(200 / png.width, 50 / png.height);
        page.drawImage(png, { x, y: y - 52, width: png.width * s, height: png.height * s });
      } catch { /* ignore */ }
    }
    page.drawLine({ start: { x, y: y - 56 }, end: { x: x + 230, y: y - 56 }, thickness: 0.75, color: ink });
    page.drawText(label, { x, y: y - 67, size: 8, font, color: muted });
    if (mode === "online") {
      page.drawText(clean(`${name}  ${when}`), { x, y: y - 78, size: 8, font, color: ink });
    } else {
      page.drawText(clean(`Name: ${name}`), { x, y: y - 80, size: 9, font, color: ink });
      page.drawText("Date:", { x, y: y - 98, size: 9, font, color: ink });
      page.drawLine({ start: { x: x + 28, y: y - 100 }, end: { x: x + 150, y: y - 100 }, thickness: 0.5, color: ink });
    }
  };
  const fmt = (d?: string) => d ? new Date(d).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }) : "";
  await sigBox("Accepted by customer", mode === "online" ? opts.custSig : null, sale.customer_typed_name ?? customer.name, fmt(sale.customer_signed_at), M);
  await sigBox("Accepted by company representative", mode === "online" ? opts.repSig : null, sale.rep_name ?? "", fmt(sale.rep_signed_at), W / 2 + 6);

  if (mode === "paper-blank") {
    page.drawText("Please sign both copies: one for you, one for North Grenville Hot Tubs.", { x: M, y: y - 122, size: 8, font, color: muted });
    return await pdf.save();
  }

  // Signing record page
  page = pdf.addPage([612, 792]);
  y = 792 - M;
  page.drawText(mode === "online" ? "Electronic signing record" : "Paper signing record", { x: M, y, size: 14, font: bold, color: ink });
  y -= 24;
  const nPhotos = opts.photos?.length ?? 0;
  const rec = mode === "online" ? [
    ["Agreement", `#${sale.number}, terms version ${sale.terms_version}`],
    ["Company representative", `${sale.rep_name} signed ${fmt(sale.rep_signed_at)}`],
    ["Customer", `${sale.customer_typed_name} (${customer.email}) signed ${fmt(sale.customer_signed_at)}`],
    ["Customer device", `${sale.customer_sign_ip ?? "unknown IP"} / ${sale.customer_sign_ua ?? ""}`],
    ["Method", "The customer reviewed the agreement online, ticked a box confirming they agree to its terms, typed their full name and drew their signature."],
  ] : [
    ["Agreement", `#${sale.number}, terms version ${sale.terms_version}`],
    ["Signed", `In person, on paper. Recorded ${fmt(sale.customer_signed_at)}`],
    ["Customer", `${customer.name} (${customer.email})`],
    ["Recorded by", `${sale.rep_name}`],
    ["Original", "The customer and the company representative each signed two printed copies. The customer kept one; North Grenville Hot Tubs keeps the other."],
    ["Photos", nPhotos ? `${nPhotos} photo${nPhotos > 1 ? "s" : ""} of the signed pages follow${nPhotos > 1 ? "" : "s"}.` : "No photos of the signed pages were added."],
  ];
  for (const [k, v] of rec) {
    page.drawText(k, { x: M, y, size: 9, font: bold, color: ink });
    for (const ln of wrap(clean(v), font, 9, W - 2 * M - 150)) { page.drawText(ln, { x: M + 150, y, size: 9, font, color: ink }); y -= 12; }
    y -= 6;
  }
  // Photos of the signed paper pages, one per page, scaled to fit.
  for (const p of opts.photos ?? []) {
    try {
      const img = p.type === "image/png" ? await pdf.embedPng(p.bytes) : await pdf.embedJpg(p.bytes);
      const pg = pdf.addPage([612, 792]);
      const s = Math.min((612 - 2 * M) / img.width, (792 - 2 * M) / img.height);
      pg.drawImage(img, { x: (612 - img.width * s) / 2, y: (792 - img.height * s) / 2, width: img.width * s, height: img.height * s });
    } catch (e) { console.error("photo embed", e); }
  }
  return await pdf.save();
}

function wrap(text: string, font: any, size: number, width: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let lineTxt = "";
    for (const word of para.split(/\s+/)) {
      const t = lineTxt ? lineTxt + " " + word : word;
      if (font.widthOfTextAtSize(t, size) > width && lineTxt) { out.push(lineTxt); lineTxt = word; } else lineTxt = t;
    }
    out.push(lineTxt);
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array) {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array) {
  let s = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}
