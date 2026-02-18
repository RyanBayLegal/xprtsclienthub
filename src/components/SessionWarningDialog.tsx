import { useAuth } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

export function SessionWarningDialog() {
  const { showTimeoutWarning, extendSession, signOut } = useAuth();

  return (
    <AlertDialog open={showTimeoutWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-destructive" />
            Session About to Expire
          </AlertDialogTitle>
          <AlertDialogDescription>
            You'll be automatically logged out in <strong>2 minutes</strong> due to inactivity.
            Would you like to stay logged in?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => signOut()}>Log Out Now</AlertDialogCancel>
          <AlertDialogAction onClick={extendSession}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
