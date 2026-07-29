import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const KNOWN_FIELDS = new Set([
  "fname", "lname", "first_name", "last_name", "firstname", "lastname",
  "email", "phone", "botcheck",
  "page", "page_url", "source_url", "form", "form_name", "form_id",
]);

const LABELS: Record<string, string> = {
  firm: "Firm",
  company: "Company",
  role: "Role",
  service: "Interest",
  message: "Message",
  practice_area: "Practice Area",
  website: "Website",
  clio_version: "Clio Version",
  team_size: "Team Size",
  challenges: "Challenges",
  goals: "Goals",
};

function prettyLabel(key: string) {
  if (LABELS[key]) return LABELS[key];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SITE_LABELS: Record<string, string> = {
  "xprts.com": "xprts.com",
  "www.xprts.com": "xprts.com",
  "xprts1.wpenginepowered.com": "xprts1 (WPEngine)",
  "xprtsstaging.wpenginepowered.com": "xprtsstaging (WPEngine)",
};

function resolveSite(req: Request, data: Record<string, string>) {
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

function titleize(slug: string) {
  return slug
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Derive which assessment/form was submitted, so the 5+ resource tools don't
// all collapse into a single "Clio Assessment Form" source.
function resolveFormName(data: Record<string, string>, path: string) {
  const explicit = (data.form_name || data.form || data.form_id || "").trim();
  if (explicit) return titleize(explicit);

  const slug = path
    .split("/")
    .filter(Boolean)
    .pop();
  if (slug && slug !== "resources") return titleize(slug);

  // Fallback: read the "=== XXX RESULTS ===" banner in the assessment payload
  const blob = Object.values(data).join("\n");
  const m = blob.match(/===\s*([A-Z0-9][A-Z0-9 &/'-]+?)\s*(?:RESULTS)?\s*===/i);
  if (m) return titleize(m[1].toLowerCase());

  return "Clio Assessment";
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

    const fname = (data.fname || data.first_name || data.firstname || "").trim();
    const lname = (data.lname || data.last_name || data.lastname || "").trim();
    const email = (data.email || "").trim();
    const phone = (data.phone || "").trim();

    const name = [fname, lname].filter(Boolean).join(" ");

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Everything else goes into needs
    const site = resolveSite(req, data);
    const formName = resolveFormName(data, site.path);
    const submittedAt = new Date().toISOString();
    const sourceLabel = `${formName} Form - ${site.label}`;

    const extraParts: string[] = [];
    extraParts.push(`Form: ${formName}`);
    extraParts.push(`Website: ${site.label}`);
    if (site.url) extraParts.push(`Submitted From: ${site.url}`);
    extraParts.push(`Submitted At: ${submittedAt}`);
    for (const [key, rawValue] of Object.entries(data)) {
      if (KNOWN_FIELDS.has(key)) continue;
      const value = String(rawValue ?? "").trim();
      if (!value) continue;
      extraParts.push(`${prettyLabel(key)}: ${value}`);
    }
    const needs = extraParts.join("\n") || null;

    const { data: lead, error } = await supabase.from("leads").insert({
      name,
      contact: [email, phone].filter(Boolean).join(" | "),
      source: sourceLabel,
      needs,
      stage: "Prospecting Stage",
    }).select("id, name").single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify team admins in-app
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
          message: `A new lead from ${sourceLabel} has been added.`,
          lead_id: lead.id,
        }));

        await supabase.from("notifications").insert(notifications);
      }
    } catch (notifErr) {
      console.error("Notification error (non-fatal):", notifErr);
    }

    // Send email notification
    try {
      await supabase.functions.invoke("send-lead-notification", {
        headers: { "x-notify-secret": Deno.env.get("NOTIFY_SECRET") ?? "" },
        body: {
          lead_id: lead.id,
          lead_name: lead.name,
          source: sourceLabel,
          contact: [email, phone].filter(Boolean).join(" | ") || null,
          notes: needs,
        },
      });
    } catch (emailErr) {
      console.error("Email notification error (non-fatal):", emailErr);
    }

    return new Response(JSON.stringify({ success: true, lead_id: lead.id, name: lead.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Capture clio assessment error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});