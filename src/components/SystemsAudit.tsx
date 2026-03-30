import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Link2, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { logAudit, getUserName } from "@/lib/audit-logger";
import ClientAttachments from "@/components/ClientAttachments";

interface SystemsAuditProps {
  clientProfileId: string;
}

const DEFAULT_DATA: Record<string, Record<string, string>> = {
  firm_structure: {
    practice_type: "",
    team_size: "",
    chaotic_areas: "",
    wish_easier: "",
  },
  lead_flow_intake: {
    how_clients_find_you: "",
    what_happens_after_contact: "",
    who_answers_calls: "",
    clients_being_lost: "",
  },
  consultation_conversion: {
    consultation_structure: "",
    how_scheduled: "",
    post_consultation_process: "",
    consultation_frustrations: "",
  },
  revenue_billing: {
    fee_structure: "",
    payment_collected_upfront: "",
    receivable_challenges: "",
    ideal_billing_system: "",
  },
  technology_systems: {
    crm_intake_software: "",
    billing_accounting: "",
    phone_system: "",
    systems_integrated: "",
  },
  growth_strategy: {
    twelve_month_vision: "",
    hiring_plans: "",
    revenue_benchmark: "",
    scaling_concerns: "",
  },
  strategic_notes: {
    fix_three_things: "",
    keeps_you_up: "",
    feel_in_control: "",
  },
};

const SECTION_LABELS: Record<string, string> = {
  firm_structure: "1. Firm Structure & Current State",
  lead_flow_intake: "2. Lead Flow & Intake Process",
  consultation_conversion: "3. Consultation & Conversion",
  revenue_billing: "4. Revenue & Billing Systems",
  technology_systems: "5. Technology & System Infrastructure",
  growth_strategy: "6. Growth Strategy & Vision",
  strategic_notes: "7. Additional Strategic Notes",
};

const FIELD_LABELS: Record<string, string> = {
  practice_type: "What type of law/service do you practice?",
  team_size: "How many people currently work at your firm?",
  chaotic_areas: "What feels chaotic or disorganized right now?",
  wish_easier: "What do you wish was easier in your firm?",
  how_clients_find_you: "How do new clients typically find your firm?",
  what_happens_after_contact: "When someone calls or submits a form, what happens next?",
  who_answers_calls: "Who is responsible for answering or returning calls?",
  clients_being_lost: "Do you believe potential clients are being lost? If so, why?",
  consultation_structure: "Do you offer consultations? Describe your structure.",
  how_scheduled: "How are consultations scheduled?",
  post_consultation_process: "What occurs immediately following a consultation?",
  consultation_frustrations: "What frustrations exist within your current consult process?",
  fee_structure: "How do you structure fees (flat fee, hourly, hybrid)?",
  payment_collected_upfront: "Is payment collected prior to commencing work?",
  receivable_challenges: "Do receivables present ongoing challenges?",
  ideal_billing_system: "Describe your ideal billing and payment system.",
  crm_intake_software: "What CRM or intake software are you currently using?",
  billing_accounting: "What billing or accounting platform do you rely on?",
  phone_system: "What phone system is in place?",
  systems_integrated: "Are your systems integrated or operating independently?",
  twelve_month_vision: "Where do you want your firm positioned 12 months from now?",
  hiring_plans: "Are you planning to hire or expand your team?",
  revenue_benchmark: "What revenue benchmark would define success?",
  scaling_concerns: "What concerns or risks do you associate with scaling?",
  fix_three_things: "If we could fix 3 things immediately, what would they be?",
  keeps_you_up: "What keeps you up at night about your firm?",
  feel_in_control: "What would make you feel fully in control of your business?",
};

export default function SystemsAudit({ clientProfileId }: SystemsAuditProps) {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, Record<string, string>>>(DEFAULT_DATA);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<{ title: string; url: string }[]>([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: existing } = await supabase
        .from("systems_audits")
        .select("*")
        .eq("client_profile_id", clientProfileId)
        .maybeSingle();
      if (existing) {
        setRecordId(existing.id);
        const merged = { ...DEFAULT_DATA };
        const saved = existing.section_data as Record<string, any>;
        Object.keys(merged).forEach((section) => {
          if (saved[section]) {
            merged[section] = { ...merged[section], ...saved[section] };
          }
        });
        setData(merged);
        if (saved._links && Array.isArray(saved._links)) {
          setLinks(saved._links);
        }
      }
    };
    load();
  }, [clientProfileId]);

  const updateField = (section: string, field: string, value: string) => {
    setData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const sectionDataWithLinks = { ...data, _links: links } as any;
    if (recordId) {
      const { error } = await supabase
        .from("systems_audits")
        .update({ section_data: sectionDataWithLinks })
        .eq("id", recordId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data: inserted, error } = await supabase
        .from("systems_audits")
        .insert({
          client_profile_id: clientProfileId,
          section_data: sectionDataWithLinks,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      setRecordId(inserted.id);
    }
    toast.success("Systems audit saved");
    if (user) {
      const userName = await getUserName(user.id);
      await logAudit({ userId: user.id, userName, entityType: "systems_audit", entityId: recordId || "new", clientProfileId, action: recordId ? "update" : "create", description: "Saved systems audit" });
    }
    setSaving(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Systems Discovery & Operational Assessment</h3>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2" defaultValue={["firm_structure"]}>
        {Object.entries(SECTION_LABELS).map(([section, label]) => (
          <AccordionItem key={section} value={section} className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-medium">{label}</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 py-2">
                {Object.keys(data[section] || {}).map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs">{FIELD_LABELS[field] || field}</Label>
                    <Textarea
                      value={data[section]?.[field] || ""}
                      onChange={(e) => updateField(section, field, e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Links Section */}
      <div className="mt-6 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Link2 className="h-4 w-4" /> Links
        </h4>
        {links.length > 0 && (
          <div className="space-y-1.5">
            {links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded border bg-card">
                <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                  {link.title}
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLinks(links.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input placeholder="Title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="h-8 text-sm" />
          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={() => {
            if (!linkUrl.trim()) { toast.error("URL is required"); return; }
            setLinks([...links, { title: linkTitle.trim() || linkUrl.trim(), url: linkUrl.trim() }]);
            setLinkTitle("");
            setLinkUrl("");
          }}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Links are saved when you click "Save All"</p>
      </div>

      {/* Attachments Section */}
      <div className="mt-6">
        <ClientAttachments clientProfileId={clientProfileId} />
      </div>
    </div>
  );
}
