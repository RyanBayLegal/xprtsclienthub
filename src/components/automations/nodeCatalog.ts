import { Mail, ListTodo, Bell, UserCheck, GitBranch, Zap, MailCheck, type LucideIcon } from "lucide-react";

export type NodeKind =
  | "trigger"
  | "send_email"
  | "create_task"
  | "send_notification"
  | "convert_to_client"
  | "condition"
  | "wait_for_reply";

export const NODE_CATALOG: Record<NodeKind, { label: string; icon: LucideIcon; accent: string }> = {
  trigger: { label: "Trigger", icon: Zap, accent: "text-primary" },
  send_email: { label: "Send Email", icon: Mail, accent: "text-blue-500" },
  create_task: { label: "Assign Task", icon: ListTodo, accent: "text-emerald-500" },
  send_notification: { label: "Internal Notification", icon: Bell, accent: "text-amber-500" },
  convert_to_client: { label: "Convert to Client", icon: UserCheck, accent: "text-violet-500" },
  condition: { label: "Condition", icon: GitBranch, accent: "text-muted-foreground" },
  wait_for_reply: { label: "If Client Replies", icon: MailCheck, accent: "text-sky-500" },
};

export const ADDABLE_KINDS: NodeKind[] = [
  "trigger",
  "send_email",
  "create_task",
  "send_notification",
  "condition",
  "wait_for_reply",
  "convert_to_client",
];

export const TRIGGER_TYPES = [
  { value: "lead_created", label: "New lead from web form" },
  { value: "lead_created_manual", label: "New lead created/added manually" },
  { value: "lead_merged", label: "Two leads merged" },
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
  lead_created_manual: [
    "name", "email", "phone", "contact", "source", "referrer_name", "website",
    "date_reached", "follow_up_date", "follow_up_email_after", "follow_up_email_sent",
    "booked", "email_sent_with_info", "next_steps", "needs", "notes", "stage",
    "stage_reason", "stage_changed_at", "lead_id", "id", "created_by",
    "created_at", "updated_at",
  ],
  lead_merged: [
    "name", "email", "contact", "source", "stage", "needs", "notes", "next_steps",
    "lead_id", "primary_lead_id", "primary_lead_name",
    "secondary_lead_id", "secondary_lead_name",
    "merged_lead_id", "merged_lead_name", "merged_fields", "merged_field_count",
    "merged_field_sources", "merge_source_ids", "merged_at",
  ],
  lead_stage_change: ["name", "email", "contact", "stage", "previous_stage", "source"],
  client_stage_change: ["name", "email", "stage", "previous_stage", "company"],
  task_event: ["title", "description", "priority", "due_date", "assignee_name", "email", "event"],
  email_received: ["from_email", "from_name", "subject", "body", "to_email"],
};

/** Sample payload used by the token preview panel and the simulation dialog. */
export function sampleContext(triggerType: string): Record<string, unknown> {
  switch (triggerType) {
    case "email_received":
      return {
        from_email: "jane@lawfirm.com", from_name: "Jane Doe", to_email: "ryan@xprts.com",
        subject: "Invoice #1042 question", body: "Hi, following up about invoice #1042.",
        email: "jane@lawfirm.com", name: "Jane Doe",
      };
    case "task_event":
      return {
        title: "Follow up with lead", description: "Call back", priority: "high",
        due_date: "2026-01-01", assignee_name: "Ryan", email: "ryan@xprts.com", event: "created",
      };
    case "client_stage_change":
      return { name: "Acme Legal", email: "ops@acme.com", company: "Acme Legal", stage: "Active", previous_stage: "Qualified" };
    case "lead_stage_change":
      return { name: "Jane Doe", email: "jane@lawfirm.com", contact: "jane@lawfirm.com", source: "Strategy Review", stage: "Discovery Stage", previous_stage: "Prospecting Stage" };
    case "lead_created_manual":
      return {
        id: "00000000-0000-0000-0000-000000000001",
        lead_id: "00000000-0000-0000-0000-000000000001",
        name: "Jane Doe", email: "jane@lawfirm.com", phone: "+1 555 0100",
        contact: "jane@lawfirm.com | +1 555 0100", source: "Referral from Client",
        referrer_name: "Acme Legal", website: "https://lawfirm.com",
        date_reached: "2026-01-05", follow_up_date: "2026-01-12", follow_up_email_after: "2026-01-19",
        follow_up_email_sent: false, booked: false, email_sent_with_info: false,
        next_steps: "Book discovery call", needs: "Needs a VA", notes: "Added by staff",
        stage: "Prospecting Stage", stage_reason: null, stage_changed_at: new Date().toISOString(),
        created_by: "00000000-0000-0000-0000-0000000000aa",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
    case "lead_merged":
      return {
        name: "Jane Doe", email: "jane@lawfirm.com", contact: "jane@lawfirm.com",
        source: "Referral from Client", stage: "Discovery Stage",
        needs: "Needs a VA", notes: "Primary lead notes",
        lead_id: "00000000-0000-0000-0000-000000000001",
        primary_lead_id: "00000000-0000-0000-0000-000000000001",
        primary_lead_name: "Jane Doe",
        secondary_lead_id: "00000000-0000-0000-0000-000000000002",
        secondary_lead_name: "J. Doe (duplicate)",
        merged_lead_id: "00000000-0000-0000-0000-000000000002",
        merged_lead_name: "J. Doe (duplicate)",
        merged_fields: "needs, notes, website",
        merged_field_count: 3,
        merged_field_sources: "needs ← J. Doe (duplicate); notes ← J. Doe (duplicate); website ← J. Doe (duplicate)",
        merge_source_ids: "00000000-0000-0000-0000-000000000001, 00000000-0000-0000-0000-000000000002",
        merged_at: new Date().toISOString(),
      };
    default:
      return { name: "Jane Doe", email: "jane@lawfirm.com", contact: "jane@lawfirm.com", source: "Strategy Review - xprts.com", needs: "Needs a VA", notes: "Submitted from web form" };
  }
}