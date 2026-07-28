import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://xprts.com",
  "https://www.xprts.com",
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
    const extraParts: string[] = [];
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
      source: "Clio Assessment Form",
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
          message: `A new lead from Clio Assessment Form has been added.`,
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
          source: "Clio Assessment Form",
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