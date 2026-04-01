import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Camera, Paperclip, Link2, ExternalLink, X, ArrowLeftRight } from "lucide-react";
import { logAudit, getUserName } from "@/lib/audit-logger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { toast } from "sonner";

interface TalentAttachment {
  id: string;
  talent_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

interface TalentLink {
  title: string;
  url: string;
}

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
  notes: string | null;
  links: TalentLink[];
  // Placed tab enrichment
  placed_client_name?: string | null;
  placed_start_date?: string | null;
}

const ITEMS_PER_PAGE = 10;

const emptyForm = { full_name: "", country: "", role: "", email: "", contact_number: "", rate_per_hour: "", notes: "" };

export default function TalentPool({ filter = "free" }: { filter?: "free" | "placed" }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<TalentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TalentRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formLinks, setFormLinks] = useState<TalentLink[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [pendingAvatarBlob, setPendingAvatarBlob] = useState<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Attachments state
  const [attachments, setAttachments] = useState<TalentAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const attachRef = useRef<HTMLInputElement>(null);

  // Detail/expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailAttachments, setDetailAttachments] = useState<TalentAttachment[]>([]);

  // Place dialog state (for Free tab → place talent with a client)
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [placeTalentId, setPlaceTalentId] = useState<string | null>(null);
  const [placeClientId, setPlaceClientId] = useState("");
  const [placeStartDate, setPlaceStartDate] = useState("");
  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>([]);

  const fetchClients = async () => {
    const { data } = await supabase.from("client_profiles").select("id, name").order("name");
    if (data) setClientOptions(data);
  };

  const handleMoveToPlaced = async (talentId: string, talentName: string) => {
    setPlaceTalentId(talentId);
    setPlaceClientId("");
    setPlaceStartDate("");
    await fetchClients();
    setPlaceDialogOpen(true);
  };

  const confirmPlace = async () => {
    if (!placeTalentId || !placeClientId) { toast.error("Please select a client"); return; }
    const { error } = await supabase.from("placed_vas").insert({
      client_profile_id: placeClientId,
      talent_id: placeTalentId,
      start_date: placeStartDate || null,
      created_by: user?.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("Already placed with this client");
      else toast.error(error.message);
      return;
    }
    const talentName = rows.find(r => r.id === placeTalentId)?.full_name || "Unknown";
    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "placed_va", entityId: placeClientId, clientProfileId: placeClientId, action: "create", description: `Placed talent: ${talentName}` });
    }
    toast.success("Talent placed with client");
    setPlaceDialogOpen(false);
    fetchData();
  };

  // Confirmation for moving to free
  const [freeConfirm, setFreeConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleMoveToFree = async (talentId: string) => {
    const talent = rows.find(r => r.id === talentId);
    setFreeConfirm({ id: talentId, name: talent?.full_name || "Unknown" });
  };

  const confirmMoveToFree = async () => {
    if (!freeConfirm) return;
    const { error } = await supabase.from("placed_vas").delete().eq("talent_id", freeConfirm.id);
    if (error) { toast.error("Failed to remove placement"); setFreeConfirm(null); return; }
    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "placed_va", entityId: freeConfirm.id, action: "delete", description: `Moved talent back to free: ${freeConfirm.name}` });
    }
    toast.success("Talent moved back to available");
    setFreeConfirm(null);
    fetchData();
  };

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const fetchData = async () => {
    // Get all placed talent data with client info
    const { data: placedData } = await supabase
      .from("placed_vas")
      .select("talent_id, client_profile_id, start_date, client_profiles(name)");
    const placedMap = new Map<string, { clientName: string; startDate: string | null }>();
    const placedIds = new Set<string>();
    (placedData || []).forEach((p: any) => {
      placedIds.add(p.talent_id);
      placedMap.set(p.talent_id, {
        clientName: p.client_profiles?.name || "Unknown",
        startDate: p.start_date,
      });
    });

    // Fetch all talent, then filter client-side for free/placed
    const { data: allData, error } = await supabase
      .from("talent_pool" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && allData) {
      const all = (allData as any[]).map((r) => ({
        ...r,
        links: Array.isArray(r.links) ? r.links : [],
        placed_client_name: placedMap.get(r.id)?.clientName || null,
        placed_start_date: placedMap.get(r.id)?.startDate || null,
      }));
      const filtered = filter === "placed"
        ? all.filter((r) => placedIds.has(r.id))
        : all.filter((r) => !placedIds.has(r.id));

      setTotal(filtered.length);
      const from = (page - 1) * ITEMS_PER_PAGE;
      setRows(filtered.slice(from, from + ITEMS_PER_PAGE));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [page, filter]);

  const fetchAttachmentsFor = async (talentId: string) => {
    const { data } = await supabase
      .from("talent_attachments" as any)
      .select("*")
      .eq("talent_id", talentId)
      .order("created_at", { ascending: false });
    return ((data as any) || []) as TalentAttachment[];
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormLinks([]);
    setAvatarPreview(null);
    setPendingAvatarBlob(null);
    setAttachments([]);
    setPendingFiles([]);
    setDialogOpen(true);
  };

  const openEdit = async (r: TalentRow) => {
    setEditing(r);
    setForm({
      full_name: r.full_name,
      country: r.country || "",
      role: r.role || "",
      email: r.email || "",
      contact_number: r.contact_number || "",
      rate_per_hour: r.rate_per_hour != null ? String(r.rate_per_hour) : "",
      notes: r.notes || "",
    });
    setFormLinks(r.links || []);
    setAvatarPreview(r.avatar_url);
    setPendingAvatarBlob(null);
    setPendingFiles([]);
    const atts = await fetchAttachmentsFor(r.id);
    setAttachments(atts);
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

  const uploadAttachments = async (talentId: string) => {
    for (const file of pendingFiles) {
      const path = `talent/${talentId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("talent-attachments").upload(path, file, { upsert: true });
      if (uploadErr) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("talent-attachments").getPublicUrl(path);
      await supabase.from("talent_attachments" as any).insert({
        talent_id: talentId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type || null,
        file_size: file.size || null,
        uploaded_by: user?.id,
      });
    }
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
      notes: form.notes.trim() || null,
      links: formLinks.filter((l) => l.title.trim() && l.url.trim()),
    };

    if (editing) {
      const avatarUrl = await uploadAvatar(editing.id);
      if (avatarUrl) payload.avatar_url = avatarUrl;
      const { error } = await supabase.from("talent_pool" as any).update(payload).eq("id", editing.id);
      if (error) { toast.error("Failed to update"); return; }
      await uploadAttachments(editing.id);
      toast.success("Talent updated");
    } else {
      payload.created_by = user?.id;
      const { data, error } = await supabase.from("talent_pool" as any).insert(payload).select("id").single();
      if (error || !data) { toast.error("Failed to add"); return; }
      const id = (data as any).id;
      const avatarUrl = await uploadAvatar(id);
      if (avatarUrl) {
        await supabase.from("talent_pool" as any).update({ avatar_url: avatarUrl }).eq("id", id);
      }
      await uploadAttachments(id);
      toast.success("Talent added");
    }
    setDialogOpen(false);
    setPendingAvatarBlob(null);
    setPendingFiles([]);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("talent_pool" as any).delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Talent removed");
    if (expandedId === id) setExpandedId(null);
    fetchData();
  };

  const deleteAttachment = async (att: TalentAttachment) => {
    await supabase.from("talent_attachments" as any).delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    setDetailAttachments((prev) => prev.filter((a) => a.id !== att.id));
    toast.success("Attachment deleted");
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    const atts = await fetchAttachmentsFor(id);
    setDetailAttachments(atts);
  };

  const addLink = () => setFormLinks((prev) => [...prev, { title: "", url: "" }]);
  const removeLink = (idx: number) => setFormLinks((prev) => prev.filter((_, i) => i !== idx));
  const updateLink = (idx: number, field: "title" | "url", value: string) =>
    setFormLinks((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Talent</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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

              {/* Notes */}
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this talent..." rows={3} />
              </div>

              {/* Links */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Links</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={addLink}>
                    <Plus className="h-3 w-3 mr-1" />Add Link
                  </Button>
                </div>
                {formLinks.map((link, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input placeholder="Title" value={link.title} onChange={(e) => updateLink(i, "title", e.target.value)} className="h-8 text-xs" />
                    <Input placeholder="https://..." value={link.url} onChange={(e) => updateLink(i, "url", e.target.value)} className="h-8 text-xs" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeLink(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Attachments</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => attachRef.current?.click()}>
                    <Paperclip className="h-3 w-3 mr-1" />Add File
                  </Button>
                  <input ref={attachRef} type="file" multiple className="hidden" onChange={(e) => {
                    if (e.target.files) setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                    if (attachRef.current) attachRef.current.value = "";
                  }} />
                </div>
                {/* Existing attachments */}
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 text-xs py-1">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">{att.file_name}</a>
                    <span className="text-muted-foreground">{formatFileSize(att.file_size)}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteAttachment(att)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
                {/* Pending uploads */}
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1 text-muted-foreground">
                    <Paperclip className="h-3 w-3 shrink-0" />
                    <span className="truncate flex-1">{f.name}</span>
                    <Badge variant="secondary" className="text-[9px]">pending</Badge>
                    <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>

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
                {filter === "placed" ? (
                  <>
                    <TableHead>Client Designated</TableHead>
                    <TableHead>Date Started</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>Email</TableHead>
                    <TableHead>Contact Number</TableHead>
                  </>
                )}
                <TableHead>Rate/Hr ($)</TableHead>
                {filter === "free" && <TableHead>Date Added</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={filter === "placed" ? 7 : 8} className="text-center text-muted-foreground py-8">No talent found</TableCell>
                </TableRow>
              ) : rows.map(r => (
                <>
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => toggleExpand(r.id)}>
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
                    {filter === "placed" ? (
                      <>
                        <TableCell className="font-medium text-primary">{r.placed_client_name || "—"}</TableCell>
                        <TableCell>{r.placed_start_date ? new Date(r.placed_start_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>{r.email || "—"}</TableCell>
                        <TableCell>{r.contact_number || "—"}</TableCell>
                      </>
                    )}
                    <TableCell>{r.rate_per_hour != null ? `$${Number(r.rate_per_hour).toFixed(2)}` : "—"}</TableCell>
                    {filter === "free" && <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {filter === "free" ? (
                          <Button variant="ghost" size="icon" title="Place with client" onClick={(e) => { e.stopPropagation(); handleMoveToPlaced(r.id, r.full_name); }}>
                            <ArrowLeftRight className="h-4 w-4 text-primary" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" title="Move back to available" onClick={(e) => { e.stopPropagation(); handleMoveToFree(r.id); }}>
                            <ArrowLeftRight className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && (
                    <TableRow key={`${r.id}-detail`}>
                      <TableCell colSpan={8} className="bg-muted/30 px-6 py-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          {/* Notes */}
                          <div>
                            <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Notes</h4>
                            <p className="text-sm whitespace-pre-wrap">{r.notes || <span className="text-muted-foreground italic">No notes</span>}</p>
                          </div>
                          {/* Attachments */}
                          <div>
                            <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Attachments</h4>
                            {detailAttachments.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No attachments</p>
                            ) : detailAttachments.map((att) => (
                              <div key={att.id} className="flex items-center gap-2 text-xs py-0.5">
                                <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{att.file_name}</a>
                                <span className="text-muted-foreground">{formatFileSize(att.file_size)}</span>
                              </div>
                            ))}
                          </div>
                          {/* Links */}
                          <div>
                            <h4 className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Links</h4>
                            {(!r.links || r.links.length === 0) ? (
                              <p className="text-sm text-muted-foreground italic">No links</p>
                            ) : r.links.map((link, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                                <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                                  {link.title || link.url}
                                </a>
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
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

      {/* Place talent dialog */}
      <Dialog open={placeDialogOpen} onOpenChange={setPlaceDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Place Talent with Client</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <Select value={placeClientId} onValueChange={setPlaceClientId}>
                <SelectTrigger><SelectValue placeholder="Choose a client..." /></SelectTrigger>
                <SelectContent>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={placeStartDate} onChange={(e) => setPlaceStartDate(e.target.value)} />
            </div>
            <Button onClick={confirmPlace}>Place Talent</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm move to free */}
      <AlertDialog open={!!freeConfirm} onOpenChange={() => setFreeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Talent Back to Available?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove all placements for <strong>{freeConfirm?.name}</strong> and move them back to the Free tab?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMoveToFree}>Move to Free</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AvatarCropDialog file={cropFile} open={cropOpen} onClose={() => { setCropOpen(false); setCropFile(null); }} onCrop={handleCropped} />
    </div>
  );
}
