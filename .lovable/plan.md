

## Plan: Pipeline Workflow Automation

### Overview
Create an automation system where admins define rules like "When a lead enters stage X, do Y." Actions fire automatically when leads move between pipeline stages (via Kanban drag-and-drop or table edit).

### Database Changes

**New table: `workflow_automations`**
- `id` (uuid, PK)
- `name` (text, not null) — rule label
- `trigger_stage` (text, not null) — the pipeline stage that triggers this
- `action_type` (text, not null) — one of: `create_task`, `send_notification`, `convert_to_client`
- `action_config` (jsonb, default `{}`) — action-specific config (task title, priority, assignee, notification message, etc.)
- `is_active` (boolean, default true)
- `created_by` (uuid)
- `created_at` (timestamptz, default now())

RLS: team_admin only (ALL).

### Action Types

| Action | `action_config` shape |
|---|---|
| `create_task` | `{ title, description, priority, assigned_to, assigned_to_name, due_in_days }` |
| `send_notification` | `{ user_id, title, message }` (or `notify_all_admins: true`) |
| `convert_to_client` | `{ default_stage }` — auto-converts lead to client profile |

### Code Changes

**1. New component `src/components/WorkflowAutomations.tsx`**
- Management UI accessible from the Leads page (new tab or settings section)
- Form to create/edit rules: pick trigger stage, action type, configure action details
- List of existing rules with active/inactive toggle and delete
- Staff member dropdown for task assignment (reuse existing pattern)

**2. New utility `src/lib/workflow-engine.ts`**
- `executeWorkflows(leadId, newStage, userId)` — queries active automations matching `trigger_stage === newStage`, then executes each action:
  - `create_task`: inserts into `tasks` table with lead_id and config
  - `send_notification`: inserts into `notifications` table
  - `convert_to_client`: inserts into `client_profiles` (checks if already converted)

**3. `src/pages/LeadsKanban.tsx` — `handleDrop`**
- After successful stage update, call `executeWorkflows(lead.id, newStage, user.id)`

**4. `src/pages/Leads.tsx` — stage update handler**
- Same integration: call `executeWorkflows` after lead stage is changed via table edit

**5. `src/pages/Leads.tsx` — Add "Automations" tab/button**
- Add a button or tab that opens a dialog/section with the `WorkflowAutomations` component

### No Edge Functions Needed
All logic runs client-side using existing Supabase client calls, keeping it simple and consistent with the current architecture.

