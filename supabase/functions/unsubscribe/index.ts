// GET ?token=...  (link in every email)  or POST from email clients' one-click unsubscribe (RFC 8058).
import { admin, redirect, SITE_URL } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (/^[0-9a-f-]{36}$/i.test(token)) {
    await admin().from("subscribers").update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("token", token);
  }
  if (req.method === "POST") return new Response("Unsubscribed", { status: 200 });
  return redirect(`${SITE_URL}/blog/?subscribe=unsubscribed`);
});
