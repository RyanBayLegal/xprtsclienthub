import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, UserCheck, FileText, Shield, ChevronLeft, ChevronRight, Download, Zap, Eye, ArrowRight } from "lucide-react";
import BulkLeadImport from "@/components/BulkLeadImport";
import { exportToCSV } from "@/lib/csv-export";
import { toast } from "sonner";
import { logAudit, logFieldChanges, getUserName } from "@/lib/audit-logger";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import LeadsKanban from "./LeadsKanban";
import NDABuilder from "@/components/NDABuilder";
import AgreementBuilder from "@/components/AgreementBuilder";
import WorkflowAutomations from "@/components/WorkflowAutomations";
import StageHistoryTimeline from "@/components/StageHistoryTimeline";
import LeadsBulkEdit from "@/components/LeadsBulkEdit";


const STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const CLIENT_STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

interface Lead {
  id: string;
  name: string;
  contact: string | null;
  source: string | null;
  website: string | null;
  date_reached: string | null;
  follow_up_email_sent: boolean | null;
  follow_up_date: string | null;
  needs: string | null;
  booked: boolean | null;
  email_sent_with_info: boolean | null;
  next_steps: string | null;
  follow_up_email_after: string | null;
  stage: string;
  notes: string | null;
  stage_changed_at: string | null;
  created_at?: string | null;
  referrer_name?: string | null;
}

const emptyLead = {
  name: "", email: "", phone: "", contact: "", source: "", website: "", date_reached: "",
  follow_up_email_sent: false, follow_up_date: "", needs: "", booked: false,
  email_sent_with_info: false, next_steps: "", follow_up_email_after: "", stage: "Prospecting Stage", notes: "",
  referrer_name: "",
};

const REFERRAL_SOURCES = ["Referral from Client", "Referral from Partner"];

const LEADS_PAGE_SIZE = 15;

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSources, setLeadSources] = useState<{ id: string; name: string }[]>([]);
  const [kanbanKey, setKanbanKey] = useState(0);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [leadsPage, setLeadsPage] = useState(0);

  // Convert to client state
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertForm, setConvertForm] = useState({
    name: "", company: "", role: "", practice_area: "", stage: "Onboarding/Kickoff Stage",
    pain_points: "", discovery_notes: "",
  });

  // NDA / Agreement dialog for leads
  const [docLead, setDocLead] = useState<Lead | null>(null);
  const [docClientProfileId, setDocClientProfileId] = useState<string | null>(null);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docTab, setDocTab] = useState<"nda" | "agreement">("nda");
  const [loadingDocProfile, setLoadingDocProfile] = useState(false);

  const fetchLeads = async () => {
    let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (stageFilter !== "all") q = q.eq("stage", stageFilter);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    if (data) setLeads(data);
  };

  useEffect(() => { setLeadsPage(0); fetchLeads(); }, [search, stageFilter]);

  useEffect(() => {
    supabase
      .from("lead_sources")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data }) => setLeadSources(data || []));
  }, []);

  // Mark new_lead notifications as read when user visits the Leads page
  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("type", "new_lead")
      .eq("read", false)
      .then(() => {});
  }, [user]);

  const handleSave = async () => {
    const combinedContact = [form.email, form.phone].filter(Boolean).join(" | ") || form.contact;
    const { email: _e, phone: _p, ...formRest } = form;
    const payload = {
      ...formRest,
      contact: combinedContact || null,
      date_reached: form.date_reached || null,
      follow_up_date: form.follow_up_date || null,
      follow_up_email_after: form.follow_up_email_after || null,
      referrer_name: REFERRAL_SOURCES.includes(form.source)
        ? (form.referrer_name?.trim() || null)
        : null,
      created_by: user?.id,
    };
    if (REFERRAL_SOURCES.includes(form.source) && !form.referrer_name?.trim()) {
      toast.error("Referrer name is required for referral sources");
      return;
    }
    if (editingId) {
      const { created_by, ...updatePayload } = payload;
      const oldLead = leads.find(l => l.id === editingId);
      const { error } = await supabase.from("leads").update(updatePayload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      if (user && oldLead) {
        const userName = await getUserName(user.id);
        // Log explicit stage change with time-in-stage
        if (oldLead.stage !== form.stage) {
          const stageAge = oldLead.stage_changed_at
            ? Math.floor((Date.now() - new Date(oldLead.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0;
          await logAudit({
            userId: user.id,
            userName,
            entityType: "lead",
            entityId: editingId,
            action: "update",
            fieldName: "Stage",
            oldValue: oldLead.stage,
            newValue: form.stage,
            description: `Moved lead "${oldLead.name}" from ${oldLead.stage} to ${form.stage} (was in ${oldLead.stage} for ${stageAge} day${stageAge !== 1 ? "s" : ""})`,
          });
        }
        await logFieldChanges(user.id, userName, "lead", editingId, oldLead as any, { ...form, stage: oldLead.stage } as any, null,
          { name: "Name", contact: "Contact", source: "Source", needs: "Needs", notes: "Notes", website: "Website" }
        );
      }
      toast.success("Lead updated");
    } else {
      const { data: inserted, error } = await supabase.from("leads").insert(payload).select("id").single();
      if (error) { toast.error(error.message); return; }
      if (user && inserted) {
        const userName = await getUserName(user.id);
        await logAudit({ userId: user.id, userName, entityType: "lead", entityId: inserted.id, action: "create", description: `Created lead: ${form.name}` });
      }
      toast.success("Lead created");
    }
    setDialogOpen(false);
    setForm(emptyLead);
    setEditingId(null);
    fetchLeads();
    setKanbanKey((k) => k + 1);
  };

  const handleEdit = (lead: Lead) => {
    const contactParts = (lead.contact || "").split(" | ");
    const emailPart = contactParts.find(p => p.includes("@")) || "";
    const phonePart = contactParts.find(p => !p.includes("@")) || "";
    setForm({
      name: lead.name, email: emailPart.trim(), phone: phonePart.trim(), contact: lead.contact || "",
      source: lead.source || "",
      website: lead.website || "", date_reached: lead.date_reached || "",
      follow_up_email_sent: lead.follow_up_email_sent || false,
      follow_up_date: lead.follow_up_date || "", needs: lead.needs || "",
      booked: lead.booked || false, email_sent_with_info: lead.email_sent_with_info || false,
      next_steps: lead.next_steps || "", follow_up_email_after: lead.follow_up_email_after || "",
      stage: lead.stage, notes: lead.notes || "",
      referrer_name: lead.referrer_name || "",
    });
    setEditingId(lead.id);
    setDialogOpen(true);
  };

  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (!leadId || editingId === leadId) return;
    let cancelled = false;
    const openTargetLead = async () => {
      const target = leads.find((lead) => lead.id === leadId);
      if (target) {
        if (cancelled) return;
        handleEdit(target);
        return;
      }
      const { data } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
      if (cancelled) return;
      if (data) handleEdit(data as Lead);
      else {
        toast.error("Lead not found — it may have been deleted.");
        setSearchParams({}, { replace: true });
      }
    };
    openTargetLead();
    return () => { cancelled = true; };
  }, [searchParams, leads, editingId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead deleted");
    fetchLeads();
    setKanbanKey((k) => k + 1);
  };

  // Split a free-text contact field into email + phone.
  // Handles: "a@b.com", "555-1234", "a@b.com / 555-1234", "555-1234, a@b.com".
  const splitContact = (raw: string | null | undefined): { email: string | null; phone: string | null } => {
    const s = (raw || "").trim();
    if (!s) return { email: null, phone: null };
    const parts = s.split(/[\s,;|/]+/).map((p) => p.trim()).filter(Boolean);
    let email: string | null = null;
    let phone: string | null = null;
    for (const p of parts) {
      if (!email && /\S+@\S+\.\S+/.test(p)) email = p;
      else if (!phone && /[\d()+\-\s]{6,}/.test(p)) phone = p;
    }
    if (!email && !phone) {
      // Fallback: original string as phone if it contains digits, else email if @, else phone.
      if (s.includes("@")) email = s; else phone = s;
    }
    return { email, phone };
  };

  // Build the field-by-field preview of what will be copied from lead → client profile.
  // Used both by the preview panel and the audit log.
  type SyncRow = { label: string; field: string; from: string | null; to: string | null };
  const buildSyncPlan = (lead: any, form: typeof convertForm): SyncRow[] => {
    const { email, phone } = splitContact(lead?.contact);
    const extraNotes: string[] = [];
    if (lead?.next_steps) extraNotes.push(`Next steps: ${lead.next_steps}`);
    if (lead?.date_reached) extraNotes.push(`First reached: ${lead.date_reached}`);
    if (lead?.follow_up_date) extraNotes.push(`Follow-up date: ${lead.follow_up_date}`);
    if (lead?.referrer_name) extraNotes.push(`Referrer: ${lead.referrer_name}`);
    if (lead?.website) extraNotes.push(`Website: ${lead.website}`);
    const composedDiscoveryNotes = [form.discovery_notes, ...extraNotes].filter(Boolean).join("\n") || null;
    const howFound = lead?.referrer_name
      ? `${lead?.source || "Referral"} — ${lead.referrer_name}`
      : lead?.source || null;
    return [
      { label: "Name", field: "name", from: lead?.name || null, to: form.name || null },
      { label: "Email", field: "email", from: lead?.contact || null, to: email },
      { label: "Phone", field: "phone", from: lead?.contact || null, to: phone },
      { label: "Company", field: "company", from: null, to: form.company || null },
      { label: "Role / Title", field: "role", from: null, to: form.role || null },
      { label: "Practice Area", field: "practice_area", from: null, to: form.practice_area || null },
      { label: "Stage", field: "stage", from: lead?.stage || null, to: form.stage || null },
      { label: "Pain Points", field: "pain_points", from: lead?.needs || null, to: form.pain_points || lead?.needs || null },
      { label: "Discovery Source", field: "discovery_source", from: lead?.source || null, to: lead?.source || null },
      { label: "How They Found Us", field: "how_they_found_us", from: lead?.referrer_name || lead?.source || null, to: howFound },
      { label: "Discovery Notes", field: "discovery_notes", from: lead?.notes || null, to: composedDiscoveryNotes },
    ];
  };

  const openConvert = (lead: Lead) => {
    setConvertLead(lead);
    setConvertForm({
      name: lead.name,
      company: "",
      role: "",
      practice_area: "",
      stage: "Onboarding/Kickoff Stage",
      pain_points: lead.needs || "",
      discovery_notes: lead.notes || "",
    });
    setConvertDialogOpen(true);
  };

  const handleConvert = async () => {
    if (!convertLead || !convertForm.name) { toast.error("Name is required"); return; }
    setConverting(true);

    // Check if a client profile already exists for this lead
    const { data: existing } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("lead_id", convertLead.id)
      .maybeSingle();

    if (existing) {
      toast.info("A client profile already exists for this lead.");
      navigate(`/clients/${existing.id}`);
      setConvertDialogOpen(false);
      setConverting(false);
      return;
    }

    // Pull the freshest lead record so every field carries over, even if the
    // in-memory list is stale.
    const { data: freshLead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", convertLead.id)
      .maybeSingle();
    const lead: any = freshLead || convertLead;

    // The lead "contact" field holds either an email or phone (combined column).
    const contactStr = (lead.contact || "").trim();
    const looksLikeEmail = contactStr.includes("@");
    const leadEmail = looksLikeEmail ? contactStr : null;
    const leadPhone = !looksLikeEmail && contactStr ? contactStr : null;

    // Compose discovery notes — keep the user's edits and append any extra
    // lead context that wasn't already part of the form.
    const extraNotes: string[] = [];
    if (lead.next_steps) extraNotes.push(`Next steps: ${lead.next_steps}`);
    if (lead.date_reached) extraNotes.push(`First reached: ${lead.date_reached}`);
    if (lead.follow_up_date) extraNotes.push(`Follow-up date: ${lead.follow_up_date}`);
    if (lead.referrer_name) extraNotes.push(`Referrer: ${lead.referrer_name}`);
    if (lead.website) extraNotes.push(`Website: ${lead.website}`);
    const composedDiscoveryNotes = [convertForm.discovery_notes, ...extraNotes]
      .filter(Boolean)
      .join("\n");

    const { data, error } = await supabase.from("client_profiles").insert({
      // Form-driven fields (user can override during conversion)
      name: convertForm.name,
      company: convertForm.company || null,
      role: convertForm.role || null,
      practice_area: convertForm.practice_area || null,
      stage: convertForm.stage || null,
      pain_points: convertForm.pain_points || lead.needs || null,
      discovery_notes: composedDiscoveryNotes || null,
      // Auto-synced from lead
      email: leadEmail,
      phone: leadPhone,
      discovery_source: lead.source || null,
      how_they_found_us: lead.referrer_name
        ? `${lead.source || "Referral"} — ${lead.referrer_name}`
        : lead.source || null,
      lead_id: lead.id,
      created_by: user?.id,
    }).select("id").single();

    if (error) { toast.error(error.message); setConverting(false); return; }

    // Audit the conversion so the trail is visible on both records.
    if (user) {
      try {
        const userName = await getUserName(user.id);
        await logAudit({
          userId: user.id,
          userName,
          entityType: "lead",
          entityId: lead.id,
          action: "update",
          fieldName: "Converted to Client",
          oldValue: null,
          newValue: convertForm.name,
          description: `Converted lead "${lead.name}" to client profile (all lead fields synced)`,
        });
      } catch (e) {
        console.error("Failed to log conversion audit:", e);
      }
    }

    toast.success(`${convertForm.name} converted to client profile!`);
    setConvertDialogOpen(false);
    setConverting(false);
    navigate(`/clients/${data.id}`);
  };

  const openDocDialog = async (lead: Lead, tab: "nda" | "agreement") => {
    setDocLead(lead);
    setDocTab(tab);
    setDocClientProfileId(null);
    setLoadingDocProfile(true);
    setDocDialogOpen(true);
    // Find existing client profile for this lead
    const { data } = await supabase
      .from("client_profiles")
      .select("id")
      .eq("lead_id", lead.id)
      .maybeSingle();
    setDocClientProfileId(data?.id ?? null);
    setLoadingDocProfile(false);
  };

  const updateField = (field: string, value: string | boolean) => setForm((f) => ({ ...f, [field]: value }));

  const exportLeads = () => {
    const headers = ["Name", "Contact", "Source", "Referrer", "Website", "Stage", "Date Added", "Date Reached", "Follow-up Date", "Booked", "Needs", "Next Steps", "Notes"];
    const rows = leads.map((l) => [
      l.name, l.contact, l.source, l.referrer_name || "", l.website, l.stage,
      l.created_at ? new Date(l.created_at).toLocaleString() : "",
      l.date_reached, l.follow_up_date, l.booked ? "Yes" : "No", l.needs, l.next_steps, l.notes,
    ]);
    exportToCSV("leads-export", headers, rows);
    toast.success(`Exported ${rows.length} leads`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm(emptyLead); setEditingId(null); if (searchParams.has("lead")) setSearchParams({}, { replace: true }); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Lead" : "New Lead"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="email@example.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input type="tel" placeholder="+1 (555) 000-0000" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Source</Label>
                    <Select
                      value={form.source || "__none__"}
                      onValueChange={(v) => updateField("source", v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— None —</SelectItem>
                        {leadSources.map((s) => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                        {form.source && !leadSources.some((s) => s.name === form.source) && (
                          <SelectItem value={form.source}>{form.source} (legacy)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date Reached</Label>
                    <Input type="date" value={form.date_reached} onChange={(e) => updateField("date_reached", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Stage</Label>
                    <Select value={form.stage} onValueChange={(v) => updateField("stage", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {REFERRAL_SOURCES.includes(form.source) && (
                    <div className="space-y-2 col-span-2">
                      <Label>Referrer Name *</Label>
                      <Input
                        placeholder="Who referred this lead?"
                        value={form.referrer_name}
                        onChange={(e) => updateField("referrer_name", e.target.value)}
                      />
                    </div>
                  )}
                  {editingId && (
                    <div className="space-y-2 col-span-2">
                      <Label>Date Added</Label>
                      <Input
                        readOnly
                        disabled
                        value={
                          leads.find((l) => l.id === editingId)?.created_at
                            ? new Date(leads.find((l) => l.id === editingId)!.created_at!).toLocaleString()
                            : ""
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">Auto-set when the lead was created. Cannot be edited.</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Needs</Label>
                  <Textarea value={form.needs} onChange={(e) => updateField("needs", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Next Steps</Label>
                  <Textarea value={form.next_steps} onChange={(e) => updateField("next_steps", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.follow_up_email_sent} onCheckedChange={(v) => updateField("follow_up_email_sent", !!v)} />
                    Follow-up Sent
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.booked} onCheckedChange={(v) => updateField("booked", !!v)} />
                    Booked
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.email_sent_with_info} onCheckedChange={(v) => updateField("email_sent_with_info", !!v)} />
                    Info Email Sent
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Follow-up Date</Label>
                    <Input type="date" value={form.follow_up_date} onChange={(e) => updateField("follow_up_date", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Follow-up After</Label>
                    <Input type="date" value={form.follow_up_email_after} onChange={(e) => updateField("follow_up_email_after", e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleSave}>{editingId ? "Update" : "Create"} Lead</Button>
                {editingId && (
                  <StageHistoryTimeline entityType="lead" entityId={editingId} />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2">
          <BulkLeadImport onImported={() => { fetchLeads(); setKanbanKey((k) => k + 1); }} />
          <Button variant="outline" size="sm" onClick={exportLeads}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>
      </div>

      {/* Convert to Client Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Convert to Client Profile
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Pre-filled from <span className="font-medium">{convertLead?.name}</span>. Fill in additional details and confirm.
          </p>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Full Name *</Label>
                <Input value={convertForm.name} onChange={(e) => setConvertForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={convertForm.company} onChange={(e) => setConvertForm((f) => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Role / Title</Label>
                <Input value={convertForm.role} onChange={(e) => setConvertForm((f) => ({ ...f, role: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Input value={convertForm.practice_area} onChange={(e) => setConvertForm((f) => ({ ...f, practice_area: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Client Stage</Label>
                <Select value={convertForm.stage} onValueChange={(v) => setConvertForm((f) => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLIENT_STAGES.map((s) => <SelectItem key={s} value={s}>{s.replace(" Stage", "")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pain Points / Needs</Label>
              <Textarea rows={2} value={convertForm.pain_points} onChange={(e) => setConvertForm((f) => ({ ...f, pain_points: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Discovery Notes</Label>
              <Textarea rows={2} value={convertForm.discovery_notes} onChange={(e) => setConvertForm((f) => ({ ...f, discovery_notes: e.target.value }))} />
            </div>
            <Button onClick={handleConvert} disabled={converting} className="w-full">
              <UserCheck className="mr-2 h-4 w-4" />
              {converting ? "Converting..." : "Create Client Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NDA / Agreement Dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {docTab === "nda" ? <Shield className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-primary" />}
              {docTab === "nda" ? "Mutual NDA" : "Engagement Agreement"} — {docLead?.name}
            </DialogTitle>
          </DialogHeader>
          {loadingDocProfile ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : !docClientProfileId ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">This lead must be converted to a client profile before creating documents.</p>
              <Button onClick={() => { setDocDialogOpen(false); if (docLead) openConvert(docLead); }}>
                <UserCheck className="mr-2 h-4 w-4" />
                Convert to Client First
              </Button>
            </div>
          ) : (
            <Tabs value={docTab} onValueChange={(v) => setDocTab(v as "nda" | "agreement")}>
              <TabsList className="mb-4">
                <TabsTrigger value="nda"><Shield className="h-3.5 w-3.5 mr-1.5" />NDA</TabsTrigger>
                <TabsTrigger value="agreement"><FileText className="h-3.5 w-3.5 mr-1.5" />Agreement</TabsTrigger>
              </TabsList>
              <TabsContent value="nda">
                <NDABuilder
                  clientProfileId={docClientProfileId}
                  leadId={docLead?.id}
                  clientName={docLead?.name || ""}
                  onCreated={() => setDocDialogOpen(false)}
                />
              </TabsContent>
              <TabsContent value="agreement">
                <AgreementBuilder
                  clientProfileId={docClientProfileId}
                  leadId={docLead?.id}
                  clientName={docLead?.name || ""}
                  onCreated={() => setDocDialogOpen(false)}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="kanban">
        <TabsList className="mb-4">
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="automations"><Zap className="h-3.5 w-3.5 mr-1" />Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-0">
          <LeadsKanban onConvert={openConvert} onEdit={handleEdit} refreshKey={kanbanKey} />
        </TabsContent>

        <TabsContent value="table">
          <div className="flex gap-4 mb-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Filter stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="Hired Stage">Hired</SelectItem>
                <SelectItem value="Lost Stage">Lost</SelectItem>
                <SelectItem value="For Nurture">For Nurture</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={bulkEditMode ? "default" : "outline"}
              size="sm"
              onClick={() => setBulkEditMode((v) => !v)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {bulkEditMode ? "Exit Bulk Edit" : "Bulk Edit"}
            </Button>
          </div>

          {bulkEditMode ? (
            <LeadsBulkEdit
              leads={leads as any}
              stages={[...STAGES, "Hired Stage", "Lost Stage", "For Nurture"]}
              onClose={() => setBulkEditMode(false)}
              onSaved={() => { fetchLeads(); setKanbanKey((k) => k + 1); setBulkEditMode(false); }}
            />
          ) : (
          <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Stage Age</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Date Reached</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Next Steps</TableHead>
                  <TableHead className="w-44">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const leadsTotalPages = Math.ceil(leads.length / LEADS_PAGE_SIZE);
                  const paginatedLeads = leads.slice(leadsPage * LEADS_PAGE_SIZE, (leadsPage + 1) * LEADS_PAGE_SIZE);
                  return paginatedLeads.length === 0 ? (
                      <TableRow>
                       <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                         No leads yet. Click &quot;Add Lead&quot; to get started.
                       </TableCell>
                     </TableRow>
                  ) : (
                    paginatedLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          <span
                            className="cursor-pointer hover:text-primary hover:underline"
                            onClick={async () => {
                              const { data: cp } = await supabase.from("client_profiles").select("id").eq("lead_id", lead.id).maybeSingle();
                              if (cp) {
                                navigate(`/clients/${cp.id}`);
                              } else {
                                toast.info("No client profile yet. Convert this lead first.");
                              }
                            }}
                          >
                            {lead.name}
                          </span>
                        </TableCell>
                        <TableCell>{lead.contact}</TableCell>
                        <TableCell>{lead.source}</TableCell>
                        <TableCell className="text-xs">
                          {REFERRAL_SOURCES.includes(lead.source || "")
                            ? (lead.referrer_name || <span className="text-muted-foreground">—</span>)
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                            {lead.stage}
                          </span>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            if (!lead.stage_changed_at) return <span className="text-muted-foreground">—</span>;
                            const days = Math.floor((Date.now() - new Date(lead.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24));
                            const color = days < 7 ? "text-green-600" : days < 14 ? "text-amber-600" : "text-destructive";
                            return <span className={`text-xs font-medium ${color}`}>{days}d</span>;
                          })()}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {lead.created_at
                            ? new Date(lead.created_at).toLocaleDateString()
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{lead.date_reached}</TableCell>
                        <TableCell>{lead.booked ? "✓" : "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{lead.next_steps}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" title="Convert to Client" onClick={() => openConvert(lead)}>
                              <UserCheck className="h-4 w-4 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" title="NDA" onClick={() => openDocDialog(lead, "nda")}>
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Agreement" onClick={() => openDocDialog(lead, "agreement")}>
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(lead)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(lead.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  );
                })()}
              </TableBody>
            </Table>
          </div>
          {/* Leads Pagination */}
          {leads.length > LEADS_PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {leadsPage * LEADS_PAGE_SIZE + 1}–{Math.min((leadsPage + 1) * LEADS_PAGE_SIZE, leads.length)} of {leads.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={leadsPage === 0} onClick={() => setLeadsPage(leadsPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-2">{leadsPage + 1} / {Math.ceil(leads.length / LEADS_PAGE_SIZE)}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={(leadsPage + 1) * LEADS_PAGE_SIZE >= leads.length} onClick={() => setLeadsPage(leadsPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          </>
          )}
        </TabsContent>

        <TabsContent value="automations" className="mt-0">
          <WorkflowAutomations />
        </TabsContent>
      </Tabs>
    </div>
  );
}

