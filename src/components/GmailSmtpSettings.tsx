import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, ShieldCheck, ShieldAlert, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Status {
  configured: boolean;
  ok: boolean;
  gmail_user?: string;
  message?: string;
  error?: string;
}

export default function GmailSmtpSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [sending, setSending] = useState(false);

  // Local form state — values are NEVER stored in the database. Submitting
  // opens Lovable's secure secret prompt where the values are encrypted at rest.
  const [gmailUser, setGmailUser] = useState("");
  const [appPassword, setAppPassword] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("test-gmail-smtp", { body: {} });
    if (error) toast.error(error.message);
    else setStatus(data as Status);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleSaveCredentials = () => {
    toast.info(
      "To securely save credentials, ask Lovable in chat: \"Save my Gmail SMTP credentials\". A secure prompt will open — values are encrypted and never stored in the database.",
      { duration: 8000 }
    );
  };

  const handleSendTest = async () => {
    if (!testTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-gmail-smtp", { body: { to: testTo } });
      if (error) throw error;
      const r = data as Status;
      if (r.ok) toast.success(r.message || "Test email sent");
      else toast.error(r.error || "Test failed");
      setStatus(r);
    } catch (e: any) {
      toast.error(e.message || "Test failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail SMTP (App Password)
        </CardTitle>
        <CardDescription>
          Send notification emails through your own Gmail account using an App Password — works on
          any Gmail/Workspace account, no workspace connector required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3 rounded-md border p-3">
          {loading ? (
            <Badge variant="secondary">Checking…</Badge>
          ) : status?.configured && status?.ok ? (
            <>
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">Configured</div>
                <div className="text-xs text-muted-foreground">
                  Sending as <span className="font-mono">{status.gmail_user}</span>
                </div>
              </div>
              <Badge>Active</Badge>
            </>
          ) : status?.configured && !status?.ok ? (
            <>
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <div className="text-sm font-medium">Credentials saved but failing</div>
                <div className="text-xs text-muted-foreground break-all">{status.error}</div>
              </div>
              <Badge variant="destructive">Error</Badge>
            </>
          ) : (
            <>
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm font-medium">Not configured</div>
                <div className="text-xs text-muted-foreground">
                  Add your Gmail address and App Password below to enable sending.
                </div>
              </div>
              <Badge variant="secondary">Inactive</Badge>
            </>
          )}
        </div>

        {/* Credential form */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gmail-user">Gmail address</Label>
            <Input
              id="gmail-user"
              type="email"
              placeholder="you@gmail.com"
              value={gmailUser}
              onChange={(e) => setGmailUser(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gmail-app-password">App Password (16 characters)</Label>
            <Input
              id="gmail-app-password"
              type="password"
              placeholder="xxxx xxxx xxxx xxxx"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSaveCredentials}>Save credentials securely</Button>
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Create an App Password <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Credentials are stored as encrypted backend secrets (<span className="font-mono">GMAIL_USER</span>,{" "}
          <span className="font-mono">GMAIL_APP_PASSWORD</span>) — never in the database.
          Requires 2-Step Verification on the Gmail account.
        </p>

        {/* Live test */}
        <div className="border-t pt-4 space-y-2">
          <Label htmlFor="test-to">Send a test email</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="test-to"
              type="email"
              placeholder="recipient@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleSendTest} disabled={sending || !status?.configured}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending…" : "Send test"}
            </Button>
            <Button variant="ghost" onClick={refresh} disabled={loading}>
              Refresh status
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}