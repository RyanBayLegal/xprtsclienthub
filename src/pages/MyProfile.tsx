import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/UserAvatar";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { Save, Upload } from "lucide-react";
import { toast } from "sonner";

export default function MyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      
      const [clientRes, profileRes] = await Promise.all([
        supabase.from("client_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle(),
      ]);
      
      if (profileRes.data) setUserProfile(profileRes.data);
      
      if (clientRes.data) {
        setProfile(clientRes.data);
        const { data: rolesData } = await supabase.from("roles_open").select("*").eq("client_profile_id", clientRes.data.id);
        if (rolesData) setRoles(rolesData);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const update = (field: string, value: string) => {
    setProfile((p: any) => p ? { ...p, [field]: value } : p);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return; }
    
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
    
    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
    setUserProfile((p) => p ? { ...p, avatar_url: avatarUrl } : { full_name: null, avatar_url: avatarUrl });
    toast.success("Avatar updated");
    setUploading(false);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        {profile && <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Changes</Button>}
      </div>

      {/* Avatar section */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <UserAvatar
              avatarUrl={userProfile?.avatar_url}
              fullName={userProfile?.full_name || profile?.name}
              size="lg"
            />
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP. Max 5MB.</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!profile ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">No client profile found</h2>
          <p className="text-muted-foreground">Your team hasn't set up your client profile yet. You can still update your photo above.</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
