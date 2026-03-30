import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { Send, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import MentionTextarea, { extractMentionedUserIds } from "@/components/MentionTextarea";

interface TaskCommentsProps {
  taskId: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null };
}

/** Auto-linkify URLs and highlight @mentions in text */
function LinkifyText({ text }: { text: string }) {
  const regex = /(https?:\/\/[^\s<]+)|(@\w[\w\s]*?\b)/g;
  const parts: { type: "text" | "url" | "mention"; value: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      parts.push({ type: "url", value: match[1] });
    } else if (match[2]) {
      parts.push({ type: "mention", value: match[2] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "url") {
          return (
            <a
              key={i}
              href={part.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80 break-all"
            >
              {part.value}
            </a>
          );
        }
        if (part.type === "mention") {
          return (
            <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

export default function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

      setComments(data.map((c: any) => ({
        ...c,
        profile: profileMap.get(c.user_id) || null,
      })));
    }
  };

  useEffect(() => { fetchComments(); }, [taskId]);

  const addComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("task_comments").insert({
      task_id: taskId,
      user_id: user.id,
      content: newComment.trim(),
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }

    // Send notification for new comment + @mentions
    try {
      const { data: taskData } = await supabase.from("tasks").select("title, assigned_to, created_by").eq("id", taskId).maybeSingle();
      if (taskData) {
        const notifyUserIds = new Set<string>();
        // Standard notifications for assignee/creator
        if (taskData.assigned_to && taskData.assigned_to !== user.id) notifyUserIds.add(taskData.assigned_to);
        if (taskData.created_by && taskData.created_by !== user.id) notifyUserIds.add(taskData.created_by);
        
        // @mention notifications
        for (const uid of mentionedUserIds) {
          if (uid !== user.id) notifyUserIds.add(uid);
        }

        for (const uid of notifyUserIds) {
          const isMentioned = mentionedUserIds.includes(uid);
          await supabase.from("notifications").insert({
            user_id: uid,
            type: isMentioned ? "task_mention" : "task_comment",
            title: isMentioned ? "You were mentioned in a task comment" : "New comment on task",
            message: `Comment on "${taskData.title}": ${newComment.trim().slice(0, 100)}`,
          });
        }
      }
    } catch (_) { /* non-critical */ }

    setNewComment("");
    setMentionedUserIds([]);
    setSubmitting(false);
    fetchComments();
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    const { error } = await supabase.from("task_comments").update({ content: editContent.trim() }).eq("id", editingId);
    if (error) { toast.error(error.message); return; }
    setEditingId(null);
    setEditContent("");
    fetchComments();
  };

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-medium text-muted-foreground">Comments {comments.length > 0 && `(${comments.length})`}</p>
      {comments.length > 0 && (
        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 group">
              <UserAvatar
                avatarUrl={c.profile?.avatar_url}
                fullName={c.profile?.full_name}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{c.profile?.full_name || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                  {user?.id === c.user_id && editingId !== c.id && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEdit(c)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteComment(c.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                {editingId === c.id ? (
                  <div className="mt-1 space-y-1">
                    <MentionTextarea
                      value={editContent}
                      onChange={setEditContent}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditingId(null); }}
                    />
                    <div className="flex gap-1">
                      <Button size="icon" className="h-6 w-6" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-foreground/80 mt-0.5">
                    <LinkifyText text={c.content} />
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <MentionTextarea
          value={newComment}
          onChange={setNewComment}
          placeholder="Add a comment… (type @ to mention)"
          onMentionUsers={setMentionedUserIds}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addComment(); } }}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={addComment} disabled={submitting || !newComment.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
