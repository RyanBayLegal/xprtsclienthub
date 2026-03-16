import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface TalentRow {
  id: string;
  full_name: string;
  country: string | null;
  role: string | null;
  email: string | null;
  contact_number: string | null;
  rate_per_hour: number | null;
  created_at: string;
}

const ITEMS_PER_PAGE = 10;

const emptyForm = { full_name: "", country: "", role: "", email: "", contact_number: "", rate_per_hour: "" };

export default function TalentPool() {
  const { user } = useAuth();
  const [rows, setRows] = useState<TalentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TalentRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchData = async () => {
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { count } = await supabase
      .from("talent_pool" as any)
      .select("id", { count: "exact", head: true });

    setTotal(count || 0);

    const { data, error } = await supabase
      .from("talent_pool" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (!error) setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: TalentRow) => {
    setEditing(r);
    setForm({
      full_name: r.full_name,
      country: r.country || "",
      role: r.role || "",
      email: r.email || "",
      contact_number: r.contact_number || "",
      rate_per_hour: r.rate_per_hour != null ? String(r.rate_per_hour) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.error("Full name is required"); return; }
    const payload: any = {
      full_name: form.full_name.trim(),
      country: form.country.trim() || null,
      role: form.role.trim() || null,
      email: form.email.trim() || null,
      contact_number: form.contact_number.trim() || null,
      rate_per_hour: form.rate_per_hour ? parseFloat(form.rate_per_hour) : null,
    };

    if (editing) {
      const { error } = await supabase.from("talent_pool" as any).update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Talent updated");
    } else {
      payload.created_by = user?.id;
      const { error } = await supabase.from("talent_pool" as any).insert(payload);
      if (error) { toast.error("Failed to add"); return; }
      toast.success("Talent added");
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("talent_pool" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Talent removed");
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Talent</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Talent" : "Add Talent"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Country</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
                <div><Label>Role</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Contact Number</Label><Input value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} /></div>
              </div>
              <div><Label>Rate per Hour ($)</Label><Input type="number" min="0" step="0.01" value={form.rate_per_hour} onChange={e => setForm(f => ({ ...f, rate_per_hour: e.target.value }))} /></div>
              <Button onClick={handleSave}>{editing ? "Update" : "Add"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Contact Number</TableHead>
                <TableHead>Rate/Hr ($)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No talent found</TableCell>
                </TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>{r.country || "—"}</TableCell>
                  <TableCell>{r.role || "—"}</TableCell>
                  <TableCell>{r.email || "—"}</TableCell>
                  <TableCell>{r.contact_number || "—"}</TableCell>
                  <TableCell>{r.rate_per_hour != null ? `$${Number(r.rate_per_hour).toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
