import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Loader2, Send, User } from "lucide-react";

type Filter = "all" | "leads" | "clients" | "unmatched";

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string | null;
  at: string;
  address: string;
  status?: string | null;
  error?: string | null;
}

interface Thread {
  key: string;
  kind: "lead" | "client" | "unmatched";
  id: string | null;
  name: string;
  email: string;
  messages: Message[];
}

/** Back-and-forth email conversations with leads and clients. */
export default function EmailReplies() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    const [inboundRes, outboundRes] = await Promise.all([
      supabase
        .from("inbound_emails")
        .select("id, from_email, from_name, subject, body_text, received_at, matched_lead_id, matched_client_id")
        .order("received_at", { ascending: false })
        .limit(300),
      (supabase as any)
        .from("notification_logs")
        .select("id, recipient_email, subject, body_text, created_at, lead_id, client_profile_id, status, error_message, direction")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const inbound = (inboundRes.data as any[]) || [];
    const outbound = ((outboundRes.data as any[]) || []).filter(
      (o) => (o.direction ?? "outbound") === "outbound" && o.recipient_email,
    );

    const leadIds = new Set<string>();
    const clientIds = new Set<string>();
    inbound.forEach((r) => { if (r.matched_lead_id) leadIds.add(r.matched_lead_id); if (r.matched_client_id) clientIds.add(r.matched_client_id); });
    outbound.forEach((o) => { if (o.lead_id) leadIds.add(o.lead_id); if (o.client_profile_id) clientIds.add(o.client_profile_id); });

    const [l, c] = await Promise.all([
      leadIds.size ? supabase.from("leads").select("id, name, contact").in("id", [...leadIds]) : Promise.resolve({ data: [] as any[] }),
      clientIds.size ? supabase.from("client_profiles").select("id, name, email").in("id", [...clientIds]) : Promise.resolve({ data: [] as any[] }),
    ]);
    const leadMap = new Map(((l.data as any[]) || []).map((x) => [x.id, x]));
    const clientMap = new Map(((c.data as any[]) || []).map((x) => [x.id, x]));

    const map = new Map<string, Thread>();
    const push = (
      kind: Thread["kind"],
      id: string | null,
      name: string,
      email: string,
      msg: Message,
    ) => {
      const key = id ? `${kind}:${id}` : `email:${(email || "unknown").toLowerCase()}`;
      if (!map.has(key)) map.set(key, { key, kind, id, name, email, messages: [] });
      const t = map.get(key)!;
      if (!t.email && email) t.email = email;
      t.messages.push(msg);
    };

    for (const r of inbound) {
      const kind: Thread["kind"] = r.matched_client_id ? "client" : r.matched_lead_id ? "lead" : "unmatched";
      const id = r.matched_client_id || r.matched_lead_id || null;
      const name =
        (kind === "client" && clientMap.get(id!)?.name) ||
        (kind === "lead" && leadMap.get(id!)?.name) ||
        r.from_name || r.from_email || "Unknown sender";
      push(kind, id, String(name), r.from_email || "", {
        id: `in:${r.id}`,
        direction: "inbound",
        subject: r.subject,
        body: r.body_text,
        at: r.received_at,
        address: r.from_email || "",
      });
    }

    const emailOf = (raw: string | null) =>
      (raw || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0]?.toLowerCase() || "";

    for (const o of outbound) {
      const kind: Thread["kind"] = o.client_profile_id ? "client" : o.lead_id ? "lead" : "unmatched";
      const id = o.client_profile_id || o.lead_id || null;
      const name =
        (kind === "client" && clientMap.get(id!)?.name) ||
        (kind === "lead" && leadMap.get(id!)?.name) ||
        o.recipient_email || "Unknown recipient";
      const addr = emailOf(o.recipient_email) || String(o.recipient_email || "").toLowerCase();
      push(kind, id, String(name), addr, {
        id: `out:${o.id}`,
        direction: "outbound",
        subject: o.subject,
        body: o.body_text,
        at: o.created_at,
        address: addr,
        status: o.status,
        error: o.error_message,
      });
    }

    const list = [...map.values()].map((t) => ({
      ...t,
      messages: t.messages.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    }));
    // Fall back to the contact record's email when the thread has none.
    for (const t of list) {
      if (!t.email && t.id) {
        t.email = emailOf(t.kind === "client" ? clientMap.get(t.id)?.email : leadMap.get(t.id)?.contact);
      }
    }
    list.sort(
      (a, b) =>
        new Date(b.messages[b.messages.length - 1].at).getTime() -
        new Date(a.messages[a.messages.length - 1].at).getTime(),
    );
    setThreads(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads
      .filter((t) =>
        filter === "all" ? true : filter === "leads" ? t.kind === "lead" : filter === "clients" ? t.kind === "client" : t.kind === "unmatched",
      )
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.messages.some((m) => `${m.subject ?? ""} ${m.body ?? ""}`.toLowerCase().includes(q)),
      );
  }, [threads, filter, search]);

  const sendReply = async (t: Thread) => {
    const body = (drafts[t.key] || "").trim();
    if (!body) return;
    if (!t.email) { toast.error("No email address on this thread"); return; }
    setSending(t.key);
    const lastSubject = [...t.messages].reverse().find((m) => m.subject)?.subject || "";
    const subject = lastSubject.toLowerCase().startsWith("re:") ? lastSubject : `Re: ${lastSubject || "Your message"}`;
    const { data, error } = await supabase.functions.invoke("send-thread-reply", {
      body: {
        to: t.email,
        subject,
        body,
        lead_id: t.kind === "lead" ? t.id : null,
        client_profile_id: t.kind === "client" ? t.id : null,
      },
    });
    setSending(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to send reply");
      return;
    }
    toast.success(`Reply sent to ${t.email}`);
    setDrafts((d) => ({ ...d, [t.key]: "" }));
    await load();
    requestAnimationFrame(() => bottomRefs.current[t.key]?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

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
      {!loading && visible.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No conversations yet. Emails you send and replies received through the inbound webhook are matched to leads and clients by email address.
        </CardContent></Card>
      )}

      {visible.map((t) => {
        const isOpen = open[t.key] ?? false;
        const latest = t.messages[t.messages.length - 1];
        const inboundCount = t.messages.filter((m) => m.direction === "inbound").length;
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
                  <Badge variant="outline">
                    {t.messages.length} message{t.messages.length === 1 ? "" : "s"}
                    {inboundCount > 0 && ` · ${inboundCount} received`}
                  </Badge>
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(latest.at), { addSuffix: true })}
                </span>
                {t.kind === "client" && t.id && (
                  <Button asChild variant="outline" size="sm"><Link to={`/clients/${t.id}`}>Open client</Link></Button>
                )}
                {t.kind === "lead" && t.id && (
                  <Button asChild variant="outline" size="sm"><Link to={`/leads?highlight=${t.id}`}>Open lead</Link></Button>
                )}
              </div>
              <p className="mt-1 pl-6 text-xs text-muted-foreground">{t.email || "No email address"}</p>

              {!isOpen && (
                <p className="mt-1 line-clamp-1 pl-6 text-xs text-muted-foreground">
                  <span className="font-medium">{latest.direction === "inbound" ? "Them" : "You"}:</span>{" "}
                  {latest.subject || "(no subject)"} — {latest.body}
                </p>
              )}

              {isOpen && (
                <div className="mt-3 space-y-3 pl-6">
                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {t.messages.map((m) => (
                      <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg border p-2.5",
                            m.direction === "outbound"
                              ? "border-primary/30 bg-primary/10"
                              : "border-border bg-muted/40",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {m.direction === "outbound" ? "You" : t.name}
                            </span>
                            {m.direction === "outbound" && m.status && m.status !== "sent" && (
                              <Badge variant="destructive" className="h-4 px-1 text-[10px] capitalize">{m.status}</Badge>
                            )}
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                              {new Date(m.at).toLocaleString()}
                            </span>
                          </div>
                          {m.subject && <p className="mt-0.5 text-sm font-medium text-foreground">{m.subject}</p>}
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{m.body}</p>
                          {m.error && <p className="mt-1 text-[11px] text-destructive">{m.error}</p>}
                        </div>
                      </div>
                    ))}
                    <div ref={(el) => { bottomRefs.current[t.key] = el; }} />
                  </div>

                  <div className="flex items-end gap-2">
                    <Textarea
                      value={drafts[t.key] || ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [t.key]: e.target.value }))}
                      placeholder={t.email ? `Reply to ${t.email}…` : "No email address on this thread"}
                      disabled={!t.email}
                      rows={2}
                      className="min-h-[60px]"
                    />
                    <Button
                      onClick={() => sendReply(t)}
                      disabled={!t.email || sending === t.key || !(drafts[t.key] || "").trim()}
                    >
                      {sending === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="ml-2">Send</span>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
