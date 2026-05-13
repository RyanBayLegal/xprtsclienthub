import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type Result = {
  id: string;
  type: "lead" | "client" | "task";
  title: string;
  subtitle?: string;
  navigateTo: string;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${q}%`;
      const [leadsRes, clientsRes, tasksRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, contact, source, website, stage, needs, notes, next_steps, referrer_name, stage_reason")
          .or(
            [
              `name.ilike.${like}`,
              `contact.ilike.${like}`,
              `source.ilike.${like}`,
              `website.ilike.${like}`,
              `stage.ilike.${like}`,
              `needs.ilike.${like}`,
              `notes.ilike.${like}`,
              `next_steps.ilike.${like}`,
              `referrer_name.ilike.${like}`,
              `stage_reason.ilike.${like}`,
            ].join(","),
          )
          .limit(10),
        supabase
          .from("client_profiles")
          .select(
            "id, name, company, role, email, phone, stage, practice_area, discovery_notes, key_attributes, pain_points, motivators, influences, future_plans, how_they_found_us, discovery_source, attitude, meeting_preferences, stage_reason",
          )
          .or(
            [
              "name", "company", "role", "email", "phone", "stage",
              "practice_area", "discovery_notes", "key_attributes",
              "pain_points", "motivators", "influences", "future_plans",
              "how_they_found_us", "discovery_source", "attitude",
              "meeting_preferences", "stage_reason",
            ].map((f) => `${f}.ilike.${like}`).join(","),
          )
          .limit(10),
        supabase
          .from("tasks")
          .select("id, title, description, status, priority, stage, assigned_to_name, template_name, client_profile_id, lead_id")
          .or(
            [
              "title", "description", "status", "priority", "stage",
              "assigned_to_name", "template_name",
            ].map((f) => `${f}.ilike.${like}`).join(","),
          )
          .limit(10),
      ]);

      if (cancelled) return;
      const out: Result[] = [];
      (leadsRes.data || []).forEach((l: any) =>
        out.push({
          id: l.id, type: "lead", title: l.name || "(Untitled lead)",
          subtitle: [l.stage, l.contact, l.source].filter(Boolean).join(" · "),
          navigateTo: `/leads`,
        }),
      );
      (clientsRes.data || []).forEach((c: any) =>
        out.push({
          id: c.id, type: "client", title: c.name || "(Untitled client)",
          subtitle: [c.stage, c.company, c.practice_area].filter(Boolean).join(" · "),
          navigateTo: `/clients/${c.id}`,
        }),
      );
      (tasksRes.data || []).forEach((t: any) =>
        out.push({
          id: t.id, type: "task", title: t.title || "(Untitled task)",
          subtitle: [t.status, t.priority, t.assigned_to_name].filter(Boolean).join(" · "),
          navigateTo: t.client_profile_id ? `/clients/${t.client_profile_id}` : `/tasks`,
        }),
      );
      setResults(out);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [query]);

  const go = (r: Result) => {
    setOpen(false);
    setQuery("");
    navigate(r.navigateTo);
  };

  const grouped = {
    lead: results.filter((r) => r.type === "lead"),
    client: results.filter((r) => r.type === "client"),
    task: results.filter((r) => r.type === "task"),
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-2 text-muted-foreground w-56 justify-start"
        title="Search (⌘K)"
      >
        <Search className="h-4 w-4" />
        <span className="text-xs">Search anything…</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search leads, clients, tasks — any field…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {!query.trim() && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Type to search across leads, clients, and tasks.
            </div>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <CommandEmpty>No matches found.</CommandEmpty>
          )}
          {loading && (
            <div className="py-6 text-center text-xs text-muted-foreground">Searching…</div>
          )}
          {grouped.lead.length > 0 && (
            <CommandGroup heading="Leads">
              {grouped.lead.map((r) => (
                <CommandItem key={`l-${r.id}`} value={`lead-${r.id}-${r.title}`} onSelect={() => go(r)}>
                  <div className="flex flex-col">
                    <span className="text-sm">{r.title}</span>
                    {r.subtitle && <span className="text-[11px] text-muted-foreground">{r.subtitle}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.client.length > 0 && (
            <CommandGroup heading="Clients">
              {grouped.client.map((r) => (
                <CommandItem key={`c-${r.id}`} value={`client-${r.id}-${r.title}`} onSelect={() => go(r)}>
                  <div className="flex flex-col">
                    <span className="text-sm">{r.title}</span>
                    {r.subtitle && <span className="text-[11px] text-muted-foreground">{r.subtitle}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.task.length > 0 && (
            <CommandGroup heading="Tasks">
              {grouped.task.map((r) => (
                <CommandItem key={`t-${r.id}`} value={`task-${r.id}-${r.title}`} onSelect={() => go(r)}>
                  <div className="flex flex-col">
                    <span className="text-sm">{r.title}</span>
                    {r.subtitle && <span className="text-[11px] text-muted-foreground">{r.subtitle}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}