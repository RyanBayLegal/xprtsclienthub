import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface EmailRule {
  field: string;
  operator: string;
  value?: string;
  capture_as?: string;
  case_sensitive?: boolean;
}

const FIELDS = [
  { value: "subject", label: "Subject" },
  { value: "body", label: "Body" },
  { value: "from_email", label: "From email" },
  { value: "from_name", label: "From name" },
  { value: "to_email", label: "To email" },
];

const OPERATORS = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "matches_regex", label: "matches regex" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

interface Props {
  rules: EmailRule[];
  matchMode: string;
  onChange: (rules: EmailRule[], matchMode: string) => void;
  fields?: { value: string; label: string }[];
  emptyHint?: string;
}

export default function EmailRuleBuilder({ rules, matchMode, onChange, fields, emptyHint }: Props) {
  const fieldList = fields?.length ? fields : FIELDS;
  const update = (i: number, patch: Partial<EmailRule>) =>
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)), matchMode);

  const captures = rules.map((r) => r.capture_as).filter(Boolean) as string[];

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs">Match</Label>
        <Select value={matchMode || "all"} onValueChange={(v) => onChange(rules, v)}>
          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rules</SelectItem>
            <SelectItem value="any">Any rule</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => onChange([...rules, { field: fieldList[0].value, operator: "contains", value: "" }], matchMode)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Add rule
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground">{emptyHint || "No rules — every inbound email will trigger this automation."}</p>
      )}

      {rules.map((r, i) => {
        const needsValue = !["is_empty", "is_not_empty"].includes(r.operator);
        return (
          <div key={i} className="space-y-2 rounded-md bg-muted/40 p-2">
            <div className="flex gap-2">
              <Select value={r.field} onValueChange={(v) => update(i, { field: v })}>
                <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fieldList.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={r.operator} onValueChange={(v) => update(i, { operator: v })}>
                <SelectTrigger className="h-8 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => onChange(rules.filter((_, idx) => idx !== i), matchMode)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {needsValue && (
              <Input
                className="h-8"
                value={r.value || ""}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={r.operator === "matches_regex" ? "invoice #(\\d+)" : "keyword"}
              />
            )}
            <div className="flex items-center gap-2">
              <Input
                className="h-8"
                value={r.capture_as || ""}
                onChange={(e) => update(i, { capture_as: e.target.value.replace(/[^\w]/g, "_") })}
                placeholder="Save match as variable (optional)"
              />
              {r.capture_as && (
                <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{`{{${r.capture_as}}}`}</Badge>
              )}
            </div>
            {r.operator === "matches_regex" && (
              <p className="text-[11px] text-muted-foreground">
                The first capture group (or the whole match) is stored in the variable.
              </p>
            )}
          </div>
        );
      })}

      {captures.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Available in later steps: {captures.map((c) => `{{${c}}}`).join(", ")}
        </p>
      )}
    </div>
  );
}
