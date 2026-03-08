import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
        <Palette className="h-4 w-4" /> Colors:
      </span>
      {clients.map(client => (
        <Popover key={client.id}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
              disabled={saving === client.id}
            >
              <div
                className="w-3 h-3 rounded-full ring-1 ring-border"
                style={{ backgroundColor: client.color }}
              />
              {client.name}
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
  );
}
