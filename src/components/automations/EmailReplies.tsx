import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Mail, User } from "lucide-react";

interface Reply {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  matched_lead_id: string | null;
  matched_client_id: string | null;
}

type Filter = "all" | "leads" | "clients" | "unmatched";

interface Thread {
  key: string;
  kind: "lead" | "client" | "unmatched";
  id: string | null;
  name: string;
  email: string;
  replies: Reply[];
}

/** Email replies grouped by the lead or client they belong to. */
export default function EmailReplies() {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("inbound_emails")
        .select("id, from_email, from_name, subject, body_text, received_at, matched_lead_id, matched_client_id")
        .order("received_at", { ascending: false })
        .limit(300);
      const rows = (data as Reply[]) || [];
      setReplies(rows);

      const leadIds = Array.from(new Set(rows.map((r) => r.matched_lead_id).filter(Boolean))) as string[];
      const clientIds = Array.from(new Set(rows.map((r) => r.matched_client_id).filter(Boolean))) as string[];
      const [l, c] = await Promise.all([
        leadIds.length ? supabase.from("leads").select("id, name").in("id", leadIds) : Promise.resolve({ data: [] }),
        clientIds.length ? supabase.from("client_profiles").select("id, name").in("id", clientIds) : Promise.resolve({ data: [] }),
      ]);
      setLeadNames(Object.fromEntries(((l.data as { id: string; name: string }[]) || []).map((x) => [x.id, x.name])));
      setClientNames(Object.fromEntries(((c.data as { id: string; name: string }[]) || []).map((x) => [x.id, x.name])));
      setLoading(false);
    })();
  }, []);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const r of replies) {
      const kind: Thread["kind"] = r.matched_client_id ? "client" : r.matched_lead_id ? "lead" : "unmatched";
      const id = r.matched_client_id || r.matched_lead_id || null;
      const key = id ? `${kind}:${id}` : `email:${(r.from_email || "unknown").toLowerCase()}`;
      const name =
        (kind === "client" && clientNames[id!]) ||
        (kind === "lead" && leadNames[id!]) ||
        r.from_name ||
        r.from_email ||
        "Unknown sender";
      if (!map.has(key)) {
        map.set(key, { key, kind, id, name: String(name), email: r.from_email || "", replies: [] });
      }
      map.get(key)!.replies.push(r);
    }
    const q = search.trim().toLowerCase();
    return Array.from(map.values())
      .filter((t) =>
        filter === "all" ? true : filter === "leads" ? t.kind === "lead" : filter === "clients" ? t.kind === "client" : t.kind === "unmatched",
      )
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.replies.some((r) => `${r.subject ?? ""} ${r.body_text ?? ""}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => new Date(b.replies[0].received_at).getTime() - new Date(a.replies[0].received_at).getTime());
  }, [replies, leadNames, clientNames, filter, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "leads", "clients", "unmatched"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
        <Input
          className="ml-auto w-full max-w-xs"
          placeholder="Search sender, subject or body…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && threads.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No email replies yet. Replies arrive through the inbound email webhook and are matched to leads and clients by email address.
        </CardContent></Card>
      )}

      {threads.map((t) => {
        const isOpen = open[t.key] ?? false;
        const latest = t.replies[0];
        return (
          <Card key={t.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen((o) => ({ ...o, [t.key]: !isOpen }))} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">{t.name}</span>
                  <Badge variant={t.kind === "client" ? "default" : t.kind === "lead" ? "secondary" : "outline"} className="capitalize">
                    {t.kind}
                  </Badge>
                  <Badge variant="outline">{t.replies.length} repl{t.replies.length === 1 ? "y" : "ies"}</Badge>
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(latest.received_at), { addSuffix: true })}
                </span>
                {t.kind === "client" && t.id && (
                  <Button asChild variant="outline" size="sm"><Link to={`/clients/${t.id}`}>Open client</Link></Button>
                )}
                {t.kind === "lead" && t.id && (
                  <Button asChild variant="outline" size="sm"><Link to={`/leads?highlight=${t.id}`}>Open lead</Link></Button>
                )}
              </div>
              <p className="mt-1 pl-6 text-xs text-muted-foreground">{t.email}</p>

              {!isOpen && (
                <p className="mt-1 line-clamp-1 pl-6 text-xs text-muted-foreground">
                  {latest.subject || "(no subject)"} — {latest.body_text}
                </p>
              )}

              {isOpen && (
                <div className="mt-3 space-y-2 pl-6">
                  {t.replies.map((r) => (
                    <div key={r.id} className="rounded-md border border-border p-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">{r.subject || "(no subject)"}</span>
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {new Date(r.received_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{r.body_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
