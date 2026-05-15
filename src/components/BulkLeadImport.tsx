import { useState, useRef } from "react";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, List, AlertCircle, CheckCircle2, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logAudit, getUserName } from "@/lib/audit-logger";

interface ParsedLead {
  name: string;
  contact: string;
  source: string;
  website: string;
  needs: string;
  notes: string;
  stage: string;
  date_reached: string;
  valid: boolean;
  error?: string;
}

interface ManualLead {
  name: string;
  email: string;
  phone: string;
  source: string;
  website: string;
  needs: string;
  notes: string;
  stage: string;
  date_reached: string;
}

const STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const CSV_HEADERS = ["name", "email", "phone", "source", "website", "needs", "notes", "stage", "date_reached"];

const emptyManualLead = (): ManualLead => ({
  name: "", email: "", phone: "", source: "", website: "", needs: "", notes: "", stage: "", date_reached: "",
});

interface Props {
  onImported: () => void;
}

export default function BulkLeadImport({ onImported }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("csv");
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [manualLeads, setManualLeads] = useState<ManualLead[]>([emptyManualLead()]);
  const [defaultStage, setDefaultStage] = useState("Prospecting Stage");
  const [sources, setSources] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("lead_sources")
      .select("name")
      .order("name")
      .then(({ data }) => setSources((data || []).map((s) => s.name)));
  }, [open]);

  const reset = () => {
    setParsed([]);
    setManualLeads([emptyManualLead()]);
    setImporting(false);
  };

  const downloadTemplate = () => {
    const sourceList = sources.length ? sources.join(" | ") : "Referral | Website | LinkedIn";
    const stageList = STAGES.join(" | ");
    const sampleSource = sources[0] || "Referral";
    const lines = [
      CSV_HEADERS.join(","),
      `# Allowed sources: ${sourceList}`,
      `# Allowed stages: ${stageList}`,
      `John Smith,john@example.com,555-1234,${sampleSource},https://example.com,VA support,Great prospect,Prospecting Stage,2026-01-15`,
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSVContent = (text: string) => {
    const lines = text.trim().split("\n").filter((l) => !l.trim().startsWith("#"));
    if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }

    const headerLine = lines[0].toLowerCase();
    const headers = parseCSVLine(headerLine);
    const nameIdx = headers.findIndex(h => h.includes("name"));
    if (nameIdx === -1) { toast.error("CSV must have a 'name' column"); return; }

    const emailIdx = headers.findIndex(h => h.includes("email"));
    const phoneIdx = headers.findIndex(h => h.includes("phone"));
    const sourceIdx = headers.findIndex(h => h.includes("source"));
    const websiteIdx = headers.findIndex(h => h.includes("website"));
    const needsIdx = headers.findIndex(h => h.includes("need"));
    const notesIdx = headers.findIndex(h => h.includes("note"));
    const stageIdx = headers.findIndex(h => h.includes("stage"));
    const dateIdx = headers.findIndex(h => h.includes("date") || h.includes("reached"));

    const results: ParsedLead[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = parseCSVLine(lines[i]);
      const name = (cols[nameIdx] || "").trim();
      const email = emailIdx >= 0 ? (cols[emailIdx] || "").trim() : "";
      const phone = phoneIdx >= 0 ? (cols[phoneIdx] || "").trim() : "";
      const contact = [email, phone].filter(Boolean).join(" | ");
      const stage = stageIdx >= 0 ? (cols[stageIdx] || "").trim() : "";

      results.push({
        name,
        contact,
        source: sourceIdx >= 0 ? (cols[sourceIdx] || "").trim() : "",
        website: websiteIdx >= 0 ? (cols[websiteIdx] || "").trim() : "",
        needs: needsIdx >= 0 ? (cols[needsIdx] || "").trim() : "",
        notes: notesIdx >= 0 ? (cols[notesIdx] || "").trim() : "",
        stage: STAGES.includes(stage) ? stage : defaultStage,
        date_reached: dateIdx >= 0 ? (cols[dateIdx] || "").trim() : "",
        valid: !!name,
        error: !name ? "Name is required" : undefined,
      });
    }
    setParsed(results);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ",") { result.push(current); current = ""; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      parseCSVContent(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateManualLead = (index: number, field: keyof ManualLead, value: string) => {
    setManualLeads(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const addManualRow = () => setManualLeads(prev => [...prev, emptyManualLead()]);

  const removeManualRow = (index: number) => {
    if (manualLeads.length <= 1) return;
    setManualLeads(prev => prev.filter((_, i) => i !== index));
  };

  const parseManualList = () => {
    const results: ParsedLead[] = manualLeads
      .filter(l => l.name.trim())
      .map(l => {
        const contact = [l.email.trim(), l.phone.trim()].filter(Boolean).join(" | ");
        const stage = STAGES.includes(l.stage) ? l.stage : defaultStage;
        return {
          name: l.name.trim(),
          contact,
          source: l.source.trim(),
          website: l.website.trim(),
          needs: l.needs.trim(),
          notes: l.notes.trim(),
          stage,
          date_reached: l.date_reached.trim(),
          valid: true,
        };
      });
    if (!results.length) { toast.error("Enter at least one lead with a name"); return; }
    setParsed(results);
  };

  const handleImport = async () => {
    const validLeads = parsed.filter(l => l.valid);
    if (!validLeads.length) { toast.error("No valid leads to import"); return; }
    setImporting(true);

    const payload = validLeads.map(l => ({
      name: l.name,
      contact: l.contact || null,
      source: l.source || null,
      website: l.website || null,
      needs: l.needs || null,
      notes: l.notes || null,
      stage: l.stage,
      date_reached: l.date_reached || null,
      created_by: user?.id,
    }));

    const { data, error } = await supabase.from("leads").insert(payload).select("id");
    if (error) { toast.error(error.message); setImporting(false); return; }

    if (user && data) {
      const userName = await getUserName(user.id);
      await logAudit({
        userId: user.id,
        userName,
        entityType: "lead",
        entityId: data[0].id,
        action: "create",
        description: `Bulk imported ${data.length} leads`,
      });
      // Email notify admins via Gmail connector for each imported lead
      validLeads.forEach((l, idx) => {
        const id = data[idx]?.id;
        if (!id) return;
        supabase.functions.invoke("send-lead-notification", {
          body: {
            lead_id: id,
            lead_name: l.name,
            source: l.source || "Bulk import",
            interest: l.needs || null,
            contact: l.contact || null,
            notes: l.notes || null,
          },
        }).catch((e) => console.error("Lead email notify failed:", e));
      });
    }

    toast.success(`Successfully imported ${data?.length || 0} leads`);
    setImporting(false);
    reset();
    setOpen(false);
    onImported();
  };

  const validCount = parsed.filter(l => l.valid).length;
  const invalidCount = parsed.filter(l => !l.valid).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload className="mr-2 h-4 w-4" />Bulk Import</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import Leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label>Default Stage</Label>
              <Select value={defaultStage} onValueChange={setDefaultStage}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => { setTab(v); setParsed([]); }}>
            <TabsList>
              <TabsTrigger value="csv"><FileText className="mr-1 h-4 w-4" />CSV File</TabsTrigger>
              <TabsTrigger value="list"><List className="mr-1 h-4 w-4" />Manual Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns: <strong>name</strong> (required), email, phone, source, website, needs, notes, stage, date_reached.
              </p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />Choose CSV File
                </Button>
                <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />Download Template
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="list" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add leads manually. Only <strong>Name</strong> is required. Leave other fields blank if not needed.
              </p>
              <div className="border rounded-md max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Name *</TableHead>
                      <TableHead className="min-w-[140px]">Email</TableHead>
                      <TableHead className="min-w-[110px]">Phone</TableHead>
                      <TableHead className="min-w-[100px]">Source</TableHead>
                      <TableHead className="min-w-[130px]">Website</TableHead>
                      <TableHead className="min-w-[110px]">Needs</TableHead>
                      <TableHead className="min-w-[110px]">Notes</TableHead>
                      <TableHead className="min-w-[160px]">Stage</TableHead>
                      <TableHead className="min-w-[120px]">Date Reached</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualLeads.map((lead, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1">
                          <Input value={lead.name} onChange={e => updateManualLead(i, "name", e.target.value)} placeholder="Name" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input value={lead.email} onChange={e => updateManualLead(i, "email", e.target.value)} placeholder="Email" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input value={lead.phone} onChange={e => updateManualLead(i, "phone", e.target.value)} placeholder="Phone" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Select value={lead.source || "__none__"} onValueChange={v => updateManualLead(i, "source", v === "__none__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Source" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input value={lead.website} onChange={e => updateManualLead(i, "website", e.target.value)} placeholder="Website" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input value={lead.needs} onChange={e => updateManualLead(i, "needs", e.target.value)} placeholder="Needs" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input value={lead.notes} onChange={e => updateManualLead(i, "notes", e.target.value)} placeholder="Notes" className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Select value={lead.stage || "__default__"} onValueChange={v => updateManualLead(i, "stage", v === "__default__" ? "" : v)}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Default" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__default__">Default</SelectItem>
                              {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input type="date" value={lead.date_reached} onChange={e => updateManualLead(i, "date_reached", e.target.value)} className="h-8 text-sm" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeManualRow(i)} disabled={manualLeads.length <= 1}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addManualRow}>
                  <Plus className="mr-1 h-4 w-4" />Add Row
                </Button>
                <Button variant="outline" onClick={parseManualList}>Preview & Validate</Button>
              </div>
            </TabsContent>
          </Tabs>

          {parsed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />{validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" />{invalidCount} invalid
                  </span>
                )}
              </div>

              <div className="border rounded-md max-h-[300px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Date Reached</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((lead, i) => (
                      <TableRow key={i} className={!lead.valid ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{lead.name || "—"}</TableCell>
                        <TableCell className="text-sm">{lead.contact || "—"}</TableCell>
                        <TableCell className="text-sm">{lead.source || "—"}</TableCell>
                        <TableCell className="text-sm">{lead.stage}</TableCell>
                        <TableCell className="text-sm">{lead.date_reached || "—"}</TableCell>
                        <TableCell>
                          {lead.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <span className="text-xs text-destructive">{lead.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? "Importing..." : `Import ${validCount} Lead${validCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
