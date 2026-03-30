import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MentionUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMentionUsers?: (userIds: string[]) => void;
}

export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  className,
  onKeyDown,
  onMentionUsers,
}: MentionTextareaProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["team_admin", "staff_member"]);
      if (!roles) return;
      const ids = roles.map((r) => r.user_id);
      if (ids.length === 0) return;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids);
      if (profiles) {
        setUsers(profiles.map((p) => ({ id: p.user_id, full_name: p.full_name, avatar_url: p.avatar_url })));
      }
    };
    fetchUsers();
  }, []);

  const filtered = users.filter((u) =>
    u.full_name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart || 0;
    onChange(val);

    // Check if we're in a mention context
    const textBeforeCursor = val.slice(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    if (lastAt >= 0) {
      const charBefore = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
      const textAfterAt = textBeforeCursor.slice(lastAt + 1);
      if ((charBefore === " " || charBefore === "\n" || lastAt === 0) && !/\s/.test(textAfterAt)) {
        setMentionStart(lastAt);
        setMentionQuery(textAfterAt);
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowDropdown(false);
  };

  const insertMention = (user: MentionUser) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(mentionStart + 1 + mentionQuery.length);
    const name = user.full_name || "user";
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setShowDropdown(false);

    // Extract all mentioned user IDs
    if (onMentionUsers) {
      const mentionedIds = users
        .filter((u) => u.full_name && newValue.includes(`@${u.full_name}`))
        .map((u) => u.id);
      onMentionUsers(mentionedIds);
    }

    setTimeout(() => {
      if (textareaRef.current) {
        const pos = mentionStart + name.length + 2;
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filtered[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowDropdown(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn("min-h-[36px] h-9 text-xs resize-none", className)}
      />
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-56 max-h-40 overflow-y-auto bg-popover border rounded-md shadow-md z-50"
        >
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center gap-2",
                i === selectedIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(u);
              }}
            >
              <span className="font-medium">{u.full_name || "Unknown"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Extract @mentioned user IDs from text given a list of known users */
export function extractMentionedUserIds(
  text: string,
  users: { id: string; full_name: string | null }[]
): string[] {
  return users
    .filter((u) => u.full_name && text.includes(`@${u.full_name}`))
    .map((u) => u.id);
}
