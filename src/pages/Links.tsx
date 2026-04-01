import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit, getUserName, logFieldChanges } from "@/lib/audit-logger";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TeamLink {
  id: string;
  title: string;
  url: string;
  category: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

const DEFAULT_CATEGORIES = ["General", "Tools", "Docs", "Resources", "Templates", "Other"];

export default function Links() {
  const { user } = useAuth();
  const [links, setLinks] = useState<TeamLink[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("General");
  const [customCategory, setCustomCategory] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editLink, setEditLink] = useState<TeamLink | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Derive all unique categories from existing links + defaults
  const allCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...links.map((l) => l.category || "General")])
  ).sort();

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("team_links")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error loading links", description: error.message, variant: "destructive" });
    } else {
      setLinks((data as TeamLink[]) || []);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const resolveCategory = (selected: string, custom: string) => {
    if (selected === "__custom") return custom.trim() || "General";
    return selected;
  };

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" });
      return;
    }

    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;

    setLoading(true);

    let creatorName: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      creatorName = profile?.full_name || user.email || null;
    }

    const { data: inserted, error } = await supabase.from("team_links").insert({
      title: title.trim(),
      url: finalUrl,
      category: resolveCategory(category, customCategory),
      created_by: user?.id,
      created_by_name: creatorName,
    }).select().single();

    setLoading(false);

    if (error) {
      toast({ title: "Error adding link", description: error.message, variant: "destructive" });
    } else {
      if (user) {
        const userName = await getUserName(user.id);
        await logAudit({ userId: user.id, userName, entityType: "team_link", entityId: inserted?.id || "", action: "create", description: `Added link: ${title.trim()}` });
      }
      setTitle("");
      setUrl("");
      setCategory("General");
      setCustomCategory("");
      fetchLinks();
    }
  };

  const handleDelete = async (id: string) => {
    const link = links.find(l => l.id === id);
    const { error } = await supabase.from("team_links").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting link", description: error.message, variant: "destructive" });
    } else {
      if (user) {
        const userName = await getUserName(user.id);
        await logAudit({ userId: user.id, userName, entityType: "team_link", entityId: id, action: "delete", description: `Deleted link: ${link?.title || id}` });
      }
      fetchLinks();
    }
  };

  const openEdit = (link: TeamLink) => {
    setEditLink(link);
    setEditTitle(link.title);
    setEditUrl(link.url);
    const cat = link.category || "General";
    if (allCategories.includes(cat)) {
      setEditCategory(cat);
      setEditCustomCategory("");
    } else {
      setEditCategory("__custom");
      setEditCustomCategory(cat);
    }
  };

  const handleEdit = async () => {
    if (!editLink) return;
    if (!editTitle.trim() || !editUrl.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" });
      return;
    }

    let finalUrl = editUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;

    const newData = { title: editTitle.trim(), url: finalUrl, category: resolveCategory(editCategory, editCustomCategory) };

    setEditLoading(true);
    const { error } = await supabase
      .from("team_links")
      .update(newData)
      .eq("id", editLink.id);
    setEditLoading(false);

    if (error) {
      toast({ title: "Error updating link", description: error.message, variant: "destructive" });
    } else {
      if (user) {
        const userName = await getUserName(user.id);
        const oldData = { title: editLink.title, url: editLink.url, category: editLink.category || "General" };
        await logFieldChanges(user.id, userName, "team_link", editLink.id, oldData, newData, null, { title: "Title", url: "URL", category: "Category" });
      }
      setEditLink(null);
      fetchLinks();
    }
  };

  // Group links by category
  const grouped = links.reduce<Record<string, TeamLink[]>>((acc, link) => {
    const cat = link.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(link);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Links</h1>
        <p className="text-sm text-muted-foreground mt-1">Save and organize links to external resources, tools, and files.</p>
      </div>

      <Card className="border-dashed border-2 border-primary/20 bg-primary/[0.02] shadow-none">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Link title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Paste URL here"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__custom">+ Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {category === "__custom" && (
              <Input
                placeholder="Custom category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="flex-1"
              />
            )}
            <Button onClick={handleAdd} disabled={loading} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Link
            </Button>
          </div>
        </CardContent>
      </Card>

      {links.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <ExternalLink className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No links added yet. Add your first link above.</p>
        </div>
      )}

      <div className="space-y-8">
        {sortedGroups.map((group) => (
          <div key={group} className="space-y-3">
            <div className="flex items-center gap-2.5 border-b border-border pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">{group}</span>
              <span className="text-xs text-muted-foreground font-medium">({grouped[group].length})</span>
            </div>
            <div className="grid gap-2">
              {grouped[group].map((link) => (
                <div
                  key={link.id}
                  className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 transition-all hover:shadow-sm hover:border-primary/20"
                >
                  <div className="min-w-0 flex-1">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                    >
                      {link.title}
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{new URL(link.url).hostname}</span>
                      {link.created_by_name && (
                        <>
                          <span className="text-xs text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground">{link.created_by_name}</span>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(link.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(link)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(link.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editLink} onOpenChange={(open) => !open && setEditLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
              <Input
                placeholder="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">URL</label>
              <Input
                placeholder="URL"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Category</label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="__custom">+ Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editCategory === "__custom" && (
              <Input
                placeholder="Custom category name"
                value={editCustomCategory}
                onChange={(e) => setEditCustomCategory(e.target.value)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLink(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={editLoading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
