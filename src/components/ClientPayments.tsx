import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoice_number: string;
  for_month: string | null;
  status: string;
  sent_at: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  payment_mode: string | null;
  amount: number | null;
}

const STATUSES = ["sent", "due", "paid", "overdue", "cancelled"];
const PAYMENT_MODES = ["Stripe", "Zelle", "Others"];

const emptyForm = { invoice_number: "", for_month: "", due_date: "", sent_at: "", paid_at: "", notes: "", payment_mode: "", amount: "" };

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "paid": return "default";
    case "overdue": return "destructive";
    case "due": return "outline";
    case "cancelled": return "secondary";
    default: return "secondary";
  }
};

export default function ClientPayments({ clientProfileId }: { clientProfileId: string }) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("client_invoices")
      .select("*")
      .eq("client_profile_id", clientProfileId)
      .order("created_at", { ascending: false });
    if (data) setInvoices(data as Invoice[]);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [clientProfileId]);

  const handleSave = async () => {
    if (!form.invoice_number.trim()) { toast.error("Invoice number is required"); return; }
    const payload = {
      invoice_number: form.invoice_number.trim(),
      for_month: form.for_month || null,
      due_date: form.due_date || null,
      sent_at: form.sent_at ? new Date(form.sent_at).toISOString() : new Date().toISOString(),
      paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
      payment_mode: form.payment_mode || null,
      notes: form.notes || null,
      amount: form.amount ? parseFloat(form.amount) : null,
    };
    if (editingId) {
      const { error } = await supabase.from("client_invoices").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Invoice updated");
    } else {
      const { error } = await supabase.from("client_invoices").insert({
        ...payload,
        client_profile_id: clientProfileId,
        created_by: user?.id || null,
      } as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Invoice added");
    }
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(false);
    fetchInvoices();
  };

  const handleEdit = (inv: Invoice) => {
    setForm({
      invoice_number: inv.invoice_number,
      for_month: inv.for_month || "",
      due_date: inv.due_date || "",
      sent_at: inv.sent_at ? inv.sent_at.slice(0, 10) : "",
      paid_at: inv.paid_at ? inv.paid_at.slice(0, 10) : "",
      notes: inv.notes || "",
      payment_mode: inv.payment_mode || "",
      amount: inv.amount != null ? String(inv.amount) : "",
    });
    setEditingId(inv.id);
    setDialogOpen(true);
  };

  const updateStatus = async (invoiceId: string, newStatus: string) => {
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid") updates.paid_at = new Date().toISOString();
    if (newStatus !== "paid") updates.paid_at = null;

    const { error } = await supabase.from("client_invoices").update(updates).eq("id", invoiceId);
    if (error) { toast.error(error.message); return; }
    setInvoices((prev) => prev.map((inv) =>
      inv.id === invoiceId ? { ...inv, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : null } : inv
    ));
    toast.success(`Invoice marked as ${newStatus}`);
  };

  if (loading) return <div className="text-muted-foreground py-8 text-center">Loading invoices...</div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Payment Tracking</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm(emptyForm); setEditingId(null); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add Invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Invoice" : "Add Invoice"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Invoice Number *</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="INV-001" />
              </div>
              <div className="space-y-2">
                <Label>For Month</Label>
                <Input value={form.for_month} onChange={(e) => setForm({ ...form, for_month: e.target.value })} placeholder="March 2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date Sent</Label>
                  <Input type="date" value={form.sent_at} onChange={(e) => setForm({ ...form, sent_at: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date Paid</Label>
                <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Mode of Payment</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue placeholder="Select mode..." /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 1500" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave}>{editingId ? "Update Invoice" : "Add Invoice"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No invoices yet. Click "Add Invoice" to create one.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>For Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.for_month || "—"}</TableCell>
                  <TableCell>
                    <Select value={inv.status} onValueChange={(v) => updateStatus(inv.id, v)}>
                      <SelectTrigger className="w-[120px] h-8">
                        <Badge variant={statusBadgeVariant(inv.status) as any} className="capitalize">{inv.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {inv.status === "paid" ? (
                      inv.amount != null ? `$${inv.amount.toLocaleString()}` : "—"
                    ) : ""}
                  </TableCell>
                  <TableCell>{format(new Date(inv.sent_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>{inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>{inv.paid_at ? format(new Date(inv.paid_at), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>{inv.payment_mode || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{inv.notes || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
