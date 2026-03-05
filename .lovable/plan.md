

## Plan: Add Internal Team "Links" Page

### Overview
Create a standalone "Links" page accessible from the sidebar for team admins only. This is an internal resource board where the team can save and organize clickable links to external files, tools, or resources.

### Database Changes
Create a new `team_links` table:
- `id` (uuid, PK, default gen_random_uuid())
- `title` (text, not null) — display name
- `url` (text, not null) — the link URL
- `created_by` (uuid) — who added it
- `created_by_name` (text) — cached creator name
- `created_at` (timestamptz, default now())

RLS: Team admins only (ALL policy using `has_role`).

### Code Changes

**1. New page `src/pages/Links.tsx`**
- Form at top: title + URL inputs, "Add Link" button
- List of links below, each showing title as a clickable anchor (`target="_blank"`), URL preview, who added it, when, and a delete button
- Fetches from `team_links` table ordered by `created_at` desc

**2. `src/App.tsx`** — Add route `/links` wrapped in `ProtectedRoute` + `TeamRoute`

**3. `src/components/AppSidebar.tsx`** — Add "Links" nav item for `team_admin` role (using `Link2` icon from lucide-react)

