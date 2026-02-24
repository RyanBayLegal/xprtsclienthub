import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import ScopingQuestionnaire from "@/components/ScopingQuestionnaire";
import ClientTasks from "@/components/ClientTasks";
import ClientAvatarUpload from "@/components/ClientAvatarUpload";
import ClientAttachments from "@/components/ClientAttachments";
import SystemsAudit from "@/components/SystemsAudit";
import AgreementBuilder from "@/components/AgreementBuilder";
import NDABuilder from "@/components/NDABuilder";

const STAGES = ["Prospect", "Qualified", "Active", "Signed", "Inactive"];

interface ClientProfileData {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  name: string;
  role: string | null;
  company: string | null;
  practice_area: string | null;
  is_economic_buyer: boolean | null;
  key_attributes: string | null;
  attitude: string | null;
  stage: string | null;
  pain_points: string | null;
  influences: string | null;
  motivators: string | null;
  repeat_customer_probability: string | null;
  meeting_preferences: string | null;
  client_health_score: number | null;
  future_plans: string | null;
  discovery_source: string | null;
  how_they_found_us: string | null;
  discovery_notes: string | null;
  email: string | null;
  phone: string | null;
}

interface RoleOpen {
  id: string;
  role_name: string;
  is_signed: boolean | null;
  pricing: string | null;
}

interface Agreement {
  id: string;
  status: string;
  notes: string | null;
  agreement_url: string | null;
  sent_at: string;
  created_at: string;
}

export default function ClientProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role: userRole } = useAuth();
  const isTeam = userRole === "team_admin";

  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [roles, setRoles] = useState<RoleOpen[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [ndaDialogOpen, setNdaDialogOpen] = useState(false);
  const [agreementForm, setAgreementForm] = useState({ notes: "", agreement_url: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      if (id === "new") {
        setIsNew(true);
        setProfile({
          id: "", lead_id: null, user_id: null, name: "", role: "", company: "", practice_area: "",
          is_economic_buyer: false, key_attributes: "", attitude: "", stage: "Prospect",
          pain_points: "", influences: "", motivators: "", repeat_customer_probability: "",
          meeting_preferences: "", client_health_score: null, future_plans: "",
          discovery_source: "", how_they_found_us: "", discovery_notes: "",
          email: "", phone: "",
        });
        setLoading(false);
        return;
      }

      let { data } = await supabase.from("client_profiles").select("*").eq("lead_id", id!).maybeSingle();
      if (!data) {
        const res = await supabase.from("client_profiles").select("*").eq("id", id!).maybeSingle();
        data = res.data;
      }

      if (data) {
        setProfile(data as ClientProfileData);
        // Fetch roles and agreements in parallel
        const [rolesRes, agreementsRes] = await Promise.all([
          supabase.from("roles_open").select("*").eq("client_profile_id", data.id),
          supabase.from("engagement_agreements").select("*").eq("client_profile_id", data.id).order("created_at", { ascending: false }),
        ]);
        if (rolesRes.data) setRoles(rolesRes.data);
        if (agreementsRes.data) setAgreements(agreementsRes.data as Agreement[]);
      } else if (isTeam) {
        const { data: lead } = await supabase.from("leads").select("*").eq("id", id!).maybeSingle();
        setIsNew(true);
        setProfile({
          id: "", lead_id: id!, user_id: null, name: lead?.name || "", role: "", company: "",
          practice_area: "", is_economic_buyer: false, key_attributes: "", attitude: "",
          stage: "Prospect", pain_points: "", influences: "", motivators: "",
          repeat_customer_probability: "", meeting_preferences: "", client_health_score: null,
          future_plans: "", discovery_source: lead?.source || "", how_they_found_us: "",
          discovery_notes: "", email: "", phone: "",
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [id, isTeam]);

  const updateProfile = (field: string, value: string | boolean | number | null) => {
    setProfile((p) => p ? { ...p, [field]: value } : p);
  };

  const handleSave = async () => {
    if (!profile) return;
    const { id: _id, ...payload } = profile;
    if (isNew) {
      const { data, error } = await supabase.from("client_profiles").insert({ ...payload, created_by: user?.id }).select().single();
      if (error) { toast.error(error.message); return; }
      setProfile(data as ClientProfileData);
      setIsNew(false);
      toast.success("Profile created");
    } else {
      const { error } = await supabase.from("client_profiles").update(payload).eq("id", profile.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Profile saved");
    }
  };

  const addRole = async () => {
    if (!profile?.id) { toast.error("Save the profile first"); return; }
    const { data, error } = await supabase.from("roles_open").insert({ client_profile_id: profile.id, role_name: "New Role" }).select().single();
    if (error) { toast.error(error.message); return; }
    setRoles([...roles, data]);
  };

  const updateRole = async (roleId: string, field: string, value: string | boolean) => {
    setRoles((r) => r.map((ro) => ro.id === roleId ? { ...ro, [field]: value } : ro));
    await supabase.from("roles_open").update({ [field]: value }).eq("id", roleId);
  };

  const deleteRole = async (roleId: string) => {
    await supabase.from("roles_open").delete().eq("id", roleId);
    setRoles((r) => r.filter((ro) => ro.id !== roleId));
  };

  const sendAgreement = async () => {
    if (!profile?.id) { toast.error("Save the profile first"); return; }
    const { data, error } = await supabase.from("engagement_agreements").insert({
      client_profile_id: profile.id,
      lead_id: profile.lead_id,
      sent_by: user?.id,
      status: "sent",
      notes: agreementForm.notes || null,
      agreement_url: agreementForm.agreement_url || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setAgreements([data as Agreement, ...agreements]);
    setAgreementDialogOpen(false);
    setAgreementForm({ notes: "", agreement_url: "" });

    // Create notification
    if (user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "agreement_sent",
        title: "Engagement agreement sent",
        message: `Agreement sent to ${profile.name}`,
        lead_id: profile.lead_id,
      });
    }
    toast.success("Engagement agreement sent");
  };

  const updateAgreementStatus = async (agreementId: string, status: string) => {
    const { error } = await supabase.from("engagement_agreements").update({ status }).eq("id", agreementId);
    if (error) { toast.error(error.message); return; }
    setAgreements((prev) => prev.map((a) => a.id === agreementId ? { ...a, status } : a));

    if (status === "signed" && user) {
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "agreement_signed",
        title: "Agreement signed!",
        message: `${profile?.name} signed the engagement agreement`,
        lead_id: profile?.lead_id || null,
      });
    }
    toast.success(`Agreement marked as ${status}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="text-center py-12 text-muted-foreground">Profile not found</div>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {!isNew && profile.id && (
          <ClientAvatarUpload
            clientProfileId={profile.id}
            clientName={profile.name}
            avatarUrl={(profile as any).avatar_url || null}
            onAvatarChange={(url) => setProfile((p) => p ? { ...p, avatar_url: url } as any : p)}
            editable={isTeam}
          />
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{profile.name || "New Client Profile"}</h1>
          {profile.stage && (
            <Badge variant="secondary" className="text-xs">{profile.stage}</Badge>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          {isTeam && !isNew && (
            <>
              <Dialog open={agreementDialogOpen} onOpenChange={setAgreementDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><FileText className="mr-2 h-4 w-4" />Create Agreement</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>XPRTS Staffing Services Agreement</DialogTitle></DialogHeader>
                  <AgreementBuilder
                    clientProfileId={profile.id}
                    leadId={profile.lead_id}
                    clientName={profile.name}
                    onCreated={() => {
                      setAgreementDialogOpen(false);
                      supabase.from("engagement_agreements").select("*").eq("client_profile_id", profile.id).order("created_at", { ascending: false }).then(({ data }) => {
                        if (data) setAgreements(data as Agreement[]);
                      });
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Dialog open={ndaDialogOpen} onOpenChange={setNdaDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><FileText className="mr-2 h-4 w-4" />Create NDA</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Mutual NDA & Non-Interference Agreement</DialogTitle></DialogHeader>
                  <NDABuilder
                    clientProfileId={profile.id}
                    leadId={profile.lead_id}
                    clientName={profile.name}
                    onCreated={() => {
                      setNdaDialogOpen(false);
                      supabase.from("engagement_agreements").select("*").eq("client_profile_id", profile.id).order("created_at", { ascending: false }).then(({ data }) => {
                        if (data) setAgreements(data as Agreement[]);
                      });
                    }}
                  />
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save</Button>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="relationship">Relationship</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
          {isTeam && <TabsTrigger value="agreements">Agreements</TabsTrigger>}
          {isTeam && !isNew && <TabsTrigger value="scoping">Scoping</TabsTrigger>}
          {isTeam && !isNew && <TabsTrigger value="tasks">Tasks</TabsTrigger>}
          {isTeam && !isNew && <TabsTrigger value="attachments">Attachments</TabsTrigger>}
          {isTeam && !isNew && <TabsTrigger value="audit">Systems Audit</TabsTrigger>}
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={profile.name} onChange={(e) => updateProfile("name", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={profile.role || ""} onChange={(e) => updateProfile("role", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={profile.company || ""} onChange={(e) => updateProfile("company", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Input value={profile.practice_area || ""} onChange={(e) => updateProfile("practice_area", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={profile.email || ""} onChange={(e) => updateProfile("email", e.target.value)} placeholder="client@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={profile.phone || ""} onChange={(e) => updateProfile("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Checkbox checked={profile.is_economic_buyer || false} onCheckedChange={(v) => updateProfile("is_economic_buyer", !!v)} />
                <Label>Economic Buyer / Decision Maker</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessment">
          <Card>
            <CardHeader><CardTitle>Assessment</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={profile.stage || "Prospect"} onValueChange={(v) => updateProfile("stage", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {isTeam && (
                  <div className="space-y-2">
                    <Label>Attitude (Internal)</Label>
                    <Input value={profile.attitude || ""} onChange={(e) => updateProfile("attitude", e.target.value)} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Key Attributes</Label>
                <Textarea value={profile.key_attributes || ""} onChange={(e) => updateProfile("key_attributes", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pain Points</Label>
                <Textarea value={profile.pain_points || ""} onChange={(e) => updateProfile("pain_points", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Influences</Label>
                <Textarea value={profile.influences || ""} onChange={(e) => updateProfile("influences", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Motivators</Label>
                <Textarea value={profile.motivators || ""} onChange={(e) => updateProfile("motivators", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationship">
          <Card>
            <CardHeader><CardTitle>Relationship</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Repeat Customer Probability</Label>
                <Select value={profile.repeat_customer_probability || ""} onValueChange={(v) => updateProfile("repeat_customer_probability", v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Mid">Mid</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meeting Preferences</Label>
                <Input value={profile.meeting_preferences || ""} onChange={(e) => updateProfile("meeting_preferences", e.target.value)} />
              </div>
              {isTeam && (
                <div className="space-y-2">
                  <Label>Client Health Score (0-10)</Label>
                  <Input type="number" min={0} max={10} value={profile.client_health_score ?? ""} onChange={(e) => updateProfile("client_health_score", e.target.value ? Number(e.target.value) : null)} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardHeader><CardTitle>Business</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Future Plans</Label>
                <Textarea value={profile.future_plans || ""} onChange={(e) => updateProfile("future_plans", e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Roles Open (30-60 days)</Label>
                  {isTeam && <Button variant="outline" size="sm" onClick={addRole}><Plus className="mr-1 h-3 w-3" />Add Role</Button>}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Signed</TableHead>
                      <TableHead>Pricing</TableHead>
                      {isTeam && <TableHead className="w-12" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No roles added</TableCell></TableRow>
                    ) : (
                      roles.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell><Input value={r.role_name} onChange={(e) => updateRole(r.id, "role_name", e.target.value)} className="h-8" /></TableCell>
                          <TableCell><Checkbox checked={r.is_signed || false} onCheckedChange={(v) => updateRole(r.id, "is_signed", !!v)} /></TableCell>
                          <TableCell><Input value={r.pricing || ""} onChange={(e) => updateRole(r.id, "pricing", e.target.value)} className="h-8" /></TableCell>
                          {isTeam && (
                            <TableCell><Button variant="ghost" size="icon" onClick={() => deleteRole(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discovery">
          <Card>
            <CardHeader><CardTitle>Discovery</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input value={profile.discovery_source || ""} onChange={(e) => updateProfile("discovery_source", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>How They Found Us</Label>
                  <Input value={profile.how_they_found_us || ""} onChange={(e) => updateProfile("how_they_found_us", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={profile.discovery_notes || ""} onChange={(e) => updateProfile("discovery_notes", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isTeam && (
          <TabsContent value="agreements">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Engagement Agreements</CardTitle>
                  {!isNew && (
                    <Button variant="outline" size="sm" onClick={() => setAgreementDialogOpen(true)}>
                      <Plus className="mr-1 h-3 w-3" />New Agreement
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agreements.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No agreements yet</TableCell></TableRow>
                    ) : (
                      agreements.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{formatDistanceToNow(new Date(a.sent_at), { addSuffix: true })}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === "signed" ? "default" : "secondary"}>{a.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {a.agreement_url ? <a href={a.agreement_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">View</a> : "—"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">{a.notes || "—"}</TableCell>
                          <TableCell>
                            <Select value={a.status} onValueChange={(v) => updateAgreementStatus(a.id, v)}>
                              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["draft", "sent", "viewed", "signed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isTeam && !isNew && profile.id && (
          <TabsContent value="scoping">
            <ScopingQuestionnaire clientProfileId={profile.id} />
          </TabsContent>
        )}

        {isTeam && !isNew && profile.id && (
          <TabsContent value="tasks">
            <ClientTasks clientProfileId={profile.id} leadId={profile.lead_id} />
          </TabsContent>
        )}

        {isTeam && !isNew && profile.id && (
          <TabsContent value="attachments">
            <ClientAttachments clientProfileId={profile.id} />
          </TabsContent>
        )}

        {isTeam && !isNew && profile.id && (
          <TabsContent value="audit">
            <SystemsAudit clientProfileId={profile.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
