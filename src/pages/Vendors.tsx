import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Vendor {
  id: string;
  name: string;
  description: string | null;
  subscribed_date: string | null;
  subscribed_by: string | null;
  fee: string | null;
}

const PAGE_SIZE = 15;
const emptyForm = { name: "", description: "", subscribed_date: "", subscribed_by: "", fee: "" };

export default function Vendors() {
  const { role } = useAuth();
  const isAdmin = role === "team_admin";
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchVendors = async () => {
    const { data } = await supabase.from("vendors").select("id, name, description, subscribed_date, subscribed_by, fee").order("created_at", { ascending: false });
    if (data) setVendors(data as Vendor[]);
  };

  useEffect(() => { fetchVendors(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Vendor name is required"); return; }
    const payload = {
      name: form.name,
      description: form.description || null,
      subscribed_date: form.subscribed_date || null,
      subscribed_by: form.subscribed_by || null,
      fee: form.fee || null,
    };
    if (editingId) {
      const { error } = await supabase.from("vendors").update(payload as any).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Vendor updated");
    } else {
      const { error } = await supabase.from("vendors").insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Vendor added");
    }
    setDialogOpen(false);
    setForm(emptyForm);
    setEditingId(null);
    fetchVendors();
  };

  const handleEdit = (v: Vendor) => {
    setForm({
      name: v.name,
      description: v.description || "",
      subscribed_date: v.subscribed_date || "",
      subscribed_by: v.subscribed_by || "",
      fee: v.fee || "",
    });
    setEditingId(v.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vendor deleted");
    fetchVendors();
  };

  const totalPages = Math.ceil(vendors.length / PAGE_SIZE);
  const paginated = vendors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm(emptyForm); setEditingId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Vendor</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Vendor" : "New Vendor"}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subscribed Date</Label>
                    <Input type="date" value={form.subscribed_date} onChange={(e) => setForm((f) => ({ ...f, subscribed_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subscribed By</Label>
                    <Input value={form.subscribed_by} onChange={(e) => setForm((f) => ({ ...f, subscribed_by: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fee</Label>
                  <Input value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} />
                </div>
                <Button onClick={handleSave}>{editingId ? "Update" : "Add"} Vendor</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Subscribed Date</TableHead>
              <TableHead>Subscribed By</TableHead>
              <TableHead>Fee</TableHead>
              {isAdmin && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No vendors yet.
                </TableCell>
              </TableRow>
            ) : paginated.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="max-w-[200px] truncate">{v.description || "—"}</TableCell>
                <TableCell>{v.subscribed_date || "—"}</TableCell>
                <TableCell>{v.subscribed_by || "—"}</TableCell>
                <TableCell>{v.fee || "—"}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {vendors.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, vendors.length)} of {vendors.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
