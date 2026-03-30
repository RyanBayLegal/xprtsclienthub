import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAudit, getUserName } from "@/lib/audit-logger";

interface AgreementBuilderProps {
  clientProfileId: string;
  leadId?: string | null;
  clientName: string;
  onCreated: () => void;
}

const DEFAULT_AGREEMENT = {
  effective_date: format(new Date(), "yyyy-MM-dd"),
  client_name: "",
  monthly_fee: "",
  hourly_rate: "",
  onboarding_fee_waived: false,
  selected_holidays: [] as string[],
  role_title: "",
  role_type: "full-time",
};

const FEDERAL_HOLIDAYS = [
  "New Year's Day",
  "Memorial Day",
  "Independence Day",
  "Labor Day",
  "Thanksgiving Day",
  "Christmas Eve",
  "Christmas Day",
  "New Year's Eve",
];

export default function AgreementBuilder({ clientProfileId, leadId, clientName, onCreated }: AgreementBuilderProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({ ...DEFAULT_AGREEMENT, client_name: clientName });
  const [clientSig, setClientSig] = useState("");
  const [saving, setSaving] = useState(false);

  const updateField = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const toggleHoliday = (holiday: string) => {
    setForm((f) => ({
      ...f,
      selected_holidays: f.selected_holidays.includes(holiday)
        ? f.selected_holidays.filter((h) => h !== holiday)
        : f.selected_holidays.length < 8
          ? [...f.selected_holidays, holiday]
          : f.selected_holidays,
    }));
  };

  const handleCreate = async () => {
    if (!form.client_name) { toast.error("Client name is required"); return; }
    setSaving(true);

    const { error } = await supabase.from("engagement_agreements").insert({
      client_profile_id: clientProfileId,
      lead_id: leadId || null,
      sent_by: user?.id,
      status: clientSig ? "signed" : "sent",
      content_data: form as any,
      client_signature: clientSig || null,
      client_signed_at: clientSig ? new Date().toISOString() : null,
      notes: `Agreement for ${form.client_name}`,
    });

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Create notification
    if (user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: clientSig ? "agreement_signed" : "agreement_sent",
        title: clientSig ? "Agreement signed!" : "Engagement agreement sent",
        message: `Agreement ${clientSig ? "signed by" : "sent to"} ${form.client_name}`,
        lead_id: leadId || null,
      });
    }

    toast.success(clientSig ? "Agreement created and signed" : "Agreement created and sent");

    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "engagement_agreement", entityId: clientProfileId, clientProfileId, action: "create", description: `Created agreement for ${form.client_name}${clientSig ? " (signed)" : ""}` });
    }

    setSaving(false);
    onCreated();
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">XPRTS Staffing Services Agreement</CardTitle>
          <p className="text-xs text-muted-foreground">11 N Nile Ave, East Wenatchee, WA 98802 · (650) 561-6942 · karen@xprts.com</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Effective Date</Label>
              <Input type="date" value={form.effective_date} onChange={(e) => updateField("effective_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Name</Label>
              <Input value={form.client_name} onChange={(e) => updateField("client_name", e.target.value)} />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">1. Services & Role</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Role Title</Label>
              <Input value={form.role_title} onChange={(e) => updateField("role_title", e.target.value)} placeholder="e.g., Legal Assistant" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Input value={form.role_type} onChange={(e) => updateField("role_type", e.target.value)} placeholder="full-time / part-time" />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">4. Compensation & Fees</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly Fee ($)</Label>
              <Input value={form.monthly_fee} onChange={(e) => updateField("monthly_fee", e.target.value)} placeholder="N/A or amount" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hourly Rate ($)</Label>
              <Input value={form.hourly_rate} onChange={(e) => updateField("hourly_rate", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={form.onboarding_fee_waived}
              onCheckedChange={(v) => updateField("onboarding_fee_waived", !!v)}
            />
            <Label className="text-xs">
              Onboarding fee of $350 per Remote Staff {form.onboarding_fee_waived && <span className="font-semibold text-muted-foreground">(Waived)</span>}
            </Label>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">8. Federal Holidays (select up to 8)</h4>
          <div className="grid grid-cols-2 gap-2">
            {FEDERAL_HOLIDAYS.map((h) => (
              <label key={h} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={form.selected_holidays.includes(h)}
                  onCheckedChange={() => toggleHoliday(h)}
                />
                {h}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">{form.selected_holidays.length}/8 selected</p>

          <Separator />
          <h4 className="font-semibold text-sm">Agreement Terms Summary</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 12-month term, auto-renews. 30-day written notice to terminate.</p>
            <p>• Risk-Free Cancellation within first 30 days.</p>
            <p>• Annual $150/month increase after 12 months.</p>
            <p>• Invoices due within 5 days. 5% late fee on unpaid balances.</p>
            <p>• Buy-out fees: $20k standard, $25k JD-equivalent, $30k technical roles.</p>
            <p>• Remote Staff use Hubstaff for timekeeping.</p>
            <p>• PTO: 10 days/year, accrues after 6 months of service.</p>
            <p>• Governed by Delaware law.</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">Signatures</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Client Signature (type full name)</Label>
              <Input
                value={clientSig}
                onChange={(e) => setClientSig(e.target.value)}
                placeholder="Type full name to sign"
                className="italic font-serif"
              />
              {clientSig && (
                <p className="text-[10px] text-muted-foreground">
                  Signed: {format(new Date(), "MMMM d, yyyy")}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">XPRTS, Inc.</Label>
              <p className="text-sm italic font-serif border rounded px-3 py-2 bg-muted/30">Jayson R. Elliott</p>
              <p className="text-[10px] text-muted-foreground">Auto-signed on creation</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleCreate} disabled={saving} className="w-full">
        {saving ? "Creating..." : clientSig ? "Create Signed Agreement" : "Create & Send Agreement"}
      </Button>
    </div>
  );
}
