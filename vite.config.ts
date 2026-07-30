import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// Fallbacks for the publishable Lovable Cloud keys so production builds never
// boot with an undefined Supabase URL (blank page: "supabaseUrl is required").
const FALLBACK_SUPABASE_URL = "https://gvkqcmssjjnmvkbdirrh.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2a3FjbXNzampubXZrYmRpcnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTM3MjgsImV4cCI6MjA4NjkyOTcyOH0.i1LzgrDCq5neH7k1ADAltv4n_CI2ufAI4jfKuXpQQ6U";
const FALLBACK_SUPABASE_PROJECT_ID = "gvkqcmssjjnmvkbdirrh";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      process.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY,
    ),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
      process.env.VITE_SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID,
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
}));
