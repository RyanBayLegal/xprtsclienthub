import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface TaskLinksProps {
  taskId: string;
  links: { title: string; url: string }[];
  onUpdate: (links: { title: string; url: string }[]) => void;
}

export default function TaskLinks({ taskId, links, onUpdate }: TaskLinksProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const addLink = async () => {
    if (!url.trim()) { toast.error("URL is required"); return; }
    const newLinks = [...links, { title: title.trim() || url.trim(), url: url.trim() }];
    const { error } = await supabase.from("tasks").update({ links: newLinks as any }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    onUpdate(newLinks);
    setTitle("");
    setUrl("");
    toast.success("Link added");
  };

  const removeLink = async (idx: number) => {
    const newLinks = links.filter((_, i) => i !== idx);
    const { error } = await supabase.from("tasks").update({ links: newLinks as any }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    onUpdate(newLinks);
    toast.success("Link removed");
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Link2 className="h-3 w-3" /> Links
      </h4>
      {links.length > 0 && (
        <div className="space-y-1">
          {links.map((link, idx) => (
            <div key={idx} className="flex items-center gap-2 p-1.5 rounded border bg-card">
              <ExternalLink className="h-3 w-3 text-primary shrink-0" />
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline truncate flex-1">
                {link.title}
              </a>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeLink(idx)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 text-[11px]" />
        <Input placeholder="URL" value={url} onChange={(e) => setUrl(e.target.value)} className="h-7 text-[11px]" />
        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 shrink-0" onClick={addLink}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
