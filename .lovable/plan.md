

## Plan: Pipeline Ageing, Client Notes, Vendors Tab, Kanban Pagination, Staff Dropdown in Tasks, and Task Assignment Email

This plan covers six features across database changes, new pages/components, and UI updates.

---

### 1. Database Migrations

Three new tables and one column addition are needed:

**a. `client_notes` table** — timestamped notes on client profiles
```sql
CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
-- Team admin full access
CREATE POLICY "Team can manage client_notes" ON public.client_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));
-- Clients can view notes on their own profile
CREATE POLICY "Clients can view own notes" ON public.client_notes FOR SELECT TO authenticated
  USING (client_profile_id IN (SELECT id FROM client_profiles WHERE user_id = auth.uid()));
```

**b. `vendors` table** — new CRM tab
```sql
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subscribed_date date,
  subscribed_by text,
  fee text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team can manage vendors" ON public.vendors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'team_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'team_admin'::app_role));
-- Staff can view vendors
CREATE POLICY "Staff can view vendors" ON public.vendors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'staff_member'::app_role));
```

---

### 2. Pipeline Ageing (Leads Table + Kanban)

- In the **Leads table view**, add a "Stage Age" column showing how long each lead has been in its current stage, calculated from `stage_changed_at` using `formatDistanceToNow`.
- In the **Kanban board**, display the stage age on each lead card (e.g., "In stage 5 days").
- Color-code: green < 7 days, amber 7-14 days, red > 14 days.

**Files modified:** `src/pages/Leads.tsx`, `src/pages/LeadsKanban.tsx`

---

### 3. Notes Section in Client Profile

- Add a new **"Notes"** tab in `ClientProfile.tsx` (visible to team admins).
- Displays a list of notes with timestamp, author name, and content.
- A textarea + "Add Note" button at the top to create new notes.
- Fetches from `client_notes` table, inserts with `created_by` = current user ID and `created_by_name` fetched from profiles.

**Files modified:** `src/pages/ClientProfile.tsx`

---

### 4. Vendors Tab

- Create a new page `src/pages/Vendors.tsx` with a table: Vendor Name, Description, Subscribed Date, Subscribed By, Fee.
- Include Add/Edit/Delete dialogs (admin only).
- Add pagination (15 per page).
- Add route in `src/App.tsx` under TeamRoute: `/vendors`.
- Add sidebar nav item in `src/components/AppSidebar.tsx` for `team_admin` and `staff_member` roles.

**Files created:** `src/pages/Vendors.tsx`
**Files modified:** `src/App.tsx`, `src/components/AppSidebar.tsx`

---

### 5. Kanban Pagination

- Add pagination to the Kanban board in `LeadsKanban.tsx`.
- Each stage column will show up to 10 leads at a time, with a "Show more" / "Show less" toggle or a small page control per column.

**Files modified:** `src/pages/LeadsKanban.tsx`

---

### 6. Staff Dropdown in Task "Assign To" Field

The task form already has a staff dropdown fetching from `user_roles` + `profiles`. This is already implemented in `Tasks.tsx` (lines 294-310, 462-473). No changes needed here — it already works.

---

### 7. Auto-Send Email on Task Assignment

- Create a new edge function `supabase/functions/send-task-assignment/index.ts` that:
  - Receives `{ assignee_email, assignee_name, task_title, task_description, due_date }`.
  - Logs the email content to console (ready for SMTP integration later, since no RESEND_API_KEY is configured).
- In `Tasks.tsx`, after a task is created or edited with an `assigned_to` value, call `supabase.functions.invoke("send-task-assignment", ...)` with the staff member's email (fetched from `auth` via profiles or passed from the form).
- Since there is no Resend API key configured, the edge function will log the email. The user will be informed they need to set up Resend for actual email delivery.

**Files created:** `supabase/functions/send-task-assignment/index.ts`
**Files modified:** `src/pages/Tasks.tsx`

---

### Summary of All Changes

| Area | Files | Type |
|------|-------|------|
| Database | Migration SQL | 2 new tables (`client_notes`, `vendors`) |
| Pipeline Ageing | `Leads.tsx`, `LeadsKanban.tsx` | Stage age column + color coding |
| Client Notes | `ClientProfile.tsx` | New "Notes" tab |
| Vendors | `Vendors.tsx` (new), `App.tsx`, `AppSidebar.tsx` | New page + routing + nav |
| Kanban Pagination | `LeadsKanban.tsx` | Per-column pagination |
| Task Assignment Email | `send-task-assignment/index.ts` (new), `Tasks.tsx` | Edge function + invoke on assign |

