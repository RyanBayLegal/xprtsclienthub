import { Mail, ListTodo, Bell, UserCheck, GitBranch, Zap, type LucideIcon } from "lucide-react";

export type NodeKind =
  | "trigger"
  | "send_email"
  | "create_task"
  | "send_notification"
  | "convert_to_client"
  | "condition";

export const NODE_CATALOG: Record<NodeKind, { label: string; icon: LucideIcon; accent: string }> = {
  trigger: { label: "Trigger", icon: Zap, accent: "text-primary" },
  send_email: { label: "Send Email", icon: Mail, accent: "text-blue-500" },
  create_task: { label: "Assign Task", icon: ListTodo, accent: "text-emerald-500" },
  send_notification: { label: "Internal Notification", icon: Bell, accent: "text-amber-500" },
  convert_to_client: { label: "Convert to Client", icon: UserCheck, accent: "text-violet-500" },
  condition: { label: "Condition", icon: GitBranch, accent: "text-muted-foreground" },
};

export const ADDABLE_KINDS: NodeKind[] = [
  "send_email",
  "create_task",
  "send_notification",
  "condition",
  "convert_to_client",
];

export const TRIGGER_TYPES = [
  { value: "lead_created", label: "New lead from web form" },
  { value: "lead_stage_change", label: "Lead stage changed" },
  { value: "client_stage_change", label: "Client stage changed" },
  { value: "task_event", label: "Task event" },
  { value: "email_received", label: "Email received (inbound)" },
];

export const LEAD_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
  "Hired Stage",
  "For Nurture",
  "Lost Stage",
];

export const CLIENT_STAGES = [
  "Prospect",
  "Qualified",
  "Active",
  "Signed",
  "Onboarding/Kickoff Stage",
  "Inactive",
];

export const TASK_EVENTS = [
  { value: "created", label: "Task created" },
  { value: "assigned", label: "Task assigned" },
  { value: "completed", label: "Task completed" },
  { value: "overdue", label: "Task overdue" },
];

export const CONTEXT_TOKENS: Record<string, string[]> = {
  lead_created: ["name", "email", "contact", "source", "needs", "notes"],
  lead_stage_change: ["name", "email", "contact", "stage", "previous_stage", "source"],
  client_stage_change: ["name", "email", "stage", "previous_stage", "company"],
  task_event: ["title", "description", "priority", "due_date", "assignee_name", "email", "event"],
  email_received: ["from_email", "from_name", "subject", "body", "to_email"],
};