import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const { branding } = useBranding();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.app_name} className="h-10 mx-auto mb-2" />
          ) : (
            <CardTitle className="text-2xl font-bold tracking-tight">{branding.app_name}</CardTitle>
          )}
          <CardDescription>
            {forgotMode ? "Reset your password" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forgotMode ? (
            resetSent ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox.
                </p>
                <Button variant="outline" className="w-full" onClick={() => { setForgotMode(false); setResetSent(false); }}>
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <button
                  type="button"
                  className="w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setForgotMode(false)}
                >
                  Back to Sign In
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setForgotMode(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}
          {!forgotMode && (
            <p className="text-xs text-center text-muted-foreground mt-4">
              Contact your administrator to get an account.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

