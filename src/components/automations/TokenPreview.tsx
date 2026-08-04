import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { toast } from "sonner";
import { CONTEXT_TOKENS, sampleContext } from "./nodeCatalog";

interface Props {
  triggerType: string;
  extraTokens?: string[];
  /** Optional override of the sample payload (e.g. edited simulation data). */
  sample?: Record<string, unknown>;
}

/** Shows the sample payload and every token value available to later steps. */
export default function TokenPreview({ triggerType, extraTokens = [], sample }: Props) {
  const [open, setOpen] = useState(true);
  const payload = useMemo(
    () => sample ?? sampleContext(triggerType),
    [sample, triggerType],
  );
  const tokens = useMemo(() => {
    const declared = CONTEXT_TOKENS[triggerType] || [];
    return Array.from(new Set([...declared, ...Object.keys(payload), ...extraTokens]));
  }, [triggerType, payload, extraTokens]);

  const valueOf = (t: string) => {
    const v = (payload as Record<string, unknown>)[t];
    if (v === undefined) return "—";
    if (v === null) return "null";
    return String(v);
  };

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <button type="button" className="flex w-full items-center gap-2" onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Label className="cursor-pointer text-xs">Token preview — sample payload for this trigger</Label>
        <Badge variant="secondary" className="ml-auto text-[10px]">{tokens.length} tokens</Badge>
      </button>

      {open && (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div className="max-h-56 overflow-auto rounded border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Token values</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => {
                  navigator.clipboard.writeText(tokens.map((t) => `{{${t}}}`).join(" "));
                  toast.success("Tokens copied");
                }}
              >
                <Copy className="mr-1 h-3 w-3" /> Copy all
              </Button>
            </div>
            <table className="w-full text-[11px]">
              <tbody>
                {tokens.map((t) => (
                  <tr key={t} className="border-b border-border/50 last:border-0">
                    <td className="py-0.5 pr-2 align-top">
                      <button
                        type="button"
                        className="font-mono text-[10px] text-primary hover:underline"
                        onClick={() => { navigator.clipboard.writeText(`{{${t}}}`); toast.success(`{{${t}}} copied`); }}
                      >
                        {`{{${t}}}`}
                      </button>
                    </td>
                    <td className="py-0.5 align-top text-muted-foreground">
                      <span className="line-clamp-2 break-all">{valueOf(t)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="max-h-56 overflow-auto rounded border border-border bg-background p-2">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Sample payload</p>
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
