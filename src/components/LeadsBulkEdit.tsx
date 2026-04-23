import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { logFieldChanges, getUserName } from "@/lib/audit-logger";

interface Lead {
  id: string;
  name: string;
  contact: string | null;
  source: string | null;
  website: string | null;
  date_reached: string | null;
  follow_up_date: string | null;
  needs: string | null;
  booked: boolean | null;
  follow_up_email_sent: boolean | null;
  email_sent_with_info: boolean | null;
  next_steps: string | null;
  stage: string;
  notes: string | null;
  referrer_name?: string | null;
}

interface Props {
  leads: Lead[];
  stages: string[];
  onClose: () => void;
  onSaved: () => void;
}

type EditableField =
  | "name" | "contact" | "source" | "website" | "stage"
  | "date_reached" | "follow_up_date" | "next_steps" | "notes"
  | "booked" | "follow_up_email_sent" | "email_sent_with_info" | "referrer_name";

const COLUMNS: { key: EditableField; label: string; type: "text" | "date" | "select" | "bool" }[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "contact", label: "Contact", type: "text" },
  { key: "source", label: "Source", type: "select" },
  { key: "referrer_name", label: "Referrer", type: "text" },
  { key: "stage", label: "Stage", type: "select" },
  { key: "date_reached", label: "Date Reached", type: "date" },
  { key: "follow_up_date", label: "Follow-up", type: "date" },
  { key: "booked", label: "Booked", type: "bool" },
  { key: "follow_up_email_sent", label: "FU Sent", type: "bool" },
  { key: "next_steps", label: "Next Steps", type: "text" },
  { key: "notes", label: "Notes", type: "text" },
];

export default function LeadsBulkEdit({ leads, stages, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, Lead>>(() =>
    Object.fromEntries(leads.map((l) => [l.id, { ...l }]))
  );
  const [original] = useState<Record<string, Lead>>(() =>
    Object.fromEntries(leads.map((l) => [l.id, { ...l }]))
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  // Find/Replace state
  const [findField, setFindField] = useState<EditableField>("source");
  const [findValue, setFindValue] = useState("");
  const [replaceValue, setReplaceValue] = useState("");
  const [scopeSelectedOnly, setScopeSelectedOnly] = useState(false);

  useEffect(() => {
    supabase
      .from("lead_sources")
      .select("name")
      .order("name")
      .then(({ data }) => setSources((data || []).map((s) => s.name)));
  }, []);

  const dirtyIds = useMemo(() => {
    return Object.keys(rows).filter(
      (id) => JSON.stringify(rows[id]) !== JSON.stringify(original[id])
    );
  }, [rows, original]);

  const updateCell = (id: string, field: EditableField, value: any) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(Object.keys(rows)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const applyReplace = () => {
    const ids = scopeSelectedOnly ? Array.from(selected) : Object.keys(rows);
    if (ids.length === 0) {
      toast.error("No rows in scope");
      return;
    }
    const col = COLUMNS.find((c) => c.key === findField);
    if (!col) return;

    let count = 0;
    setRows((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        const row = { ...next[id] };
        if (col.type === "bool") {
          // For bools: replaceValue "true"/"false" sets all in scope
          const newVal = replaceValue === "true";
          if ((row as any)[findField] !== newVal) {
            (row as any)[findField] = newVal;
            count++;
            next[id] = row;
          }
        } else {
          const current = ((row as any)[findField] ?? "") as string;
          // If findValue empty -> overwrite all
          if (!findValue) {
            if (current !== replaceValue) {
              (row as any)[findField] = replaceValue || null;
              count++;
              next[id] = row;
            }
          } else if (current.includes(findValue)) {
            const updated = current.split(findValue).join(replaceValue);
            (row as any)[findField] = updated || null;
            count++;
            next[id] = row;
          }
        }
      }
      return next;
    });
    toast.success(`Updated ${count} row${count === 1 ? "" : "s"}`);
  };

  const fillDownFromFirstSelected = () => {
    const ids = Array.from(selected);
    if (ids.length < 2) {
      toast.error("Select at least 2 rows to fill down");
      return;
    }
    const col = COLUMNS.find((c) => c.key === findField);
    if (!col) return;
    const sourceVal = (rows[ids[0]] as any)[findField];
    setRows((prev) => {
      const next = { ...prev };
      for (let i = 1; i < ids.length; i++) {
        next[ids[i]] = { ...next[ids[i]], [findField]: sourceVal };
      }
      return next;
    });
    toast.success(`Filled down to ${ids.length - 1} row${ids.length - 1 === 1 ? "" : "s"}`);
  };

  const handleSave = async () => {
    if (dirtyIds.length === 0) {
      toast.info("No changes to save");
      return;
    }
    setSaving(true);
    const userName = user ? await getUserName(user.id) : "Unknown";
    let successCount = 0;
    const fieldLabels = {
      name: "Name", contact: "Contact", source: "Source", website: "Website",
      stage: "Stage", date_reached: "Date Reached", follow_up_date: "Follow-up Date",
      next_steps: "Next Steps", notes: "Notes", booked: "Booked",
      follow_up_email_sent: "Follow-up Sent", email_sent_with_info: "Info Email Sent",
      referrer_name: "Referrer",
    };

    for (const id of dirtyIds) {
      const row = rows[id];
      const old = original[id];
      const payload: any = {};
      for (const col of COLUMNS) {
        if ((row as any)[col.key] !== (old as any)[col.key]) {
          payload[col.key] = (row as any)[col.key] === "" ? null : (row as any)[col.key];
        }
      }
      if (Object.keys(payload).length === 0) continue;
      const { error } = await supabase.from("leads").update(payload).eq("id", id);
      if (error) {
        toast.error(`${row.name}: ${error.message}`);
        continue;
      }
      successCount++;
      if (user) {
        await logFieldChanges(user.id, userName, "lead", id, old as any, row as any, null, fieldLabels);
      }
    }
    setSaving(false);
    toast.success(`Saved ${successCount} lead${successCount === 1 ? "" : "s"}`);
    onSaved();
  };

  const renderCell = (lead: Lead, col: typeof COLUMNS[number]) => {
    const val = (lead as any)[col.key];
    if (col.type === "bool") {
      return (
        <Checkbox
          checked={!!val}
          onCheckedChange={(v) => updateCell(lead.id, col.key, !!v)}
        />
      );
    }
    if (col.type === "select") {
      const options = col.key === "stage" ? stages : sources;
      return (
        <Select
          value={val || "__none__"}
          onValueChange={(v) => updateCell(lead.id, col.key, v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            {val && !options.includes(val) && (
              <SelectItem value={val}>{val} (legacy)</SelectItem>
            )}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type={col.type}
        value={val || ""}
        onChange={(e) => updateCell(lead.id, col.key, e.target.value)}
        className="h-8 text-xs"
      />
    );
  };

  const allSelected = selected.size === Object.keys(rows).length && Object.keys(rows).length > 0;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wand2 className="h-4 w-4 text-primary" />
          Find & Replace
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Field</Label>
            <Select value={findField} onValueChange={(v) => setFindField(v as EditableField)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Find (blank = overwrite all)</Label>
            <Input value={findValue} onChange={(e) => setFindValue(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Replace with</Label>
            <Input
              value={replaceValue}
              onChange={(e) => setReplaceValue(e.target.value)}
              className="h-9"
              placeholder={COLUMNS.find(c => c.key === findField)?.type === "bool" ? "true or false" : ""}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scope</Label>
            <label className="flex items-center gap-2 h-9 px-3 rounded-md border bg-background text-xs">
              <Checkbox
                checked={scopeSelectedOnly}
                onCheckedChange={(v) => setScopeSelectedOnly(!!v)}
              />
              Selected only ({selected.size})
            </label>
          </div>
          <Button onClick={applyReplace} className="h-9">Apply Replace</Button>
          <Button onClick={fillDownFromFirstSelected} variant="outline" className="h-9" title="Copy first selected row's value to other selected rows">
            Fill Down
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {dirtyIds.length > 0 ? (
            <span className="text-amber-600 font-medium">
              {dirtyIds.length} unsaved change{dirtyIds.length === 1 ? "" : "s"}
            </span>
          ) : (
            "Edit cells directly. Use Find & Replace or Fill Down for bulk changes."
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || dirtyIds.length === 0}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "Saving…" : `Save ${dirtyIds.length || ""}`.trim()}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
              </TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className="text-xs whitespace-nowrap">{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.values(rows).length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="text-center text-muted-foreground py-8">
                  No leads to edit.
                </TableCell>
              </TableRow>
            ) : (
              Object.values(rows).map((lead) => {
                const isDirty = JSON.stringify(rows[lead.id]) !== JSON.stringify(original[lead.id]);
                return (
                  <TableRow key={lead.id} className={isDirty ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={(v) => toggleOne(lead.id, !!v)}
                      />
                    </TableCell>
                    {COLUMNS.map((c) => (
                      <TableCell key={c.key} className="p-1.5 min-w-[140px]">
                        {renderCell(lead, c)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
