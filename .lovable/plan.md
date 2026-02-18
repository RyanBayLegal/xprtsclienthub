

# Follow-Up Notifications, Stage Timestamps, Funnel Analytics, and Scoping Questionnaire

## Overview

This plan adds four capabilities to XPRTS CRM:
1. **Automatic follow-up due notifications** on dashboard load
2. **Stage change timestamps** recorded on the leads table
3. **Funnel visualization** in Analytics showing conversion between pipeline stages
4. **Client Discovery & Scoping Questionnaire** -- a digital version of the uploaded Scoping Framework document, stored per client profile

---

## 1. Follow-Up Due Notifications

When the Dashboard loads, the app will check for any leads with `follow_up_date <= today`. For each overdue/due lead, it will automatically create a notification (if one hasn't already been created that day) so the bell icon shows an alert.

**Changes:**
- `src/pages/Dashboard.tsx` -- Add a `useEffect` that queries leads where `follow_up_date <= today`, then inserts notifications for each (deduplicating by checking existing notifications of type `follow_up_due` for the same lead created today).

---

## 2. Stage Change Timestamps

Add a `stage_changed_at` column to the `leads` table. Every time a lead's stage is updated (via Kanban drag-and-drop or manual edit), this timestamp is automatically set.

**Database migration:**
- Add `stage_changed_at timestamptz` column to `leads` (default `now()`)
- Create a trigger `set_stage_changed_at` that sets `stage_changed_at = now()` whenever `stage` changes on UPDATE

**UI changes:**
- `src/pages/LeadsKanban.tsx` -- Show `stage_changed_at` on lead cards as a small relative timestamp (e.g., "moved 2d ago")
- Lead table in `src/pages/Leads.tsx` -- Add a "Stage Changed" column

---

## 3. Funnel Analytics

Add a funnel chart to the Analytics page showing how many leads are in each stage in pipeline order (Prospecting -> Discovery -> Solution Mapping -> Proposal/Contract -> Onboarding/Kickoff), with stage-to-stage conversion percentages.

**Changes:**
- `src/pages/Analytics.tsx`:
  - Update `STAGE_COLORS` to use the new 5 stages
  - Add a funnel/horizontal bar chart showing leads per stage in pipeline order
  - Show conversion rates between consecutive stages (e.g., "Prospecting -> Discovery: 60%")
  - Update the existing conversion rate cards to reflect new stages (replace "Signed"/"Lost"/"Booked" with stage-based metrics like "Proposal Rate" and "Onboarding Rate")

---

## 4. Client Discovery & Scoping Questionnaire

Implement the full Scoping Framework from the uploaded document as a new tab on the Client Profile page. This stores all questionnaire data in a new `scoping_questionnaires` database table.

**Sections from the document:**
1. Firm Overview (name, practice area, jurisdiction, hours, size, contact, challenges, goals)
2. Roles Requested (role title, headcount, schedule, responsibilities, independence level)
3. Experience & Skill Requirements (level, languages, skills checklist, certifications)
4. Training & Onboarding (firm training, SOPs, onboarding contact)
5. Systems & Technology (case management, CRM, billing, phone, communication tools, security)
6. Performance Expectations (success metrics, reporting preferences, escalation process)
7. Communication & Oversight (point of contact, preferred method)
8. Compliance & Confidentiality (NDA, HIPAA/GDPR, ethical boundaries)
9. Flexibility & Growth (scaling needs, temp vs long-term, coverage)
10. Defining Success (30/60/90 day goals, top outcomes, concerns)

**Database migration:**
- Create `scoping_questionnaires` table with `id`, `client_profile_id` (FK), `section_data` (jsonb -- stores all sections as structured JSON), `created_by`, `created_at`, `updated_at`
- RLS: Team can full CRUD; clients can view their own

**UI changes:**
- `src/pages/ClientProfile.tsx` -- Add a "Scoping" tab with an accordion-based form covering all 10 sections
- Each section is collapsible and auto-saves when the user clicks Save

---

## Technical Details

### Database Migration SQL

```sql
-- Stage change timestamp
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz DEFAULT now();

-- Trigger to auto-update stage_changed_at
CREATE OR REPLACE FUNCTION public.set_stage_changed_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    NEW.stage_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stage_changed_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_stage_changed_at();

-- Scoping questionnaires table
CREATE TABLE public.scoping_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  section_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scoping_questionnaires ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Team can manage scoping_questionnaires"
  ON public.scoping_questionnaires FOR ALL
  USING (has_role(auth.uid(), 'team_admin'))
  WITH CHECK (has_role(auth.uid(), 'team_admin'));

CREATE POLICY "Clients can view own scoping questionnaire"
  ON public.scoping_questionnaires FOR SELECT
  USING (client_profile_id IN (
    SELECT id FROM public.client_profiles WHERE user_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER set_scoping_updated_at
  BEFORE UPDATE ON public.scoping_questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Add follow-up due notification check on load |
| `src/pages/LeadsKanban.tsx` | Display `stage_changed_at` timestamp on cards |
| `src/pages/Leads.tsx` | Add "Stage Changed" column to table view |
| `src/pages/Analytics.tsx` | Update stage colors, add funnel chart with conversion percentages between stages |
| `src/pages/ClientProfile.tsx` | Add "Scoping" tab with accordion form for all 10 questionnaire sections |

### Scoping Questionnaire Data Shape (jsonb)

```text
{
  "firm_overview": {
    "firm_name", "practice_areas", "jurisdiction",
    "business_hours", "attorney_count", "staff_count",
    "contact_name", "contact_email", "contact_title",
    "staffing_challenges", "outsourcing_goals"
  },
  "roles_requested": [{
    "role_title", "headcount", "full_or_part_time",
    "schedule", "timezone", "work_days", "time",
    "weekend_coverage", "primary_responsibilities",
    "weekly_responsibilities", "internal_tasks",
    "independence_level"
  }],
  "experience_skills": {
    "experience_level", "languages", "law_firm_experience",
    "practice_area_experience", "skills_checklist",
    "certifications"
  },
  "training_onboarding": {
    "firm_provides_training", "onboarding_contact",
    "start_date_skills", "has_sops", "share_sops",
    "ongoing_training"
  },
  "systems_technology": {
    "case_management", "crm_tools", "billing_systems",
    "phone_systems", "communication_tools",
    "time_tracking", "licenses_provided",
    "security_requirements"
  },
  "performance": {
    "success_metrics", "reporting_preference",
    "escalation_process"
  },
  "communication": {
    "primary_contact", "preferred_method"
  },
  "compliance": {
    "confidentiality", "nda_required", "regulatory",
    "ethical_boundaries", "conflict_screening"
  },
  "flexibility_growth": {
    "anticipated_changes", "scale_ability",
    "temp_vs_longterm", "coverage_expectations"
  },
  "defining_success": {
    "first_30_days", "first_60_days", "first_90_days",
    "top_outcomes", "concerns"
  }
}
```

