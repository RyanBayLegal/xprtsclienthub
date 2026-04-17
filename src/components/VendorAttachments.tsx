import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, FileText, Image, File, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface VendorAttachmentsProps {
  vendorId: string;
  canManage?: boolean;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  _signedUrl?: string;
}

const fileIcon = (type: string | null) => {
  if (type?.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (type?.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const extractStoragePath = (fileUrl: string): string => {
  const match = fileUrl.match(/vendor-attachments\/(.+?)(\?|$)/);
  if (match) return decodeURIComponent(match[1]);
  return fileUrl;
};

export default function VendorAttachments({ vendorId, canManage = true }: VendorAttachmentsProps) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from("vendor_attachments" as any)
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false });
    if (!data) return;
    const withUrls = await Promise.all(
      (data as unknown as Attachment[]).map(async (att) => {
        const path = extractStoragePath(att.file_url);
        const { data: signed } = await supabase.storage
          .from("vendor-attachments")
          .createSignedUrl(path, 3600);
        return { ...att, _signedUrl: signed?.signedUrl || att.file_url };
      })
    );
    setAttachments(withUrls);
  };

  useEffect(() => { fetchAttachments(); }, [vendorId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} exceeds 20MB limit`); continue; }
      const path = `${vendorId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("vendor-attachments").upload(path, file);
      if (uploadError) { toast.error(`Failed to upload ${file.name}`); continue; }

      await supabase.from("vendor_attachments" as any).insert({
        vendor_id: vendorId,
        file_name: file.name,
        file_url: path,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user?.id,
      } as any);
    }

    toast.success("Files uploaded");
    setUploading(false);
    fetchAttachments();
    if (fileRef.current) fileRef.current.value = "";
  };

  const deleteAttachment = async (att: Attachment) => {
    await supabase.from("vendor_attachments" as any).delete().eq("id", att.id);
    const path = extractStoragePath(att.file_url);
    await supabase.storage.from("vendor-attachments").remove([path]);
    fetchAttachments();
    toast.success("Attachment deleted");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Attachments
        </h4>
        {canManage && (
          <div>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="mr-1 h-3 w-3" />{uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">No attachments</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/50 transition-colors">
              {fileIcon(att.file_type)}
              <div className="flex-1 min-w-0">
                <a href={att._signedUrl || att.file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline truncate block">
                  {att.file_name}
                </a>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  {att.file_size && <span>{formatSize(att.file_size)}</span>}
                  <span>{formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}</span>
                </div>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteAttachment(att)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
