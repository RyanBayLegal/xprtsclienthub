import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAudit, logFieldChanges, getUserName } from "@/lib/audit-logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, Paperclip, FileText, Image as ImageIcon, File as FileIcon, Settings2 } from "lucide-react";
import { toast } from "sonner";
import VendorAttachments from "@/components/VendorAttachments";

interface VendorFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  signedUrl?: string;
}

interface Vendor {
  id: string;
  name: string;
  description: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

const PAGE_SIZE = 15;
const emptyForm = { name: "", description: "", company_name: "", email: "", phone: "" };

export default function Vendors() {
  const { role, user } = useAuth();
  const isAdmin = role === "team_admin";
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "company_name">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [attachmentsVendor, setAttachmentsVendor] = useState<Vendor | null>(null);
  const [filesByVendor, setFilesByVendor] = useState<Record<string, VendorFile[]>>({});

  const fetchVendors = async () => {
    const { data } = await supabase.from("vendors").select("id, name, description, company_name, email, phone").order("created_at", { ascending: false });
    if (data) setVendors(data as unknown as Vendor[]);
  };

  const fetchAttachments = async () => {
    const { data } = await supabase.from("vendor_attachments" as any).select("id, vendor_id, file_name, file_url, file_type").order("created_at", { ascending: false });
    if (!data) return;
    const grouped: Record<string, VendorFile[]> = {};
    (data as any[]).forEach((f) => {
      if (!grouped[f.vendor_id]) grouped[f.vendor_id] = [];
      grouped[f.vendor_id].push({ id: f.id, file_name: f.file_name, file_url: f.file_url, file_type: f.file_type });
    });
    setFilesByVendor(grouped);
  };

  const getSignedUrl = async (path: string) => {
    const cleanPath = path.match(/vendor-attachments\/(.+?)(\?|$)/)?.[1] || path;
    const { data } = await supabase.storage.from("vendor-attachments").createSignedUrl(decodeURIComponent(cleanPath), 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  useEffect(() => { fetchVendors(); fetchAttachments(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Vendor name is required"); return; }
    const payload = {
      name: form.name,
      description: form.description || null,
      company_name: form.company_name || null,
      email: form.email || null,
      phone: form.phone || null,
    };
    const userName = user ? await getUserName(user.id) : "Unknown";
    if (editingId) {
      const oldVendor = vendors.find((v) => v.id === editingId);
      const { error } = await supabase.from("vendors").update(payload as any).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      if (user && oldVendor) {
        await logFieldChanges(user.id, userName, "vendor", editingId, oldVendor, payload, null, {
          name: "Vendor Name", company_name: "Company", email: "Email", phone: "Phone", description: "Description",
        });
      }
      toast.success("Vendor updated");
    } else {
      const { data: inserted, error } = await supabase.from("vendors").insert(payload as any).select("id").single();
      if (error) { toast.error(error.message); return; }
      if (user && inserted) {
        await logAudit({ userId: user.id, userName, entityType: "vendor", entityId: inserted.id, action: "create", description: `Added vendor: ${payload.name}` });
      }
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
      company_name: v.company_name || "",
      email: v.email || "",
      phone: v.phone || "",
    });
    setEditingId(v.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const vendor = vendors.find((v) => v.id === id);
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "vendor", entityId: id, action: "delete", description: `Deleted vendor: ${vendor?.name || id}` });
    }
    toast.success("Vendor deleted");
    fetchVendors();
  };

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase();
    return !q || v.name.toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q) || (v.company_name || "").toLowerCase().includes(q) || (v.email || "").toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") cmp = a.name.localeCompare(b.name);
    else if (sortBy === "company_name") cmp = (a.company_name || "").localeCompare(b.company_name || "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
                  <Label>Company Name</Label>
                  <Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <Button onClick={handleSave}>{editingId ? "Update" : "Add"} Vendor</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => { setSortBy("name"); setSortDir(sortBy === "name" && sortDir === "asc" ? "desc" : "asc"); }}>
                <span className="flex items-center gap-1">Vendor Name {sortBy === "name" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => { setSortBy("company_name"); setSortDir(sortBy === "company_name" && sortDir === "asc" ? "desc" : "asc"); }}>
                <span className="flex items-center gap-1">Company {sortBy === "company_name" ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}</span>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Description</TableHead>
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
                <TableCell>{v.company_name || "—"}</TableCell>
                <TableCell>{v.email || "—"}</TableCell>
                <TableCell>{v.phone || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{v.description || "—"}</TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1 items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="relative" title="Attachments">
                            <Paperclip className="h-4 w-4" />
                            {(filesByVendor[v.id]?.length || 0) > 0 && (
                              <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] rounded-full flex items-center justify-center">
                                {filesByVendor[v.id].length}
                              </Badge>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 bg-popover z-50">
                          <DropdownMenuLabel className="flex items-center justify-between">
                            <span>Attachments ({filesByVendor[v.id]?.length || 0})</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAttachmentsVendor(v)} title="Manage">
                              <Settings2 className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {(filesByVendor[v.id]?.length || 0) === 0 ? (
                            <div className="px-2 py-3 text-xs text-muted-foreground text-center">No attachments</div>
                          ) : (
                            filesByVendor[v.id].map((f) => {
                              const Icon = f.file_type?.startsWith("image/") ? ImageIcon : f.file_type?.includes("pdf") ? FileText : FileIcon;
                              return (
                                <DropdownMenuItem key={f.id} onClick={() => getSignedUrl(f.file_url)} className="cursor-pointer gap-2">
                                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="truncate text-xs">{f.file_name}</span>
                                </DropdownMenuItem>
                              );
                            })
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      <Dialog open={!!attachmentsVendor} onOpenChange={(o) => !o && setAttachmentsVendor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attachments — {attachmentsVendor?.name}</DialogTitle>
          </DialogHeader>
          {attachmentsVendor && <VendorAttachments vendorId={attachmentsVendor.id} canManage={isAdmin} />}
        </DialogContent>
      </Dialog>

      {sorted.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
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
