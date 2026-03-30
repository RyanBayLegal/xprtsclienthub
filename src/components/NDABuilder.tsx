import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAudit, getUserName } from "@/lib/audit-logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";

interface NDABuilderProps {
  clientProfileId: string;
  leadId?: string | null;
  clientName: string;
  onCreated: () => void;
}

export default function NDABuilder({ clientProfileId, leadId, clientName, onCreated }: NDABuilderProps) {
  const { user } = useAuth();
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clientSig, setClientSig] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!clientName) { toast.error("Client name is required"); return; }
    setSaving(true);

    const contentData = {
      type: "nda",
      effective_date: effectiveDate,
      client_name: clientName,
    };

    const { error } = await supabase.from("engagement_agreements").insert({
      client_profile_id: clientProfileId,
      lead_id: leadId || null,
      sent_by: user?.id,
      status: clientSig ? "signed" : "sent",
      content_data: contentData as any,
      client_signature: clientSig || null,
      client_signed_at: clientSig ? new Date().toISOString() : null,
      xprts_signature: "Jayson R. Elliott",
      xprts_signed_at: new Date().toISOString(),
      notes: `Mutual NDA for ${clientName}`,
    });

    if (error) { toast.error(error.message); setSaving(false); return; }

    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({
        userId: user.id,
        userName,
        entityType: "nda",
        entityId: clientProfileId,
        clientProfileId,
        action: "create",
        description: `Created Mutual NDA for ${clientName}${clientSig ? " (signed)" : ""}`,
      });
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: clientSig ? "nda_signed" : "nda_sent",
        title: clientSig ? "NDA signed!" : "NDA sent",
        message: `Mutual NDA ${clientSig ? "signed by" : "sent to"} ${clientName}`,
        lead_id: leadId || null,
      });
    }

    toast.success(clientSig ? "NDA created and signed" : "NDA created and sent");
    setSaving(false);
    onCreated();
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">XPRTS Mutual NDA & Non-Interference Agreement</CardTitle>
          <p className="text-xs text-muted-foreground">11 N Nile Ave, East Wenatchee, WA 98802 · (650) 561-6942 · karen@xprts.com</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Effective Date</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Client Name</Label>
              <Input value={clientName} disabled className="bg-muted/30" />
            </div>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">1. Purpose & Business Relationship</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>The Parties anticipate exchanging confidential, proprietary, and sensitive information in connection with their business relationship, including the XPRTS Staffing Services Agreement.</p>
            <p>• Facilitate evaluation, performance, and continuation of professional services</p>
            <p>• Protect confidential information, goodwill, operations, and proprietary interests</p>
            <p>• Establish enforceable obligations under Delaware law</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">2. Definitions — Confidential Information</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>"Confidential Information" means any information disclosed by one Party to the other in any form (oral, written, electronic, visual), including but not limited to:</p>
            <p>• Business operations, workflows, processes, and systems</p>
            <p>• Financial data, pricing, costs, margins, forecasts, and business models</p>
            <p>• Recruitment procedures, training methods, evaluation systems</p>
            <p>• Client lists, leads, communications, and business relationships</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">3. Non-Use and Non-Disclosure Obligations</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>The Receiving Party agrees to:</p>
            <p>• Use Confidential Information solely for the Authorized Purpose</p>
            <p>• Not disclose to any third party without prior written consent</p>
            <p>• Limit access strictly to employees/contractors bound by written confidentiality obligations</p>
            <p>• Exercise at least reasonable care to protect such information</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">4. Protection of Data & Security Standards</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Both Parties agree to maintain commercially reasonable safeguards against unauthorized access, loss, destruction, corruption, or alteration.</p>
            <p>Client is solely responsible for costs of any required security software (VPN, licenses, etc.).</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">5–6. Legally Compelled Disclosure & Ownership</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Prompt written notice required if legally compelled to disclose; only minimum amount permitted</p>
            <p>• All Confidential Information remains exclusive property of the Disclosing Party</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">7. Non-Solicitation, Non-Hiring & Non-Interference</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Client shall not directly or indirectly solicit, hire, or interfere with any XPRTS Remote Staff, employee, contractor, or vendor</p>
            <p>• Restriction applies for the maximum period permitted under Delaware law</p>
            <p>• Client shall not interfere with XPRTS's relationships with clients, staff, or partners</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">8. Injunctive Relief and Remedies</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Any breach causes irreparable harm; monetary damages alone are inadequate</p>
            <p>• XPRTS entitled to seek injunctions under Delaware law without posting bond</p>
            <p>• Violation requires payment of applicable buy-out fee per the Staffing Agreement</p>
          </div>

          <Separator />
          <h4 className="font-semibold text-sm">9–14. Additional Terms</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Return or destroy Confidential Information upon request or termination</p>
            <p>• Confidentiality and non-solicitation obligations survive for 3 years; trade secrets indefinitely</p>
            <p>• Governed exclusively by Delaware law</p>
            <p>• Any unenforceable provision narrowed to maximum extent permitted</p>
            <p>• Amendments require signed writing by both Parties</p>
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
        {saving ? "Creating..." : clientSig ? "Create Signed NDA" : "Create & Send NDA"}
      </Button>
    </div>
  );
}
