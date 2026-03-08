

## Plan: Edit Automations, Time Planner Tab, and Pre-existing Task Selection

### 1. Edit Existing Automation Rules

**File: `src/components/WorkflowAutomations.tsx`**
- Add an edit button (Pencil icon) next to each automation card's delete button
- Track an `editingId` state; when set, the dialog opens in "edit" mode pre-populated with that automation's data
- Change the dialog title dynamically: "New Automation Rule" vs "Edit Automation Rule"
- Change the submit button: "Create Automation" vs "Update Automation"
- Add a `handleUpdate` function that calls `.update()` on `workflow_automations` by ID
- Reuse the same form state (`form`) for both create and edit flows

### 2. Pre-existing Task Selection in Automation

**File: `src/components/WorkflowAutomations.tsx`**
- In the `create_task` config section, add a toggle/radio: "Create new task" vs "Use existing task template"
- When "Use existing task" is selected, fetch existing tasks from the `tasks` table and show a searchable dropdown
- Store `existing_task_id` in `action_config` when a pre-existing task is chosen
- Pre-fill title/description/priority/assignee from the selected task

**File: `src/lib/workflow-engine.ts`**
- In the `create_task` case, check if `action_config.existing_task_id` is set
- If so, fetch that task's details and clone them (with lead_id injected) instead of using the config fields

### 3. Global Time Planner Tab

This requires porting the entire schedule system from the other project. Since it uses its own Supabase tables (`schedules`, `schedule_blocks`, `clients` for scheduling, `time_off_requests`, `profiles` with `display_name`/`is_active`/`email`), we need:

**Database migration** — Create these new tables:
- `staff_schedules` (id, user_id, name, base_timezone, display_timezones jsonb, hour_start int default 7, hour_end int default 20, created_at)
- `schedule_blocks` (id, schedule_id FK, user_id, client_id nullable, block_date date, day_of_week int, start_hour numeric, end_hour numeric, label text, created_at)
- `schedule_clients` (id, user_id, name, color, timezone, created_at) — scheduling-specific clients (color-coded entries for the grid)
- `time_off_requests` (id, user_id, block_date date, start_hour int, end_hour int, reason text, status text default 'pending', reviewed_by uuid, reviewed_at timestamptz, created_at)

RLS: team_admin can manage all; staff_member can read own schedule, insert own time-off requests.

**New files to create:**
- `src/lib/timezones.ts` — Port timezone utilities and constants
- `src/hooks/useScheduleData.ts` — Port `useSchedule`, `useClients` (renamed to avoid conflict), `useBlocks`, `useTimeOffRequests` hooks, adapted to use this project's auth
- `src/components/ScheduleGrid.tsx` — Port the grid component as-is
- `src/components/StaffMultiSelect.tsx` — Port the multi-select filter
- `src/components/TimeOffAdmin.tsx` — Port admin approval UI
- `src/components/TimeOffRequestForm.tsx` — Port staff request form
- `src/components/ScheduleClients.tsx` — Port the schedule client management (colors/timezones)
- `src/pages/TimePlanner.tsx` — New page combining all schedule components (adapted from Index.tsx, removing its own nav/auth since AppLayout handles that)

**Routing & navigation:**
- `src/App.tsx` — Add `/time-planner` route wrapped in `ProtectedRoute` + `TeamRoute`
- `src/components/AppSidebar.tsx` — Add "Time Planner" nav item with `Clock` icon for team_admin and staff_member roles

**CSS:**
- `src/index.css` — Add the `.schedule-grid` component styles and CSS custom properties for grid theming

### Technical Notes
- The Time Planner's `useAuth` hook will be replaced with imports from `@/lib/auth` (this project's auth system)
- The Time Planner's `profiles` table references `display_name` and `is_active` columns which don't exist in this project's profiles table. We'll use `full_name` instead and skip `is_active` (all staff shown)
- Schedule clients are separate from CRM client_profiles — they represent color-coded time blocks
- The Time Planner project uses edge functions (`create-user`, `manage-user`) for staff management which we won't port since this project has its own staff management

