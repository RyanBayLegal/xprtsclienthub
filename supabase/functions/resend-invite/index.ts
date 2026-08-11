import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "../_shared/automation-runner.ts";


function inviteHtml(link: string, name?: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6">
  <p>Hi${name ? " " + name : ""},</p>
  <p>You have been invited to the XPRTS Client Hub. Click the button below to set your password and access your account.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block">Set your password</a></p>
  <p style="font-size:13px;color:#555">If the button does not work, copy and paste this link into your browser:<br><a href="${link}">${link}</a></p>
  <p style="font-size:13px;color:#555">This link expires after a short time. If it has expired, request a new invite.</p>
</div>`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user: caller } } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is team_admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "team_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: team_admin required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's email via admin API
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email;
    const siteUrl = req.headers.get("origin") || "https://id-preview--269ff167-474a-46bb-8fcf-11513049feb4.lovable.app";

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkError?.message || "Could not generate invite link" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sendMail(
        email,
        "Your XPRTS Client Hub invitation",
        inviteHtml(linkData.properties.action_link, userData.user.user_metadata?.full_name),
      );
    } catch (mailErr) {
      return new Response(
        JSON.stringify({ error: `Invite link created but email failed: ${(mailErr as Error).message}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Invite resent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
