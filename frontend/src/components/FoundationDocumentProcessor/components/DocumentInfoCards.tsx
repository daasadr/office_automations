import { Badge } from "@/components/ui/badge";

interface DocumentInfoCardsProps {
  newDocument: {
    title: string;
    status: string;
  };
  basedOnDocument: {
    title: string;
  };
}

export function DocumentInfoCards({ newDocument, basedOnDocument }: DocumentInfoCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="p-4 border rounded-lg space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Nový dokument</div>
        <div className="font-semibold">{newDocument.title}</div>
        <Badge variant="outline" className="mt-1">
          {newDocument.status}
        </Badge>
      </div>

      <div className="p-4 border rounded-lg space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Založeno na</div>
        <div className="font-semibold">{basedOnDocument.title}</div>
        <Badge variant="secondary" className="mt-1">
          schváleno
        </Badge>
      </div>
    </div>
  );
}
