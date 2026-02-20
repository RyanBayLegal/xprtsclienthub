import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Mail } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
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
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteProfileId, setInviteProfileId] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchClients = async () => {
    let q = supabase.from("client_profiles").select("id, name, company, role, stage, practice_area, client_health_score, stage_changed_at, avatar_url").order("created_at", { ascending: false }) as any;
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    if (data) setClients(data);
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
        if (t.client_profile_id) {
          counts[t.client_profile_id] = (counts[t.client_profile_id] || 0) + 1;
        }
      });
      setTaskCounts(counts);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchTaskCounts();
  }, [search]);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) { toast.error("Email and name are required"); return; }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-client", {
      body: { email: inviteEmail, name: inviteName, clientProfileId: inviteProfileId || undefined },
    });
    if (error) {
      toast.error(error.message || "Failed to invite client");
    } else if (data?.error) {
      toast.error(data.error);
    } else {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteProfileId("");
    }
    setInviting(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Client Profiles</h1>
        <div className="flex gap-2">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Mail className="mr-2 h-4 w-4" />Invite Client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Client by Email</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Client Name *</Label>
                  <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address *</Label>
                  <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="john@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Link to Existing Profile (optional)</Label>
                  <Select value={inviteProfileId} onValueChange={setInviteProfileId}>
                    <SelectTrigger><SelectValue placeholder="Select a profile..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {clients.filter(c => c.name).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  An account will be created and the client will receive a login link via email.
                </p>
                <Button onClick={handleInvite} disabled={inviting}>
                  {inviting ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search clients..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Practice Area</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Stage Age</TableHead>
              <TableHead>Open Tasks</TableHead>
              <TableHead>Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No client profiles yet. Convert a lead to create a client profile.
                </TableCell>
              </TableRow>
            ) : (
              clients.map((c) => {
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
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
