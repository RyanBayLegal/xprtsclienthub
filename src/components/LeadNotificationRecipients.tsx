import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Recipient {
  id: string;
  email: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

export default function LeadNotificationRecipients() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchRecipients = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_notification_recipients")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setRecipients(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleAdd = async () => {
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setAdding(true);
    const { error } = await (supabase as any)
      .from("lead_notification_recipients")
      .insert({
        email: email.trim().toLowerCase(),
        label: label.trim() || null,
        created_by: user?.id,
      });
    setAdding(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That email is already in the list" : error.message);
      return;
    }
    setEmail("");
    setLabel("");
    toast.success("Recipient added");
    fetchRecipients();
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    const { error } = await (supabase as any)
      .from("lead_notification_recipients")
      .update({ is_active })
      .eq("id", id);
    if (error) toast.error(error.message);
    else fetchRecipients();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any)
      .from("lead_notification_recipients")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Recipient removed");
      fetchRecipients();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          New Lead Email Recipients
        </CardTitle>
        <CardDescription>
          When a lead is submitted via the Strategy Review Form, an email is sent to every active address below.
          Sending uses the connected Gmail account — if Gmail is not connected yet, the list is saved and emails will start once you connect it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Label (optional, e.g. Sales Lead)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={adding || !email}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : recipients.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No recipients yet.</TableCell></TableRow>
              ) : recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{r.label || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} onCheckedChange={(v) => handleToggle(r.id, v)} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}