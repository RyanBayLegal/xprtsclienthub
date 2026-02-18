import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

const DEFAULT_TIMEOUT_MINUTES = 30;
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 minutes before logout
const SESSION_TIMEOUT_KEY = "session_timeout_minutes";

type UserRole = "team_admin" | "client" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  sessionTimeoutMinutes: number;
  setSessionTimeoutMinutes: (minutes: number) => void;
  showTimeoutWarning: boolean;
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
  sessionTimeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  setSessionTimeoutMinutes: () => {},
  showTimeoutWarning: false,
  extendSession: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<number>(() => {
    const stored = localStorage.getItem(SESSION_TIMEOUT_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_TIMEOUT_MINUTES;
  });

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSessionTimeoutMinutes = (minutes: number) => {
    localStorage.setItem(SESSION_TIMEOUT_KEY, String(minutes));
    setSessionTimeoutMinutesState(minutes);
  };

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    setRole((data?.role as UserRole) ?? null);
  };

  const signOut = async () => {
    clearTimers();
    await supabase.auth.signOut();
  };

  const clearTimers = () => {
    if (inactivityTimer.current) { clearTimeout(inactivityTimer.current); inactivityTimer.current = null; }
    if (warningTimer.current) { clearTimeout(warningTimer.current); warningTimer.current = null; }
    setShowTimeoutWarning(false);
  };

  const resetInactivityTimer = () => {
    clearTimers();

    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    const warnAt = timeoutMs - WARNING_BEFORE_MS;

    if (warnAt > 0) {
      warningTimer.current = setTimeout(() => {
        setShowTimeoutWarning(true);
      }, warnAt);
    }

    inactivityTimer.current = setTimeout(async () => {
      setShowTimeoutWarning(false);
      toast.info("You've been logged out due to inactivity.");
      await supabase.auth.signOut();
    }, timeoutMs);
  };

  const extendSession = () => {
    setShowTimeoutWarning(false);
    resetInactivityTimer();
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchRole(session.user.id), 0);
          resetInactivityTimer();
        } else {
          setRole(null);
          clearTimers();
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
        resetInactivityTimer();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Re-arm timers when timeout setting changes
  useEffect(() => {
    if (user) resetInactivityTimer();
  }, [sessionTimeoutMinutes]);

  // Activity listeners
  useEffect(() => {
    if (!user) return;

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];
    const handleActivity = () => {
      if (!showTimeoutWarning) resetInactivityTimer();
    };

    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimers();
    };
  }, [user, showTimeoutWarning, sessionTimeoutMinutes]);

  return (
    <AuthContext.Provider value={{
      user, session, role, loading, signOut,
      sessionTimeoutMinutes, setSessionTimeoutMinutes,
      showTimeoutWarning, extendSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
