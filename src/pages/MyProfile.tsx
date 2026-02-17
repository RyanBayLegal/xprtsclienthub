import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function MyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const { data } = await supabase.from("client_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setProfile(data);
        const { data: rolesData } = await supabase.from("roles_open").select("*").eq("client_profile_id", data.id);
        if (rolesData) setRoles(rolesData);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const update = (field: string, value: string) => {
    setProfile((p: any) => p ? { ...p, [field]: value } : p);
  };

  const handleSave = async () => {
    if (!profile) return;
    const { error } = await supabase.from("client_profiles").update({
      company: profile.company,
      pain_points: profile.pain_points,
      meeting_preferences: profile.meeting_preferences,
      needs: profile.needs,
      future_plans: profile.future_plans,
    }).eq("id", profile.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!profile) return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold mb-2">No profile found</h2>
      <p className="text-muted-foreground">Your team hasn't set up your profile yet. Please contact your account manager.</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Your Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={profile.name} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile.role || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={profile.company || ""} onChange={(e) => update("company", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Practice Area</Label>
              <Input value={profile.practice_area || ""} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your Needs & Preferences</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="space-y-2">
              <Label>Pain Points</Label>
              <Textarea value={profile.pain_points || ""} onChange={(e) => update("pain_points", e.target.value)} placeholder="What challenges are you facing?" />
            </div>
            <div className="space-y-2">
              <Label>Meeting Preferences</Label>
              <Input value={profile.meeting_preferences || ""} onChange={(e) => update("meeting_preferences", e.target.value)} placeholder="e.g., Zoom, In-person, Morning" />
            </div>
            <div className="space-y-2">
              <Label>Future Plans</Label>
              <Textarea value={profile.future_plans || ""} onChange={(e) => update("future_plans", e.target.value)} placeholder="Any upcoming plans we should know about?" />
            </div>
          </CardContent>
        </Card>

        {roles.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Open Roles</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.role_name}</TableCell>
                      <TableCell>{r.is_signed ? "Signed" : "Open"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
