import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ message = "Daten werden geladen..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function ErrorState({
  message = "Fehler beim Laden der Daten.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Erneut versuchen
        </Button>
      )}
    </div>
  );
}
