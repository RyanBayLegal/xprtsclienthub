import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Palette, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#FBBF24', '#F472B6', '#60A5FA', '#34D399', '#A78BFA',
  '#FB923C', '#F87171', '#2DD4BF', '#E879F9', '#818CF8',
  '#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F59E0B', '#6366F1', '#84CC16', '#06B6D4',
];

interface ScheduleColorPickerProps {
  clients: { id: string; name: string; color: string }[];
}

export function ScheduleColorPicker({ clients }: ScheduleColorPickerProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredClients = useMemo(
    () => clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  );

  const updateColor = async (clientId: string, color: string) => {
    setSaving(clientId);
    const { error } = await (supabase
      .from('client_profiles' as any)
      .update({ schedule_color: color })
      .eq('id', clientId) as any);
    setSaving(null);
    if (error) {
      toast.error('Failed to update color');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['schedule-clients-from-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['schedule-blocks'] });
    toast.success('Color updated');
  };

  if (clients.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <Palette className="h-4 w-4" />
        Client Colors ({clients.length})
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md border border-border bg-card/50 p-2 space-y-2">
          {clients.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
          )}
          <div className="max-h-32 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {filteredClients.length === 0 && (
                <p className="text-xs text-muted-foreground py-1 px-1">No clients found</p>
              )}
              {filteredClients.map(client => (
              <Popover key={client.id}>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium hover:bg-accent transition-colors"
                    disabled={saving === client.id}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: client.color }}
                    />
                    <span className="truncate max-w-[120px]">{client.name}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <p className="text-xs font-medium mb-2">{client.name}</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${
                          client.color === color ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateColor(client.id, color)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
