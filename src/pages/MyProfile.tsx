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
import { Save, Upload, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  contact_number: string | null;
  address: string | null;
  date_of_birth: string | null;
  hired_date: string | null;
  personal_email: string | null;
}

export default function MyProfile() {
  const { user } = useAuth();
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [pwOpen, setPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const [clientRes, profileRes] = await Promise.all([
        supabase.from("client_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url, contact_number, address, date_of_birth, hired_date, personal_email").eq("user_id", user.id).maybeSingle(),
      ]);

      if (profileRes.data) setProfile(profileRes.data as ProfileData);
      else setProfile({ full_name: null, avatar_url: null, contact_number: null, address: null, date_of_birth: null, hired_date: null, personal_email: null });

      if (clientRes.data) {
        setClientProfile(clientRes.data);
        const { data: rolesData } = await supabase.from("roles_open").select("*").eq("client_profile_id", clientRes.data.id);
        if (rolesData) setRoles(rolesData);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const updateClient = (field: string, value: string) => {
    setClientProfile((p: any) => p ? { ...p, [field]: value } : p);
  };

  const updateProfile = (field: keyof ProfileData, value: string | null) => {
    setProfile((p) => p ? { ...p, [field]: value } : p);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    setCropFile(file);
    setCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!user) return;
    setCropOpen(false);
    setCropFile(null);
    setUploading(true);

    const path = `${user.id}/avatar.png`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/png" });

    if (uploadError) { toast.error(uploadError.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
    updateProfile("avatar_url", avatarUrl);
    toast.success("Avatar updated");
    setUploading(false);
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name?.trim() || null,
      contact_number: profile.contact_number?.trim() || null,
      address: profile.address?.trim() || null,
      date_of_birth: profile.date_of_birth || null,
      hired_date: profile.hired_date || null,
      personal_email: profile.personal_email?.trim() || null,
    }).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
  };

  const handleSaveClient = async () => {
    if (!clientProfile) return;
    const { error } = await supabase.from("client_profiles").update({
      company: clientProfile.company,
      pain_points: clientProfile.pain_points,
      meeting_preferences: clientProfile.meeting_preferences,
      needs: clientProfile.needs,
      future_plans: clientProfile.future_plans,
    } as never).eq("id", clientProfile.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Client profile updated");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed successfully");
    setPwOpen(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPwOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />Change Password
          </Button>
          <Button onClick={handleSaveProfile}><Save className="mr-2 h-4 w-4" />Save Profile</Button>
        </div>
      </div>

      {/* Avatar & Basic Info */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <UserAvatar avatarUrl={profile?.avatar_url} fullName={profile?.full_name || user?.email} size="lg" />
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, or WebP. Max 5MB.</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={profile?.full_name || ""} onChange={(e) => updateProfile("full_name", e.target.value)} placeholder="Your display name" />
            </div>
            <div className="space-y-2">
              <Label>Account Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Personal Email</Label>
              <Input type="email" value={profile?.personal_email || ""} onChange={(e) => updateProfile("personal_email", e.target.value)} placeholder="personal@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Contact Number</Label>
              <Input value={profile?.contact_number || ""} onChange={(e) => updateProfile("contact_number", e.target.value)} placeholder="+1 (555) 000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" value={profile?.date_of_birth || ""} onChange={(e) => updateProfile("date_of_birth", e.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>Hired Date</Label>
              <Input type="date" value={profile?.hired_date || ""} onChange={(e) => updateProfile("hired_date", e.target.value || null)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Textarea value={profile?.address || ""} onChange={(e) => updateProfile("address", e.target.value)} placeholder="Your full address" rows={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      <AvatarCropDialog file={cropFile} open={cropOpen} onClose={() => { setCropOpen(false); setCropFile(null); }} onCrop={handleCroppedUpload} />

      {/* Client profile section (if applicable) */}
      {clientProfile && (
        <div className="grid gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Client Information</CardTitle>
              <Button size="sm" onClick={handleSaveClient}><Save className="mr-2 h-4 w-4" />Save</Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={clientProfile.name} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={clientProfile.role || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input value={clientProfile.company || ""} onChange={(e) => updateClient("company", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Practice Area</Label>
                <Input value={clientProfile.practice_area || ""} disabled className="bg-muted" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Your Needs & Preferences</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label>Pain Points</Label>
                <Textarea value={clientProfile.pain_points || ""} onChange={(e) => updateClient("pain_points", e.target.value)} placeholder="What challenges are you facing?" />
              </div>
              <div className="space-y-2">
                <Label>Meeting Preferences</Label>
                <Input value={clientProfile.meeting_preferences || ""} onChange={(e) => updateClient("meeting_preferences", e.target.value)} placeholder="e.g., Zoom, In-person, Morning" />
              </div>
              <div className="space-y-2">
                <Label>Future Plans</Label>
                <Textarea value={clientProfile.future_plans || ""} onChange={(e) => updateClient("future_plans", e.target.value)} placeholder="Any upcoming plans we should know about?" />
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

      {!clientProfile && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Your profile details are shown above. Update and save as needed.</p>
        </div>
      )}

      {/* Password Change Dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
