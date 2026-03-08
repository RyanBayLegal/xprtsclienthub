

## Plan: Notify Assigned Staff on Task Creation

### Problem
Currently, when a task is created, the notification is sent to the **creator's own** `user_id` (line 331: `user_id: user.id`), not to the assigned staff member. The assigned person never sees it on their dashboard.

### Changes

**1. `src/pages/Tasks.tsx` — `handleCreate` function (around lines 330-337)**
- Change the notification insert to target the **assigned staff member** (`form.assigned_to`) instead of the creator (`user.id`)
- Include richer details in the message: task title, due date, creator name, and client name
- Fetch the creator's profile name to include "Created by: X"

**2. `src/pages/Tasks.tsx` — `handleEdit` function (around lines 394-408)**
- When `assigned_to` changes on edit, also insert a notification for the newly assigned staff member with the same rich details

**3. `src/components/ClientTasks.tsx` — `createTask` function (around lines 101-112)**
- Same fix: send the notification to `form.assigned_to` (the assignee) instead of `user.id` (the creator)
- Include due date, creator name, and client name in the message

### Notification Message Format
```
"Task Title" — Client: ClientName | Due: 2026-03-05 | Created by: AdminName
```

### What Already Works
- The `notifications` table and `NotificationBell` component already display notifications per user
- Staff and Client dashboards already query tasks by `assigned_to`
- RLS on `notifications` allows team_admin to INSERT and users to SELECT/UPDATE their own

### No Database Changes Needed
The existing `notifications` table schema already supports all required fields.

