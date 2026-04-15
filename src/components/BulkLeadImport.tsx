import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, List, AlertCircle, CheckCircle2 } from "lucide-react";
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
  valid: boolean;
  error?: string;
}

const STAGES = [
  "Prospecting Stage",
  "Discovery Stage",
  "Solution Mapping Stage",
  "Proposal/Contract Stage",
  "Onboarding/Kickoff Stage",
];

const CSV_HEADERS = ["name", "email", "phone", "source", "website", "needs", "notes", "stage"];

interface Props {
  onImported: () => void;
}

export default function BulkLeadImport({ onImported }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("csv");
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [importing, setImporting] = useState(false);
  const [listText, setListText] = useState("");
  const [defaultStage, setDefaultStage] = useState("Prospecting Stage");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParsed([]);
    setListText("");
    setImporting(false);
  };

  const parseCSVContent = (text: string) => {
    const lines = text.trim().split("\n");
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

  const parseList = () => {
    const lines = listText.trim().split("\n").filter(Boolean);
    if (!lines.length) { toast.error("Enter at least one lead name"); return; }
    const results: ParsedLead[] = lines.map(line => {
      const name = line.trim();
      return {
        name,
        contact: "",
        source: "",
        website: "",
        needs: "",
        notes: "",
        stage: defaultStage,
        valid: !!name,
        error: !name ? "Name is required" : undefined,
      };
    });
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
              <TabsTrigger value="list"><List className="mr-1 h-4 w-4" />Name List</TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with columns: <strong>name</strong> (required), email, phone, source, website, needs, notes, stage.
              </p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />Choose CSV File
              </Button>
            </TabsContent>

            <TabsContent value="list" className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter one lead name per line. All leads will be created with the default stage.
              </p>
              <Textarea
                placeholder={"John Smith\nJane Doe\nAcme Corp"}
                rows={6}
                value={listText}
                onChange={(e) => setListText(e.target.value)}
              />
              <Button variant="outline" onClick={parseList}>Parse List</Button>
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
