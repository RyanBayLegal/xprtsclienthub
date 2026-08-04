// Shared automation execution engine used by the run-automation and
// inbound-email edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// deno-lint-ignore no-explicit-any
type Any = any;

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function render(template: string, ctx: Record<string, Any>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const val = key.split(".").reduce<Any>((acc, k) => (acc == null ? acc : acc[k]), ctx);
    return val == null ? "" : String(val);
  });
}

export interface MailAttachment {
  filename: string;
  contentBase64: string;
  contentType?: string;
}

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments: MailAttachment[] = [],
) {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
  if (!user || !pass) throw new Error("Gmail SMTP is not configured");

  let lastError = "";
  for (const [port, tls] of [[465, true], [587, false]] as [number, boolean][]) {
    const client = new SMTPClient({
      connection: { hostname: "smtp.gmail.com", port, tls, auth: { username: user, password: pass } },
    });
    try {
      await client.send({
        from: user,
        to,
        subject,
        content: html.replace(/<[^>]+>/g, " "),
        html,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          encoding: "base64" as const,
          content: a.contentBase64,
          contentType: a.contentType || "application/octet-stream",
        })),
      });
      try { await client.close(); } catch (_) { /* ignore */ }
      return;
    } catch (e) {
      lastError = `port ${port}: ${(e as Error)?.message ?? String(e)}`;
      try { await client.close(); } catch (_) { /* ignore */ }
    }
  }
  throw new Error(lastError || "SMTP send failed");
}

export function matchRules(
  cfg: Any,
  ctx: Record<string, Any>,
): { ok: boolean; captures: Record<string, string> } {
  const rules: Any[] = Array.isArray(cfg.rules) ? cfg.rules : [];
  const captures: Record<string, string> = {};

  // Legacy single-field config still supported.
  const legacy: Any[] = [];
  if (cfg.subject_contains) legacy.push({ field: "subject", operator: "contains", value: cfg.subject_contains });
  if (cfg.subject_regex) {
    legacy.push({
      field: "subject",
      operator: "matches_regex",
      value: cfg.subject_regex,
      case_sensitive: cfg.case_sensitive === true,
      capture_as: "subject_match",
    });
  }
  if (cfg.from_contains) legacy.push({ field: "from_email", operator: "contains", value: cfg.from_contains });
  const all = [...legacy, ...rules];
  if (all.length === 0) return { ok: true, captures };

  const mode = (cfg.match_mode || "all").toLowerCase();
  const results = all.map((rule) => {
    const source = String(ctx[rule.field || "subject"] ?? "");
    const needle = String(rule.value ?? "");
    const hay = rule.case_sensitive ? source : source.toLowerCase();
    const val = rule.case_sensitive ? needle : needle.toLowerCase();
    let ok = false;
    let captured: string | null = null;
    switch (rule.operator || "contains") {
      case "contains": ok = !!val && hay.includes(val); if (ok) captured = needle; break;
      case "not_contains": ok = !val || !hay.includes(val); break;
      case "equals": ok = hay === val; if (ok) captured = source; break;
      case "starts_with": ok = hay.startsWith(val); if (ok) captured = needle; break;
      case "ends_with": ok = hay.endsWith(val); if (ok) captured = needle; break;
      case "is_empty": ok = source.trim() === ""; break;
      case "is_not_empty": ok = source.trim() !== ""; break;
      case "matches_regex": {
        try {
          const re = new RegExp(needle, rule.case_sensitive ? "" : "i");
          const m = source.match(re);
          ok = !!m;
          if (m) captured = m[1] ?? m[0];
        } catch (_) { ok = false; }
        break;
      }
      default: ok = true;
    }
    if (ok && rule.capture_as && captured != null) captures[String(rule.capture_as)] = captured;
    return ok;
  });

  const ok = mode === "any" ? results.some(Boolean) : results.every(Boolean);
  return { ok, captures: ok ? captures : {} };
}

function matchesTrigger(auto: Any, ctx: Record<string, Any>): { ok: boolean; captures: Record<string, string> } {
  const cfg = auto.trigger_config || {};
  const none = { ok: false, captures: {} };
  const yes = { ok: true, captures: {} };
  switch (auto.trigger_type) {
    case "lead_created":
    case "lead_created_manual":
    case "lead_merged": {
      // Stage / source filters are case-insensitive; source may optionally be a regex.
      const wantStage = String(cfg.stage ?? "").trim().toLowerCase();
      if (wantStage && wantStage !== "any" && wantStage !== String(ctx.stage ?? "").trim().toLowerCase()) return none;
      const src = String(cfg.source_contains ?? "").trim();
      const haystack = String(ctx.source ?? "");
      if (src) {
        if (cfg.source_regex) {
          try {
            if (!new RegExp(src, cfg.source_case_sensitive ? "" : "i").test(haystack)) return none;
          } catch (_) { return none; }
        } else if (!haystack.toLowerCase().includes(src.toLowerCase())) return none;
      }
      return matchRules(cfg, ctx);
    }
    case "lead_stage_change":
    case "client_stage_change": {
      const want = String(cfg.stage ?? "").trim().toLowerCase();
      return (!want || want === "any" || want === String(ctx.stage ?? "").trim().toLowerCase()) ? yes : none;
    }
    case "task_event":
      return (!cfg.event || cfg.event === "any" ||
        String(cfg.event).toLowerCase() === String(ctx.event ?? "").toLowerCase()) ? yes : none;
    case "email_received":
      return matchRules(cfg, ctx);
    default:
      return yes;
  }
}

/** Looks for an inbound email reply from the contact in the run context. */
async function hasReplied(db: Any, cfg: Any, ctx: Record<string, Any>): Promise<{ found: boolean; detail: string }> {
  const days = Math.max(1, Number(cfg.within_days ?? 7));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const email = String(ctx.email || ctx.from_email || ctx.contact_email || "").trim().toLowerCase();
  const keyword = String(cfg.keyword ?? "").trim().toLowerCase();

  const lookup = async () => {
    let q = db.from("inbound_emails").select("from_email, subject, body_text, received_at")
      .gte("received_at", since).order("received_at", { ascending: false }).limit(20);
    if (ctx.client_profile_id) q = q.eq("matched_client_id", ctx.client_profile_id);
    else if (ctx.lead_id) q = q.eq("matched_lead_id", ctx.lead_id);
    else if (email) q = q.ilike("from_email", email);
    else return null;
    const { data } = await q;
    const rows: Any[] = data || [];
    if (!keyword) return rows[0] ?? null;
    return rows.find((r) =>
      `${r.subject ?? ""} ${r.body_text ?? ""}`.toLowerCase().includes(keyword)
    ) ?? null;
  };

  const waitMs = Math.min(Number(cfg.wait_seconds || 0) * 1000, MAX_DELAY_MS);
  const deadline = Date.now() + waitMs;
  for (;;) {
    const hit = await lookup();
    if (hit) {
      ctx.reply_subject = hit.subject ?? "";
      ctx.reply_body = hit.body_text ?? "";
      ctx.reply_from = hit.from_email ?? "";
      ctx.reply_received_at = hit.received_at ?? "";
      return { found: true, detail: `Reply found from ${hit.from_email ?? "contact"}` };
    }
    if (Date.now() >= deadline) break;
    await sleep(Math.min(5000, Math.max(500, deadline - Date.now())));
  }
  return { found: false, detail: `No reply in the last ${days} day(s)` };
}

function evalCondition(cfg: Any, ctx: Record<string, Any>): boolean {
  const raw = cfg.field ? ctx[cfg.field] : undefined;
  const left = String(raw ?? "").toLowerCase();
  const right = String(cfg.value ?? "").toLowerCase();
  switch (cfg.operator || "equals") {
    case "equals": return left === right;
    case "not_equals": return left !== right;
    case "contains": return left.includes(right);
    case "not_contains": return !left.includes(right);
    case "starts_with": return left.startsWith(right);
    case "ends_with": return left.endsWith(right);
    case "matches_regex": {
      try { return new RegExp(String(cfg.value ?? ""), "i").test(String(raw ?? "")); } catch (_) { return false; }
    }
    case "greater_than": return Number(raw) > Number(cfg.value);
    case "less_than": return Number(raw) < Number(cfg.value);
    case "is_empty": return left === "";
    case "is_not_empty": return left !== "";
    default: return true;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Hard cap so an edge function invocation can never hang forever.
const MAX_DELAY_MS = 60_000;

async function inCooldown(
  db: Any,
  automationId: string | null,
  nodeId: string,
  minutes: number,
): Promise<boolean> {
  if (!automationId || !minutes) return false;
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data } = await db
    .from("automation_runs")
    .select("steps, created_at")
    .eq("automation_id", automationId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data || []).some((run: Any) =>
    (run.steps || []).some((s: Any) => s.node === nodeId && s.status === "success")
  );
}

function simulateAction(kind: string, cfg: Any, ctx: Record<string, Any>): string {
  switch (kind) {
    case "send_email": {
      const to = cfg.to_mode === "custom"
        ? render(cfg.to || "", ctx)
        : cfg.to_mode === "recipients"
          ? "lead notification recipients"
          : String(ctx.email || ctx.contact_email || "(no recipient resolved)");
      return `[simulated] Email to ${to} — "${render(cfg.subject || "Notification", ctx)}"`;
    }
    case "create_task":
      return `[simulated] Task "${render(cfg.title || "Follow up", ctx)}"${cfg.assigned_to_name ? ` for ${cfg.assigned_to_name}` : ""}`;
    case "send_notification":
    case "notify":
      return `[simulated] Notification "${render(cfg.title || "Automation triggered", ctx)}"`;
    case "convert_to_client":
      return ctx.lead_id
        ? `[simulated] Convert lead to client (stage ${cfg.default_stage || "Prospect"})`
        : "[simulated] Skipped: no lead in context";
    default:
      return `[simulated] Skipped unknown step "${kind}"`;
  }
}

async function runAction(
  db: Any,
  kind: string,
  cfg: Any,
  ctx: Record<string, Any>,
  actorId: string | null,
  dryRun = false,
): Promise<string> {
  if (dryRun) return simulateAction(kind, cfg, ctx);
  switch (kind) {
    case "send_email": {
      let to = "";
      if (cfg.to_mode === "custom") to = render(cfg.to || "", ctx);
      else if (cfg.to_mode === "recipients") {
        const { data } = await db.from("lead_notification_recipients").select("email").eq("is_active", true);
        to = (data || []).map((r: Any) => r.email).join(", ");
      } else to = String(ctx.email || ctx.contact_email || "");
      if (!to) throw new Error("No email recipient resolved");
      const subject = render(cfg.subject || "Notification", ctx);
      const html = render(cfg.body || "", ctx).replace(/\n/g, "<br/>");
      await sendMail(to, subject, html);
      await db.from("notification_logs").insert({
        channel: "automation_email",
        recipient_email: to,
        lead_id: ctx.lead_id || null,
        task_id: ctx.task_id || null,
        subject,
        status: "sent",
        direction: "outbound",
        body_html: html,
        body_text: html.replace(/<[^>]+>/g, " "),
        client_profile_id: ctx.client_profile_id || null,
      });
      return `Email sent to ${to}`;
    }

    case "create_task": {
      const due = cfg.due_in_days
        ? new Date(Date.now() + Number(cfg.due_in_days) * 86400000).toISOString().split("T")[0]
        : null;
      const title = render(cfg.title || "Follow up", ctx);
      await db.from("tasks").insert({
        title,
        description: render(cfg.description || "", ctx),
        priority: cfg.priority || "medium",
        assigned_to: cfg.assigned_to || null,
        assigned_to_name: cfg.assigned_to_name || null,
        due_date: due,
        lead_id: ctx.lead_id || null,
        client_profile_id: ctx.client_profile_id || null,
        created_by: actorId,
        status: "todo",
      });
      return `Task "${title}" created`;
    }

    case "send_notification":
    case "notify": {
      const title = render(cfg.title || "Automation triggered", ctx);
      const message = render(cfg.message || "", ctx);
      let targets: string[] = [];
      if (cfg.user_id && !cfg.notify_all_admins) targets = [cfg.user_id];
      else {
        const { data } = await db.from("user_roles").select("user_id").eq("role", "team_admin");
        targets = (data || []).map((r: Any) => r.user_id);
      }
      for (const uid of targets) {
        await db.from("notifications").insert({
          user_id: uid,
          type: "workflow",
          title,
          message,
          lead_id: ctx.lead_id || null,
        });
      }
      return `Notified ${targets.length} user(s)`;
    }

    case "convert_to_client": {
      if (!ctx.lead_id) return "Skipped: no lead in context";
      const { data: existing } = await db.from("client_profiles").select("id").eq("lead_id", ctx.lead_id).maybeSingle();
      if (existing) return "Client profile already exists";
      const { data: lead } = await db.from("leads").select("*").eq("id", ctx.lead_id).maybeSingle();
      const l: Any = lead || {};
      const contact = String(l.contact || "").trim();
      const isEmail = contact.includes("@");
      await db.from("client_profiles").insert({
        name: l.name || ctx.name,
        lead_id: ctx.lead_id,
        stage: cfg.default_stage || "Prospect",
        created_by: actorId,
        email: isEmail ? contact : null,
        phone: !isEmail && contact ? contact : null,
        pain_points: l.needs || null,
        discovery_notes: l.notes || null,
        discovery_source: l.source || null,
        date_reached: l.date_reached || null,
      });
      return `Converted "${l.name || ctx.name}" to client`;
    }

    default:
      return `Skipped unknown step "${kind}"`;
  }
}

/**
 * Executes a single automation graph, optionally starting from an arbitrary
 * node (used by "re-run from step"). Records a detailed per-step timeline.
 */
async function executeGraph(
  db: Any,
  auto: Any,
  ctx: Record<string, Any>,
  actorId: string | null,
  opts: { startNodeId?: string; startInclusive?: boolean; triggerType?: string; label?: string; dryRun?: boolean } = {},
) {
  const graph = auto.graph || { nodes: [], edges: [] };
  const nodes: Any[] = graph.nodes || [];
  const edges: Any[] = graph.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const steps: Any[] = [];
  let status = "success";
  let errorMessage: string | null = null;
  const seen = new Set<string>();

  const runNode = async (node: Any, depth: number): Promise<void> => {
    const kind = node.data?.kind;
    const cfg = node.data?.config || {};
    if (kind === "trigger") {
      await visitFrom(node.id, depth + 1);
      return;
    }

    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    const delayMs = opts.dryRun ? 0 : Math.min(Number(cfg.delay_seconds || 0) * 1000, MAX_DELAY_MS);
    const maxAttempts = Math.max(1, Math.min(Number(cfg.retry_attempts || 1), 5));
    const cooldown = Number(cfg.cooldown_minutes || 0);

    const push = (extra: Any) =>
      steps.push({
        node: node.id,
        kind,
        label: cfg.label || cfg.title || cfg.subject || null,
        started_at: startedAt,
        duration_ms: Date.now() - t0,
        delay_ms: delayMs,
        ...extra,
      });

    if (!opts.dryRun && cooldown && (await inCooldown(db, auto.id ?? null, node.id, cooldown))) {
      push({ status: "skipped", attempts: 0, result: `Skipped — cooldown active (${cooldown} min)` });
      await visitFrom(node.id, depth + 1);
      return;
    }

    if (delayMs > 0) await sleep(delayMs);

    if (kind === "condition") {
      const pass = evalCondition(cfg, ctx);
      push({
        status: "success",
        attempts: 1,
        branch: pass ? "true" : "false",
        result: pass ? "Condition met → true branch" : "Condition not met → false branch",
      });
      await visitFrom(node.id, depth + 1, pass ? "true" : "false");
      return;
    }

    if (kind === "wait_for_reply") {
      let found = true;
      let detail = "[simulated] Reply found → Yes branch";
      if (!opts.dryRun) {
        const res = await hasReplied(db, cfg, ctx);
        found = res.found;
        detail = res.detail;
      }
      push({
        status: "success",
        attempts: 1,
        branch: found ? "true" : "false",
        result: detail,
      });
      await visitFrom(node.id, depth + 1, found ? "true" : "false");
      return;
    }

    let attempts = 0;
    let lastError = "";
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const result = await runAction(db, kind, cfg, ctx, actorId, opts.dryRun === true);
        push({ status: "success", attempts, result });
        await visitFrom(node.id, depth + 1);
        return;
      } catch (e) {
        lastError = (e as Error)?.message ?? String(e);
        if (attempts < maxAttempts) await sleep(Math.min(1000 * attempts, 5000));
      }
    }
    status = "error";
    errorMessage = lastError;
    push({ status: "error", attempts, result: lastError, error: lastError });
  };

  const visitFrom = async (nodeId: string, depth: number, branch?: string) => {
    if (depth > 25) return;
    const outgoing = edges.filter((e: Any) => {
      if (e.source !== nodeId) return false;
      if (!branch) return true;
      const handle = String(e.sourceHandle || "");
      if (handle.endsWith("-false")) return branch === "false";
      // untagged and "-true" handles follow the true branch
      return branch === "true";
    });
    for (const edge of outgoing) {
      const node = byId.get(edge.target);
      if (!node) continue;
      const key = `${node.id}:${depth}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await runNode(node, depth);
    }
  };

  if (opts.startNodeId) {
    const start = byId.get(opts.startNodeId);
    if (!start) throw new Error("Step not found in this automation");
    if (opts.startInclusive === false) await visitFrom(start.id, 0);
    else await runNode(start, 0);
  } else {
    const trigger = nodes.find((n: Any) => n.data?.kind === "trigger");
    if (trigger) await visitFrom(trigger.id, 0);
    else {
      const targets = new Set(edges.map((e: Any) => e.target));
      for (const n of nodes.filter((n: Any) => !targets.has(n.id))) await runNode(n, 0);
    }
  }

  if (opts.dryRun) {
    return { automation: auto.name, status, steps, error_message: errorMessage, simulated: true };
  }

  await db.from("automation_runs").insert({
    automation_id: auto.id ?? null,
    automation_name: opts.label ? `${auto.name} ${opts.label}` : auto.name,
    trigger_type: opts.triggerType || auto.trigger_type,
    context: ctx,
    steps,
    status,
    error_message: errorMessage,
    executed_by: actorId,
  });

  return { automation: auto.name, status, steps, error_message: errorMessage };
}

export async function runAutomations(
  triggerType: string,
  ctx: Record<string, Any>,
  actorId: string | null = null,
) {
  const db = adminClient();
  const { data: automations } = await db
    .from("automations")
    .select("*")
    .eq("trigger_type", triggerType)
    .eq("is_active", true);

  const summary: Any[] = [];
  for (const auto of (automations || []) as Any[]) {
    const match = matchesTrigger(auto, ctx);
    if (!match.ok) continue;
    const runCtx = { ...ctx, ...match.captures, match: match.captures };
    summary.push(await executeGraph(db, auto, runCtx, actorId, { triggerType }));
  }
  return summary;
}

/** Re-runs an existing automation starting at a specific step. */
export async function replayAutomation(
  automationId: string,
  fromNodeId: string,
  ctx: Record<string, Any>,
  actorId: string | null = null,
) {
  const db = adminClient();
  const { data: auto } = await db.from("automations").select("*").eq("id", automationId).maybeSingle();
  if (!auto) throw new Error("Automation not found");
  return await executeGraph(db, auto, ctx, actorId, {
    startNodeId: fromNodeId,
    triggerType: auto.trigger_type,
    label: "(re-run)",
  });
}
/** Executes an automation in simulation mode — no emails, tasks, or records are created. */
export async function simulateAutomation(
  automationId: string,
  ctx: Record<string, Any>,
  actorId: string | null = null,
  graphOverride?: Any,
) {
  const db = adminClient();
  let auto: Any = null;
  if (automationId) {
    const { data } = await db.from("automations").select("*").eq("id", automationId).maybeSingle();
    auto = data;
  }
  if (!auto && graphOverride) auto = { name: "Draft automation", trigger_type: graphOverride.trigger_type, graph: graphOverride.graph, trigger_config: graphOverride.trigger_config || {} };
  if (!auto) throw new Error("Automation not found");
  if (graphOverride?.graph) auto = { ...auto, graph: graphOverride.graph, trigger_config: graphOverride.trigger_config ?? auto.trigger_config };

  const match = matchesTrigger(auto, ctx);
  const runCtx = { ...ctx, ...match.captures, match: match.captures };
  const result = await executeGraph(db, auto, runCtx, actorId, {
    triggerType: auto.trigger_type,
    label: "(simulation)",
    dryRun: true,
  });
  return { ...result, trigger_matched: match.ok, captures: match.captures, context: runCtx };
}
