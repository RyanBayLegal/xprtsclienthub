import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Palette, Save, UserPlus, Users, Trash2 } from "lucide-react";

interface ManagedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
}

export default function Settings() {
  const { user } = useAuth();
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
  const [newUserRole, setNewUserRole] = useState<"team_admin" | "client">("team_admin");
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role, created_at");
    if (!roles) return;

    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);

    const mapped: ManagedUser[] = roles.map((r) => {
      const profile = profiles?.find((p) => p.user_id === r.user_id);
      return {
        id: r.user_id,
        email: "",
        full_name: profile?.full_name || null,
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
    setNewUserRole("team_admin");
    setAddingUser(false);
    fetchUsers();
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
        </TabsList>

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
                        <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as "team_admin" | "client")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="team_admin">Team Admin</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        A temporary password will be generated. The user will receive an email to set their own password.
                      </p>
                      <Button onClick={handleAddUser} disabled={addingUser} className="w-full">
                        {addingUser ? "Creating..." : "Create User"}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No users found. Click "Add User" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "team_admin" ? "default" : "secondary"}>
                            {u.role === "team_admin" ? "Team Admin" : "Client"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
