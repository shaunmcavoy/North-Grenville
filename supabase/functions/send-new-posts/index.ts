// Called on a schedule (pg_cron). Reads the site's blog feed, and emails any post that hasn't been sent yet
// to every confirmed subscriber. Requires header x-cron-secret matching private.settings.cron_secret.
import { admin, button, emailShell, escapeHtml, FROM, FUNCTIONS_URL, REPLY_TO, sendEmail, SITE_URL } from "../_shared/common.ts";

type Post = { slug: string; title: string; description: string; date: string; url: string; image: string };

Deno.serve(async (req) => {
  const db = admin();
  const { data: ok } = await db.rpc("check_cron_secret", { s: req.headers.get("x-cron-secret") ?? "" });
  if (ok !== true) return new Response("Forbidden", { status: 403 });

  const feed = await fetch(`${SITE_URL}/blog/feed.json?t=${Date.now()}`).then((r) => r.json()) as { posts: Post[] };
  const { data: sent } = await db.from("post_sends").select("slug");
  const sentSlugs = new Set((sent ?? []).map((s) => s.slug));
  const fresh = feed.posts.filter((p) => !sentSlugs.has(p.slug))
    .filter((p) => Date.now() - new Date(p.date + "T12:00:00Z").getTime() < 14 * 86400_000); // only recent posts

  const results = [];
  for (const p of fresh.reverse()) {
    // Claim the post first so a retry can never double-send.
    const { error: claimErr } = await db.from("post_sends").insert({ slug: p.slug, title: p.title });
    if (claimErr) continue;

    const { data: subs } = await db.from("subscribers").select("email,first_name,token").eq("status", "confirmed");
    const list = subs ?? [];
    const emails = list.map((s) => {
      const unsub = `${FUNCTIONS_URL}/unsubscribe?token=${s.token}`;
      const hi = s.first_name ? `Hi ${escapeHtml(s.first_name)},` : "Hi there,";
      return {
        from: FROM, to: s.email, reply_to: REPLY_TO, subject: p.title,
        headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        html: emailShell({
          preheader: p.description, unsubscribeUrl: unsub,
          body: `<p>${hi}</p>
<img src="${p.image}" width="544" alt="" style="width:100%;max-width:544px;border-radius:10px;display:block">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:28px;line-height:1.2;margin:22px 0 10px">${escapeHtml(p.title)}</h1>
<p>${escapeHtml(p.description)}</p>
${button(p.url, "Read the post")}
<p>Questions about your tub? Just hit reply, or call or text me at (613) 292-1786.</p><p>Blaine</p>`,
        }),
        text: `${p.title}\n\n${p.description}\n\nRead it: ${p.url}\n\nBlaine, North Grenville Hot Tubs, 5333 County Rd 19, Kemptville, ON\nUnsubscribe: ${unsub}`,
      };
    });
    for (let i = 0; i < emails.length; i += 100) await sendEmail(emails.slice(i, i + 100), true);
    await db.from("post_sends").update({ recipients: emails.length }).eq("slug", p.slug);
    results.push({ slug: p.slug, recipients: emails.length });
  }
  return new Response(JSON.stringify({ sent: results }), { headers: { "Content-Type": "application/json" } });
});
