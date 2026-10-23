// GET ?token=...  Confirms a pending subscriber, then sends them back to the blog.
import { admin, redirect, SITE_URL } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return redirect(`${SITE_URL}/blog/?subscribe=invalid`);
  const db = admin();
  const { data } = await db.from("subscribers").select("id,status").eq("token", token).maybeSingle();
  if (!data) return redirect(`${SITE_URL}/blog/?subscribe=invalid`);
  if (data.status !== "confirmed") {
    await db.from("subscribers").update({ status: "confirmed", confirmed_at: new Date().toISOString(), unsubscribed_at: null })
      .eq("id", data.id);
  }
  return redirect(`${SITE_URL}/blog/?subscribe=confirmed`);
});
