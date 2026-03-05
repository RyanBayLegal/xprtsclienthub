import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

    const { error } = await supabase.from("team_links").insert({
      title: title.trim(),
      url: finalUrl,
      category: resolveCategory(category, customCategory),
      created_by: user?.id,
      created_by_name: creatorName,
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error adding link", description: error.message, variant: "destructive" });
    } else {
      setTitle("");
      setUrl("");
      setCategory("General");
      setCustomCategory("");
      fetchLinks();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("team_links").delete().eq("id", id);
    if (error) {
      toast({ title: "Error deleting link", description: error.message, variant: "destructive" });
    } else {
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

    setEditLoading(true);
    const { error } = await supabase
      .from("team_links")
      .update({
        title: editTitle.trim(),
        url: finalUrl,
        category: resolveCategory(editCategory, editCustomCategory),
      })
      .eq("id", editLink.id);
    setEditLoading(false);

    if (error) {
      toast({ title: "Error updating link", description: error.message, variant: "destructive" });
    } else {
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Links</h1>
      <p className="text-sm text-muted-foreground">Save and organize links to external resources, tools, and files.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
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
            <Button onClick={handleAdd} disabled={loading}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {links.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No links added yet.</p>
      )}

      {sortedGroups.map((group) => (
        <div key={group} className="space-y-2">
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="secondary" className="text-xs">{group}</Badge>
            <span className="text-xs text-muted-foreground">({grouped[group].length})</span>
          </div>
          {grouped[group].map((link) => (
            <Card key={link.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4 px-5">
                <div className="min-w-0 flex-1">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {link.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="text-xs text-muted-foreground truncate">{new URL(link.url).hostname}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {link.created_by_name && `Added by ${link.created_by_name} · `}
                    {format(new Date(link.created_at), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(link)}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(link.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {/* Edit Dialog */}
      <Dialog open={!!editLink} onOpenChange={(open) => !open && setEditLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Input
              placeholder="URL"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
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
