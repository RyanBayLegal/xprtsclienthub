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

async function sendMail(to: string, subject: string, html: string) {
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

function matchesTrigger(auto: Any, ctx: Record<string, Any>): boolean {
  const cfg = auto.trigger_config || {};
  switch (auto.trigger_type) {
    case "lead_stage_change":
    case "client_stage_change":
      return !cfg.stage || cfg.stage === "any" || cfg.stage === ctx.stage;
    case "task_event":
      return !cfg.event || cfg.event === "any" || cfg.event === ctx.event;
    case "email_received": {
      const needle = (cfg.subject_contains || "").toLowerCase().trim();
      const from = (cfg.from_contains || "").toLowerCase().trim();
      const okSubject = !needle || String(ctx.subject || "").toLowerCase().includes(needle);
      const okFrom = !from || String(ctx.from_email || "").toLowerCase().includes(from);
      return okSubject && okFrom;
    }
    default:
      return true;
  }
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

async function runAction(
  db: Any,
  kind: string,
  cfg: Any,
  ctx: Record<string, Any>,
  actorId: string | null,
): Promise<string> {
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
  opts: { startNodeId?: string; startInclusive?: boolean; triggerType?: string; label?: string } = {},
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
    const delayMs = Math.min(Number(cfg.delay_seconds || 0) * 1000, MAX_DELAY_MS);
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

    if (cooldown && (await inCooldown(db, auto.id ?? null, node.id, cooldown))) {
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

    let attempts = 0;
    let lastError = "";
    while (attempts < maxAttempts) {
      attempts++;
      try {
        const result = await runAction(db, kind, cfg, ctx, actorId);
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
    if (!matchesTrigger(auto, ctx)) continue;
    summary.push(await executeGraph(db, auto, ctx, actorId, { triggerType }));
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