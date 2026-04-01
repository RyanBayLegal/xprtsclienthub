import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Trash2, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { logAudit, getUserName } from "@/lib/audit-logger";

interface PlacedVA {
  id: string;
  talent_id: string;
  start_date: string | null;
  notes: string | null;
  created_at: string;
  talent?: {
    full_name: string;
    role: string | null;
    email: string | null;
    contact_number: string | null;
    rate_per_hour: number | null;
    avatar_url: string | null;
    country: string | null;
  };
}

interface TalentOption {
  id: string;
  full_name: string;
  role: string | null;
  avatar_url: string | null;
}

export default function PlacedVAs({ clientProfileId, staffStartDate, onStaffStartDateChange }: {
  clientProfileId: string;
  staffStartDate: string | null;
  onStaffStartDateChange: (date: string | null) => void;
}) {
  const { user } = useAuth();
  const [placedVAs, setPlacedVAs] = useState<PlacedVA[]>([]);
  const [talentOptions, setTalentOptions] = useState<TalentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTalent, setSelectedTalent] = useState("");
  const [startDate, setStartDate] = useState("");
  const [freeConfirm, setFreeConfirm] = useState<{ id: string; talentName: string } | null>(null);

  const fetchData = async () => {
    const { data } = await supabase
      .from("placed_vas" as any)
      .select("*")
      .eq("client_profile_id", clientProfileId)
      .order("created_at", { ascending: false });

    if (data) {
      const vas = data as any[];
      // Fetch talent details for each
      const talentIds = vas.map((v) => v.talent_id);
      if (talentIds.length > 0) {
        const { data: talents } = await supabase
          .from("talent_pool" as any)
          .select("id, full_name, role, email, contact_number, rate_per_hour, avatar_url, country")
          .in("id", talentIds);
        const talentMap = new Map((talents as any[] || []).map((t) => [t.id, t]));
        setPlacedVAs(vas.map((v) => ({ ...v, talent: talentMap.get(v.talent_id) })));
      } else {
        setPlacedVAs([]);
      }
    }
    setLoading(false);
  };

  const fetchTalentOptions = async () => {
    const { data } = await supabase
      .from("talent_pool" as any)
      .select("*")
      .order("full_name");
    if (data) setTalentOptions((data as any[]).map(t => ({ id: t.id, full_name: t.full_name, role: t.role, avatar_url: t.avatar_url })));
  };

  useEffect(() => { fetchData(); }, [clientProfileId]);

  const handleAdd = async () => {
    if (!selectedTalent) { toast.error("Please select a talent"); return; }

    const { error } = await supabase.from("placed_vas" as any).insert({
      client_profile_id: clientProfileId,
      talent_id: selectedTalent,
      start_date: startDate || null,
      created_by: user?.id,
    });

    if (error) {
      if (error.code === "23505") toast.error("This VA is already placed with this client");
      else toast.error(error.message);
      return;
    }

    // Update staff_start_date on client profile if start_date provided
    if (startDate) {
      onStaffStartDateChange(startDate);
    }

    toast.success("VA placed successfully");

    if (user) {
      const userName = await getUserName(user.id);
      const talentName = talentOptions.find(t => t.id === selectedTalent)?.full_name || "Unknown";
      await logAudit({ userId: user.id, userName, entityType: "placed_va", entityId: clientProfileId, clientProfileId, action: "create", description: `Placed VA: ${talentName}` });
    }

    setDialogOpen(false);
    setSelectedTalent("");
    setStartDate("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const va = placedVAs.find(v => v.id === id);
    await supabase.from("placed_vas" as any).delete().eq("id", id);
    toast.success("VA removed");

    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "placed_va", entityId: clientProfileId, clientProfileId, action: "delete", description: `Removed VA: ${va?.talent?.full_name || "Unknown"}` });
    }

    fetchData();
  };

  const confirmMoveToFree = async () => {
    if (!freeConfirm) return;
    await supabase.from("placed_vas" as any).delete().eq("id", freeConfirm.id);
    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "placed_va", entityId: clientProfileId, clientProfileId, action: "delete", description: `Moved VA back to free: ${freeConfirm.talentName}` });
    }
    toast.success("VA moved back to available");
    setFreeConfirm(null);
    fetchData();
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  if (loading) return <p className="text-muted-foreground text-center py-8">Loading...</p>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Placed VAs</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (o) fetchTalentOptions(); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add VA</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Place a VA</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Select Talent *</Label>
                  <Select value={selectedTalent} onValueChange={setSelectedTalent}>
                    <SelectTrigger><SelectValue placeholder="Choose from talent pool..." /></SelectTrigger>
                    <SelectContent>
                      {talentOptions.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.full_name}{t.role ? ` — ${t.role}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <Button onClick={handleAdd}>Place VA</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Rate/Hr</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {placedVAs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No VAs placed yet</TableCell>
              </TableRow>
            ) : placedVAs.map((va) => (
              <TableRow key={va.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      {va.talent?.avatar_url && <AvatarImage src={va.talent.avatar_url} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                        {va.talent ? getInitials(va.talent.full_name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{va.talent?.full_name || "Unknown"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{va.talent?.role || "—"}</TableCell>
                <TableCell className="text-sm">{va.talent?.country || "—"}</TableCell>
                <TableCell className="text-sm">{va.talent?.email || "—"}</TableCell>
                <TableCell className="text-sm">{va.talent?.contact_number || "—"}</TableCell>
                <TableCell className="text-sm">{va.talent?.rate_per_hour != null ? `$${Number(va.talent.rate_per_hour).toFixed(2)}` : "—"}</TableCell>
                <TableCell className="text-sm">{va.start_date ? new Date(va.start_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Move back to available" onClick={() => setFreeConfirm({ id: va.id, talentName: va.talent?.full_name || "Unknown" })}>
                      <ArrowLeftRight className="h-4 w-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(va.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
