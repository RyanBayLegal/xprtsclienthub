import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAIL = "ryan@baylegal.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = authHeader.replace("Bearer ", "").trim();
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve the caller: try JWT claims first (works with signing keys),
    // then fall back to the auth server lookup.
    let caller: { id: string; email: string | null } | null = null;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    try {
      const { data: claimsData } = await (anonClient.auth as any).getClaims(token);
      const claims = claimsData?.claims;
      if (claims?.sub) caller = { id: claims.sub, email: claims.email ?? null };
    } catch (_e) { /* fall through */ }

    if (!caller) {
      const { data: userData } = await anonClient.auth.getUser(token);
      if (userData?.user) caller = { id: userData.user.id, email: userData.user.email ?? null };
    }

    if (!caller) return json({ error: "Unauthorized" }, 401);

    if (!caller.email) {
      try {
        const { data: u } = await admin.auth.admin.getUserById(caller.id);
        caller = { id: caller.id, email: u?.user?.email ?? null };
      } catch (_e) { /* ignore */ }
    }

    const { action, userId, role: newRole } = await req.json();

    const isSuperAdmin = (caller.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;

    if (action !== "list" && !isSuperAdmin) {
      return json({ error: "Forbidden: super admin only" }, 403);
    }

    if (action === "list") {
      const { data: callerRole } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .maybeSingle();
      if (!isSuperAdmin && callerRole?.role !== "team_admin") {
        return json({ error: "Forbidden" }, 403);
      }
    }

    // Resolve actor display name
    const { data: actorProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", caller.id)
      .maybeSingle();

    const logAction = async (
      targetUserId: string,
      actionName: string,
      oldValue: string | null,
      newValue: string | null,
      details: string,
    ) => {
      let targetEmail: string | null = null;
      try {
        const { data: t } = await admin.auth.admin.getUserById(targetUserId);
        targetEmail = t?.user?.email ?? null;
      } catch (_e) { /* ignore */ }
      const { data: tp } = await admin
        .from("profiles")
        .select("full_name")
        .eq("user_id", targetUserId)
        .maybeSingle();
      await admin.from("user_admin_audit_logs").insert({
        actor_user_id: caller.id,
        actor_email: caller.email ?? null,
        actor_name: actorProfile?.full_name ?? null,
        target_user_id: targetUserId,
        target_email: targetEmail,
        target_name: tp?.full_name ?? null,
        action: actionName,
        old_value: oldValue,
        new_value: newValue,
        details,
      });
    };

    if (action === "list") {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listErr) return json({ error: listErr.message }, 400);
      return json({
        users: (list?.users ?? []).map((u) => ({
          id: u.id,
          email: u.email ?? "",
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at,
        })),
      });
    }

    if (!userId) return json({ error: "userId is required" }, 400);
    if (userId === caller.id) return json({ error: "You cannot modify your own access" }, 400);

    if (action === "disable" || action === "enable") {
      const isActive = action === "enable";
      const { error } = await admin
        .from("profiles")
        .update({ is_active: isActive })
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      if (!isActive) {
        try { await admin.auth.admin.signOut(userId, "global"); } catch (_e) { /* ignore */ }
      }
      await logAction(
        userId,
        isActive ? "restore" : "disable",
        isActive ? "Disabled" : "Active",
        isActive ? "Active" : "Disabled",
        isActive ? "Restored account access" : "Disabled account access",
      );
      return json({ success: true, is_active: isActive });
    }

    if (action === "set_role") {
      const allowed = ["team_admin", "staff_member", "client"];
      if (!allowed.includes(newRole)) return json({ error: "Invalid role" }, 400);
      const { data: existing } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        const { error } = await admin.from("user_roles").update({ role: newRole }).eq("user_id", userId);
        if (error) return json({ error: error.message }, 400);
      } else {
        const { error } = await admin.from("user_roles").insert({ user_id: userId, role: newRole });
        if (error) return json({ error: error.message }, 400);
      }
      await logAction(userId, "role_change", existing?.role ?? null, newRole, "Changed user role");
      return json({ success: true, role: newRole });
    }

    if (action === "delete") {
      await logAction(userId, "remove", null, null, "Removed user account");
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
