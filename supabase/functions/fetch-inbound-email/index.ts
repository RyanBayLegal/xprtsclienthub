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

function normalizeMessageId(value: string) {
  return value.trim().toLowerCase().replace(/^<|>$/g, "");
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
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

      const url = new URL(req.url);
      const days = Number(url.searchParams.get("days") || 14);
      const { data: syncState } = await db.from("email_sync_state").select("last_uid").eq("id", true).maybeSingle();
      const lastUid = Number((syncState as Any)?.last_uid || 0);
      const since = new Date(Date.now() - days * 86400000);
      const mm = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][since.getUTCMonth()];
      // Re-scan a bounded recent window so messages skipped before a contact was
      // added can be backfilled. Database uniqueness makes repeated polls safe.
      const criteria = `SINCE ${since.getUTCDate()}-${mm}-${since.getUTCFullYear()}`;
      const searchRes = await imap.cmd(`UID SEARCH ${criteria}`);
      const uids = (searchRes.match(/^\* SEARCH([\d\s]*)/m)?.[1] || "")
        .trim().split(/\s+/).filter(Boolean)
        .slice(-250);

      let stored = 0;
      let maxUid = lastUid;
      const seen: string[] = [];
      const debug: Any[] = [];

      // Known contacts only — we never store mail from addresses that are not
      // on a lead or client record.
      const { data: leadRows } = await db.from("leads").select("id, name, contact");
      const { data: clientRows } = await db.from("client_profiles").select("id, name, email");
      const leadByEmail = new Map<string, Any>();
      for (const l of (leadRows || []) as Any[]) {
        for (const e of String(l.contact || "").toLowerCase().match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []) {
          if (!leadByEmail.has(e)) leadByEmail.set(e, l);
        }
      }
      const clientByEmail = new Map<string, Any>();
      for (const c of (clientRows || []) as Any[]) {
        const e = String(c.email || "").toLowerCase().match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
        if (e && !clientByEmail.has(e)) clientByEmail.set(e, c);
      }

      for (const uid of uids) {
        if (Number(uid) > maxUid) maxUid = Number(uid);
        const key = `gmail:inbox:${uid}`;
        const { data: exists } = await db.from("inbound_emails").select("id").eq("provider_fingerprint", key).maybeSingle();
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
        const messageId = h("Message-ID") || h("Message-Id");
        const inReplyTo = h("In-Reply-To");
        const referencesHeader = h("References");

        const contentFingerprint = `gmail:content:${await sha256([
          normalizeMessageId(messageId), fromEmail, subject.trim().toLowerCase(),
          isNaN(receivedAt.getTime()) ? "" : receivedAt.toISOString(), text.trim(),
        ].join("\n"))}`;
        const dedupeFilters = [key, contentFingerprint];
        const { data: duplicate } = await db.from("inbound_emails").select("id")
          .in("provider_fingerprint", dedupeFilters).limit(1);
        if ((duplicate || []).length) continue;
        if (messageId) {
          const { data: duplicateMessage } = await db.from("inbound_emails").select("id")
            .ilike("message_id", messageId.trim()).limit(1);
          if ((duplicateMessage || []).length) continue;
        }

        // The sender must be a known lead/client before reply headers may attach it.
        const senderClient = clientByEmail.get(fromEmail) || null;
        const senderLead = leadByEmail.get(fromEmail) || null;
        if (!senderClient && !senderLead) {
          debug.push({ uid, from_email: fromEmail, subject, message_id: messageId || null, stored: false, reason: "Sender is not on any lead or client record" });
          continue;
        }

        // 1) Header-based matching: link the reply to the outbound message it answers.
        const refIds = [...new Set(
          `${inReplyTo} ${referencesHeader}`.match(/<[^>\s]+>/g) || [],
        )];
        let lead: Any = null;
        let client: Any = null;
        let matchMethod = "none";
        let parentLog: Any = null;
        if (refIds.length) {
          const { data: parents } = await db
            .from("notification_logs")
            .select("id, message_id, thread_id, lead_id, client_profile_id, subject")
            .in("message_id", refIds)
            .limit(1);
          parentLog = (parents || [])[0] || null;
          if (parentLog?.client_profile_id) { client = { id: parentLog.client_profile_id }; matchMethod = "header:in-reply-to"; }
          else if (parentLog?.lead_id) { lead = { id: parentLog.lead_id }; matchMethod = "header:in-reply-to"; }
        }

        // 2) Fall back to the sender address on a known lead or client.
        if (!lead && !client) {
          if (senderClient) { client = senderClient; matchMethod = "sender:client-email"; }
          else if (senderLead) { lead = senderLead; matchMethod = "sender:lead-email"; }
        }

        const threadId = client ? `client:${client.id}` : lead ? `lead:${lead.id}` : null;
        const decision = {
          uid,
          from_email: fromEmail,
          subject,
          message_id: messageId || null,
          in_reply_to: inReplyTo || null,
          references: refIds,
          matched_parent_message_id: parentLog?.message_id ?? null,
          match_method: matchMethod,
          thread_id: threadId,
          lead_id: lead?.id ?? null,
          client_profile_id: client?.id ?? null,
          received_at: isNaN(receivedAt.getTime()) ? new Date().toISOString() : receivedAt.toISOString(),
        };

        debug.push({ ...decision, stored: true, reason: matchMethod.startsWith("header") ? "Matched by reply headers" : "Matched by sender email" });

        const { data: inserted, error: insertError } = await db.from("inbound_emails").insert({
          from_email: fromEmail,
          from_name: fromName || null,
          to_email: h("To") || user,
          subject: subject || null,
          body_text: text || null,
          body_html: html || null,
          raw_payload: { source: "imap", uid },
          message_uid: key,
          provider_fingerprint: key,
          message_id: messageId || null,
          in_reply_to: inReplyTo || null,
          references_header: referencesHeader || null,
          thread_id: threadId,
          match_method: matchMethod,
          match_debug: decision,
          matched_lead_id: lead?.id ?? null,
          matched_client_id: client?.id ?? null,
          processed: true,
          received_at: isNaN(receivedAt.getTime()) ? new Date().toISOString() : receivedAt.toISOString(),
        }).select("id").maybeSingle();

        if (insertError) {
          if (insertError.code === "23505") continue;
          throw insertError;
        }

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

      await db.from("email_sync_state").upsert({
        id: true,
        last_checked_at: new Date().toISOString(),
        last_uid: maxUid > 0 ? maxUid : null,
        updated_at: new Date().toISOString(),
      });
      return json({ success: true, checked: uids.length, stored, senders: seen, debug });
    } finally {
      imap.close();
    }
  } catch (e) {
    console.error("fetch-inbound-email failed", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
