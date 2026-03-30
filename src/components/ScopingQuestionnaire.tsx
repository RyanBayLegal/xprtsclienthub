import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { logAudit, getUserName } from "@/lib/audit-logger";

interface ScopingQuestionnaireProps {
  clientProfileId: string;
}

const DEFAULT_DATA: Record<string, any> = {
  firm_overview: {
    firm_name: "", practice_areas: "", jurisdiction: "",
    business_hours: "", attorney_count: "", staff_count: "",
    contact_name: "", contact_email: "", contact_title: "",
    staffing_challenges: "", outsourcing_goals: "",
  },
  roles_requested: {
    role_title: "", headcount: "", full_or_part_time: "",
    schedule: "", timezone: "", work_days: "", time: "",
    weekend_coverage: "", primary_responsibilities: "",
    weekly_responsibilities: "", internal_tasks: "",
    independence_level: "",
  },
  experience_skills: {
    experience_level: "", languages: "", law_firm_experience: "",
    practice_area_experience: "", skills_checklist: "",
    certifications: "",
  },
  training_onboarding: {
    firm_provides_training: "", onboarding_contact: "",
    start_date_skills: "", has_sops: "", share_sops: "",
    ongoing_training: "",
  },
  systems_technology: {
    case_management: "", crm_tools: "", billing_systems: "",
    phone_systems: "", communication_tools: "",
    time_tracking: "", licenses_provided: "",
    security_requirements: "",
  },
  performance: {
    success_metrics: "", reporting_preference: "",
    escalation_process: "",
  },
  communication: {
    primary_contact: "", preferred_method: "",
  },
  compliance: {
    confidentiality: "", nda_required: "", regulatory: "",
    ethical_boundaries: "", conflict_screening: "",
  },
  flexibility_growth: {
    anticipated_changes: "", scale_ability: "",
    temp_vs_longterm: "", coverage_expectations: "",
  },
  defining_success: {
    first_30_days: "", first_60_days: "", first_90_days: "",
    top_outcomes: "", concerns: "",
  },
};

const SECTION_LABELS: Record<string, string> = {
  firm_overview: "1. Firm Overview",
  roles_requested: "2. Roles Requested",
  experience_skills: "3. Experience & Skill Requirements",
  training_onboarding: "4. Training & Onboarding",
  systems_technology: "5. Systems & Technology",
  communication: "6. Communication & Oversight",
  performance: "7. Performance Expectations",
  compliance: "8. Compliance & Confidentiality",
  flexibility_growth: "9. Flexibility & Growth",
  defining_success: "10. Defining Success",
};

const FIELD_LABELS: Record<string, string> = {
  firm_name: "Firm Name", practice_areas: "Practice Area(s)", jurisdiction: "Jurisdiction / States",
  business_hours: "Business Hours", attorney_count: "Number of Attorneys", staff_count: "Number of Staff",
  contact_name: "Primary Contact Name", contact_email: "Primary Contact Email", contact_title: "Contact Title",
  staffing_challenges: "Current Staffing Challenges", outsourcing_goals: "Outsourcing Goals",
  role_title: "Role Title", headcount: "Headcount Needed", full_or_part_time: "Full-Time or Part-Time",
  schedule: "Schedule / Shift", timezone: "Timezone", work_days: "Work Days", time: "Hours / Time",
  weekend_coverage: "Weekend Coverage Needed?", primary_responsibilities: "Primary Responsibilities",
  weekly_responsibilities: "Weekly Responsibilities", internal_tasks: "Internal Tasks",
  independence_level: "Level of Independence",
  experience_level: "Experience Level", languages: "Language Requirements",
  law_firm_experience: "Law Firm Experience Required", practice_area_experience: "Practice Area Experience",
  skills_checklist: "Skills Checklist", certifications: "Certifications Required",
  firm_provides_training: "Will Firm Provide Training?", onboarding_contact: "Onboarding Contact",
  start_date_skills: "Start Date / Skill Readiness", has_sops: "Has SOPs?", share_sops: "Will Share SOPs?",
  ongoing_training: "Ongoing Training Plans",
  case_management: "Case Management Software", crm_tools: "CRM Tools", billing_systems: "Billing Systems",
  phone_systems: "Phone Systems", communication_tools: "Communication Tools (Slack, Teams, etc.)",
  time_tracking: "Time Tracking Tool", licenses_provided: "Licenses Provided by Firm?",
  security_requirements: "Security Requirements",
  success_metrics: "Key Success Metrics", reporting_preference: "Reporting Preference / Frequency",
  escalation_process: "Escalation Process",
  primary_contact: "Point of Contact", preferred_method: "Preferred Communication Method",
  confidentiality: "Confidentiality Requirements", nda_required: "NDA Required?",
  regulatory: "HIPAA / GDPR / Other Regulatory", ethical_boundaries: "Ethical Boundaries",
  conflict_screening: "Conflict Screening Process",
  anticipated_changes: "Anticipated Changes (Next 6-12 Months)", scale_ability: "Ability to Scale Up/Down",
  temp_vs_longterm: "Temporary vs. Long-Term", coverage_expectations: "Coverage Expectations",
  first_30_days: "First 30 Days Goals", first_60_days: "First 60 Days Goals",
  first_90_days: "First 90 Days Goals", top_outcomes: "Top 3 Desired Outcomes",
  concerns: "Concerns or Reservations",
};

const TEXTAREA_FIELDS = new Set([
  "staffing_challenges", "outsourcing_goals", "primary_responsibilities",
  "weekly_responsibilities", "internal_tasks", "skills_checklist",
  "success_metrics", "escalation_process", "confidentiality",
  "ethical_boundaries", "conflict_screening", "anticipated_changes",
  "coverage_expectations", "first_30_days", "first_60_days",
  "first_90_days", "top_outcomes", "concerns",
]);

export default function ScopingQuestionnaire({ clientProfileId }: ScopingQuestionnaireProps) {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, any>>(DEFAULT_DATA);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: existing } = await supabase
        .from("scoping_questionnaires")
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
    if (recordId) {
      const { error } = await supabase
        .from("scoping_questionnaires")
        .update({ section_data: data as any })
        .eq("id", recordId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data: inserted, error } = await supabase
        .from("scoping_questionnaires")
        .insert({
          client_profile_id: clientProfileId,
          section_data: data as any,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      setRecordId(inserted.id);
    }
    toast.success("Scoping questionnaire saved");
    setSaving(false);
  };

  const renderField = (section: string, field: string) => {
    const label = FIELD_LABELS[field] || field.replace(/_/g, " ");
    const value = data[section]?.[field] || "";
    if (TEXTAREA_FIELDS.has(field)) {
      return (
        <div key={field} className="space-y-1.5 col-span-2">
          <Label className="text-xs">{label}</Label>
          <Textarea value={value} onChange={(e) => updateField(section, field, e.target.value)} className="min-h-[80px]" />
        </div>
      );
    }
    return (
      <div key={field} className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input value={value} onChange={(e) => updateField(section, field, e.target.value)} />
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Client Discovery & Scoping Questionnaire</h3>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving..." : "Save All"}
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2" defaultValue={["firm_overview"]}>
        {Object.entries(SECTION_LABELS).map(([section, label]) => (
          <AccordionItem key={section} value={section} className="border rounded-lg px-4">
            <AccordionTrigger className="text-sm font-medium">{label}</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 md:grid-cols-2 py-2">
                {Object.keys(data[section] || {}).map((field) => renderField(section, field))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
