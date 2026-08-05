import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MinusCircle, Clock, Timer, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

export interface FieldChange {
  field: string;
  from?: unknown;
  to?: unknown;
  changed?: boolean;
}

export interface StepRecord {
  node?: string;
  kind: string;
  label?: string | null;
  result?: string;
  status: string;
  attempts?: number;
  duration_ms?: number;
  delay_ms?: number;
  branch?: string;
  error?: string;
  started_at?: string;
  details?: {
    wait_ms?: number;
    waited_ms?: number;
    capped?: boolean;
    target?: string;
    table?: string;
    record_id?: string | null;
    changes?: FieldChange[];
    [k: string]: unknown;
  } | null;
}

const fmtValue = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

const fmtMs = (ms: number) => {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s * 10) / 10}s`;
  if (s < 3600) return `${Math.round((s / 60) * 10) / 10} min`;
  if (s < 86400) return `${Math.round((s / 3600) * 10) / 10} h`;
  if (s < 604800) return `${Math.round((s / 86400) * 10) / 10} days`;
  if (s < 2629800) return `${Math.round((s / 604800) * 10) / 10} weeks`;
  if (s < 31557600) return `${Math.round((s / 2629800) * 10) / 10} months`;
  return `${Math.round((s / 31557600) * 10) / 10} years`;
};

interface Props {
  steps: StepRecord[];
  onRerun?: (nodeId: string) => void;
  rerunningNode?: string | null;
  emptyText?: string;
}

/** Step-by-step timeline of an automation run: status, waits, field diffs and errors. */
export default function StepTimeline({ steps, onRerun, rerunningNode, emptyText = "No steps executed." }: Props) {
  if (!steps || steps.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-border/70 pl-5">
      {steps.map((s, i) => {
        const changes = s.details?.changes ?? [];
        const waitMs = s.details?.waited_ms ?? s.details?.wait_ms;
        return (
          <li key={i} className="relative">
            <span className="absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background">
              {s.status === "error" ? (
                <XCircle className="h-4 w-4 text-destructive" />
              ) : s.status === "skipped" ? (
                <MinusCircle className="h-4 w-4 text-muted-foreground" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
            </span>
            <div className="rounded-lg border border-border/70 bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {i + 1}. {s.kind.replace(/_/g, " ")}
                </span>
                {s.label && <span className="truncate text-xs text-muted-foreground">— {s.label}</span>}
                <Badge
                  variant={s.status === "error" ? "destructive" : s.status === "skipped" ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {s.status}
                </Badge>
                {s.branch && <Badge variant="secondary" className="text-[10px]">branch: {s.branch}</Badge>}
                {(s.attempts ?? 0) > 1 && <Badge variant="secondary" className="text-[10px]">{s.attempts} attempts</Badge>}
                {typeof s.duration_ms === "number" && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {fmtMs(s.duration_ms)}
                  </span>
                )}
                {!!s.delay_ms && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Timer className="h-3 w-3" /> pre-step delay {fmtMs(s.delay_ms)}
                  </span>
                )}
                {onRerun && s.node && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-xs"
                    disabled={rerunningNode === s.node}
                    onClick={() => onRerun(s.node!)}
                  >
                    <RotateCw className="mr-1 h-3 w-3" />
                    {rerunningNode === s.node ? "Running…" : "Re-run from here"}
                  </Button>
                )}
              </div>

              <p className={`mt-1 text-xs ${s.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {s.error || s.result}
              </p>

              {typeof waitMs === "number" && waitMs > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-orange-500">
                  <Timer className="h-3 w-3" /> Scheduled wait {fmtMs(waitMs)}
                  {s.details?.capped ? " (capped at 60s per run)" : ""}
                </p>
              )}

              {changes.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-md border border-border/70">
                  <table className="w-full text-[11px]">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">
                          {s.details?.target === "client" ? "Client field" : "Lead field"}
                        </th>
                        <th className="px-2 py-1 text-left font-medium">Before</th>
                        <th className="px-2 py-1 text-left font-medium">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.field} className="border-t border-border/60">
                          <td className="px-2 py-1 font-mono">{c.field}</td>
                          <td className="px-2 py-1 text-muted-foreground line-through">{fmtValue(c.from)}</td>
                          <td className="px-2 py-1">
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <ArrowRight className="h-3 w-3" />
                              {fmtValue(c.to)}
                            </span>
                            {c.changed === false && (
                              <span className="ml-1 text-[10px] text-muted-foreground">(unchanged)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}