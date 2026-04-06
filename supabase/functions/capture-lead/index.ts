import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let body: Record<string, string>;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      body = {};
      formData.forEach((value, key) => {
        body[key] = String(value);
      });
    } else {
      body = await req.json().catch(() => ({}));
    }

    // Web3Forms webhook sends nested data; handle both flat and nested
    const data = body.data ? (typeof body.data === "string" ? JSON.parse(body.data) : body.data) : body;

    const fname = (data.fname || data["First Name"] || "").trim();
    const lname = (data.lname || data["Last Name"] || "").trim();
    const email = (data.email || data.Email || "").trim();
    const phone = (data.phone || data.Phone || "").trim();
    const firm = (data.firm || data["Firm Name"] || "").trim();
    const service = (data.service || data["Primary Interest"] || "").trim();
    const message = (data.message || data.Message || "").trim();

    const name = [fname, lname].filter(Boolean).join(" ");

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build notes from all available info
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
