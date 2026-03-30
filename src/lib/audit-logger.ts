import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  userId: string;
  userName?: string;
  entityType: string;
  entityId: string;
  clientProfileId?: string | null;
  action: "create" | "update" | "delete";
  fieldName?: string;
  oldValue?: string | null;
  newValue?: string | null;
  description?: string;
}

export async function logAudit(entry: AuditLogEntry) {
  try {
    await supabase.from("audit_logs" as any).insert({
      user_id: entry.userId,
      user_name: entry.userName || null,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      client_profile_id: entry.clientProfileId || null,
      action: entry.action,
      field_name: entry.fieldName || null,
      old_value: entry.oldValue ?? null,
      new_value: entry.newValue ?? null,
      description: entry.description || null,
    } as any);
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

export async function logFieldChanges(
  userId: string,
  userName: string,
  entityType: string,
  entityId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  clientProfileId?: string | null,
  fieldLabels?: Record<string, string>
) {
  const changes: AuditLogEntry[] = [];
  for (const key of Object.keys(newData)) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({
        userId,
        userName,
        entityType,
        entityId,
        clientProfileId,
        action: "update",
        fieldName: fieldLabels?.[key] || key,
        oldValue: oldVal != null ? String(oldVal) : null,
        newValue: newVal != null ? String(newVal) : null,
        description: `Changed ${fieldLabels?.[key] || key}`,
      });
    }
  }
  if (changes.length > 0) {
    await Promise.all(changes.map(logAudit));
  }
  return changes.length;
}

export async function getUserName(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.full_name || "Unknown";
}
