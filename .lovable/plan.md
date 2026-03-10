

## Payment Tracking Tab for Client Profiles

### What We're Building
A new "Payments" tab on the Client Profile page (visible for team admins on non-new profiles) to track invoices per client. Each invoice record includes: invoice number, month/period, sent date, due date, paid date, amount, and status.

### Database Changes

**New `client_invoices` table:**

| Column | Type | Default |
|--------|------|---------|
| id | uuid | gen_random_uuid() |
| client_profile_id | uuid | FK required |
| invoice_number | text | required |
| amount | numeric | nullable |
| for_month | text | nullable (e.g. "March 2026") |
| status | text | 'sent' |
| sent_at | timestamptz | now() |
| due_date | date | nullable |
| paid_at | timestamptz | nullable |
| notes | text | nullable |
| created_by | uuid | nullable |
| created_at | timestamptz | now() |

**RLS Policies:**
- Team admins: full CRUD
- Clients: can view own invoices (via client_profile_id lookup)

### UI Changes

**New `ClientPayments` component** (`src/components/ClientPayments.tsx`):
- Table listing all invoices for the client, sorted newest first
- "Add Invoice" button opens a dialog with fields: invoice number, amount, for month, due date, notes
- Status column with dropdown to update: sent, due, paid, overdue, cancelled
- When marked "paid", auto-sets `paid_at` timestamp
- Badge color coding: sent (secondary), due (outline), paid (green/default), overdue (destructive)

**ClientProfile.tsx updates:**
- Import `ClientPayments`
- Add a "Payments" tab trigger (team-only, non-new profiles)
- Add corresponding `TabsContent`

### File Changes
1. **Migration** — create `client_invoices` table with RLS
2. **New file**: `src/components/ClientPayments.tsx` — invoice list + add/edit UI
3. **Edit**: `src/pages/ClientProfile.tsx` — add Payments tab

