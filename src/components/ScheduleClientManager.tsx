import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useScheduleClients } from '@/hooks/useScheduleData';
import { CLIENT_COLORS, TIMEZONE_OPTIONS } from '@/lib/timezones';
import { toast } from 'sonner';

export function ScheduleClientManager() {
  const { clients, addClient, deleteClient } = useScheduleClients();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CLIENT_COLORS[0]);
  const [timezone, setTimezone] = useState('America/New_York');

  const handleAdd = () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    addClient.mutate({ name, color, timezone }, {
      onSuccess: () => {
        toast.success('Schedule client added');
        setDialogOpen(false);
        setName('');
      },
      onError: () => toast.error('Failed to add client'),
    });
  };

  if (clients.length === 0 && !dialogOpen) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Schedule Clients:</span>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Add Client</Button>
          </DialogTrigger>
          <ClientDialog name={name} setName={setName} color={color} setColor={setColor} timezone={timezone} setTimezone={setTimezone} onAdd={handleAdd} />
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-muted-foreground">Clients:</span>
      {clients.map((c: any) => (
        <Badge key={c.id} variant="outline" className="gap-1 pr-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
          {c.name}
          <button onClick={() => deleteClient.mutate(c.id)} className="ml-1 hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2"><Plus className="h-3 w-3" /></Button>
        </DialogTrigger>
        <ClientDialog name={name} setName={setName} color={color} setColor={setColor} timezone={timezone} setTimezone={setTimezone} onAdd={handleAdd} />
      </Dialog>
    </div>
  );
}

function ClientDialog({ name, setName, color, setColor, timezone, setTimezone, onAdd }: {
  name: string; setName: (v: string) => void;
  color: string; setColor: (v: string) => void;
  timezone: string; setTimezone: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Add Schedule Client</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Name</label>
          <Input placeholder="e.g. Acme Corp" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Color</label>
          <div className="flex gap-2 flex-wrap">
            {CLIENT_COLORS.map(c => (
              <button
                key={c}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Timezone</label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map(tz => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onAdd} className="w-full">Add Client</Button>
      </div>
    </DialogContent>
  );
}
