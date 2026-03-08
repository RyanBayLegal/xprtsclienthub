import { supabase } from "@/integrations/supabase/client";

interface WorkflowAutomation {
  id: string;
  name: string;
  trigger_stage: string;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
}

export async function executeWorkflows(
  leadId: string,
  leadName: string,
  newStage: string,
  userId: string
) {
  const { data: automations } = await supabase
    .from("workflow_automations")
    .select("*")
    .eq("trigger_stage", newStage)
    .eq("is_active", true);

  if (!automations || automations.length === 0) return;

  const results: string[] = [];

  for (const auto of automations as WorkflowAutomation[]) {
    try {
      switch (auto.action_type) {
        case "create_task": {
          const cfg = auto.action_config;
          const dueDate = cfg.due_in_days
            ? new Date(Date.now() + cfg.due_in_days * 86400000).toISOString().split("T")[0]
            : null;

          await supabase.from("tasks").insert({
            title: (cfg.title || "Follow up").replace("{{lead_name}}", leadName),
            description: (cfg.description || "").replace("{{lead_name}}", leadName),
            priority: cfg.priority || "medium",
            assigned_to: cfg.assigned_to || null,
            assigned_to_name: cfg.assigned_to_name || null,
            due_date: dueDate,
            lead_id: leadId,
            created_by: userId,
            status: "todo",
          });
          results.push(`Task "${cfg.title || "Follow up"}" created`);
          break;
        }

        case "send_notification": {
          const cfg = auto.action_config;
          if (cfg.notify_all_admins) {
            const { data: admins } = await supabase
              .from("user_roles")
              .select("user_id")
              .eq("role", "team_admin");
            if (admins) {
              for (const admin of admins) {
                await supabase.from("notifications").insert({
                  user_id: admin.user_id,
                  type: "workflow",
                  title: (cfg.title || "Workflow triggered").replace("{{lead_name}}", leadName),
                  message: (cfg.message || "").replace("{{lead_name}}", leadName),
                  lead_id: leadId,
                });
              }
            }
          } else if (cfg.user_id) {
            await supabase.from("notifications").insert({
              user_id: cfg.user_id,
              type: "workflow",
              title: (cfg.title || "Workflow triggered").replace("{{lead_name}}", leadName),
              message: (cfg.message || "").replace("{{lead_name}}", leadName),
              lead_id: leadId,
            });
          }
          results.push(`Notification sent`);
          break;
        }

        case "convert_to_client": {
          const { data: existing } = await supabase
            .from("client_profiles")
            .select("id")
            .eq("lead_id", leadId)
            .maybeSingle();

          if (!existing) {
            const cfg = auto.action_config;
            await supabase.from("client_profiles").insert({
              name: leadName,
              lead_id: leadId,
              stage: cfg.default_stage || "Prospect",
              created_by: userId,
            });
            results.push(`Converted "${leadName}" to client`);
          } else {
            results.push(`Client profile already exists`);
          }
          break;
        }
      }
    } catch (err) {
      console.error(`Workflow "${auto.name}" failed:`, err);
    }
  }

  return results;
}
