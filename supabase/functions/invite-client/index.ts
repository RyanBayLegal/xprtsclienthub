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

    const body = await req.json();
    const { email, name, role: invitedRole, clientProfileId, resend } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = req.headers.get("origin") || "https://id-preview--269ff167-474a-46bb-8fcf-11513049feb4.lovable.app";

    // Resend mode: just generate a new recovery link for an existing user
    if (resend) {
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
        await sendMail(email, "Your XPRTS Client Hub invitation", inviteHtml(linkData.properties.action_link, name));
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
    }

    // Create mode
    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const assignedRole = invitedRole === "team_admin" ? "team_admin" : "client";
    const tempPassword = crypto.randomUUID() + "Aa1!";

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: false,
      user_metadata: { full_name: name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    await adminClient.from("user_roles").insert({ user_id: userId, role: assignedRole });

    if (clientProfileId) {
      await adminClient
        .from("client_profiles")
        .update({ user_id: userId })
        .eq("id", clientProfileId);
    }

    let emailSent = false;
    let emailError: string | null = null;
    const { data: newLink } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });

    if (newLink?.properties?.action_link) {
      try {
        await sendMail(email, "Your XPRTS Client Hub invitation", inviteHtml(newLink.properties.action_link, name));
        emailSent = true;
      } catch (mailErr) {
        emailError = (mailErr as Error).message;
      }
    } else {
      emailError = "Could not generate invite link";
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        emailSent,
        emailError,
        message: emailSent
          ? `Client account created and invite emailed to ${email}`
          : `Client account created for ${email}, but the invite email failed: ${emailError}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
