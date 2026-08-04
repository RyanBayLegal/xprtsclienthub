import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, adminClient, runAutomations } from "../_shared/automation-runner.ts";

// Pulls recent messages from the configured Gmail mailbox over IMAP and stores
// them in inbound_emails so replies from leads/clients appear in threads.

// deno-lint-ignore no-explicit-any
type Any = any;

class Imap {
  private conn!: Deno.TlsConn;
  private buf = "";
  private dec = new TextDecoder();
  private enc = new TextEncoder();
  private tag = 0;

  async connect(host: string) {
    this.conn = await Deno.connectTls({ hostname: host, port: 993 });
    await this.readUntil(/^\* OK/m);
  }

  private async readChunk(): Promise<string> {
    const b = new Uint8Array(65536);
    const n = await this.conn.read(b);
    if (n === null) throw new Error("IMAP connection closed");
    return this.dec.decode(b.subarray(0, n));
  }

  private async readUntil(re: RegExp): Promise<string> {
    while (!re.test(this.buf)) this.buf += await this.readChunk();
    const out = this.buf;
    this.buf = "";
    return out;
  }

  async cmd(command: string): Promise<string> {
    const tag = `a${++this.tag}`;
    await this.conn.write(this.enc.encode(`${tag} ${command}\r\n`));
    const re = new RegExp(`^${tag} (OK|NO|BAD)`, "m");
    const res = await this.readUntil(re);
    const status = res.match(re)?.[1];
    if (status !== "OK") throw new Error(`IMAP ${command.split(" ")[0]} failed: ${res.slice(-300)}`);
    return res;
  }

  close() { try { this.conn.close(); } catch (_) { /* ignore */ } }
}

function decodeBody(raw: string): { text: string; html: string } {
  const headerEnd = raw.search(/\r?\n\r?\n/);
  const headers = headerEnd > -1 ? raw.slice(0, headerEnd) : raw;
  let body = headerEnd > -1 ? raw.slice(headerEnd).replace(/^\r?\n\r?\n/, "") : "";

  const boundary = headers.match(/boundary="?([^";\r\n]+)"?/i)?.[1];
  const pickPart = (part: string) => {
    const pe = part.search(/\r?\n\r?\n/);
    const ph = pe > -1 ? part.slice(0, pe) : "";
    let pb = pe > -1 ? part.slice(pe).replace(/^\r?\n\r?\n/, "") : "";
    const enc = ph.match(/Content-Transfer-Encoding:\s*(\S+)/i)?.[1]?.toLowerCase();
    if (enc === "base64") {
      try { pb = new TextDecoder().decode(Uint8Array.from(atob(pb.replace(/\s+/g, "")), (c) => c.charCodeAt(0))); } catch (_) { /* ignore */ }
    } else if (enc === "quoted-printable") {
      pb = pb.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    }
    return { type: (ph.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1] || "text/plain").toLowerCase(), body: pb };
  };

  let text = "";
  let html = "";
  if (boundary) {
    for (const part of raw.split(`--${boundary}`)) {
      if (!part.trim() || part.trim() === "--") continue;
      const p = pickPart(part);
      if (p.type.includes("text/plain") && !text) text = p.body;
      if (p.type.includes("text/html") && !html) html = p.body;
    }
  } else {
    const p = pickPart(raw);
    if (p.type.includes("text/html")) html = p.body; else text = p.body;
    body = p.body;
  }
  if (!text && html) text = html.replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n");
  if (!text && !html) text = body;
  // Strip quoted reply history for readability.
  text = text.split(/\r?\n(?:>|On .+ wrote:)/)[0].trim();
  return { text, html };
}

function decodeMime(v: string) {
  return v.replace(/=\?[^?]+\?[bB]\?([^?]+)\?=/g, (_m, b) => {
    try { return new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))); } catch { return _m; }
  }).replace(/=\?[^?]+\?[qQ]\?([^?]+)\?=/g, (_m, q) =>
    q.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16))));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Allow either an authenticated staff/admin user or the cron service role.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = adminClient();
    if (token !== serviceKey) {
      if (!token) return json({ error: "Unauthorized" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(token);
      const userId = claims?.claims?.sub as string | undefined;
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
      const ok = (roles || []).some((r: Any) => r.role === "team_admin" || r.role === "staff_member");
      if (!ok) return json({ error: "Forbidden" }, 403);
    }

    const user = Deno.env.get("GMAIL_USER");
    const pass = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
    if (!user || !pass) return json({ error: "Gmail is not configured. Add your Gmail address and app password in Settings." }, 400);

    const imap = new Imap();
    await imap.connect("imap.gmail.com");
    try {
      await imap.cmd(`LOGIN "${user}" "${pass}"`);
      await imap.cmd(`SELECT INBOX`);

      const days = Number(new URL(req.url).searchParams.get("days") || 14);
      const since = new Date(Date.now() - days * 86400000);
      const mm = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][since.getUTCMonth()];
      const searchRes = await imap.cmd(`UID SEARCH SINCE ${since.getUTCDate()}-${mm}-${since.getUTCFullYear()}`);
      const uids = (searchRes.match(/^\* SEARCH([\d\s]*)/m)?.[1] || "").trim().split(/\s+/).filter(Boolean).slice(-80);

      let stored = 0;
      const seen: string[] = [];
      for (const uid of uids) {
        const key = `gmail:${uid}`;
        const { data: exists } = await db.from("inbound_emails").select("id").eq("message_uid", key).maybeSingle();
        if (exists) continue;

        const raw = await imap.cmd(`UID FETCH ${uid} (BODY.PEEK[])`);
        const start = raw.indexOf("\r\n");
        const message = raw.slice(start + 2);
        const headerBlock = message.slice(0, Math.max(0, message.search(/\r?\n\r?\n/)))
          .replace(/\r?\n[ \t]+/g, " ");
        const h = (name: string) =>
          decodeMime(headerBlock.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1]?.trim() || "");

        const rawFrom = h("From");
        const fromEmail = (rawFrom.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "").toLowerCase();
        if (!fromEmail || fromEmail === user.toLowerCase()) continue;
        const fromName = rawFrom.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
        const subject = h("Subject");
        const dateHeader = h("Date");
        const receivedAt = dateHeader ? new Date(dateHeader) : new Date();
        const { text, html } = decodeBody(message);

        const { data: lead } = await db.from("leads").select("id").ilike("contact", `%${fromEmail}%`).limit(1).maybeSingle();
        const { data: client } = await db.from("client_profiles").select("id").ilike("email", fromEmail).limit(1).maybeSingle();

        const { data: inserted } = await db.from("inbound_emails").insert({
          from_email: fromEmail,
          from_name: fromName || null,
          to_email: h("To") || user,
          subject: subject || null,
          body_text: text || null,
          body_html: html || null,
          raw_payload: { source: "imap", uid },
          message_uid: key,
          matched_lead_id: lead?.id ?? null,
          matched_client_id: client?.id ?? null,
          processed: true,
          received_at: isNaN(receivedAt.getTime()) ? new Date().toISOString() : receivedAt.toISOString(),
        }).select("id").maybeSingle();

        stored++;
        seen.push(fromEmail);

        await runAutomations("email_received", {
          email_id: inserted?.id ?? null,
          from_email: fromEmail,
          from_name: fromName,
          to_email: user,
          subject,
          body: text,
          email: fromEmail,
          name: fromName || fromEmail,
          lead_id: lead?.id ?? null,
          client_profile_id: client?.id ?? null,
        }, null);
      }

      await db.from("email_sync_state").upsert({ id: true, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return json({ success: true, checked: uids.length, stored, senders: seen });
    } finally {
      imap.close();
    }
  } catch (e) {
    console.error("fetch-inbound-email failed", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
