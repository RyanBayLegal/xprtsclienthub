import type { Edge, Node } from "@xyflow/react";

export interface ValidationIssue {
  level: "error" | "warning";
  nodeId?: string;
  message: string;
}

interface Cfg { [k: string]: unknown }

const kindOf = (n: Node) => String((n.data as { kind?: string })?.kind ?? "");
const cfgOf = (n: Node) => ((n.data as { config?: Cfg })?.config ?? {}) as Cfg;
const str = (v: unknown) => String(v ?? "").trim();

/**
 * Static analysis of an automation before saving: required inputs,
 * missing branches, unreachable nodes and misconfigured steps.
 */
export function validateAutomation(
  graph: { nodes: Node[]; edges: Edge[] },
  triggerType: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];

  const triggers = nodes.filter((n) => kindOf(n) === "trigger");
  if (triggers.length === 0) issues.push({ level: "error", message: "Add a Trigger step — the automation has no entry point." });
  if (triggers.length > 1) issues.push({ level: "error", message: "Only one Trigger step is allowed." });

  const actions = nodes.filter((n) => kindOf(n) !== "trigger");
  if (actions.length === 0) issues.push({ level: "error", message: "Add at least one action step after the trigger." });

  // Reachability from the trigger (or from root nodes when no trigger exists).
  const roots = triggers.length ? triggers.map((t) => t.id) : nodes.filter((n) => !edges.some((e) => e.target === n.id)).map((n) => n.id);
  const reachable = new Set<string>(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (reachable.has(e.source) && !reachable.has(e.target)) { reachable.add(e.target); changed = true; }
    }
  }
  for (const n of nodes) {
    if (!reachable.has(n.id)) {
      issues.push({ level: "error", nodeId: n.id, message: `"${label(n)}" is unreachable — connect it to the flow.` });
    }
  }

  for (const n of nodes) {
    const kind = kindOf(n);
    const cfg = cfgOf(n);
    const name = label(n);
    const outgoing = edges.filter((e) => e.source === n.id);

    if (kind !== "trigger" && kind !== "condition" && outgoing.length === 0) {
      // terminal steps are fine — no issue
    }

    switch (kind) {
      case "send_email": {
        if (!str(cfg.subject)) issues.push({ level: "error", nodeId: n.id, message: `${name}: subject is required.` });
        if (!str(cfg.body)) issues.push({ level: "error", nodeId: n.id, message: `${name}: body is required.` });
        if (cfg.to_mode === "custom" && !str(cfg.to)) issues.push({ level: "error", nodeId: n.id, message: `${name}: specific email address is required.` });
        if ((cfg.to_mode ?? "contact") === "contact" && !["lead_created", "lead_stage_change", "client_stage_change", "email_received", "task_event"].includes(triggerType)) {
          issues.push({ level: "warning", nodeId: n.id, message: `${name}: this trigger may not provide a contact email.` });
        }
        break;
      }
      case "create_task": {
        if (!str(cfg.title)) issues.push({ level: "error", nodeId: n.id, message: `${name}: task title is required.` });
        if (cfg.due_in_days !== undefined && str(cfg.due_in_days) !== "" && Number(cfg.due_in_days) < 0) {
          issues.push({ level: "error", nodeId: n.id, message: `${name}: due in days cannot be negative.` });
        }
        if (!cfg.assigned_to) issues.push({ level: "warning", nodeId: n.id, message: `${name}: no assignee selected.` });
        break;
      }
      case "send_notification": {
        if (!str(cfg.title)) issues.push({ level: "error", nodeId: n.id, message: `${name}: notification title is required.` });
        break;
      }
      case "convert_to_client": {
        if (!["lead_created", "lead_stage_change", "email_received"].includes(triggerType)) {
          issues.push({ level: "warning", nodeId: n.id, message: `${name}: this trigger rarely carries a lead to convert.` });
        }
        break;
      }
      case "condition": {
        const op = str(cfg.operator) || "equals";
        if (!str(cfg.field)) issues.push({ level: "error", nodeId: n.id, message: `${name}: choose a field to test.` });
        if (!["is_empty", "is_not_empty"].includes(op) && !str(cfg.value)) {
          issues.push({ level: "error", nodeId: n.id, message: `${name}: a comparison value is required.` });
        }
        if (op === "matches_regex") {
          try { new RegExp(str(cfg.value)); } catch { issues.push({ level: "error", nodeId: n.id, message: `${name}: invalid regular expression.` }); }
        }
        const hasTrue = outgoing.some((e) => !String(e.sourceHandle ?? "").endsWith("-false"));
        const hasFalse = outgoing.some((e) => String(e.sourceHandle ?? "").endsWith("-false"));
        if (!hasTrue) issues.push({ level: "error", nodeId: n.id, message: `${name}: the Yes branch has no next step.` });
        if (!hasFalse) issues.push({ level: "warning", nodeId: n.id, message: `${name}: the No branch is empty — non-matching runs stop here.` });
        break;
      }
    }

    if (kind !== "trigger") {
      const delay = Number(cfg.delay_seconds || 0);
      if (delay > 60) issues.push({ level: "warning", nodeId: n.id, message: `${name}: delay is capped at 60 seconds.` });
      const retries = Number(cfg.retry_attempts || 1);
      if (retries > 5) issues.push({ level: "warning", nodeId: n.id, message: `${name}: retries are capped at 5.` });
    }
  }

  return issues;
}

function label(n: Node): string {
  const cfg = cfgOf(n);
  const kind = kindOf(n);
  const custom = str(cfg.label) || str(cfg.title) || str(cfg.subject);
  const base = kind.replace(/_/g, " ");
  return custom ? `${base} "${custom}"` : base;
}

export function countErrors(issues: ValidationIssue[]) {
  return issues.filter((i) => i.level === "error").length;
}
