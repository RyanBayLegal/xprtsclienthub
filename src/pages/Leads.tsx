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
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import LeadsKanban from "./LeadsKanban";

const STAGES = [
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
}

const emptyLead = {
  name: "", contact: "", source: "", website: "", date_reached: "",
  follow_up_email_sent: false, follow_up_date: "", needs: "", booked: false,
  email_sent_with_info: false, next_steps: "", follow_up_email_after: "", stage: "Prospecting Stage", notes: "",
};

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyLead);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    let q = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (stageFilter !== "all") q = q.eq("stage", stageFilter);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    if (data) setLeads(data);
  };

  useEffect(() => { fetchLeads(); }, [search, stageFilter]);

  const handleSave = async () => {
    const payload = {
      ...form,
      date_reached: form.date_reached || null,
      follow_up_date: form.follow_up_date || null,
      follow_up_email_after: form.follow_up_email_after || null,
      created_by: user?.id,
    };
    if (editingId) {
      const { created_by, ...updatePayload } = payload;
      const { error } = await supabase.from("leads").update(updatePayload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Lead updated");
    } else {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Lead created");
    }
    setDialogOpen(false);
    setForm(emptyLead);
    setEditingId(null);
    fetchLeads();
  };

  const handleEdit = (lead: Lead) => {
    setForm({
      name: lead.name, contact: lead.contact || "", source: lead.source || "",
      website: lead.website || "", date_reached: lead.date_reached || "",
      follow_up_email_sent: lead.follow_up_email_sent || false,
      follow_up_date: lead.follow_up_date || "", needs: lead.needs || "",
      booked: lead.booked || false, email_sent_with_info: lead.email_sent_with_info || false,
      next_steps: lead.next_steps || "", follow_up_email_after: lead.follow_up_email_after || "",
      stage: lead.stage, notes: lead.notes || "",
    });
    setEditingId(lead.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead deleted");
    fetchLeads();
  };

  const updateField = (field: string, value: string | boolean) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm(emptyLead); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Lead</Button>
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
                  <Label>Contact</Label>
                  <Input value={form.contact} onChange={(e) => updateField("contact", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input value={form.source} onChange={(e) => updateField("source", e.target.value)} />
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
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList className="mb-4">
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <LeadsKanban />
        </TabsContent>

        <TabsContent value="table">
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leads..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Filter stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Date Reached</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Next Steps</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No leads yet. Click "Add Lead" to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/clients/${lead.id}`)}>
                      <TableCell className="font-medium">{lead.name}</TableCell>
                      <TableCell>{lead.contact}</TableCell>
                      <TableCell>{lead.source}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                          {lead.stage}
                        </span>
                      </TableCell>
                      <TableCell>{lead.date_reached}</TableCell>
                      <TableCell>{lead.booked ? "✓" : "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{lead.next_steps}</TableCell>
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
