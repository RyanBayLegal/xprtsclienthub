import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface BrandingSettings {
  id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  sidebar_color: string;
  app_name: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  id: "",
  logo_url: null,
  primary_color: "#005b2f",
  accent_color: "#f2c865",
  sidebar_color: "#08331c",
  app_name: "XPRTS CRM",
};

interface BrandingContextType {
  branding: BrandingSettings;
  loading: boolean;
  refetch: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  loading: true,
  refetch: async () => {},
});

export const useBranding = () => useContext(BrandingContext);

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function lighten(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.min(255, parseInt(result[1], 16) + amount);
  const g = Math.min(255, parseInt(result[2], 16) + amount);
  const b = Math.min(255, parseInt(result[3], 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function applyBrandingToCSS(branding: BrandingSettings) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hexToHsl(branding.primary_color));
  root.style.setProperty("--ring", hexToHsl(branding.primary_color));
  root.style.setProperty("--accent", hexToHsl(branding.accent_color));
  root.style.setProperty("--sidebar-background", hexToHsl(branding.sidebar_color));
  root.style.setProperty("--sidebar-primary", hexToHsl(branding.accent_color));
  root.style.setProperty("--sidebar-accent", hexToHsl(lighten(branding.sidebar_color, 20)));
  root.style.setProperty("--sidebar-border", hexToHsl(lighten(branding.sidebar_color, 30)));
  root.style.setProperty("--success", hexToHsl(branding.primary_color));
  root.style.setProperty("--warning", hexToHsl(branding.accent_color));
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    const { data } = await supabase
      .from("branding_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      const settings: BrandingSettings = {
        id: data.id,
        logo_url: data.logo_url,
        primary_color: data.primary_color || DEFAULT_BRANDING.primary_color,
        accent_color: data.accent_color || DEFAULT_BRANDING.accent_color,
        sidebar_color: data.sidebar_color || DEFAULT_BRANDING.sidebar_color,
        app_name: data.app_name || DEFAULT_BRANDING.app_name,
      };
      setBranding(settings);
      applyBrandingToCSS(settings);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, loading, refetch: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
