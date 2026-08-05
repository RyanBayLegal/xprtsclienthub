import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, Pencil, Trash2, Workflow, CheckCircle2, XCircle, Copy, Mail, AlertTriangle, FlaskConical } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import EmailRuleBuilder, { type EmailRule } from "@/components/automations/EmailRuleBuilder";
import { countErrors, type ValidationIssue } from "@/lib/automation-validator";
import AutomationCanvas, { type Graph, type StaffOption } from "@/components/automations/AutomationCanvas";
import { CLIENT_STAGES, LEAD_STAGES, TASK_EVENTS, TRIGGER_TYPES, sampleContext } from "@/components/automations/nodeCatalog";
import TokenPreview from "@/components/automations/TokenPreview";
import EmailReplies from "@/components/automations/EmailReplies";
import StepTimeline, { type StepRecord } from "@/components/automations/StepTimeline";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_config: Record<string, any>;
  graph: Graph;
  is_active: boolean;
  created_at: string;
}

interface RunRow {
  id: string;
  automation_id: string | null;
  automation_name: string;
  trigger_type: string;
  status: string;
  error_message: string | null;
  context: Record<string, unknown> | null;
  steps: StepRecord[];
  created_at: string;
}

interface InboundEmail {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
}

const INBOUND_URL = "https://gvkqcmssjjnmvkbdirrh.supabase.co/functions/v1/inbound-email";

// Triggers are added by the user from the step palette — never auto-created.
function emptyGraph(_triggerType: string): Graph {
  return { nodes: [], edges: [] } as Graph;
}

export default function Automations() {
  const { user } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Automation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [simOpen, setSimOpen] = useState(false);
  const [simInput, setSimInput] = useState("{}");
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<{
    status?: string;
    trigger_matched?: boolean;
    captures?: Record<string, string>;
    steps?: StepRecord[];
    error_message?: string | null;
  } | null>(null);

  const openSimulation = () => {
    if (!editing) return;
    setSimResult(null);
    setSimInput(JSON.stringify(sampleContext(editing.trigger_type), null, 2));
    setSimOpen(true);
  };

  const runSimulation = async () => {
    if (!editing) return;
    let context: Record<string, unknown>;
    try { context = JSON.parse(simInput || "{}"); }
    catch { toast.error("Test data must be valid JSON"); return; }
    setSimRunning(true);
    const { data, error } = await supabase.functions.invoke("run-automation", {
      body: {
        simulate: true,
        automation_id: editing.id || null,
        trigger_type: editing.trigger_type,
        trigger_config: editing.trigger_config,
        graph: editing.graph,
        context,
      },
    });
    setSimRunning(false);
    if (error) { toast.error(error.message); return; }
    setSimResult((data as { results?: any[] })?.results?.[0] ?? null);
  };

  const rerunFromStep = async (run: RunRow, nodeId: string) => {
    if (!run.automation_id) { toast.error("This automation no longer exists"); return; }
    const key = `${run.id}:${nodeId}`;
    setRerunning(key);
    const { data, error } = await supabase.functions.invoke("run-automation", {
      body: { automation_id: run.automation_id, from_node_id: nodeId, context: run.context || {} },
    });
    setRerunning(null);
    if (error) { toast.error(error.message); return; }
    const result = (data as { results?: { status?: string }[] })?.results?.[0];
    if (result?.status === "error") toast.error("Re-run finished with errors");
    else toast.success("Re-run completed");
    load();
  };

  const load = async () => {
    setLoading(true);
    const [a, r, e, s] = await Promise.all([
      supabase.from("automations").select("*").order("created_at", { ascending: false }),
      supabase.from("automation_runs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("inbound_emails").select("id, from_email, from_name, subject, body_text, received_at").order("received_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("user_id, full_name").eq("is_active", true).order("full_name"),
    ]);
    setAutomations((a.data as unknown as Automation[]) || []);
    setRuns((r.data as unknown as RunRow[]) || []);
    setEmails((e.data as unknown as InboundEmail[]) || []);
    setStaff((s.data as StaffOption[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing({
      id: "",
      name: "",
      description: "",
      trigger_type: "lead_created",
      trigger_config: {},
      graph: emptyGraph("lead_created"),
      is_active: true,
      created_at: new Date().toISOString(),
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Give the automation a name"); return; }
    const errors = countErrors(issues);
    if (errors > 0) {
      toast.error(`Fix ${errors} validation ${errors === 1 ? "error" : "errors"} before saving`);
      return;
    }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      description: editing.description,
      trigger_type: editing.trigger_type,
      trigger_config: editing.trigger_config,
      graph: editing.graph as never,
      is_active: editing.is_active,
      created_by: user?.id ?? null,
    };
    const { error } = editing.id
      ? await supabase.from("automations").update(payload).eq("id", editing.id)
      : await supabase.from("automations").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Automation updated" : "Automation created");
    setEditing(null);
    load();
  };

  const toggleActive = async (a: Automation, value: boolean) => {
    const { error } = await supabase.from("automations").update({ is_active: value }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    setAutomations((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: value } : x)));
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("automations").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Automation deleted");
    load();
  };

  const triggerLabel = (a: Automation) => {
    const base = TRIGGER_TYPES.find((t) => t.value === a.trigger_type)?.label ?? a.trigger_type;
    const cfg = a.trigger_config || {};
    if (cfg.stage) return `${base} → ${cfg.stage}`;
    if (cfg.event) return `${base} → ${cfg.event}`;
    return base;
  };

  const stepCount = (a: Automation) => Math.max(0, (a.graph?.nodes?.length ?? 1) - 1);

  const triggerOptions = useMemo(() => {
    if (!editing) return null;
    if (editing.trigger_type === "lead_stage_change" || editing.trigger_type === "client_stage_change") {
      const stages = editing.trigger_type === "lead_stage_change" ? LEAD_STAGES : CLIENT_STAGES;
      return (
        <div>
          <Label className="text-xs">When stage becomes</Label>
          <Select
            value={editing.trigger_config?.stage || "any"}
            onValueChange={(v) => setEditing({ ...editing, trigger_config: { ...editing.trigger_config, stage: v } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any stage</SelectItem>
              {stages.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (editing.trigger_type === "task_event") {
      return (
        <div>
          <Label className="text-xs">Task event</Label>
          <Select
            value={editing.trigger_config?.event || "created"}
            onValueChange={(v) => setEditing({ ...editing, trigger_config: { ...editing.trigger_config, event: v } })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TASK_EVENTS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (editing.trigger_type === "email_received") {
      return (
        <>
          <div className="md:col-span-3 flex flex-wrap items-end gap-4 rounded-md border border-border p-3">
            <div className="flex items-center gap-2 pb-2">
              <Switch
                checked={editing.trigger_config?.auto_refresh_enabled !== false}
                onCheckedChange={(v) =>
                  setEditing({ ...editing, trigger_config: { ...editing.trigger_config, auto_refresh_enabled: v } })
                }
              />
              <Label className="text-xs">Automatically check Gmail for replies</Label>
            </div>
            <div className="w-56">
              <Label className="text-xs">Polling frequency</Label>
              <Select
                disabled={editing.trigger_config?.auto_refresh_enabled === false}
                value={String(editing.trigger_config?.poll_interval_seconds || 60)}
                onValueChange={(v) =>
                  setEditing({ ...editing, trigger_config: { ...editing.trigger_config, poll_interval_seconds: Number(v) } })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 seconds</SelectItem>
                  <SelectItem value="30">Every 30 seconds</SelectItem>
                  <SelectItem value="60">Every minute</SelectItem>
                  <SelectItem value="300">Every 5 minutes</SelectItem>
                  <SelectItem value="900">Every 15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Subject pattern (optional regex)</Label>
            <Input
              placeholder="e.g. ^Re: Invoice #(\d+)"
              value={(editing.trigger_config?.subject_regex as string) || ""}
              onChange={(e) =>
                setEditing({ ...editing, trigger_config: { ...editing.trigger_config, subject_regex: e.target.value } })
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Case-insensitive by default. The first capture group is available as <code>{"{{subject_match}}"}</code>.
            </p>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Inbound email rules</Label>
            <EmailRuleBuilder
              rules={(editing.trigger_config?.rules as EmailRule[]) || []}
              matchMode={(editing.trigger_config?.match_mode as string) || "all"}
              onChange={(rules, match_mode) =>
                setEditing({ ...editing, trigger_config: { ...editing.trigger_config, rules, match_mode } })
              }
            />
          </div>
        </>
      );
    }
    if (editing.trigger_type === "lead_created_manual" || editing.trigger_type === "lead_created") {
      return (
        <>
          <div>
            <Label className="text-xs">Only when stage is</Label>
            <Select
              value={editing.trigger_config?.stage || "any"}
              onValueChange={(v) => setEditing({ ...editing, trigger_config: { ...editing.trigger_config, stage: v } })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any stage</SelectItem>
                {LEAD_STAGES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Only when source contains</Label>
            <Input
              placeholder={editing.trigger_config?.source_regex ? "e.g. ^(Referral|Strategy).*" : "e.g. Referral, Strategy Review (blank = any)"}
              value={(editing.trigger_config?.source_contains as string) || ""}
              onChange={(e) =>
                setEditing({ ...editing, trigger_config: { ...editing.trigger_config, source_contains: e.target.value } })
              }
            />
            <div className="mt-2 flex items-center gap-2">
              <Switch
                checked={!!editing.trigger_config?.source_regex}
                onCheckedChange={(v) =>
                  setEditing({ ...editing, trigger_config: { ...editing.trigger_config, source_regex: v } })
                }
              />
              <Label className="text-[11px] text-muted-foreground">Treat as regular expression</Label>
              <Switch
                className="ml-3"
                checked={!!editing.trigger_config?.source_case_sensitive}
                onCheckedChange={(v) =>
                  setEditing({ ...editing, trigger_config: { ...editing.trigger_config, source_case_sensitive: v } })
                }
              />
              <Label className="text-[11px] text-muted-foreground">Case sensitive</Label>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Stage and source matching ignore letter case by default.
            </p>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Field pattern filters (optional)</Label>
            <EmailRuleBuilder
              rules={(editing.trigger_config?.rules as EmailRule[]) || []}
              matchMode={(editing.trigger_config?.match_mode as string) || "all"}
              onChange={(rules, match_mode) =>
                setEditing({ ...editing, trigger_config: { ...editing.trigger_config, rules, match_mode } })
              }
              emptyHint="No filters — every new lead triggers this automation."
              fields={[
                { value: "name", label: "Name" },
                { value: "email", label: "Email" },
                { value: "contact", label: "Contact" },
                { value: "source", label: "Source" },
                { value: "referrer_name", label: "Referrer" },
                { value: "website", label: "Website" },
                { value: "needs", label: "Needs" },
                { value: "notes", label: "Notes" },
                { value: "next_steps", label: "Next steps" },
                { value: "stage", label: "Stage" },
              ]}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Rules test lead fields such as needs, notes or email — regex captures become tokens for later steps.
            </p>
          </div>
        </>
      );
    }
    return null;
  }, [editing]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Workflow className="h-6 w-6 text-primary" /> Automations
          </h1>
          <p className="text-sm text-muted-foreground">
            Build visual workflows that send emails, assign tasks and notify the team when things happen.
          </p>
        </div>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" /> New automation</Button>
      </div>

      <Tabs defaultValue="flows">
        <TabsList>
          <TabsTrigger value="flows">Flows</TabsTrigger>
          <TabsTrigger value="runs">Run history</TabsTrigger>
          <TabsTrigger value="replies">Email replies</TabsTrigger>
          <TabsTrigger value="inbox">Inbound email</TabsTrigger>
        </TabsList>

        <TabsContent value="replies" className="pt-4">
          <EmailReplies />
        </TabsContent>

        <TabsContent value="flows" className="space-y-3 pt-4">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && automations.length === 0 && (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              No automations yet. Create your first one to start sending emails and assigning tasks automatically.
            </CardContent></Card>
          )}
          {automations.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{a.name}</p>
                    <Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Paused"}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {triggerLabel(a)} · {stepCount(a)} step{stepCount(a) === 1 ? "" : "s"}
                  </p>
                </div>
                <Switch checked={a.is_active} onCheckedChange={(v) => toggleActive(a, v)} />
                <Button variant="ghost" size="icon" onClick={() => setEditing({ ...a, graph: a.graph || emptyGraph(a.trigger_type) })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="runs" className="space-y-2 pt-4">
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No automation runs yet.</p>}
          {runs.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                  {r.status === "success"
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="font-medium text-foreground">{r.automation_name}</span>
                  <Badge variant="outline">{r.trigger_type}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                {r.error_message && (
                  <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{r.error_message}</p>
                )}
                <StepTimeline
                  steps={r.steps || []}
                  onRerun={r.automation_id ? (nodeId) => rerunFromStep(r, nodeId) : undefined}
                  rerunningNode={
                    rerunning?.startsWith(`${r.id}:`) ? rerunning.slice(r.id.length + 1) : null
                  }
                />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="inbox" className="space-y-3 pt-4">
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-medium text-foreground">Inbound email webhook</p>
              <p className="text-xs text-muted-foreground">
                Point your mail provider's inbound parse (or a Zapier/Make "new email" step) at this URL. Every email
                received here is stored below and fires your "Email received" automations.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{INBOUND_URL}</code>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(INBOUND_URL); toast.success("Copied"); }}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                </Button>
              </div>
            </CardContent>
          </Card>
          {emails.length === 0 && <p className="text-sm text-muted-foreground">No inbound emails received yet.</p>}
          {emails.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">{e.subject || "(no subject)"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(e.received_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{e.from_name} &lt;{e.from_email}&gt;</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.body_text}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="flex h-screen w-screen max-w-none flex-col gap-4 rounded-none border-0 p-6 sm:rounded-none">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editing?.id ? "Edit automation" : "New automation"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Welcome new lead" />
                </div>
                <div>
                  <Label className="text-xs">Trigger</Label>
                  <Select
                    value={editing.trigger_type}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        trigger_type: v,
                        trigger_config: {},
                        graph: {
                          ...editing.graph,
                          nodes: (editing.graph.nodes || []).map((n) =>
                            n.id === "trigger"
                              ? { ...n, data: { ...n.data, config: { trigger_type: v } } }
                              : n,
                          ),
                        },
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                {triggerOptions}
                <div className="md:col-span-3">
                  <TokenPreview
                    triggerType={editing.trigger_type}
                    extraTokens={[
                      ...(((editing.trigger_config?.rules as EmailRule[]) || [])
                        .map((r) => r.capture_as)
                        .filter(Boolean) as string[]),
                      ...(editing.trigger_config?.subject_regex ? ["subject_match"] : []),
                    ]}
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <AutomationCanvas
                  key={editing.id || "new"}
                  graph={editing.graph}
                  triggerType={editing.trigger_type}
                  staff={staff}
                  extraTokens={((editing.trigger_config?.rules as EmailRule[]) || [])
                    .map((r) => r.capture_as)
                    .filter(Boolean) as string[]}
                  onValidate={setIssues}
                  onChange={(g) => setEditing((prev) => (prev ? { ...prev, graph: g } : prev))}
                />
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3">
                <div className="mr-auto flex items-center gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <span className="text-sm text-muted-foreground">Active</span>
                </div>
                {countErrors(issues) > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> {countErrors(issues)} error{countErrors(issues) === 1 ? "" : "s"}
                  </Badge>
                )}
                <Button variant="outline" onClick={openSimulation}>
                  <FlaskConical className="mr-2 h-4 w-4" /> Simulate
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save automation"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Simulate automation</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Replays this flow with your test data. No emails are sent and no tasks, clients or notifications are created.
          </p>
          <div>
            <Label className="text-xs">Test context (JSON)</Label>
            <Textarea rows={10} className="font-mono text-xs" value={simInput} onChange={(e) => setSimInput(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSimInput(JSON.stringify(sampleContext(editing?.trigger_type || "lead_created"), null, 2))}>
              Reset sample
            </Button>
            <Button onClick={runSimulation} disabled={simRunning}>
              <FlaskConical className="mr-2 h-4 w-4" /> {simRunning ? "Simulating…" : "Run simulation"}
            </Button>
          </div>

          {simResult && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={simResult.trigger_matched ? "default" : "secondary"}>
                  {simResult.trigger_matched ? "Trigger matched" : "Trigger did not match"}
                </Badge>
                <Badge variant={simResult.status === "error" ? "destructive" : "outline"}>{simResult.status}</Badge>
              </div>
              {simResult.captures && Object.keys(simResult.captures).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(simResult.captures).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="font-mono text-[10px]">{`{{${k}}} = ${v}`}</Badge>
                  ))}
                </div>
              )}
              {simResult.error_message && (
                <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">{simResult.error_message}</p>
              )}
              {(simResult.steps || []).length === 0 && (
                <p className="text-xs text-muted-foreground">No steps ran with this data.</p>
              )}
              {(simResult.steps || []).map((st, i) => (
                <div key={i} className="flex items-start gap-2 rounded border border-border/60 px-2 py-1.5">
                  {st.status === "error"
                    ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    : st.status === "skipped"
                      ? <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">{st.kind}</span>
                      {st.branch && <Badge variant="secondary" className="text-[10px]">branch: {st.branch}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{st.result}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Past run history is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}