import { supabase } from "@/integrations/supabase/client";

export type AutomationTrigger =
  | "lead_stage_change"
  | "lead_created"
  | "client_stage_change"
  | "task_event"
  | "email_received";

/**
 * Fires any active automations matching the given trigger.
 * Failures are swallowed so automations never block the user's action.
 */
export async function triggerAutomation(
  trigger_type: AutomationTrigger,
  context: Record<string, unknown>,
) {
  try {
    const { data, error } = await supabase.functions.invoke("run-automation", {
      body: { trigger_type, context },
    });
    if (error) {
      console.error("Automation dispatch failed:", error);
      return [];
    }
    return (data as { results?: unknown[] })?.results ?? [];
  } catch (e) {
    console.error("Automation dispatch failed:", e);
    return [];
  }
}