import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ROLE_STATUSES = ["open", "sourcing", "for interview", "filled", "withdrawn"];

interface RoleOpen {
  id: string;
  client_profile_id: string;
  role_name: string;
  is_signed: boolean | null;
  pricing: string | null;
  date_requested: string | null;
  arrangement_hours: string | null;
  agreement: string | null;
  projected_start_date: string | null;
  role_status: string;
  client_name?: string;
}

interface ClientOption {
  id: string;
  name: string;
}

export default function OpenRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<RoleOpen[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const fetchData = async () => {
    const [rolesRes, clientsRes] = await Promise.all([
      supabase.from("roles_open").select("*, client_profiles(name)").eq("is_signed", true).order("created_at", { ascending: false }),
      supabase.from("client_profiles").select("id, name").order("name"),
    ]);

    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => ({
        ...r,
        client_name: r.client_profiles?.name || "Unknown",
      })));
    }
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const addRole = async () => {
    if (clients.length === 0) {
      toast.error("No clients available. Create a client profile first.");
      return;
    }
    const clientId = selectedClient !== "all" ? selectedClient : clients[0].id;
    const { data, error } = await supabase
      .from("roles_open")
      .insert({ client_profile_id: clientId, role_name: "New Role", is_signed: true, role_status: "open" } as any)
      .select("*, client_profiles(name)")
      .single();
    if (error) { toast.error(error.message); return; }
    setRoles([{ ...data, client_name: (data as any).client_profiles?.name || "Unknown" } as RoleOpen, ...roles]);
    toast.success("Role added");
  };

  const updateRole = async (roleId: string, field: string, value: string | boolean) => {
    setRoles((r) => r.map((ro) => ro.id === roleId ? { ...ro, [field]: value } : ro));
    await supabase.from("roles_open").update({ [field]: value } as any).eq("id", roleId);
  };

  const deleteRole = async (roleId: string) => {
    await supabase.from("roles_open").delete().eq("id", roleId);
    setRoles((r) => r.filter((ro) => ro.id !== roleId));
    toast.success("Role deleted");
  };

  const filtered = roles.filter((r) => {
    if (selectedClient !== "all" && r.client_profile_id !== selectedClient) return false;
    if (selectedStatus !== "all" && r.role_status !== selectedStatus) return false;
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Open Roles</h1>
        <Button size="sm" onClick={addRole}>
          <Plus className="mr-1 h-4 w-4" />Add Role
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter by Client:</span>
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">Status:</span>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ROLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No open roles found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Date Requested</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Arrangement (Hours)</TableHead>
                  
                  <TableHead>Projected Start</TableHead>
                  <TableHead>Signed EA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.client_name}</TableCell>
                    <TableCell>
                      <Input value={r.role_name} onChange={(e) => updateRole(r.id, "role_name", e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="date" value={r.date_requested || ""} onChange={(e) => updateRole(r.id, "date_requested", e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={r.pricing || ""} onChange={(e) => updateRole(r.id, "pricing", e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Input value={r.arrangement_hours || ""} onChange={(e) => updateRole(r.id, "arrangement_hours", e.target.value)} className="h-8" placeholder="e.g. 40" />
                    </TableCell>
                    <TableCell>
                      <Input type="date" value={r.projected_start_date || ""} onChange={(e) => updateRole(r.id, "projected_start_date", e.target.value)} className="h-8" />
                    </TableCell>
                    <TableCell>
                      <Checkbox checked={r.is_signed || false} onCheckedChange={(v) => updateRole(r.id, "is_signed", !!v)} />
                    </TableCell>
                    <TableCell>
                      <Select value={r.role_status || "open"} onValueChange={(v) => updateRole(r.id, "role_status", v)}>
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteRole(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
