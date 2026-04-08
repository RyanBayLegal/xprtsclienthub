import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface EntityInStage {
  id: string;
  name: string;
  daysInStage: number;
}

interface StageRowProps {
  label: string;
  avgDays: number;
  count: number;
  pct: number;
  maxDays: number;
  entities: EntityInStage[];
  entityType: "lead" | "client";
}

export default function StageRow({ label, avgDays, count, pct, maxDays, entities, entityType }: StageRowProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const entityLabel = entityType === "lead" ? "lead" : "client";

  const handleClick = (id: string) => {
    setOpen(false);
    if (entityType === "lead") {
      navigate("/leads");
    } else {
      navigate(`/clients/${id}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{pct}%</span>
              <span className="text-sm font-bold">{avgDays}d</span>
            </div>
          </div>
          <Progress value={maxDays > 0 ? (avgDays / maxDays) * 100 : 0} className="h-2" />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {count} {entityLabel}{count !== 1 ? "s" : ""} recorded
          </p>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="px-3 py-2 border-b">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{entities.length} currently in stage</p>
        </div>
        {entities.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">No {entityLabel}s currently in this stage.</p>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="divide-y">
              {entities.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleClick(e.id)}
                  className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-[10px] text-muted-foreground">{e.daysInStage} day{e.daysInStage !== 1 ? "s" : ""} in stage</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
