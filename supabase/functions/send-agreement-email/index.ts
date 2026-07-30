import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate the caller's JWT for real
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (userError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agreement_id, client_email, client_name, agreement_type } = await req.json();

    if (!agreement_id || !client_email) {
      return new Response(JSON.stringify({ error: "agreement_id and client_email are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Fetch the agreement
    const { data: agreement, error: fetchError } = await supabaseAdmin
      .from("engagement_agreements")
      .select("*")
      .eq("id", agreement_id)
      .single();

    if (fetchError || !agreement) {
      return new Response(JSON.stringify({ error: "Agreement not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Authorize: team_admin/staff_member, or the client who owns this agreement
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    let allowed = roles.includes("team_admin") || roles.includes("staff_member");
    if (!allowed && agreement.client_profile_id) {
      const { data: ownProfile } = await supabaseAdmin
        .from("client_profiles")
        .select("id")
        .eq("id", agreement.client_profile_id)
        .eq("user_id", callerId)
        .maybeSingle();
      allowed = !!ownProfile;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentData = agreement.content_data as Record<string, any> || {};
    const isNDA = contentData.type === "nda" || agreement_type === "nda";
    const docTitle = isNDA ? "Mutual NDA & Non-Interference Agreement" : "Staffing Services Agreement";

    const signedDate = agreement.client_signed_at
      ? new Date(agreement.client_signed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // Build email HTML
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #005b2f;">
          <h1 style="color: #005b2f; margin: 0; font-size: 24px;">XPRTS</h1>
          <p style="color: #666; margin: 4px 0 0; font-size: 12px;">11 N Nile Ave, East Wenatchee, WA 98802</p>
        </div>
        
        <div style="padding: 30px 0;">
          <h2 style="color: #08331c; margin: 0 0 16px;">Your ${docTitle}</h2>
          <p style="color: #333; line-height: 1.6;">
            Dear ${client_name || "Client"},
          </p>
          <p style="color: #333; line-height: 1.6;">
            ${agreement.status === "signed"
              ? `Your ${docTitle} has been fully executed and signed as of ${signedDate}. A copy of the signed agreement is attached to this email for your records.`
              : `Please find attached your ${docTitle} for review. If you have any questions, please don't hesitate to reach out.`
            }
          </p>
          
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <h3 style="color: #005b2f; margin: 0 0 8px; font-size: 14px;">Agreement Details</h3>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Type:</strong> ${docTitle}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Status:</strong> ${agreement.status}</p>
            <p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Date:</strong> ${signedDate}</p>
            ${agreement.client_signature ? `<p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>Client Signature:</strong> ${agreement.client_signature}</p>` : ""}
            ${agreement.xprts_signature ? `<p style="margin: 4px 0; font-size: 13px; color: #555;"><strong>XPRTS Signature:</strong> ${agreement.xprts_signature}</p>` : ""}
          </div>

          <p style="color: #333; line-height: 1.6;">
            Thank you for choosing XPRTS. We look forward to a successful partnership.
          </p>
          <p style="color: #333; line-height: 1.6;">
            Best regards,<br/>
            <strong>XPRTS, Inc.</strong><br/>
            <span style="color: #666; font-size: 13px;">(650) 561-6942 · karen@xprts.com</span>
          </p>
        </div>
        
        <div style="border-top: 1px solid #ddd; padding-top: 16px; text-align: center;">
          <p style="color: #999; font-size: 11px; margin: 0;">
            This email was sent automatically by XPRTS CRM. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    `;

    // Send via Supabase Auth email (using admin API)
    // Since we don't have a dedicated email service, we'll use the built-in invite
    // For now, log the email and return success - in production, integrate with Resend/SendGrid
    console.log(`Email would be sent to: ${client_email}`);
    console.log(`Subject: Your XPRTS ${docTitle}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agreement email prepared for ${client_email}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
