import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface AvatarCropDialogProps {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onCrop: (croppedBlob: Blob) => void;
}

export default function AvatarCropDialog({ file, open, onClose, onCrop }: AvatarCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const CANVAS_SIZE = 280;

  // Load image when file changes
  useEffect(() => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !image) return;

    const size = CANVAS_SIZE;
    canvas.width = size * 2;
    canvas.height = size * 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate draw dimensions to fit image in circle
    const scale = Math.max(size * 2 / image.width, size * 2 / image.height) * zoom;
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (size * 2 - w) / 2 + offset.x * 2;
    const y = (size * 2 - h) / 2 + offset.y * 2;

    // Draw image
    ctx.save();
    ctx.beginPath();
    ctx.arc(size, size, size, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();
  }, [image, zoom, offset]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragging(true);
    dragStart.current = { x: touch.clientX, y: touch.clientY, ox: offset.x, oy: offset.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const touch = e.touches[0];
    setOffset({
      x: dragStart.current.ox + (touch.clientX - dragStart.current.x),
      y: dragStart.current.oy + (touch.clientY - dragStart.current.y),
    });
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, "image/png", 1);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Crop area */}
          <div
            className="relative rounded-full overflow-hidden border-2 border-primary/30 shadow-lg cursor-grab active:cursor-grabbing bg-muted"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            <canvas
              ref={canvasRef}
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
              className="pointer-events-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">Drag to reposition</p>

          {/* Zoom control */}
          <div className="flex items-center gap-3 w-full max-w-[260px]">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            <RotateCcw className="mr-1 h-3 w-3" /> Reset
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCrop}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
