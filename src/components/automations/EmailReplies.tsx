import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Bug, ChevronDown, ChevronRight, Loader2, Paperclip, RefreshCw, RotateCw, Send, User, X,
} from "lucide-react";

type Filter = "all" | "leads" | "clients" | "unmatched";

interface AttachmentRef {
  path: string;
  name: string;
  type?: string;
  size?: number;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string | null;
  at: string;
  address: string;
  status?: string | null;
  error?: string | null;
  attachments: AttachmentRef[];
  messageId?: string | null;
  matchMethod?: string | null;
  matchDebug?: Record<string, unknown> | null;
}

interface Thread {
  key: string;
  kind: "lead" | "client" | "unmatched";
  id: string | null;
  name: string;
  email: string;
  messages: Message[];
}

const asAttachments = (v: unknown): AttachmentRef[] =>
  Array.isArray(v) ? (v as AttachmentRef[]).filter((a) => a && typeof a.path === "string") : [];

/** Back-and-forth email conversations with leads and clients. */
export default function EmailReplies() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sender, setSender] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [debugRows, setDebugRows] = useState<Record<string, unknown>[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inboundRes, outboundRes, syncRes] = await Promise.all([
      (supabase as any)
        .from("inbound_emails")
        .select("id, from_email, from_name, subject, body_text, received_at, matched_lead_id, matched_client_id, attachments, message_id, in_reply_to, thread_id, match_method, match_debug")
        .order("received_at", { ascending: false })
        .limit(300),
      (supabase as any)
        .from("notification_logs")
        .select("id, recipient_email, subject, body_text, created_at, lead_id, client_profile_id, status, error_message, direction, attachments, message_id, thread_id")
        .order("created_at", { ascending: false })
        .limit(300),
      (supabase as any).from("email_sync_state").select("last_checked_at").maybeSingle(),
    ]);

    setLastChecked((syncRes as any)?.data?.last_checked_at ?? null);

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
    const push = (kind: Thread["kind"], id: string | null, name: string, email: string, msg: Message) => {
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
        attachments: asAttachments(r.attachments),
        messageId: r.message_id ?? null,
        matchMethod: r.match_method ?? null,
        matchDebug: r.match_debug ?? null,
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
        attachments: asAttachments(o.attachments),
        messageId: o.message_id ?? null,
      });
    }

    const list = [...map.values()].map((t) => ({
      ...t,
      messages: t.messages.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    }));
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

  const sync = useCallback(async (silent: boolean) => {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("fetch-inbound-email");
    setSyncing(false);
    if (error || (data as any)?.error) {
      if (!silent) toast.error((data as any)?.error || error?.message || "Could not check the mailbox");
      return;
    }
    const stored = (data as any)?.stored ?? 0;
    const dbg = (data as any)?.debug;
    if (Array.isArray(dbg) && dbg.length) setDebugRows(dbg);
    if (!silent) {
      toast.success(stored ? `${stored} new repl${stored === 1 ? "y" : "ies"} imported` : "No new replies found");
    } else if (stored) {
      toast.success(`${stored} new repl${stored === 1 ? "y" : "ies"} received`);
    }
    await load();
  }, [load]);

  const checkForReplies = () => sync(false);

  // Automatic incremental polling so replies land in threads on their own.
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") sync(true);
    }, 60000);
    return () => clearInterval(id);
  }, [autoRefresh, sync]);

  // Live updates when rows are written by automations or other users.
  useEffect(() => {
    const channel = supabase
      .channel("email-threads")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbound_emails" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const messageMatches = useCallback(
    (m: Message) => {
      const q = search.trim().toLowerCase();
      const s = sender.trim().toLowerCase();
      const okQ = !q || `${m.subject ?? ""} ${m.body ?? ""}`.toLowerCase().includes(q);
      const okS = !s || m.address.toLowerCase().includes(s);
      const t = new Date(m.at).getTime();
      const okFrom = !from || t >= new Date(`${from}T00:00:00`).getTime();
      const okTo = !to || t <= new Date(`${to}T23:59:59`).getTime();
      return okQ && okS && okFrom && okTo;
    },
    [search, sender, from, to],
  );

  const hasQuery = !!(search.trim() || sender.trim() || from || to);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const s = sender.trim().toLowerCase();
    return threads
      .filter((t) =>
        filter === "all" ? true : filter === "leads" ? t.kind === "lead" : filter === "clients" ? t.kind === "client" : t.kind === "unmatched",
      )
      .filter((t) => {
        if (!hasQuery) return true;
        const contactHit = (!!q && (t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))) ||
          (!!s && t.email.toLowerCase().includes(s));
        return contactHit || t.messages.some(messageMatches);
      });
  }, [threads, filter, search, sender, hasQuery, messageMatches]);

  const jumpTo = (threadKey: string, messageId: string) => {
    setOpen((o) => ({ ...o, [threadKey]: true }));
    setHighlighted(messageId);
    requestAnimationFrame(() =>
      setTimeout(() => msgRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" }), 60),
    );
  };

  const openAttachment = async (a: AttachmentRef) => {
    const { data, error } = await supabase.storage.from("email-attachments").createSignedUrl(a.path, 3600);
    if (error || !data?.signedUrl) { toast.error("Could not open attachment"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const uploadFiles = async (list: File[]): Promise<AttachmentRef[] | null> => {
    const out: AttachmentRef[] = [];
    for (const f of list) {
      const path = `${crypto.randomUUID()}/${f.name}`;
      const { error } = await supabase.storage.from("email-attachments").upload(path, f, { contentType: f.type || undefined });
      if (error) { toast.error(`Upload failed: ${f.name}`); return null; }
      out.push({ path, name: f.name, type: f.type || undefined, size: f.size });
    }
    return out;
  };

  const send = async (
    t: Thread,
    body: string,
    subject: string,
    attachments: AttachmentRef[],
  ) => {
    const lastInbound = [...t.messages].reverse().find((m) => m.direction === "inbound" && m.messageId);
    const { data, error } = await supabase.functions.invoke("send-thread-reply", {
      body: {
        to: t.email,
        subject,
        body,
        attachments,
        in_reply_to: lastInbound?.messageId || null,
        lead_id: t.kind === "lead" ? t.id : null,
        client_profile_id: t.kind === "client" ? t.id : null,
      },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to send");
      return false;
    }
    return true;
  };

  const subjectFor = (t: Thread) => {
    const lastSubject = [...t.messages].reverse().find((m) => m.subject)?.subject || "";
    return lastSubject.toLowerCase().startsWith("re:") ? lastSubject : `Re: ${lastSubject || "Your message"}`;
  };

  const sendReply = async (t: Thread) => {
    const body = (drafts[t.key] || "").trim();
    if (!body) return;
    if (!t.email) { toast.error("No email address on this thread"); return; }
    setSending(t.key);
    const attachments = await uploadFiles(files[t.key] || []);
    if (!attachments) { setSending(null); return; }
    const ok = await send(t, body, subjectFor(t), attachments);
    setSending(null);
    if (!ok) return;
    toast.success(`Reply sent to ${t.email}`);
    setDrafts((d) => ({ ...d, [t.key]: "" }));
    setFiles((f) => ({ ...f, [t.key]: [] }));
    await load();
    requestAnimationFrame(() => bottomRefs.current[t.key]?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const retryMessage = async (t: Thread, m: Message) => {
    if (!t.email || !m.body) return;
    setRetrying(m.id);
    const ok = await send(t, m.body, m.subject || subjectFor(t), m.attachments);
    setRetrying(null);
    if (ok) { toast.success("Message resent"); await load(); }
  };

  const statusLabel = (m: Message) => {
    const s = (m.status || "sent").toLowerCase();
    if (s === "failed" || s === "error") return { label: "failed", variant: "destructive" as const };
    if (s === "sent" || s === "delivered") return { label: "sent", variant: "outline" as const };
    return { label: s === "pending" ? "queued" : s, variant: "secondary" as const };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "leads", "clients", "unmatched"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {lastChecked && (
            <span className="text-xs text-muted-foreground">
              Checked {formatDistanceToNow(new Date(lastChecked), { addSuffix: true })}
            </span>
          )}
          <Button
            size="sm"
            variant={autoRefresh ? "secondary" : "outline"}
            onClick={() => setAutoRefresh((v) => !v)}
            title="Automatically pull new replies every minute"
          >
            Auto-refresh {autoRefresh ? "on" : "off"}
          </Button>
          <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Bug className="mr-2 h-4 w-4" />Matching debug</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
              <DialogHeader><DialogTitle>Message matching debug</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground">
                Shows how each fetched message was matched: reply headers first (Message-ID / In-Reply-To / References),
                then the sender address against lead and client records. Messages from addresses that are not on a lead
                or client are never stored.
              </p>
              {debugRows.length === 0 && storedDebug.length === 0 && (
                <p className="text-sm text-muted-foreground">Run “Check for replies” to see matching details.</p>
              )}
              {[...debugRows, ...storedDebug].map((row, i) => {
                const r = row as Record<string, any>;
                return (
                  <div key={i} className="rounded-md border p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={r.stored === false ? "destructive" : "outline"}>
                        {r.stored === false ? "not attached" : "attached"}
                      </Badge>
                      <span className="font-medium">{r.from_email || "—"}</span>
                      <span className="truncate text-muted-foreground">{r.subject || "(no subject)"}</span>
                    </div>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      <div><dt className="inline text-muted-foreground">Match: </dt><dd className="inline">{r.match_method || "none"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Reason: </dt><dd className="inline">{r.reason || "—"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Message-ID: </dt><dd className="inline break-all">{r.message_id || "—"}</dd></div>
                      <div><dt className="inline text-muted-foreground">In-Reply-To: </dt><dd className="inline break-all">{r.in_reply_to || "—"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Thread: </dt><dd className="inline break-all">{r.thread_id || "—"}</dd></div>
                      <div><dt className="inline text-muted-foreground">Lead / Client: </dt><dd className="inline break-all">{r.lead_id || r.client_profile_id || "—"}</dd></div>
                    </dl>
                  </div>
                );
              })}
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={checkForReplies} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Check for replies
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Keyword in subject or body…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Input placeholder="Sender email contains…" value={sender} onChange={(e) => setSender(e.target.value)} />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <div className="flex gap-2">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          {hasQuery && (
            <Button variant="ghost" size="icon" onClick={() => { setSearch(""); setSender(""); setFrom(""); setTo(""); }} aria-label="Clear filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && visible.length === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No conversations match. Use “Check for replies” to pull the latest messages from your connected Gmail inbox.
        </CardContent></Card>
      )}

      {visible.map((t) => {
        const isOpen = open[t.key] ?? false;
        const latest = t.messages[t.messages.length - 1];
        const inboundCount = t.messages.filter((m) => m.direction === "inbound").length;
        const matches = hasQuery ? t.messages.filter(messageMatches) : [];
        const attached = files[t.key] || [];
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

              {matches.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">
                  <span className="text-xs text-muted-foreground">{matches.length} matching:</span>
                  {matches.slice(0, 5).map((m) => (
                    <Button key={m.id} size="sm" variant="secondary" className="h-6 max-w-[220px] px-2 text-xs" onClick={() => jumpTo(t.key, m.id)}>
                      <span className="truncate">
                        {new Date(m.at).toLocaleDateString()} · {m.subject || m.body?.slice(0, 30) || "(no subject)"}
                      </span>
                    </Button>
                  ))}
                </div>
              )}

              {!isOpen && (
                <p className="mt-1 line-clamp-1 pl-6 text-xs text-muted-foreground">
                  <span className="font-medium">{latest.direction === "inbound" ? "Them" : "You"}:</span>{" "}
                  {latest.subject || "(no subject)"} — {latest.body}
                </p>
              )}

              {isOpen && (
                <div className="mt-3 space-y-3 pl-6">
                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {t.messages.map((m) => {
                      const st = statusLabel(m);
                      const isMatch = hasQuery && messageMatches(m);
                      return (
                        <div
                          key={m.id}
                          ref={(el) => { msgRefs.current[m.id] = el; }}
                          className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg border p-2.5 transition-shadow",
                              m.direction === "outbound" ? "border-primary/30 bg-primary/10" : "border-border bg-muted/40",
                              isMatch && "ring-1 ring-primary/40",
                              highlighted === m.id && "ring-2 ring-primary",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {m.direction === "outbound" ? "You" : t.name}
                              </span>
                              {m.direction === "outbound" && (
                                <Badge variant={st.variant} className="h-4 px-1 text-[10px] capitalize">{st.label}</Badge>
                              )}
                              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                                {new Date(m.at).toLocaleString()}
                              </span>
                            </div>
                            {m.subject && <p className="mt-0.5 text-sm font-medium text-foreground">{m.subject}</p>}
                            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{m.body}</p>
                            {m.attachments.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {m.attachments.map((a) => (
                                  <Button key={a.path} size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => openAttachment(a)}>
                                    <Paperclip className="mr-1 h-3 w-3" />
                                    <span className="max-w-[160px] truncate">{a.name}</span>
                                  </Button>
                                ))}
                              </div>
                            )}
                            {m.error && <p className="mt-1 text-[11px] text-destructive">{m.error}</p>}
                            {m.direction === "outbound" && st.label === "failed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-1.5 h-6 px-2 text-[11px]"
                                onClick={() => retryMessage(t, m)}
                                disabled={retrying === m.id}
                              >
                                {retrying === m.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCw className="mr-1 h-3 w-3" />}
                                Retry
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={(el) => { bottomRefs.current[t.key] = el; }} />
                  </div>

                  {attached.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {attached.map((f, i) => (
                        <Badge key={`${f.name}-${i}`} variant="secondary" className="gap-1">
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[160px] truncate">{f.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${f.name}`}
                            onClick={() => setFiles((s) => ({ ...s, [t.key]: (s[t.key] || []).filter((_, idx) => idx !== i) }))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <Textarea
                      value={drafts[t.key] || ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [t.key]: e.target.value }))}
                      placeholder={t.email ? `Reply to ${t.email}…` : "No email address on this thread"}
                      disabled={!t.email}
                      rows={2}
                      className="min-h-[60px]"
                    />
                    <label className={cn("cursor-pointer", !t.email && "pointer-events-none opacity-50")}>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || []);
                          if (picked.length) setFiles((s) => ({ ...s, [t.key]: [...(s[t.key] || []), ...picked] }));
                          e.currentTarget.value = "";
                        }}
                      />
                      <span className="inline-flex h-10 items-center rounded-md border border-input px-3 text-sm hover:bg-accent">
                        <Paperclip className="h-4 w-4" />
                      </span>
                    </label>
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
