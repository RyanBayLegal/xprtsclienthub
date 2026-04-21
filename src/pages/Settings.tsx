import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { UserAvatar } from "@/components/UserAvatar";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Upload, Palette, Save, UserPlus, Users, RotateCcw, Shield } from "lucide-react";
import LeadSourcesManager from "@/components/LeadSourcesManager";

interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

export default function Settings() {
  const { user, sessionTimeoutMinutes, setSessionTimeoutMinutes } = useAuth();
  const { branding, refetch } = useBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Branding state
  const [appName, setAppName] = useState(branding.app_name);
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [accentColor, setAccentColor] = useState(branding.accent_color);
  const [sidebarColor, setSidebarColor] = useState(branding.sidebar_color);
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logo_url);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // User management state
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"team_admin" | "client" | "staff_member">("team_admin");
  const [addingUser, setAddingUser] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTargetUser = useRef<string | null>(null);

  // Security state
  const [localTimeout, setLocalTimeout] = useState(sessionTimeoutMinutes);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, created_at");
    if (!roles) return;

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);

    const mapped: ManagedUser[] = roles.map((r) => {
      const profile = profiles?.find((p) => p.user_id === r.user_id);
      return {
        id: r.user_id,
        email: "",
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        role: r.role,
        created_at: r.created_at,
      };
    });
    setUsers(mapped);
  };

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserName) {
      toast.error("Email and name are required");
      return;
    }
    setAddingUser(true);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    const res = await supabase.functions.invoke("invite-client", {
      body: { email: newUserEmail, name: newUserName, role: newUserRole },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error) {
      toast.error(res.error.message || "Failed to create user");
      setAddingUser(false);
      return;
    }

    toast.success(`Invite sent to ${newUserEmail}. They'll receive an email to set their password.`);
    setAddUserOpen(false);
    setNewUserEmail("");
    setNewUserName("");
    setNewUserRole("team_admin" as "team_admin" | "client" | "staff_member");
    setAddingUser(false);
    fetchUsers();
  };

  const handleResendInvite = async (userId: string) => {
    const u = users.find((x) => x.id === userId);
    if (!u) return;

    // We need the email — fetch it via edge function resend mode using user_id lookup
    // Since we store name but not email in profiles, we call the edge function with resend + user_id
    setResendingId(userId);

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;

    // We'll need to get the email. Use admin via edge function resend with userId
    const res = await supabase.functions.invoke("resend-invite", {
      body: { userId },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.error || res.data?.error) {
      toast.error(res.data?.error || res.error?.message || "Failed to resend invite");
    } else {
      toast.success("Invite email resent successfully.");
    }
    setResendingId(null);
  };

  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    setCropFile(file);
    setCropOpen(true);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCroppedAvatarUpload = async (blob: Blob) => {
    const userId = avatarTargetUser.current;
    if (!userId) return;
    setCropOpen(false);
    setCropFile(null);

    setUploadingAvatarId(userId);
    const path = `${userId}/avatar.png`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/png" });

    if (uploadError) { toast.error(uploadError.message); setUploadingAvatarId(null); return; }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = urlData.publicUrl + "?t=" + Date.now();

    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, avatar_url: avatarUrl } : u));
    toast.success("Avatar updated");
    setUploadingAvatarId(null);
  };

  const handleRoleChange = async (userId: string, newRole: "team_admin" | "client" | "staff_member") => {
    if (userId === user?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    setChangingRoleId(userId);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId);
    if (error) {
      toast.error("Failed to update role: " + error.message);
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      toast.success("Role updated successfully");
    }
    setChangingRoleId(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    let logoUrl = branding.logo_url;

    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(path, logoFile, { upsert: true });

      if (uploadError) {
        toast.error("Failed to upload logo: " + uploadError.message);
        setSaving(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("branding").getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from("branding_settings")
      .update({
        app_name: appName,
        primary_color: primaryColor,
        accent_color: accentColor,
        sidebar_color: sidebarColor,
        logo_url: logoUrl,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", branding.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    await refetch();
    toast.success("Branding updated! Changes are live.");
    setSaving(false);
  };

  const handleReset = () => {
    setAppName(branding.app_name);
    setPrimaryColor(branding.primary_color);
    setAccentColor(branding.accent_color);
    setSidebarColor(branding.sidebar_color);
    setLogoPreview(branding.logo_url);
    setLogoFile(null);
  };

  const handleSaveTimeout = () => {
    setSessionTimeoutMinutes(localTimeout);
    toast.success(`Session timeout set to ${localTimeout} minutes.`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage branding, users, and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="lead-sources">Lead Sources</TabsTrigger>
        </TabsList>

        {/* ── BRANDING TAB ── */}
        <TabsContent value="branding">
          <div className="flex justify-end mb-4 gap-2">
            <Button variant="outline" onClick={handleReset}>Reset</Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Logo
                </CardTitle>
                <CardDescription>Upload your company logo for the sidebar and documents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ backgroundColor: sidebarColor }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="max-h-16 mx-auto" />
                  ) : (
                    <div className="text-white/60">
                      <Upload className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Click to upload logo</p>
                      <p className="text-xs mt-1">PNG, JPG, or SVG recommended</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                {logoPreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                  >
                    Remove Logo
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* App Name */}
            <Card>
              <CardHeader>
                <CardTitle>App Name</CardTitle>
                <CardDescription>The name shown in the sidebar header</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Application Name</Label>
                  <Input
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="XPRTS CRM"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Colors
                </CardTitle>
                <CardDescription>Set your primary, accent, and sidebar colors using hex codes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#005b2f" className="font-mono" />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for buttons, links, and highlights</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                      <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#f2c865" className="font-mono" />
                    </div>
                    <p className="text-xs text-muted-foreground">Used for badges, accents, and hover states</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Sidebar Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={sidebarColor} onChange={(e) => setSidebarColor(e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                      <Input value={sidebarColor} onChange={(e) => setSidebarColor(e.target.value)} placeholder="#08331c" className="font-mono" />
                    </div>
                    <p className="text-xs text-muted-foreground">Background color of the navigation sidebar</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 border rounded-lg overflow-hidden">
                  <div className="text-xs font-medium text-muted-foreground px-3 py-2 bg-muted/50">Preview</div>
                  <div className="flex h-32">
                    <div className="w-48 p-3 flex flex-col" style={{ backgroundColor: sidebarColor }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Preview" className="h-6 mb-2" />
                      ) : (
                        <span className="text-white text-sm font-bold mb-2">{appName}</span>
                      )}
                      <div className="space-y-1">
                        {["Dashboard", "Leads", "Clients"].map((item) => (
                          <div key={item} className="text-white/70 text-xs py-1 px-2 rounded" style={{ backgroundColor: `${sidebarColor}cc` }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 p-4 bg-background">
                      <div className="flex gap-2 mb-3">
                        <div className="px-3 py-1.5 rounded text-xs text-white font-medium" style={{ backgroundColor: primaryColor }}>
                          Primary Button
                        </div>
                        <div className="px-3 py-1.5 rounded text-xs font-medium" style={{ backgroundColor: accentColor, color: sidebarColor }}>
                          Accent Badge
                        </div>
                      </div>
                      <div className="h-2 rounded-full w-2/3" style={{ backgroundColor: primaryColor, opacity: 0.2 }} />
                      <div className="h-2 rounded-full w-1/2 mt-1" style={{ backgroundColor: primaryColor, opacity: 0.1 }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── USER MANAGEMENT TAB ── */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>Create and manage user accounts</CardDescription>
                </div>
                <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button><UserPlus className="mr-2 h-4 w-4" />Add User</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="john@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "team_admin" | "client" | "staff_member")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="team_admin">Team Admin</SelectItem>
                            <SelectItem value="staff_member">Staff Member</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The user will receive an email to verify their address and set their own password.
                      </p>
                      <Button onClick={handleAddUser} disabled={addingUser} className="w-full">
                        {addingUser ? "Creating..." : "Create User & Send Invite"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No users found. Click "Add User" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <button
                              className="relative group"
                              onClick={() => { avatarTargetUser.current = u.id; avatarInputRef.current?.click(); }}
                              disabled={uploadingAvatarId === u.id}
                              title="Change avatar"
                            >
                              <UserAvatar avatarUrl={u.avatar_url} fullName={u.full_name} size="md" />
                              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload className="h-3 w-3 text-white" />
                              </div>
                              {uploadingAvatarId === u.id && (
                                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                                  <span className="text-white text-[8px]">...</span>
                                </div>
                              )}
                            </button>
                            <span className="font-medium">{u.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleChange(u.id, v as "team_admin" | "client" | "staff_member")}
                            disabled={changingRoleId === u.id || u.id === user?.id}
                          >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="team_admin">Team Admin</SelectItem>
                              <SelectItem value="staff_member">Staff Member</SelectItem>
                              <SelectItem value="client">Client</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvite(u.id)}
                            disabled={resendingId === u.id}
                            title="Resend invite email"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            {resendingId === u.id ? "Sending..." : "Resend Invite"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileSelect} />
              <AvatarCropDialog file={cropFile} open={cropOpen} onClose={() => { setCropOpen(false); setCropFile(null); }} onCrop={handleCroppedAvatarUpload} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SECURITY TAB ── */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Session Security
              </CardTitle>
              <CardDescription>
                Configure how long users stay logged in when inactive. A warning will appear 2 minutes before automatic logout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Inactivity Timeout</Label>
                  <span className="text-sm font-semibold tabular-nums">
                    {localTimeout} {localTimeout === 1 ? "minute" : "minutes"}
                  </span>
                </div>
                <Slider
                  min={5}
                  max={120}
                  step={5}
                  value={[localTimeout]}
                  onValueChange={([v]) => setLocalTimeout(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>5 min</span>
                  <span>30 min (default)</span>
                  <span>120 min</span>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
                <p>• Users will be warned <strong>2 minutes</strong> before being logged out.</p>
                <p>• Any activity (mouse, keyboard, scroll) resets the timer.</p>
                <p>• This setting is stored per device.</p>
              </div>

              <Button onClick={handleSaveTimeout} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                Save Timeout Setting
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lead-sources">
          <LeadSourcesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
