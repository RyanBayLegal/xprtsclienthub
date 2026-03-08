import { useState, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { convertHour, formatHour, getTimezoneShort, toDateString } from '@/lib/timezones';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import type { TimeOffRequest } from '@/hooks/useScheduleData';

const SLOT_STEP = 0.5;

interface Client {
  id: string;
  name: string;
  color: string;
  timezone: string;
}

interface Block {
  id: string;
  client_id: string | null;
  block_date: string | null;
  day_of_week: number | null;
  start_hour: number;
  end_hour: number;
  label: string | null;
  clients?: Client | null;
}

interface SelectedSlot {
  dateStr: string;
  slot: number;
}

interface ScheduleGridProps {
  name: string;
  baseTimezone: string;
  displayTimezones: string[];
  hourStart: number;
  hourEnd: number;
  blocks: Block[];
  clients: Client[];
  weekDates: Date[];
  onAddBlock: (block: { block_date: string; start_hour: number; end_hour: number; client_id?: string; label?: string }) => void;
  onDeleteBlock: (id: string) => void;
  readOnly?: boolean;
  approvedTimeOff?: TimeOffRequest[];
}

export function ScheduleGrid({
  name,
  baseTimezone,
  displayTimezones,
  hourStart,
  hourEnd,
  blocks,
  clients,
  weekDates,
  onAddBlock,
  onDeleteBlock,
  readOnly = false,
  approvedTimeOff = [],
}: ScheduleGridProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [blockType, setBlockType] = useState<'client' | 'label'>('client');
  const [selectedClient, setSelectedClient] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  // Drag-to-select state
  const isDragging = useRef(false);
  const dragStartSlot = useRef<SelectedSlot | null>(null);

  const slots: number[] = [];
  for (let h = hourStart; h < hourEnd; h += SLOT_STEP) {
    slots.push(h);
  }

  const getBlockAt = useCallback((dateStr: string, slot: number): Block | undefined => {
    return blocks.find(b => b.block_date === dateStr && slot >= b.start_hour && slot < b.end_hour);
  }, [blocks]);

  const getTimeOffAt = useCallback((dateStr: string, slot: number) => {
    return approvedTimeOff.find(r => r.block_date === dateStr && slot >= r.start_hour && slot < r.end_hour);
  }, [approvedTimeOff]);

  const isBlockStart = (dateStr: string, slot: number, block: Block): boolean =>
    block.block_date === dateStr && block.start_hour === slot;

  const isTimeOffStart = (dateStr: string, slot: number, req: TimeOffRequest): boolean =>
    req.block_date === dateStr && req.start_hour === slot;

  const slotSpan = (start: number, end: number) => Math.round((end - start) / SLOT_STEP);

  const isSlotSelected = (dateStr: string, slot: number): boolean =>
    selectedSlots.some(s => s.dateStr === dateStr && s.slot === slot);

  const addSlotToSelection = (dateStr: string, slot: number) => {
    if (readOnly) return;
    if (getBlockAt(dateStr, slot)) return;
    if (getTimeOffAt(dateStr, slot)) return;
    setSelectedSlots(prev => {
      if (prev.some(s => s.dateStr === dateStr && s.slot === slot)) return prev;
      return [...prev, { dateStr, slot }];
    });
  };

  const toggleSlot = (dateStr: string, slot: number) => {
    if (readOnly) return;
    if (getBlockAt(dateStr, slot)) return;
    if (getTimeOffAt(dateStr, slot)) return;
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.dateStr === dateStr && s.slot === slot);
      if (exists) return prev.filter(s => !(s.dateStr === dateStr && s.slot === slot));
      return [...prev, { dateStr, slot }];
    });
  };

  const handleCellMouseDown = (dateStr: string, slot: number) => {
    if (readOnly) return;
    if (getBlockAt(dateStr, slot) || getTimeOffAt(dateStr, slot)) return;
    isDragging.current = true;
    dragStartSlot.current = { dateStr, slot };
    toggleSlot(dateStr, slot);
  };

  const handleCellMouseEnter = (dateStr: string, slot: number) => {
    if (!isDragging.current || readOnly) return;
    addSlotToSelection(dateStr, slot);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragStartSlot.current = null;
  };

  const openAssignDialog = () => {
    if (selectedSlots.length === 0) return;
    setBlockType('client');
    setSelectedClient('');
    setCustomLabel('');
    setDialogOpen(true);
  };

  const handleAddBlocks = () => {
    if (selectedSlots.length === 0) return;
    const grouped = groupConsecutiveSlots(selectedSlots);
    grouped.forEach(({ dateStr, startHour, endHour }) => {
      const block: { block_date: string; start_hour: number; end_hour: number; client_id?: string; label?: string } = {
        block_date: dateStr,
        start_hour: startHour,
        end_hour: endHour,
      };
      if (blockType === 'client' && selectedClient) block.client_id = selectedClient;
      else if (blockType === 'label' && customLabel) block.label = customLabel;
      onAddBlock(block);
    });
    setDialogOpen(false);
    setSelectedSlots([]);
  };

  const clearSelection = () => setSelectedSlots([]);
  const isHourBoundary = (slot: number) => slot === Math.floor(slot);

  const selectionSummary = () => {
    if (selectedSlots.length === 0) return '';
    const grouped = groupConsecutiveSlots(selectedSlots);
    return grouped.map(g => `${g.dateStr} ${formatHour(g.startHour)}–${formatHour(g.endHour)}`).join(', ');
  };

  return (
    <>
      {!readOnly && selectedSlots.length > 0 && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium">{selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''} selected</span>
          <span className="text-muted-foreground text-xs truncate max-w-md">{selectionSummary()}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={clearSelection}>Clear</Button>
            <Button size="sm" onClick={openAssignDialog}>Assign</Button>
          </div>
        </div>
      )}

      <div
        className="overflow-x-auto rounded-lg border border-border shadow-sm select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <table className="schedule-grid w-full">
          <thead>
            <tr>
              {displayTimezones.map(tz => (
                <th key={tz} className="min-w-[70px]">{getTimezoneShort(tz)}</th>
              ))}
              {weekDates.slice(0, 5).map((date) => (
                <th key={date.toISOString()} className="min-w-[120px]">
                  <div>{format(date, 'EEE')}</div>
                  <div className="text-[10px] font-normal opacity-75">{format(date, 'MMM d')}</div>
                </th>
              ))}
            </tr>
            <tr>
              <th colSpan={displayTimezones.length} className="!bg-primary text-primary-foreground text-sm tracking-wide">
                {name}
              </th>
              <th colSpan={5} className="!bg-primary text-primary-foreground text-sm">
                Schedule
              </th>
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => (
              <tr key={slot} className={!isHourBoundary(slot) ? 'border-t border-dashed border-border/40' : ''}>
                {displayTimezones.map(tz => (
                  <td key={tz} className={`tz-col whitespace-nowrap ${isHourBoundary(slot) ? '!py-1' : '!py-0.5 text-[10px] opacity-60'}`}>
                    {convertHour(slot, baseTimezone, tz)}
                  </td>
                ))}
                {weekDates.slice(0, 5).map((date) => {
                  const dateStr = toDateString(date);
                  const block = getBlockAt(dateStr, slot);
                  const timeOff = !block ? getTimeOffAt(dateStr, slot) : undefined;

                  if (block && !isBlockStart(dateStr, slot, block)) return null;
                  if (timeOff && !isTimeOffStart(dateStr, slot, timeOff)) return null;

                  const span = block ? slotSpan(block.start_hour, block.end_hour)
                    : timeOff ? slotSpan(timeOff.start_hour, timeOff.end_hour) : 1;
                  const blockColor = block?.clients?.color ?? (block?.label ? '#94A3B8' : undefined);
                  const blockName = block?.clients?.name ?? block?.label ?? '';
                  const selected = isSlotSelected(dateStr, slot);

                  return (
                    <td
                      key={dateStr}
                      rowSpan={block || timeOff ? span : 1}
                      className={`text-center text-xs font-medium relative group transition-colors cursor-pointer ${
                        selected ? 'bg-primary/20 ring-1 ring-inset ring-primary/40' : ''
                      } ${timeOff ? 'bg-destructive/15' : ''}`}
                      style={blockColor ? {
                        backgroundColor: blockColor,
                        color: getContrastColor(blockColor),
                      } : undefined}
                      onMouseDown={() => !block && !timeOff && handleCellMouseDown(dateStr, slot)}
                      onMouseEnter={() => !block && !timeOff && handleCellMouseEnter(dateStr, slot)}
                    >
                      {block ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-semibold text-[11px] uppercase tracking-wider">{blockName}</span>
                          {!readOnly && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteBlock(block.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-0.5 right-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ) : timeOff ? (
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-destructive">
                          TIME OFF
                          {timeOff.reason && <span className="block text-[9px] normal-case font-normal opacity-75">{timeOff.reason}</span>}
                        </span>
                      ) : selected ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-primary/50" />
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedSlots([]); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign to {selectedSlots.length} slot{selectedSlots.length > 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-2 max-h-20 overflow-y-auto">
            {selectionSummary()}
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={blockType === 'client' ? 'default' : 'outline'} size="sm" onClick={() => setBlockType('client')}>
                Client
              </Button>
              <Button variant={blockType === 'label' ? 'default' : 'outline'} size="sm" onClick={() => setBlockType('label')}>
                Custom Label
              </Button>
            </div>
            {blockType === 'client' ? (
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input placeholder="e.g. LUNCH, BREAK..." value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
            )}
            <Button onClick={handleAddBlocks} className="w-full">Assign Blocks</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function groupConsecutiveSlots(slots: { dateStr: string; slot: number }[]): { dateStr: string; startHour: number; endHour: number }[] {
  const byDate = new Map<string, number[]>();
  slots.forEach(s => {
    const arr = byDate.get(s.dateStr) ?? [];
    arr.push(s.slot);
    byDate.set(s.dateStr, arr);
  });

  const result: { dateStr: string; startHour: number; endHour: number }[] = [];
  byDate.forEach((hours, dateStr) => {
    hours.sort((a, b) => a - b);
    let start = hours[0];
    let end = hours[0] + SLOT_STEP;
    for (let i = 1; i < hours.length; i++) {
      if (Math.abs(hours[i] - end) < 0.01) {
        end = hours[i] + SLOT_STEP;
      } else {
        result.push({ dateStr, startHour: start, endHour: end });
        start = hours[i];
        end = hours[i] + SLOT_STEP;
      }
    }
    result.push({ dateStr, startHour: start, endHour: end });
  });
  return result;
}

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1a1a2e' : '#ffffff';
}
