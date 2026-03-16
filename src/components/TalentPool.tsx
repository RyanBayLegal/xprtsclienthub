import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { toast } from "sonner";

interface TalentRow {
  id: string;
  full_name: string;
  country: string | null;
  role: string | null;
  email: string | null;
  contact_number: string | null;
  rate_per_hour: number | null;
  avatar_url: string | null;
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setAvatarPreview(null);
    setPendingAvatarBlob(null);
    setDialogOpen(true);
  };

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
    setAvatarPreview(r.avatar_url);
    setPendingAvatarBlob(null);
    setDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setCropFile(file);
    setCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCropped = (blob: Blob) => {
    setCropOpen(false);
    setCropFile(null);
    setPendingAvatarBlob(blob);
    setAvatarPreview(URL.createObjectURL(blob));
  };

  const uploadAvatar = async (talentId: string): Promise<string | null> => {
    if (!pendingAvatarBlob) return null;
    const path = `talent/${talentId}/avatar.png`;
    const { error } = await supabase.storage.from("avatars").upload(path, pendingAvatarBlob, { upsert: true, contentType: "image/png" });
    if (error) { toast.error("Avatar upload failed"); return null; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
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
      const avatarUrl = await uploadAvatar(editing.id);
      if (avatarUrl) payload.avatar_url = avatarUrl;
      const { error } = await supabase.from("talent_pool" as any).update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Talent updated");
    } else {
      payload.created_by = user?.id;
      const { data, error } = await supabase.from("talent_pool" as any).insert(payload).select("id").single();
      if (error || !data) { toast.error("Failed to add"); return; }
      const avatarUrl = await uploadAvatar((data as any).id);
      if (avatarUrl) {
        await supabase.from("talent_pool" as any).update({ avatar_url: avatarUrl }).eq("id", (data as any).id);
      }
      toast.success("Talent added");
    }
    setDialogOpen(false);
    setPendingAvatarBlob(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("talent_pool" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Talent removed");
    fetchData();
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

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
              {/* Avatar upload */}
              <div className="flex justify-center">
                <div className="relative group w-fit">
                  <Avatar className="h-20 w-20 text-xl">
                    {avatarPreview && <AvatarImage src={avatarPreview} alt="Avatar" />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {form.full_name ? getInitials(form.full_name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

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
                <TableHead>Name</TableHead>
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
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {r.avatar_url && <AvatarImage src={r.avatar_url} alt={r.full_name} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(r.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{r.full_name}</span>
                    </div>
                  </TableCell>
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

      <AvatarCropDialog file={cropFile} open={cropOpen} onClose={() => { setCropOpen(false); setCropFile(null); }} onCrop={handleCropped} />
    </div>
  );
}
