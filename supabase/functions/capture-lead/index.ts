import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runAutomations } from "../_shared/automation-runner.ts";

const allowedOrigins = [
  "https://xprts.com",
  "https://www.xprts.com",
  "https://xprts1.wpenginepowered.com",
  "https://xprtsstaging.wpenginepowered.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const SITE_LABELS: Record<string, string> = {
  "xprts.com": "xprts.com",
  "www.xprts.com": "xprts.com",
  "xprts1.wpenginepowered.com": "xprts1 (WPEngine)",
  "xprtsstaging.wpenginepowered.com": "xprtsstaging (WPEngine)",
};

function titleize(slug: string) {
  return slug
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSiteInfo(req: Request, data: Record<string, string> = {}) {
  const url =
    (data.page_url || data.page || data.source_url || "").trim() ||
    req.headers.get("referer") ||
    req.headers.get("origin") ||
    "";
  let host = "";
  let path = "";
  try {
    if (url) {
      const u = new URL(url);
      host = u.hostname;
      path = u.pathname;
    }
  } catch (_e) {
    host = "";
  }
  const label = SITE_LABELS[host] || host || "Unknown Site";
  return { url, host, path, label };
}

// Distinguish which page the strategy-review form lived on (home, contact, /strategy-review/, ...)
function resolveFormName(data: Record<string, string>, path: string) {
  const explicit = (data.form_name || data.form || data.form_id || "").trim();
  if (explicit) return titleize(explicit);
  const slug = path.split("/").filter(Boolean).pop();
  if (!slug) return "Strategy Review";
  return titleize(slug);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let data: Record<string, string> = {};

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = String(value);
      });
    } else {
      data = await req.json().catch(() => ({}));
    }

    // Honeypot bot check
    if (data.botcheck) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fname = (data.fname || "").trim();
    const lname = (data.lname || "").trim();
    const email = (data.email || "").trim();
    const phone = (data.phone || "").trim();
    const firm = (data.firm || "").trim();
    const service = (data.service || "").trim();
    const message = (data.message || "").trim();

    const name = [fname, lname].filter(Boolean).join(" ");

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const site = getSiteInfo(req, data);
    const formName = resolveFormName(data, site.path);
    const submittedAt = new Date().toISOString();
    const sourceLabel = `${formName} Form - ${site.label}`;

    const notesParts: string[] = [];
    notesParts.push(`Form: ${formName}`);
    notesParts.push(`Website: ${site.label}`);
    if (site.url) notesParts.push(`Submitted From: ${site.url}`);
    notesParts.push(`Submitted At: ${submittedAt}`);
    if (firm) notesParts.push(`Firm: ${firm}`);
    if (service) notesParts.push(`Interest: ${service}`);
    if (message) notesParts.push(`Message: ${message}`);

    const { data: lead, error } = await supabase.from("leads").insert({
      name,
      contact: [email, phone].filter(Boolean).join(" | "),
      source: sourceLabel,
      needs: service || null,
      notes: notesParts.join("\n") || null,
      website: firm ? `Firm: ${firm}` : null,
      stage: "Prospecting Stage",
    }).select("id, name").single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify all team admins about the new lead
    try {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "team_admin");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin: { user_id: string }) => ({
          user_id: admin.user_id,
          type: "new_lead",
          title: `New Lead: ${lead.name}`,
          message: `A new lead from ${sourceLabel} has been added.${service ? ` Interest: ${service}` : ""}`,
          lead_id: lead.id,
        }));

        await supabase.from("notifications").insert(notifications);
      }
    } catch (notifErr) {
      console.error("Notification error (non-fatal):", notifErr);
    }

    // Send email notification to configured recipients (Gmail-ready, no-op if Gmail not connected)
    try {
      await supabase.functions.invoke("send-lead-notification", {
        headers: { "x-notify-secret": Deno.env.get("NOTIFY_SECRET") ?? "" },
        body: {
          lead_id: lead.id,
          lead_name: lead.name,
          source: sourceLabel,
          interest: service || null,
          contact: [email, phone].filter(Boolean).join(" | ") || null,
          notes: notesParts.join("\n") || null,
        },
      });
    } catch (emailErr) {
      console.error("Email notification error (non-fatal):", emailErr);
    }

    // Fire "new lead from web form" automations
    try {
      await runAutomations("lead_created", {
        lead_id: lead.id,
        name: lead.name,
        email: email || null,
        phone: phone || null,
        source: sourceLabel,
        needs: service || null,
        notes: notesParts.join("\n") || null,
        stage: "Prospecting Stage",
      });
    } catch (autoErr) {
      console.error("Automation error (non-fatal):", autoErr);
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead.id, name: lead.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Capture lead error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
