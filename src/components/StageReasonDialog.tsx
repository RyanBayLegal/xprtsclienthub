import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const REASON_OPTIONS = [
  "Unresponsive (more than 30 days)",
  "Not interested",
  "Needs not aligned",
  "Cost",
  "Spam",
  "XPRTS decision",
  "Client Withdrawn",
  "Others",
];

interface StageReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  entityName: string;
  onConfirm: (reason: string) => void;
}

export function StageReasonDialog({ open, onOpenChange, stageName, entityName, onConfirm }: StageReasonDialogProps) {
  const [selected, setSelected] = useState("");
  const [otherText, setOtherText] = useState("");

  const handleConfirm = () => {
    const reason = selected === "Others" ? `Others: ${otherText.trim()}` : selected;
    if (!reason) return;
    onConfirm(reason);
    setSelected("");
    setOtherText("");
  };

  const isValid = selected && (selected !== "Others" || otherText.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelected(""); setOtherText(""); } onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reason for moving to {stageName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Please select a reason for moving <span className="font-medium text-foreground">{entityName}</span> to {stageName}.
        </p>
        <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2 mt-2">
          {REASON_OPTIONS.map((option) => (
            <div key={option} className="flex items-center space-x-2">
              <RadioGroupItem value={option} id={`reason-${option}`} />
              <Label htmlFor={`reason-${option}`} className="text-sm cursor-pointer">{option}</Label>
            </div>
          ))}
        </RadioGroup>
        {selected === "Others" && (
          <Textarea
            placeholder="Please provide a reason..."
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            className="mt-2"
            autoFocus
          />
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!isValid}>Confirm</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
