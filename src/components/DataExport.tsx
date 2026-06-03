import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/csv-export";
import JSZip from "jszip";

const TABLES = [
  "profiles","user_roles","branding_settings","lead_sources","lead_notification_recipients",
  "leads","client_profiles","client_notes","client_attachments","client_invoices",
  "client_projects","key_people","placed_vas","talent_pool","talent_attachments",
  "engagement_agreements","scoping_questionnaires","systems_audits","roles_open",
  "tasks","task_comments","task_attachments","activity_time_entries",
  "schedule_clients","schedule_blocks","staff_schedules","time_off_requests",
  "vendors","vendor_attachments","team_links","notifications","notification_logs",
  "workflow_automations","workflow_automation_logs","audit_logs",
] as const;

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  let from = 0;
  const rows: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await supabase.from(table as any).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...((data as unknown) as Record<string, unknown>[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rowsToCSVString(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const escape = (val: unknown) => {
    if (val == null) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function rowsToCSVDownload(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.info(`${table} has no rows`);
    return;
  }
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const data = rows.map((r) =>
    headers.map((h) => {
      const v = r[h];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v as string | number;
    })
  );
  exportToCSV(`${table}-${new Date().toISOString().slice(0, 10)}`, headers, data);
}

export default function DataExport() {
  const [busy, setBusy] = useState<string | null>(null);
  const [fullBusy, setFullBusy] = useState(false);
  const [fullCsvBusy, setFullCsvBusy] = useState(false);

  const exportTableCSV = async (table: string) => {
    setBusy(table);
    try {
      const rows = await fetchAll(table);
      rowsToCSVDownload(table, rows);
      toast.success(`Exported ${rows.length} rows from ${table}`);
    } catch (e: any) {
      toast.error(`${table}: ${e.message ?? "failed"}`);
    } finally {
      setBusy(null);
    }
  };

  const exportTableJSON = async (table: string) => {
    setBusy(table);
    try {
      const rows = await fetchAll(table);
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      downloadBlob(`${table}-${new Date().toISOString().slice(0, 10)}.json`, blob);
      toast.success(`Exported ${rows.length} rows from ${table}`);
    } catch (e: any) {
      toast.error(`${table}: ${e.message ?? "failed"}`);
    } finally {
      setBusy(null);
    }
  };

  const exportFullBackup = async () => {
    setFullBusy(true);
    const result: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    for (const table of TABLES) {
      try {
        result[table] = await fetchAll(table);
      } catch (e: any) {
        errors[table] = e.message ?? "failed";
      }
    }
    const payload = { exported_at: new Date().toISOString(), tables: result, errors };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(`full-backup-${new Date().toISOString().slice(0, 10)}.json`, blob);
    const errCount = Object.keys(errors).length;
    if (errCount > 0) toast.warning(`Backup downloaded with ${errCount} table error(s)`);
    else toast.success("Full backup downloaded");
    setFullBusy(false);
  };

  const exportFullBackupCSV = async () => {
    setFullCsvBusy(true);
    const zip = new JSZip();
    const errors: Record<string, string> = {};
    for (const table of TABLES) {
      try {
        const rows = await fetchAll(table);
        zip.file(`${table}.csv`, rowsToCSVString(rows));
      } catch (e: any) {
        errors[table] = e.message ?? "failed";
      }
    }
    if (Object.keys(errors).length) {
      zip.file("_errors.json", JSON.stringify(errors, null, 2));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(`full-backup-${new Date().toISOString().slice(0, 10)}.zip`, blob);
    const errCount = Object.keys(errors).length;
    if (errCount > 0) toast.warning(`CSV backup downloaded with ${errCount} table error(s)`);
    else toast.success("Full CSV backup downloaded");
    setFullCsvBusy(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Full Backup
          </CardTitle>
          <CardDescription>
            Download every table as a single JSON file. Useful for full data snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportFullBackup} disabled={fullBusy || fullCsvBusy}>
              {fullBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {fullBusy ? "Preparing backup..." : "Download Full Backup (JSON)"}
            </Button>
            <Button onClick={exportFullBackupCSV} disabled={fullBusy || fullCsvBusy} variant="outline">
              {fullCsvBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {fullCsvBusy ? "Preparing CSV..." : "Download Full Backup (CSV .zip)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Table Export</CardTitle>
          <CardDescription>
            Export an individual table as CSV or JSON. Only rows visible to your role will be included.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {TABLES.map((t) => (
              <div
                key={t}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
              >
                <span className="text-sm font-mono">{t}</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === t}
                    onClick={() => exportTableCSV(t)}
                  >
                    {busy === t ? <Loader2 className="h-3 w-3 animate-spin" /> : "CSV"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy === t}
                    onClick={() => exportTableJSON(t)}
                  >
                    JSON
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}