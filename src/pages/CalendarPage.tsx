import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "follow_up" | "task" | "stage_change";
  leadId?: string | null;
  clientProfileId?: string | null;
  status?: string;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const [leadsRes, tasksRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, follow_up_date, stage")
          .not("follow_up_date", "is", null)
          .gte("follow_up_date", monthStart)
          .lte("follow_up_date", monthEnd),
        supabase
          .from("tasks")
          .select("id, title, due_date, status, client_profile_id, lead_id")
          .not("due_date", "is", null)
          .gte("due_date", monthStart)
          .lte("due_date", monthEnd),
      ]);

      const calEvents: CalendarEvent[] = [];

      (leadsRes.data || []).forEach((lead) => {
        if (lead.follow_up_date) {
          calEvents.push({
            id: `followup-${lead.id}`,
            title: `Follow-up: ${lead.name}`,
            date: lead.follow_up_date,
            type: "follow_up",
            leadId: lead.id,
          });
        }
      });

      (tasksRes.data || []).forEach((task) => {
        if (task.due_date) {
          calEvents.push({
            id: `task-${task.id}`,
            title: task.title,
            date: task.due_date,
            type: "task",
            leadId: task.lead_id,
            clientProfileId: task.client_profile_id,
            status: task.status,
          });
        }
      });

      setEvents(calEvents);
    };
    fetchEvents();
  }, [currentMonth]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.date + "T00:00:00"), day));

  const typeColors: Record<string, string> = {
    follow_up: "bg-amber-500/20 text-amber-700 border-amber-500/30",
    task: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    stage_change: "bg-purple-500/20 text-purple-700 border-purple-500/30",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-36 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);
              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] border-b border-r p-1.5 ${
                    !isCurrentMonth ? "bg-muted/30" : ""
                  }`}
                >
                  <div className={`text-xs mb-1 ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center font-bold" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer truncate ${typeColors[event.type]}`}
                        onClick={() => {
                          if (event.leadId) navigate(`/clients/${event.leadId}`);
                          else if (event.clientProfileId) navigate(`/clients/${event.clientProfileId}`);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4 mt-4">
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />
          Follow-ups
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/30" />
          Tasks
        </div>
      </div>
    </div>
  );
}
