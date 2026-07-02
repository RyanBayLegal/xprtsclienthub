import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function buildRawEmail(to: string, subject: string, html: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  const b64 = btoa(unescape(encodeURIComponent(message)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const secret = Deno.env.get("NOTIFY_SECRET");
  if (!secret || req.headers.get("x-notify-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const targetDates = [isoDateOffset(1), isoDateOffset(2)];

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, title, description, due_date, assigned_to, assigned_to_name, status, client_profile_id")
      .in("due_date", targetDates)
      .neq("status", "done")
      .not("assigned_to", "is", null);

    if (error) throw error;
    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile emails (personal_email preferred, fallback to auth email via admin)
    const userIds = Array.from(new Set(tasks.map((t: any) => t.assigned_to)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, personal_email")
      .in("user_id", userIds);

    // Get auth emails for users without personal_email
    const profileMap = new Map<string, { email: string | null; name: string | null }>();
    for (const p of profiles || []) {
      profileMap.set((p as any).user_id, {
        email: (p as any).personal_email,
        name: (p as any).full_name,
      });
    }
    for (const uid of userIds) {
      const cur = profileMap.get(uid as string);
      if (!cur?.email) {
        try {
          const { data: u } = await supabase.auth.admin.getUserById(uid as string);
          if (u?.user?.email) {
            profileMap.set(uid as string, { email: u.user.email, name: cur?.name || null });
          }
        } catch (_) { /* ignore */ }
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    const gmailReady = Boolean(LOVABLE_API_KEY && GOOGLE_MAIL_API_KEY);

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    let sent = 0;
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const t of tasks as any[]) {
      const prof = profileMap.get(t.assigned_to);
      const to = prof?.email;
      if (!to) {
        skipped.push(`task ${t.id}: no email for assignee`);
        continue;
      }

      const due = new Date(t.due_date + "T00:00:00Z");
      const daysAway = Math.round((due.getTime() - todayUtc.getTime()) / 86400000);
      const subject = `Reminder: "${t.title}" due in ${daysAway} day${daysAway === 1 ? "" : "s"}`;
      const html = `
        <p>Hi ${prof?.name || "there"},</p>
        <p>This is a reminder that your task <strong>${t.title}</strong> is due on <strong>${t.due_date}</strong> (in ${daysAway} day${daysAway === 1 ? "" : "s"}).</p>
        ${t.description ? `<p>${String(t.description).replace(/\n/g, "<br/>")}</p>` : ""}
        <p><a href="https://xprtsclienthub.lovable.app/tasks">Open in CRM</a></p>
      `;

      // Always create an in-app notification
      await supabase.from("notifications").insert({
        user_id: t.assigned_to,
        type: "task_reminder",
        title: subject,
        message: `Due ${t.due_date}`,
      });

      if (!gmailReady) {
        skipped.push(`task ${t.id}: gmail not configured`);
        continue;
      }

      try {
        const raw = buildRawEmail(to, subject, html);
        const resp = await fetch(`${GMAIL_GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });
        if (!resp.ok) {
          errors.push(`task ${t.id}: ${resp.status} ${await resp.text()}`);
        } else {
          sent++;
        }
      } catch (e) {
        errors.push(`task ${t.id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: tasks.length,
        sent,
        skipped,
        errors,
        gmail_configured: gmailReady,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-task-reminders error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});