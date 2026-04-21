import { useState, DragEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, ListTodo, Mail, Phone, DollarSign, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const VENDOR_STAGES = [
  "Outreach Sent",
  "Connected",
  "Discovery Call Scheduled",
  "Reviewing",
  "Active",
  "Not a Fit",
] as const;

const STAGE_COLORS: Record<string, string> = {
  "Outreach Sent": "bg-blue-500/10 border-blue-500/30",
  "Connected": "bg-amber-500/10 border-amber-500/30",
  "Discovery Call Scheduled": "bg-purple-500/10 border-purple-500/30",
  "Reviewing": "bg-emerald-500/10 border-emerald-500/30",
  "Active": "bg-teal-500/10 border-teal-500/30",
  "Not a Fit": "bg-gray-500/10 border-gray-500/30",
};

export interface KanbanVendor {
  id: string;
  name: string;
  vendor_type?: string | null;
  main_contact?: string | null;
  email?: string | null;
  phone?: string | null;
  pricing?: string | null;
  owner?: string | null;
  next_step?: string | null;
  stage: string;
}

interface Props {
  vendors: KanbanVendor[];
  isAdmin: boolean;
  onChanged: () => void;
  onEdit: (v: KanbanVendor) => void;
  onTasks: (v: KanbanVendor) => void;
}

export default function VendorsKanban({ vendors, isAdmin, onChanged, onEdit, onTasks }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (stage: string) =>
    setCollapsed((c) => ({ ...c, [stage]: !c[stage] }));
  const allCollapsed = VENDOR_STAGES.every((s) => collapsed[s]);
  const toggleAll = () => {
    const next = !allCollapsed;
    const map: Record<string, boolean> = {};
    VENDOR_STAGES.forEach((s) => (map[s] = next));
    setCollapsed(map);
  };

  const onDragStart = (e: DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDrop = async (e: DragEvent, stage: string) => {
    e.preventDefault();
    if (!draggedId || !isAdmin) return;
    const v = vendors.find((x) => x.id === draggedId);
    setDraggedId(null);
    if (!v || v.stage === stage) return;
    const { error } = await supabase.from("vendors").update({ stage } as any).eq("id", draggedId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${stage}`);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={toggleAll}>
          {allCollapsed ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
          {allCollapsed ? "Expand all" : "Collapse all"}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
      {VENDOR_STAGES.map((stage) => {
        const list = vendors.filter((v) => v.stage === stage);
        const isCollapsed = !!collapsed[stage];
        return (
          <div
            key={stage}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, stage)}
            className={`rounded-lg border-2 ${STAGE_COLORS[stage] || "bg-muted/30 border-muted"} p-2 ${isCollapsed ? "" : "min-h-[400px]"} flex flex-col`}
          >
            <button
              type="button"
              onClick={() => toggle(stage)}
              className="flex items-center justify-between gap-2 px-2 py-1.5 mb-2 w-full text-left hover:bg-background/40 rounded transition-colors"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                <h3 className="font-semibold text-sm truncate">{stage}</h3>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">{list.length}</Badge>
            </button>
            {!isCollapsed && (
            <div className="flex-1 space-y-2">
              {list.map((v) => (
                <Card
                  key={v.id}
                  draggable={isAdmin}
                  onDragStart={(e) => onDragStart(e, v.id)}
                  className={`hover:shadow-md transition-shadow ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <CardContent className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-medium text-sm leading-tight">{v.name}</p>
                      <div className="flex gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onTasks(v)} title="Tasks">
                          <ListTodo className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(v)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {v.vendor_type && <Badge variant="outline" className="text-[10px]">{v.vendor_type}</Badge>}
                    {v.main_contact && <p className="text-xs text-muted-foreground">👤 {v.main_contact}</p>}
                    {v.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />{v.email}
                      </p>
                    )}
                    {v.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />{v.phone}
                      </p>
                    )}
                    {v.pricing && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-3 w-3 shrink-0" />{v.pricing}
                      </p>
                    )}
                    {v.next_step && (
                      <p className="text-xs border-t pt-1.5 mt-1.5"><span className="font-medium">Next:</span> {v.next_step}</p>
                    )}
                    {v.owner && <p className="text-[10px] text-muted-foreground">Owner: {v.owner}</p>}
                  </CardContent>
                </Card>
              ))}
              {list.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Drop vendors here</p>
              )}
            </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}