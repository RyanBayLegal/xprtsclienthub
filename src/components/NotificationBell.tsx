import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
  lead_id: string | null;
}

const TASK_NOTIFICATION_TYPES = new Set(["task_assigned", "task_mention", "task_comment", "task_overdue"]);
const LEAD_NOTIFICATION_TYPES = new Set(["new_lead", "follow_up_due", "stage_change", "workflow"]);
const CLIENT_NOTIFICATION_TYPES = new Set(["agreement_sent", "agreement_signed", "nda_sent", "nda_signed"]);

const NOTIFICATION_SOUND_URL = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGg+I0NxnMnV0LFnQjY3WYWmvb+3oYNkW0o9OVNxkbS5t6qUem5YSEA5RFl0kLO5uKeVfnFdUUI5P1Zwkra7vKmWf3RiWUg8QFl0k7a6u6mZhHdpYVVLRVR0l7u/vq2ei35xZl1VT1Fxl7vBwbGkkoR8c2tkXVdWcpe+xMS2q52Qh39za2ZfWlhxmL/GxriqoJWSi4V+eHNwaGV0mcHIyLuupZqUj4qEf3p2c3BvmsLKyry1q6OdmJORjYmGg4J8ncTMzr64sq2on5qWk5CRjouKhJ7Fzs/Bvbeyraegnp2bmpqYl5aFoMbP0MO/u7azr62sq6qqqqmpppmIocfQ0cTBvbu5t7a2trW1tbW1tbaYi6LI0NHFwr+9vLu7u7u7u7u7u7u8m46jydDRxcPBv767u7u7u7u7u7u7u7yeko2kytHRxcTCwL+/v7+/v7+/v7+/v72gj42ly9LRxcTDwcHAwMDAwMDAwMDAwMC+oZGPps3S0cXFxMLCwcHBwcHBwcHBwcHBv6OSkKfO09HGxsXDw8LCwsLCwsLCwsLCwMCkk5GozNPRxsbFxMPDw8PDw8PDw8PDw8HBpaWTkqnN09HGxsXExMPDw8PDw8PDw8PDwsKmp5WTqs7T0cbGxcXExMTExMTExMTExMTDw6iol5Srz9PRxsbFxcXExMTExMTExMTExMTExKqpmJWs0NPRxsfGxcXFxcXFxcXFxcXFxcXFxauqmpar0dTSx8fGxsbFxcXFxcXFxcXFxcXFxq2smpet0tTSyMfHxsbGxsbGxsbGxsbGxsbGx6+tnJiu09XTyMjHx8bGxsbGxsbGxsbGxsbHyLGvnpqv1NXTycjIx8fHx8fHx8fHx8fHx8fHybKwnpuw1dXUycnIyMfHx8fHx8fHx8fHx8fIyrSwn52x1tXUysnJyMjIyMjIyMjIyMjIyMjJy7axoJ6y19bVy8rJycnIyMjIyMjIyMjIyMnKzLeyoZ+z2NfWy8rKycnJycnJycnJycnJycnJy83EtKOgtNnX1szLysrKycnJycnJycnJycnJysvOxbWkobXa2NfNzMvKysrKysrKysrKysrKysvMz8e2paK23NnY";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const prevCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialLoadRef = useRef(true);

  const playNotificationSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        // Use Web Audio API for a simple notification beep
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        return;
      }
    } catch (e) {
      console.log("Audio notification not available:", e);
    }
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      const newNotifs = data as Notification[];
      const newUnread = newNotifs.filter((n) => !n.read).length;

      // Play sound if unread count increased (not on initial load)
      if (!initialLoadRef.current && newUnread > prevCountRef.current) {
        playNotificationSound();
      }
      initialLoadRef.current = false;
      prevCountRef.current = newUnread;
      setNotifications(newNotifs);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Subscribe to realtime notifications
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    prevCountRef.current = Math.max(0, prevCountRef.current - 1);
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    setOpen(false);
    if (!notification.lead_id) return;
    if (TASK_NOTIFICATION_TYPES.has(notification.type)) {
      navigate(`/tasks?task=${notification.lead_id}`);
      return;
    }
    if (LEAD_NOTIFICATION_TYPES.has(notification.type)) {
      navigate(`/leads?lead=${notification.lead_id}`);
      return;
    }
    if (CLIENT_NOTIFICATION_TYPES.has(notification.type)) {
      const { data: client } = await supabase
        .from("client_profiles")
        .select("id")
        .eq("lead_id", notification.lead_id)
        .maybeSingle();
      navigate(client?.id ? `/clients/${client.id}` : `/leads?lead=${notification.lead_id}`);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    prevCountRef.current = 0;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" onClick={() => { setOpen(true); fetchNotifications(); }}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-auto py-1" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-72">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                onClick={() => handleNotificationClick(n)}
              >
                <p className="text-sm font-medium">{n.title}</p>
                {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
