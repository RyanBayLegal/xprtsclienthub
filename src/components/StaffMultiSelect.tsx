import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';

interface StaffOption {
  user_id: string;
  displayName: string;
}

interface StaffMultiSelectProps {
  staff: StaffOption[];
  selectedIds: string[];
  onToggle: (userId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export function StaffMultiSelect({ staff, selectedIds, onToggle, onSelectAll, onSelectNone }: StaffMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const label = selectedIds.length === 0
    ? 'Select staff'
    : selectedIds.length === staff.length
      ? 'All staff'
      : `${selectedIds.length} staff selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-[160px] justify-between">
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex gap-1 mb-2">
          <Button variant="ghost" size="sm" className="text-xs h-7 flex-1" onClick={onSelectAll}>All</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7 flex-1" onClick={onSelectNone}>None</Button>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {staff.map(s => (
            <label key={s.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm">
              <Checkbox
                checked={selectedIds.includes(s.user_id)}
                onCheckedChange={() => onToggle(s.user_id)}
              />
              {s.displayName}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
