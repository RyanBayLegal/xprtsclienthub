import { supabase } from "@/integrations/supabase/client";

interface WorkflowAutomation {
  id: string;
  name: string;
  trigger_stage: string;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
}

async function logExecution(
  auto: WorkflowAutomation,
  leadId: string,
  leadName: string,
  userId: string,
  result: string,
  status: "success" | "error"
) {
  try {
    await (supabase.from("workflow_automation_logs" as any).insert({
      automation_id: auto.id,
      automation_name: auto.name,
      trigger_stage: auto.trigger_stage,
      action_type: auto.action_type,
      lead_id: leadId,
      lead_name: leadName,
      result,
      status,
      executed_by: userId,
    }) as any);
  } catch (e) {
    console.error("Failed to log workflow execution:", e);
  }
}

export async function executeWorkflows(
  leadId: string,
  leadName: string,
  newStage: string,
  userId: string
) {
  const { data: automations } = await (supabase
    .from("workflow_automations" as any)
    .select("*")
    .eq("trigger_stage", newStage)
    .eq("is_active", true) as any);

  if (!automations || automations.length === 0) return;

  const results: string[] = [];

  for (const auto of automations as WorkflowAutomation[]) {
    try {
      let resultMsg = "";
      switch (auto.action_type) {
        case "create_task": {
          const cfg = auto.action_config;
          let taskTitle = cfg.title || "Follow up";
          let taskDesc = cfg.description || "";
          let taskPriority = cfg.priority || "medium";
          let taskAssignedTo = cfg.assigned_to || null;
          let taskAssignedToName = cfg.assigned_to_name || null;

          // If existing_task_id is set, clone from that task
          if (cfg.existing_task_id) {
            const { data: srcTask } = await supabase
              .from("tasks")
              .select("title, description, priority, assigned_to, assigned_to_name")
              .eq("id", cfg.existing_task_id)
              .maybeSingle();
            if (srcTask) {
              taskTitle = srcTask.title;
              taskDesc = srcTask.description || "";
              taskPriority = srcTask.priority;
              taskAssignedTo = srcTask.assigned_to;
              taskAssignedToName = srcTask.assigned_to_name;
            }
          }

          const dueDate = cfg.due_in_days
            ? new Date(Date.now() + cfg.due_in_days * 86400000).toISOString().split("T")[0]
            : null;

          await supabase.from("tasks").insert({
            title: taskTitle.replace("{{lead_name}}", leadName),
            description: taskDesc.replace("{{lead_name}}", leadName),
            priority: taskPriority,
            assigned_to: taskAssignedTo,
            assigned_to_name: taskAssignedToName,
            due_date: dueDate,
            lead_id: leadId,
            created_by: userId,
            status: "todo",
          });
          resultMsg = `Task "${taskTitle}" created`;
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
          resultMsg = "Notification sent";
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
            resultMsg = `Converted "${leadName}" to client`;
          } else {
            resultMsg = "Client profile already exists";
          }
          break;
        }
      }

      results.push(resultMsg);
      await logExecution(auto, leadId, leadName, userId, resultMsg, "success");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Workflow "${auto.name}" failed:`, err);
      results.push(`Failed: ${auto.name}`);
      await logExecution(auto, leadId, leadName, userId, errMsg, "error");
    }
  }

  return results;
}
