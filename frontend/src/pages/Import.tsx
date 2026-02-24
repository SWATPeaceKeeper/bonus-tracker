import { useState, useCallback, type DragEvent } from "react";
import { Upload, FileUp, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DataTable, { type Column } from "@/components/DataTable";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get, uploadFile } from "@/api/client";
import { formatDate, cn } from "@/lib/utils";
import type { ImportBatch, ImportResult } from "@/types";

const historyColumns: Column<ImportBatch>[] = [
  {
    key: "filename",
    header: "Datei",
    render: (r) => r.filename,
    sortValue: (r) => r.filename,
  },
  {
    key: "imported_at",
    header: "Importiert am",
    render: (r) => formatDate(r.imported_at),
    sortValue: (r) => r.imported_at,
  },
  {
    key: "row_count",
    header: "Eintraege",
    render: (r) => r.row_count,
    sortValue: (r) => r.row_count,
    className: "text-right",
  },
];

export default function Import() {
  const {
    data: batches,
    loading,
    error,
    refetch,
  } = useApi<ImportBatch[]>(() => get<ImportBatch[]>("/imports"));

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string[][]>([]);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);

    // Parse CSV for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const rows = lines.slice(0, 21).map((line) => {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === "," && !inQuotes) {
            fields.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        fields.push(current.trim());
        return fields;
      });
      setPreview(rows);
    };
    reader.readAsText(f);
  }

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) {
      handleFile(f);
    } else {
      toast.error("Bitte eine CSV-Datei auswaehlen");
    }
  }, []);

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFile<ImportResult>(
        "/imports/upload",
        file,
        "file",
      );
      setResult(res);
      setFile(null);
      setPreview([]);
      toast.success(`${res.rows_imported} Eintraege importiert`);
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Import";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CSV Import</h1>

      {/* Drop zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-4",
              "rounded-lg border-2 border-dashed p-8 transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25",
            )}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">
                Clockify CSV-Datei hierher ziehen
              </p>
              <p className="text-sm text-muted-foreground">
                oder Datei auswaehlen
              </p>
            </div>
            <label>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={onFileSelect}
              />
              <Button variant="outline" asChild>
                <span>
                  <FileUp className="mr-2 h-4 w-4" />
                  Datei auswaehlen
                </span>
              </Button>
            </label>
          </div>

          {/* File selected */}
          {file && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Importiere..." : "Importieren"}
              </Button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-4 flex items-center gap-2 rounded-md bg-green-50 p-3 text-green-800 dark:bg-green-950 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <span>
                {result.rows_imported} Eintraege importiert
                {result.projects_created > 0 &&
                  `, ${result.projects_created} neue Projekte`}
                {result.projects_updated > 0 &&
                  `, ${result.projects_updated} Projekte aktualisiert`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {preview.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Vorschau (erste {Math.min(preview.length - 1, 20)}{" "}
              Zeilen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {preview[0]?.map((header, i) => (
                      <th
                        key={i}
                        className="px-2 py-1 text-left font-medium"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, ri) => (
                    <tr key={ri} className="border-b">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import history */}
      <Card>
        <CardHeader>
          <CardTitle>Import-Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <DataTable
              columns={historyColumns}
              data={batches ?? []}
              keyFn={(r) => r.id}
              emptyMessage="Noch keine Importe vorhanden"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
