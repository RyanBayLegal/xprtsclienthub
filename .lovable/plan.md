
# Kanban Board, Notifications, Engagement Agreements & Role Assignment

## 1. Assign team_admin Role
Insert the `team_admin` role for user `ryan@baylegal.com` (already signed up) via a database migration so you get full access immediately.

## 2. Update Lead Stages
Replace the current stages ("New", "Contacted", "In Progress", "Booked", "Proposal", "Signed", "Lost") with the Kanban stages from your image:
- **Prospecting Stage**
- **Discovery Stage**
- **Solution Mapping Stage**
- **Proposal/Contract Stage**
- **Onboarding/Kickoff Stage**

Existing leads with old stage values will be migrated to "Prospecting Stage" as a default.

## 3. Kanban Board View
Create a new `src/pages/LeadsKanban.tsx` page with:
- 5 columns matching the stages above, each with a header and lead count
- Lead cards showing name, contact, source, and next steps
- **Drag-and-drop** between columns using native HTML5 drag events (no extra library needed)
- Dropping a card into a new column updates the stage in the database
- Toggle between **Table view** and **Kanban view** on the Leads page via tabs
- Clicking a card opens the lead detail / client profile

## 4. Engagement Agreement System
New database table `engagement_agreements`:
- `id`, `lead_id`, `client_profile_id`, `sent_by`, `sent_at`, `status` (draft/sent/viewed/signed), `agreement_url`, `notes`

Features:
- "Send Engagement Agreement" button on the Client Profile page
- Dialog to compose/attach agreement details and send
- Track agreement status (draft, sent, viewed, signed)
- Agreement history visible on the client profile

## 5. Notifications System
New database table `notifications`:
- `id`, `user_id`, `type` (stage_change, follow_up_due, agreement_sent, agreement_signed), `title`, `message`, `read`, `lead_id`, `created_at`

New edge function `send-notification`:
- Creates notification records when triggered
- Sends email via Lovable Cloud's built-in email (password reset endpoint repurposed) or logs for future SMTP integration

Notification triggers (handled in the frontend when actions occur):
- **Stage change**: When a lead is moved to a new stage (via Kanban drag or manual edit)
- **Follow-up due**: Checked on dashboard load -- any leads with `follow_up_date <= today`
- **Engagement agreement sent/signed**: When agreement status changes

UI:
- Bell icon in the header with unread count badge
- Dropdown showing recent notifications
- Mark as read functionality

## 6. Sidebar & Routing Updates
- Add "Kanban" link to the sidebar navigation
- Add route for `/leads/kanban`
- Add notification bell to the app header

---

## Technical Details

### Database Migration
```sql
-- Assign team_admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('d64e380a-7654-44a8-ade7-4ab4b62ecfc7', 'team_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Engagement agreements table
CREATE TABLE public.engagement_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client_profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  sent_by uuid,
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  agreement_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.engagement_agreements ENABLE ROW LEVEL SECURITY;

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  read boolean NOT NULL DEFAULT false,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Migrate old stages to new ones
UPDATE public.leads SET stage = 'Prospecting Stage'
WHERE stage NOT IN (
  'Prospecting Stage','Discovery Stage',
  'Solution Mapping Stage','Proposal/Contract Stage',
  'Onboarding/Kickoff Stage'
);
```

### RLS Policies
- `engagement_agreements`: Team can full CRUD; clients can view their own
- `notifications`: Users can view/update their own notifications; team can insert for any user

### Files to Create
- `src/pages/LeadsKanban.tsx` -- Kanban board component with drag-and-drop
- `src/components/NotificationBell.tsx` -- Header notification dropdown
- `supabase/functions/send-notification/index.ts` -- Edge function for creating notifications

### Files to Modify
- `src/pages/Leads.tsx` -- Add tab toggle for Table/Kanban views, update stage constants
- `src/pages/ClientProfile.tsx` -- Add "Send Engagement Agreement" section, update stages
- `src/components/AppSidebar.tsx` -- Add Kanban nav item
- `src/components/AppLayout.tsx` -- Add NotificationBell to header
- `src/App.tsx` -- Add Kanban route
- `supabase/config.toml` -- Register new edge function
