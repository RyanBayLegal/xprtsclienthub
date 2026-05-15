import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Plus, Trash2, Send } from "lucide-react";
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
  const [testingLead, setTestingLead] = useState(false);
  const [testingTask, setTestingTask] = useState(false);

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

  const activeRecipients = recipients.filter((r) => r.is_active);

  const sendTestLead = async () => {
    if (activeRecipients.length === 0) { toast.error("Add at least one active recipient first"); return; }
    setTestingLead(true);
    try {
      const stamp = new Date().toLocaleString();
      const { data: lead, error } = await supabase.from("leads").insert({
        name: `[TEST] Sample Lead ${stamp}`,
        contact: "test@example.com",
        source: "Email Test",
        needs: "This is a sample lead created from Settings to verify email delivery.",
        notes: "You can safely delete this test lead.",
        stage: "New",
        created_by: user?.id,
      }).select("id, name").single();
      if (error) throw error;
      const { data, error: invokeErr } = await supabase.functions.invoke("send-lead-notification", {
        body: {
          lead_id: lead.id,
          lead_name: lead.name,
          source: "Email Test",
          interest: "Sample lead notification",
          contact: "test@example.com",
          notes: "Test send from Settings.",
        },
      });
      if (invokeErr) throw invokeErr;
      const sent = (data as any)?.sent ?? 0;
      toast.success(`Test lead created. Email attempts: ${sent}/${activeRecipients.length}. See Notification Logs.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send test lead email");
    } finally {
      setTestingLead(false);
    }
  };

  const sendTestTask = async () => {
    if (activeRecipients.length === 0) { toast.error("Add at least one active recipient first"); return; }
    setTestingTask(true);
    try {
      const stamp = new Date().toLocaleString();
      const { data: task, error } = await supabase.from("tasks").insert({
        title: `[TEST] Sample Task ${stamp}`,
        description: "This is a sample task created from Settings to verify task email delivery.",
        priority: "medium",
        status: "todo",
        created_by: user?.id,
      }).select("id, title").single();
      if (error) throw error;
      const { data, error: invokeErr } = await supabase.functions.invoke("send-task-notification", {
        body: {
          task_id: task.id,
          task_title: task.title,
          task_description: "Test send from Settings.",
          priority: "medium",
          created_by_name: "Test runner",
        },
      });
      if (invokeErr) throw invokeErr;
      const sent = (data as any)?.sent ?? 0;
      toast.success(`Test task created. Email attempts: ${sent}/${activeRecipients.length}. See Notification Logs.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send test task email");
    } finally {
      setTestingTask(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notification Recipients
        </CardTitle>
        <CardDescription>
          When a new lead or task is created, an email is sent to every active address below via the connected Gmail account.
          If Gmail is not connected yet, the list is saved and emails will start once you connect it.
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

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={sendTestLead} disabled={testingLead}>
            <Send className="mr-2 h-4 w-4" /> {testingLead ? "Sending…" : "Send test lead email"}
          </Button>
          <Button variant="outline" size="sm" onClick={sendTestTask} disabled={testingTask}>
            <Send className="mr-2 h-4 w-4" /> {testingTask ? "Sending…" : "Send test task email"}
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            Creates a sample lead/task tagged [TEST] and triggers the Gmail send. Check the Notification Logs page for results.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}