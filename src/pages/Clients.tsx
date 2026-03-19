import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, ArrowUpDown, Trash2, X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { UserAvatar } from "@/components/UserAvatar";
import ClientsKanban from "@/components/ClientsKanban";
import { toast } from "sonner";

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  stage: string | null;
  practice_area: string | null;
  client_health_score: number | null;
  stage_changed_at: string | null;
  avatar_url: string | null;
}

const STAGES = ["Prospect", "Qualified", "Active", "Signed", "Inactive"];
const PAGE_SIZE = 15;

type SortField = "name" | "client_health_score" | "stage";
type SortDir = "asc" | "desc";

function getStageAgeDays(stageChangedAt: string | null): number {
  if (!stageChangedAt) return 0;
  const changed = new Date(stageChangedAt);
  const now = new Date();
  return Math.floor((now.getTime() - changed.getTime()) / (1000 * 60 * 60 * 24));
}

function getStageAgeStyle(days: number): string {
  if (days >= 30) return "bg-destructive/5";
  if (days >= 14) return "bg-amber-500/5";
  return "";
}

function getStageAgeBadge(days: number): { label: string; className: string } {
  if (days >= 30) return { label: `${days}d — stale`, className: "bg-destructive/15 text-destructive" };
  if (days >= 14) return { label: `${days}d`, className: "bg-amber-500/15 text-amber-700" };
  if (days >= 1) return { label: `${days}d`, className: "bg-muted text-muted-foreground" };
  return { label: "Today", className: "bg-primary/10 text-primary" };
}

export default function Clients() {
  const navigate = useNavigate();
  const { role: userRole } = useAuth();
  const isAdmin = userRole === "team_admin";
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [practiceFilter, setPracticeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchClients = async () => {
    let q = supabase.from("client_profiles").select("id, name, company, role, stage, practice_area, client_health_score, stage_changed_at, avatar_url").order("created_at", { ascending: false }) as any;
    if (search) q = q.ilike("name", `%${search}%`);
    if (stageFilter !== "all") q = q.eq("stage", stageFilter);
    if (practiceFilter !== "all") q = q.eq("practice_area", practiceFilter);
    const { data } = await q;
    if (data) {
      const areas = new Set<string>();
      data.forEach((c: ClientRow) => { if (c.practice_area) areas.add(c.practice_area); });
      setPracticeAreas(Array.from(areas).sort());
      setClients(data);
    }
  };

  const fetchTaskCounts = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("client_profile_id")
      .in("status", ["todo", "in_progress"])
      .not("client_profile_id", "is", null);
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((t) => {
        if (t.client_profile_id) counts[t.client_profile_id] = (counts[t.client_profile_id] || 0) + 1;
      });
      setTaskCounts(counts);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchClients();
    fetchTaskCounts();
  }, [search, stageFilter, practiceFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("client_profiles").delete().eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); setDeleteTarget(null); return; }
    toast.success(`Deleted ${deleteTarget.name}`);
    setDeleteTarget(null);
    fetchClients();
    setRefreshKey((k) => k + 1);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const sorted = [...clients].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortField === "name") return (a.name || "").localeCompare(b.name || "") * dir;
    if (sortField === "client_health_score") return ((a.client_health_score ?? -1) - (b.client_health_score ?? -1)) * dir;
    if (sortField === "stage") return (a.stage || "").localeCompare(b.stage || "") * dir;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasFilters = stageFilter !== "all" || practiceFilter !== "all";

  const exportClients = () => {
    const headers = ["Name", "Company", "Role", "Practice Area", "Stage", "Health Score", "Stage Changed At", "Open Tasks"];
    const rows = sorted.map((c) => [
      c.name, c.company, c.role, c.practice_area, c.stage,
      c.client_health_score, c.stage_changed_at ? new Date(c.stage_changed_at).toLocaleDateString() : "",
      taskCounts[c.id] || 0,
    ]);
    exportToCSV("clients-export", headers, rows);
    toast.success(`Exported ${rows.length} clients`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Client Profiles</h1>
        <Button variant="outline" size="sm" onClick={exportClients}>
          <Download className="mr-2 h-4 w-4" />Export CSV
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {/* Search + Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={practiceFilter} onValueChange={setPracticeFilter}>
              <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder="Practice Area" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Practice Areas</SelectItem>
                {practiceAreas.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setStageFilter("all"); setPracticeFilter("all"); }}>
                <X className="h-3 w-3 mr-1" />Clear Filters
              </Button>
            )}
          </div>

          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                    <div className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Practice Area</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("stage")}>
                    <div className="flex items-center gap-1">Stage <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </TableHead>
                  <TableHead>Stage Age</TableHead>
                  <TableHead>Open Tasks</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("client_health_score")}>
                    <div className="flex items-center gap-1">Health <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground py-8">
                      No client profiles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((c) => {
                    const ageDays = getStageAgeDays(c.stage_changed_at);
                    const ageStyle = getStageAgeStyle(ageDays);
                    const ageBadge = getStageAgeBadge(ageDays);
                    return (
                      <TableRow key={c.id} className={`cursor-pointer ${ageStyle}`} onClick={() => navigate(`/clients/${c.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserAvatar avatarUrl={c.avatar_url} fullName={c.name} size="sm" />
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{c.company}</TableCell>
                        <TableCell>{c.role}</TableCell>
                        <TableCell>{c.practice_area}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                            {c.stage}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${ageBadge.className}`}>
                                {ageBadge.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {c.stage_changed_at
                                ? `Stage changed: ${new Date(c.stage_changed_at).toLocaleDateString()}`
                                : "No stage change recorded"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {taskCounts[c.id] ? (
                            <Badge variant="secondary" className="text-xs">{taskCounts[c.id]} open</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>{c.client_health_score !== null ? `${c.client_health_score}/10` : "—"}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-2">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="board">
          <ClientsKanban refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
