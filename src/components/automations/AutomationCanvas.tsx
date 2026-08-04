import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { validateAutomation, type ValidationIssue } from "@/lib/automation-validator";
import {
  ADDABLE_KINDS,
  CLIENT_STAGES,
  CONTEXT_TOKENS,
  LEAD_STAGES,
  NODE_CATALOG,
  TASK_EVENTS,
  TRIGGER_TYPES,
  type NodeKind,
} from "./nodeCatalog";

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface StaffOption {
  user_id: string;
  full_name: string | null;
}

function FlowNode({ id, data, selected }: NodeProps) {
  const kind = (data as { kind: NodeKind }).kind;
  const meta = NODE_CATALOG[kind] ?? NODE_CATALOG.condition;
  const Icon = meta.icon;
  const config = ((data as { config?: Record<string, unknown> }).config) || {};
  const onDelete = (data as { onDelete?: (id: string) => void }).onDelete;
  const hasError = (data as { hasError?: boolean }).hasError;
  const subtitle =
    kind === "trigger"
      ? TRIGGER_TYPES.find((t) => t.value === config.trigger_type)?.label ?? "Choose a trigger"
      : kind === "send_email"
        ? String(config.subject || "No subject yet")
        : kind === "create_task"
          ? String(config.title || "Untitled task")
          : kind === "condition"
            ? `${config.field || "field"} ${String(config.operator || "equals").replace("_", " ")} ${config.value ?? ""}`
            : String(config.title || meta.label);

  return (
    <div
      className={`group relative min-w-[210px] rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-colors ${
        selected ? "border-primary ring-1 ring-primary" : hasError ? "border-destructive ring-1 ring-destructive/50" : "border-border"
      }`}
    >
      {kind !== "trigger" && <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />}
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${meta.accent}`} />
        <span className="text-sm font-medium text-foreground">{meta.label}</span>
        <button
          type="button"
          aria-label="Delete step"
          className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete?.(id); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>
      {(Number(config.delay_seconds) > 0 || Number(config.retry_attempts) > 1 || Number(config.cooldown_minutes) > 0) && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {Number(config.delay_seconds) > 0 && `wait ${config.delay_seconds}s · `}
          {Number(config.retry_attempts) > 1 && `${config.retry_attempts} tries · `}
          {Number(config.cooldown_minutes) > 0 && `cooldown ${config.cooldown_minutes}m`}
        </p>
      )}
      {kind === "condition" ? (
        <>
          <span className="absolute -bottom-4 left-[22%] text-[9px] font-medium text-emerald-500">Yes</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id={`${id}-true`}
            style={{ left: "30%" }}
            className="!h-2 !w-2 !bg-emerald-500"
          />
          <span className="absolute -bottom-4 left-[68%] text-[9px] font-medium text-destructive">No</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id={`${id}-false`}
            style={{ left: "72%" }}
            className="!h-2 !w-2 !bg-destructive"
          />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-primary" id={`${id}-out`} />
      )}
    </div>
  );
}

const nodeTypes = { automationNode: FlowNode };

interface Props {
  graph: Graph;
  triggerType: string;
  onChange: (graph: Graph) => void;
  staff: StaffOption[];
  extraTokens?: string[];
  onValidate?: (issues: ValidationIssue[]) => void;
}

export default function AutomationCanvas({ graph, triggerType, onChange, staff, extraTokens = [], onValidate }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(graph.nodes as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(graph.edges as Edge[]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    onChange({ nodes, edges });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const addNode = (kind: NodeKind) => {
    if (kind === "trigger" && nodes.some((n) => (n.data as { kind?: NodeKind })?.kind === "trigger")) return;
    const id = `${kind}-${Date.now()}`;
    const y = 80 + nodes.length * 110;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "automationNode",
        position: { x: kind === "trigger" ? 60 : 420, y },
        data: { kind, config: kind === "trigger" ? { trigger_type: triggerType } : {} },
      } as Node,
    ]);
    setSelectedId(id);
  };

  const updateConfig = (patch: Record<string, unknown>) => {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, config: { ...((n.data as { config?: object }).config || {}), ...patch } } }
          : n,
      ),
    );
  };

  const removeNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [setNodes, setEdges],
  );

  const removeSelected = () => { if (selectedId) removeNode(selectedId); };

  const issues = useMemo(
    () => validateAutomation({ nodes, edges }, triggerType),
    [nodes, edges, triggerType],
  );

  useEffect(() => { onValidate?.(issues); }, [issues, onValidate]);

  const errorNodeIds = useMemo(
    () => new Set(issues.filter((i) => i.level === "error" && i.nodeId).map((i) => i.nodeId as string)),
    [issues],
  );

  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, onDelete: removeNode, hasError: errorNodeIds.has(n.id) } })),
    [nodes, removeNode, errorNodeIds],
  );

  const selected = useMemo(() => nodes.find((n) => n.id === selectedId), [nodes, selectedId]);
  const hasTrigger = nodes.some((n) => (n.data as { kind?: NodeKind })?.kind === "trigger");
  const kind = (selected?.data as { kind?: NodeKind })?.kind;
  const cfg = ((selected?.data as { config?: Record<string, unknown> })?.config || {}) as Record<string, string>;
  const tokens = useMemo(
    () => Array.from(new Set([...(CONTEXT_TOKENS[triggerType] || []), ...extraTokens])),
    [triggerType, extraTokens],
  );

  return (
    <div className="flex h-full min-h-[420px] gap-3">
      <div className="flex w-44 shrink-0 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
        <p className="px-1 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Steps</p>
        {ADDABLE_KINDS.map((k) => {
          const meta = NODE_CATALOG[k];
          const Icon = meta.icon;
          const disabled = k === "trigger" && hasTrigger;
          return (
            <Button key={k} variant="ghost" size="sm" className="justify-start" disabled={disabled} onClick={() => addNode(k)}>
              <Icon className={`mr-2 h-4 w-4 ${meta.accent}`} />
              <span className="truncate text-xs">{meta.label}</span>
              <Plus className="ml-auto h-3 w-3 opacity-50" />
            </Button>
          );
        })}
        {!hasTrigger && (
          <p className="px-1 pt-1 text-[10px] leading-tight text-muted-foreground">
            Add a Trigger step to start this automation.
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          deleteKeyCode={["Backspace", "Delete"]}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="max-h-36 shrink-0 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Validation passed — this automation is ready to save.
          </p>
        ) : (
          <ul className="space-y-1">
            {issues.map((iss, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`flex w-full items-start gap-2 rounded px-1 py-0.5 text-left text-xs hover:bg-muted ${
                    iss.level === "error" ? "text-destructive" : "text-amber-600"
                  }`}
                  onClick={() => iss.nodeId && setSelectedId(iss.nodeId)}
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{iss.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>

      <div className="w-80 shrink-0 overflow-y-auto rounded-lg border border-border bg-card p-3">
        {!selected && (
          <p className="text-sm text-muted-foreground">
            Select a step on the canvas to configure it, or add one from the left. Drag from a node's right dot to
            connect it to the next step.
          </p>
        )}

        {selected && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{NODE_CATALOG[kind!]?.label}</h4>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={removeSelected}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {kind === "trigger" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  The trigger is configured in the automation settings above the canvas.
                </p>
                {triggerType === "lead_stage_change" && (
                  <p className="text-xs text-muted-foreground">Runs when a lead moves into the selected stage.</p>
                )}
              </div>
            )}

            {kind === "send_email" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Send to</Label>
                  <Select value={cfg.to_mode || "contact"} onValueChange={(v) => updateConfig({ to_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contact">The lead / client / sender</SelectItem>
                      <SelectItem value="recipients">Lead notification recipients</SelectItem>
                      <SelectItem value="custom">Specific address</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {cfg.to_mode === "custom" && (
                  <div>
                    <Label className="text-xs">Email address</Label>
                    <Input value={cfg.to || ""} onChange={(e) => updateConfig({ to: e.target.value })} placeholder="team@xprts.com" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input value={cfg.subject || ""} onChange={(e) => updateConfig({ subject: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea rows={7} value={cfg.body || ""} onChange={(e) => updateConfig({ body: e.target.value })} />
                </div>
              </div>
            )}

            {kind === "create_task" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={cfg.title || ""} onChange={(e) => updateConfig({ title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea rows={4} value={cfg.description || ""} onChange={(e) => updateConfig({ description: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Assign to</Label>
                  <Select
                    value={cfg.assigned_to || "unassigned"}
                    onValueChange={(v) =>
                      updateConfig({
                        assigned_to: v === "unassigned" ? null : v,
                        assigned_to_name: staff.find((s) => s.user_id === v)?.full_name ?? null,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Select value={cfg.priority || "medium"} onValueChange={(v) => updateConfig({ priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Due in (days)</Label>
                    <Input type="number" min={0} value={cfg.due_in_days || ""} onChange={(e) => updateConfig({ due_in_days: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {kind === "send_notification" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Notify</Label>
                  <Select
                    value={cfg.user_id || "all_admins"}
                    onValueChange={(v) =>
                      updateConfig({ user_id: v === "all_admins" ? null : v, notify_all_admins: v === "all_admins" })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_admins">All team admins</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={cfg.title || ""} onChange={(e) => updateConfig({ title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Message</Label>
                  <Textarea rows={4} value={cfg.message || ""} onChange={(e) => updateConfig({ message: e.target.value })} />
                </div>
              </div>
            )}

            {kind === "convert_to_client" && (
              <div>
                <Label className="text-xs">New client stage</Label>
                <Select value={cfg.default_stage || "Prospect"} onValueChange={(v) => updateConfig({ default_stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLIENT_STAGES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {kind === "condition" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Field</Label>
                  <Select value={cfg.field || ""} onValueChange={(v) => updateConfig({ field: v })}>
                    <SelectTrigger><SelectValue placeholder="Select field" /></SelectTrigger>
                    <SelectContent>
                      {(tokens.length ? tokens : ["name", "email"]).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Operator</Label>
                  <Select value={cfg.operator || "equals"} onValueChange={(v) => updateConfig({ operator: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">equals</SelectItem>
                      <SelectItem value="not_equals">does not equal</SelectItem>
                      <SelectItem value="contains">contains</SelectItem>
                      <SelectItem value="not_contains">does not contain</SelectItem>
                      <SelectItem value="starts_with">starts with</SelectItem>
                      <SelectItem value="ends_with">ends with</SelectItem>
                      <SelectItem value="matches_regex">matches regex</SelectItem>
                      <SelectItem value="greater_than">is greater than</SelectItem>
                      <SelectItem value="less_than">is less than</SelectItem>
                      <SelectItem value="is_empty">is empty</SelectItem>
                      <SelectItem value="is_not_empty">is not empty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!["is_empty", "is_not_empty"].includes(cfg.operator || "equals") && (
                  <div>
                    <Label className="text-xs">Value</Label>
                    <Input value={cfg.value || ""} onChange={(e) => updateConfig({ value: e.target.value })} />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Connect the green <span className="font-medium text-emerald-500">Yes</span> handle for the matching
                  branch and the red <span className="font-medium text-destructive">No</span> handle for everything else.
                </p>
              </div>
            )}

            {["send_email", "create_task", "send_notification"].includes(kind || "") && tokens.length > 0 && (
              <div className="rounded-md border border-dashed border-border p-2">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Merge tags</p>
                <div className="flex flex-wrap gap-1">
                  {tokens.map((t) => (
                    <Badge key={t} variant="secondary" className="font-mono text-[10px]">{`{{${t}}}`}</Badge>
                  ))}
                </div>
              </div>
            )}

            {kind && kind !== "trigger" && (
              <div className="space-y-2 rounded-md border border-border p-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Timing &amp; reliability</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[10px]">Delay (s)</Label>
                    <Input
                      type="number" min={0} max={60}
                      value={cfg.delay_seconds ?? ""}
                      onChange={(e) => updateConfig({ delay_seconds: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Retries</Label>
                    <Input
                      type="number" min={1} max={5}
                      value={cfg.retry_attempts ?? ""}
                      onChange={(e) => updateConfig({ retry_attempts: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">Cooldown (min)</Label>
                    <Input
                      type="number" min={0}
                      value={cfg.cooldown_minutes ?? ""}
                      onChange={(e) => updateConfig({ cooldown_minutes: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Delay waits before this step runs (max 60s). Retries re-attempt on failure. Cooldown skips the step if
                  it already succeeded within the window.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { LEAD_STAGES, TASK_EVENTS, TRIGGER_TYPES };