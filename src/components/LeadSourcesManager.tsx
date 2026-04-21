import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LeadSource {
  id: string;
  name: string;
  created_at: string;
}

export default function LeadSourcesManager() {
  const { user } = useAuth();
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_sources")
      .select("id, name, created_at")
      .order("name", { ascending: true });
    if (error) toast.error(error.message);
    else setSources(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setName("");
    setDialogOpen(true);
  };

  const openEdit = (s: LeadSource) => {
    setEditingId(s.id);
    setName(s.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase
        .from("lead_sources")
        .update({ name: trimmed })
        .eq("id", editingId);
      if (error) toast.error(error.message);
      else toast.success("Source updated");
    } else {
      const { error } = await supabase
        .from("lead_sources")
        .insert({ name: trimmed, created_by: user?.id });
      if (error) toast.error(error.message);
      else toast.success("Source added");
    }
    setSaving(false);
    setDialogOpen(false);
    fetchSources();
  };

  const handleDelete = async (s: LeadSource) => {
    if (!confirm(`Delete "${s.name}"? Leads using this source will keep their existing value.`)) return;
    const { error } = await supabase.from("lead_sources").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Source deleted");
      fetchSources();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Lead Sources</CardTitle>
          <CardDescription>
            Manage the dropdown options available in the Source field on Leads.
          </CardDescription>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Source
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : sources.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No sources yet. Add one to get started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(s.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Source" : "Add Source"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Referral, LinkedIn"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
