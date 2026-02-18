import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";

interface ClientAvatarUploadProps {
  clientProfileId: string;
  clientName: string;
  avatarUrl: string | null;
  onAvatarChange: (url: string) => void;
  editable?: boolean;
}

export default function ClientAvatarUpload({ clientProfileId, clientName, avatarUrl, onAvatarChange, editable = true }: ClientAvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = clientName
    ? clientName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${clientProfileId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage.from("client-attachments").upload(path, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from("client-attachments").getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;

    const { error } = await supabase.from("client_profiles").update({ avatar_url: url }).eq("id", clientProfileId);
    if (error) { toast.error(error.message); setUploading(false); return; }

    onAvatarChange(url);
    toast.success("Avatar updated");
    setUploading(false);
  };

  return (
    <div className="relative group w-fit">
      <Avatar className="h-20 w-20 text-xl">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={clientName} />}
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
      </Avatar>
      {editable && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button
            variant="secondary"
            size="icon"
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );
}
