import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
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

    const notesParts: string[] = [];
    if (firm) notesParts.push(`Firm: ${firm}`);
    if (service) notesParts.push(`Interest: ${service}`);
    if (message) notesParts.push(`Message: ${message}`);

    const { data: lead, error } = await supabase.from("leads").insert({
      name,
      contact: [email, phone].filter(Boolean).join(" | "),
      source: "Strategy Review Form",
      needs: service || null,
      notes: notesParts.join("\n") || null,
      website: firm ? `Firm: ${firm}` : null,
      stage: "New",
    }).select("id, name").single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
