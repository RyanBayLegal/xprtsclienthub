import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Square, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Client { id: string; name: string; }
interface Project { id: string; name: string; client_profile_id: string; target_hours: number; }
interface Staff { user_id: string; full_name: string | null; }
interface TimeEntry {
  id: string;
  staff_assigned: string;
  entry_date: string;
  client_profile_id: string;
  project_id: string;
  activity_name: string;
  start_time: string | null;
  end_time: string | null;
  total_hours: number;
  target_hours: number;
  remaining_hours: number;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  not_started: "secondary",
  in_progress: "default",
  completed: "outline",
};

export default function ActivitiesTimeTracker() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [viewTab, setViewTab] = useState("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStaff, setFilterStaff] = useState<string>("all");

  const [form, setForm] = useState({
    staff_assigned: "",
    client_profile_id: "",
    project_id: "",
    activity_name: "",
    target_hours: "0",
    entry_date: new Date().toISOString().split("T")[0],
  });

  const [projectForm, setProjectForm] = useState({ client_profile_id: "", name: "", target_hours: "0" });

  const fetchAll = useCallback(async () => {
    const [entriesRes, clientsRes, projectsRes, staffRes] = await Promise.all([
      supabase.from("activity_time_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("client_profiles").select("id, name"),
      supabase.from("client_projects").select("*"),
      supabase.from("profiles").select("user_id, full_name").eq("is_active", true),
    ]);
    if (entriesRes.data) setEntries(entriesRes.data as TimeEntry[]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (projectsRes.data) setProjects(projectsRes.data as Project[]);
    if (staffRes.data) setStaff(staffRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const clientProjects = projects.filter((p) => p.client_profile_id === form.client_profile_id);

  const handleAddEntry = async () => {
    if (!form.client_profile_id || !form.project_id || !form.activity_name.trim() || !form.staff_assigned) {
      toast.error("Please fill all required fields"); return;
    }
    const { error } = await supabase.from("activity_time_entries").insert({
      staff_assigned: form.staff_assigned,
      client_profile_id: form.client_profile_id,
      project_id: form.project_id,
      activity_name: form.activity_name.trim(),
      target_hours: parseFloat(form.target_hours) || 0,
      entry_date: form.entry_date,
      status: "not_started",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Activity entry created");
    setForm({ staff_assigned: user?.id || "", client_profile_id: "", project_id: "", activity_name: "", target_hours: "0", entry_date: new Date().toISOString().split("T")[0] });
    setDialogOpen(false);
    fetchAll();
  };

  const handleAddProject = async () => {
    if (!projectForm.client_profile_id || !projectForm.name.trim()) {
      toast.error("Client and project name required"); return;
    }
    const { error } = await supabase.from("client_projects").insert({
      client_profile_id: projectForm.client_profile_id,
      name: projectForm.name.trim(),
      target_hours: parseFloat(projectForm.target_hours) || 0,
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    setProjectForm({ client_profile_id: "", name: "", target_hours: "0" });
    setProjectDialogOpen(false);
    fetchAll();
  };

  const handleStart = async (entry: TimeEntry) => {
    // Check no other active timer for this user
    const activeEntry = entries.find((e) => e.staff_assigned === entry.staff_assigned && e.status === "in_progress");
    if (activeEntry) {
      toast.error("You already have an active timer running. Stop it first."); return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from("activity_time_entries").update({
      start_time: now,
      entry_date: new Date().toISOString().split("T")[0],
      status: "in_progress",
    }).eq("id", entry.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Timer started");
    fetchAll();
  };

  const handleEnd = async (entry: TimeEntry) => {
    if (!entry.start_time) { toast.error("Timer hasn't started yet"); return; }
    const now = new Date();
    const start = new Date(entry.start_time);
    if (now < start) { toast.error("End time cannot be before start time"); return; }
    const totalHours = parseFloat(((now.getTime() - start.getTime()) / (1000 * 60 * 60)).toFixed(2));
    const remainingHours = parseFloat((entry.target_hours - totalHours).toFixed(2));

    const { error } = await supabase.from("activity_time_entries").update({
      end_time: now.toISOString(),
      total_hours: totalHours,
      remaining_hours: remainingHours,
      status: "completed",
    }).eq("id", entry.id);
    if (error) { toast.error(error.message); return; }

    // Send notification if remaining > 0
    if (remainingHours > 0 && user) {
      await supabase.from("notifications").insert({
        user_id: entry.staff_assigned,
        type: "time_tracker",
        title: "Target hours not yet completed",
        message: `Your target hours for "${entry.activity_name}" are not yet completed. Remaining hours: ${remainingHours} hours.`,
      });
    }

    toast.success("Timer stopped");
    fetchAll();
  };

  const getClientName = (id: string) => clients.find((c) => c.id === id)?.name || "Unknown";
  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || "Unknown";
  const getStaffName = (id: string) => staff.find((s) => s.user_id === id)?.full_name || "Unknown";

  const filteredEntries = entries.filter((e) => {
    if (filterClient !== "all" && e.client_profile_id !== filterClient) return false;
    if (filterProject !== "all" && e.project_id !== filterProject) return false;
    if (filterStaff !== "all" && e.staff_assigned !== filterStaff) return false;
    return true;
  });

  // Group entries
  const groupByClient = () => {
    const grouped: Record<string, TimeEntry[]> = {};
    filteredEntries.forEach((e) => {
      const key = e.client_profile_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return grouped;
  };

  const groupByProject = () => {
    const grouped: Record<string, TimeEntry[]> = {};
    filteredEntries.forEach((e) => {
      const key = e.project_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return grouped;
  };

  const groupByClientProject = () => {
    const grouped: Record<string, Record<string, TimeEntry[]>> = {};
    filteredEntries.forEach((e) => {
      if (!grouped[e.client_profile_id]) grouped[e.client_profile_id] = {};
      if (!grouped[e.client_profile_id][e.project_id]) grouped[e.client_profile_id][e.project_id] = [];
      grouped[e.client_profile_id][e.project_id].push(e);
    });
    return grouped;
  };

  // Dashboard calculations
  const totalLogged = filteredEntries.reduce((s, e) => s + e.total_hours, 0);
  const totalTarget = filteredEntries.reduce((s, e) => s + e.target_hours, 0);
  const totalRemaining = filteredEntries.reduce((s, e) => s + e.remaining_hours, 0);
  const activeCount = filteredEntries.filter((e) => e.status !== "completed").length;

  const renderEntryRow = (e: TimeEntry) => (
    <TableRow key={e.id}>
      <TableCell className="text-sm">{getStaffName(e.staff_assigned)}</TableCell>
      <TableCell className="text-sm">{e.entry_date}</TableCell>
      <TableCell className="text-sm">{getClientName(e.client_profile_id)}</TableCell>
      <TableCell className="text-sm">{getProjectName(e.project_id)}</TableCell>
      <TableCell className="text-sm">{e.activity_name}</TableCell>
      <TableCell className="text-sm">{e.start_time ? format(new Date(e.start_time), "HH:mm:ss") : "—"}</TableCell>
      <TableCell className="text-sm">{e.end_time ? format(new Date(e.end_time), "HH:mm:ss") : "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{e.total_hours.toFixed(2)}</TableCell>
      <TableCell className="text-sm">{e.target_hours}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{e.remaining_hours.toFixed(2)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_COLORS[e.status] as any} className="capitalize text-xs">
          {e.status.replace("_", " ")}
        </Badge>
      </TableCell>
      <TableCell>
        {e.status === "not_started" && (
          <Button size="sm" variant="outline" onClick={() => handleStart(e)} className="h-7 gap-1">
            <Play className="h-3 w-3" />Start
          </Button>
        )}
        {e.status === "in_progress" && (
          <Button size="sm" variant="destructive" onClick={() => handleEnd(e)} className="h-7 gap-1">
            <Square className="h-3 w-3" />End
          </Button>
        )}
      </TableCell>
    </TableRow>
  );

  const renderTable = (data: TimeEntry[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Activity</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>End</TableHead>
          <TableHead>Total Hrs</TableHead>
          <TableHead>Target Hrs</TableHead>
          <TableHead>Remaining</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">No entries</TableCell></TableRow>
        ) : data.map(renderEntryRow)}
      </TableBody>
    </Table>
  );

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Hours Logged</p>
            <p className="text-2xl font-bold">{totalLogged.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Target Hours</p>
            <p className="text-2xl font-bold">{totalTarget.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Remaining</p>
            <p className="text-2xl font-bold">{totalRemaining.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active / Incomplete</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Client</Label>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Project</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {(filterClient !== "all" ? projects.filter(p => p.client_profile_id === filterClient) : projects).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Staff</Label>
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unknown"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 ml-auto">
              <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="mr-1 h-4 w-4" />New Project</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="space-y-2">
                      <Label>Client *</Label>
                      <Select value={projectForm.client_profile_id} onValueChange={(v) => setProjectForm({ ...projectForm, client_profile_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Project Name *</Label>
                      <Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Hours</Label>
                      <Input type="number" value={projectForm.target_hours} onChange={(e) => setProjectForm({ ...projectForm, target_hours: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button onClick={handleAddProject}>Create Project</Button></DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Entry</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Activity Entry</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="space-y-2">
                      <Label>Staff Assigned *</Label>
                      <Select value={form.staff_assigned} onValueChange={(v) => setForm({ ...form, staff_assigned: v })}>
                        <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                        <SelectContent>
                          {staff.map((s) => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unknown"}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Client *</Label>
                      <Select value={form.client_profile_id} onValueChange={(v) => setForm({ ...form, client_profile_id: v, project_id: "" })}>
                        <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                        <SelectContent>
                          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Project *</Label>
                      <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select project..." /></SelectTrigger>
                        <SelectContent>
                          {clientProjects.length === 0 ? (
                            <SelectItem value="_none" disabled>No projects for this client</SelectItem>
                          ) : clientProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Activity Name *</Label>
                      <Input value={form.activity_name} onChange={(e) => setForm({ ...form, activity_name: e.target.value })} placeholder="e.g. Development, Design Review" />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Hours</Label>
                      <Input type="number" value={form.target_hours} onChange={(e) => setForm({ ...form, target_hours: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter><Button onClick={handleAddEntry}>Create Entry</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Views */}
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList>
          <TabsTrigger value="all">All Entries</TabsTrigger>
          <TabsTrigger value="client">Per Client</TabsTrigger>
          <TabsTrigger value="project">Per Project</TabsTrigger>
          <TabsTrigger value="client-project">Client + Project</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card><CardContent className="p-4">{renderTable(filteredEntries)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="client">
          {Object.entries(groupByClient()).map(([clientId, items]) => (
            <Card key={clientId} className="mb-4">
              <CardHeader className="py-3"><CardTitle className="text-base">{getClientName(clientId)}</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">{renderTable(items)}</CardContent>
            </Card>
          ))}
          {Object.keys(groupByClient()).length === 0 && <p className="text-muted-foreground text-center py-8">No entries</p>}
        </TabsContent>

        <TabsContent value="project">
          {Object.entries(groupByProject()).map(([projectId, items]) => (
            <Card key={projectId} className="mb-4">
              <CardHeader className="py-3"><CardTitle className="text-base">{getProjectName(projectId)}</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">{renderTable(items)}</CardContent>
            </Card>
          ))}
          {Object.keys(groupByProject()).length === 0 && <p className="text-muted-foreground text-center py-8">No entries</p>}
        </TabsContent>

        <TabsContent value="client-project">
          {Object.entries(groupByClientProject()).map(([clientId, projectMap]) => (
            <Card key={clientId} className="mb-4">
              <CardHeader className="py-3"><CardTitle className="text-base">{getClientName(clientId)}</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {Object.entries(projectMap).map(([projectId, items]) => (
                  <div key={projectId}>
                    <h4 className="font-medium text-sm mb-2 text-muted-foreground">Project: {getProjectName(projectId)}</h4>
                    {renderTable(items)}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {Object.keys(groupByClientProject()).length === 0 && <p className="text-muted-foreground text-center py-8">No entries</p>}
        </TabsContent>

        <TabsContent value="dashboard">
          <div className="space-y-6">
            {/* Per-Client Summary */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />By Client</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Logged Hrs</TableHead>
                      <TableHead>Target Hrs</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupByClient()).map(([clientId, items]) => {
                      const logged = items.reduce((s, e) => s + e.total_hours, 0);
                      const target = items.reduce((s, e) => s + e.target_hours, 0);
                      const pct = target > 0 ? Math.min(100, (logged / target) * 100) : 0;
                      return (
                        <TableRow key={clientId}>
                          <TableCell>{getClientName(clientId)}</TableCell>
                          <TableCell>{logged.toFixed(1)}</TableCell>
                          <TableCell>{target.toFixed(1)}</TableCell>
                          <TableCell>{(target - logged).toFixed(1)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Per-Project Summary */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />By Project</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Logged Hrs</TableHead>
                      <TableHead>Target Hrs</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupByProject()).map(([projectId, items]) => {
                      const logged = items.reduce((s, e) => s + e.total_hours, 0);
                      const target = items.reduce((s, e) => s + e.target_hours, 0);
                      const pct = target > 0 ? Math.min(100, (logged / target) * 100) : 0;
                      const staffNames = [...new Set(items.map((e) => getStaffName(e.staff_assigned)))].join(", ");
                      return (
                        <TableRow key={projectId}>
                          <TableCell>{getProjectName(projectId)}</TableCell>
                          <TableCell>{getClientName(items[0].client_profile_id)}</TableCell>
                          <TableCell>{logged.toFixed(1)}</TableCell>
                          <TableCell>{target.toFixed(1)}</TableCell>
                          <TableCell>{(target - logged).toFixed(1)}</TableCell>
                          <TableCell className="text-sm">{staffNames}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* By Staff */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />By Staff</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Logged Hrs</TableHead>
                      <TableHead>Target Hrs</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const byStaff: Record<string, TimeEntry[]> = {};
                      filteredEntries.forEach((e) => {
                        if (!byStaff[e.staff_assigned]) byStaff[e.staff_assigned] = [];
                        byStaff[e.staff_assigned].push(e);
                      });
                      return Object.entries(byStaff).map(([staffId, items]) => (
                        <TableRow key={staffId}>
                          <TableCell>{getStaffName(staffId)}</TableCell>
                          <TableCell>{items.reduce((s, e) => s + e.total_hours, 0).toFixed(1)}</TableCell>
                          <TableCell>{items.reduce((s, e) => s + e.target_hours, 0).toFixed(1)}</TableCell>
                          <TableCell>{items.reduce((s, e) => s + e.remaining_hours, 0).toFixed(1)}</TableCell>
                          <TableCell>{items.length}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
