import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TeamLink {
  id: string;
  title: string;
  url: string;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

export default function Links() {
  const { user } = useAuth();
  const [links, setLinks] = useState<TeamLink[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("team_links")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Error loading links", description: error.message, variant: "destructive" });
    } else {
      setLinks(data || []);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleAdd = async () => {
    if (!title.trim() || !url.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" });
      return;
    }

    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "https://" + finalUrl;
    }

    setLoading(true);

    // Get creator name
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
      created_by: user?.id,
      created_by_name: creatorName,
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error adding link", description: error.message, variant: "destructive" });
    } else {
      setTitle("");
      setUrl("");
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

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Links</h1>
      <p className="text-sm text-muted-foreground">Save and organize links to external resources, tools, and files.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add New Link</CardTitle>
        </CardHeader>
        <CardContent>
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
            <Button onClick={handleAdd} disabled={loading}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No links added yet.</p>
        )}
        {links.map((link) => (
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
                <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {link.created_by_name && `Added by ${link.created_by_name} · `}
                  {format(new Date(link.created_at), "MMM d, yyyy")}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(link.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
