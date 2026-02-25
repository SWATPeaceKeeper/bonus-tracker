import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get, post, getDownloadUrl } from "@/api/client";
import { formatNumber, getMonthName, CURRENT_YEAR } from "@/lib/utils";
import type { CustomerReportData } from "@/types";

const CURRENT_MONTH = new Date().getMonth() + 1;

function buildMonthOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  // Current year and previous year
  for (const year of [CURRENT_YEAR, CURRENT_YEAR - 1]) {
    const maxMonth = year === CURRENT_YEAR ? CURRENT_MONTH : 12;
    for (let m = maxMonth; m >= 1; m--) {
      const value = `${year}-${String(m).padStart(2, "0")}`;
      const label = `${getMonthName(m)} ${year}`;
      options.push({ value, label });
    }
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

function currentMonthValue(): string {
  return `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, "0")}`;
}

export default function CustomerReport() {
  const { id } = useParams<{ id: string }>();
  const [month, setMonth] = useState(currentMonthValue());
  const [noteText, setNoteText] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  const { data, loading, error, refetch } = useApi<CustomerReportData>(
    () =>
      get<CustomerReportData>(`/reports/customer/${id}`, { month }),
    [id, month],
  );

  // When data loads, sync the note text
  const displayNote =
    noteText !== null ? noteText : (data?.note ?? "");

  async function saveNote() {
    if (noteText === null) return;
    setSavingNote(true);
    try {
      await post(
        `/reports/customer/${id}/notes`,
        { note: noteText },
        { month },
      );
      toast.success("Notiz gespeichert");
      setNoteText(null);
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Speichern";
      toast.error(msg);
    } finally {
      setSavingNote(false);
    }
  }

  function handleExportPdf() {
    const url = getDownloadUrl(`/exports/customer-pdf/${id}`, {
      month,
    });
    window.open(url, "_blank");
  }

  // Reset note edit state when month changes
  function handleMonthChange(newMonth: string) {
    setMonth(newMonth);
    setNoteText(null);
  }

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? undefined} onRetry={refetch} />
    );
  }

  const monthNum = parseInt(month.split("-")[1] ?? "1", 10);
  const yearStr = month.split("-")[0] ?? String(CURRENT_YEAR);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={`/projects/${id}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück zum Projekt
          </Link>
          <h1 className="text-2xl font-bold">Kundenbericht</h1>
          <p className="text-muted-foreground">
            {data.project_name} - {data.client}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF Export
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Stunden ({getMonthName(monthNum)} {yearStr})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(data.total_hours)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Budget (Stunden)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.budget_hours != null
                ? formatNumber(data.budget_hours)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Verbleibend (Stunden)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.hours_remaining != null
                ? formatNumber(data.hours_remaining)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>
            Mitarbeiter - {getMonthName(monthNum)} {yearStr}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Einträge für diesen Monat.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead className="text-right">
                    Stunden
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employees.map((emp) => (
                  <TableRow key={emp.employee}>
                    <TableCell>{emp.employee}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(emp.hours)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Gesamt</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(data.total_hours)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Note editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Notiz - {getMonthName(monthNum)} {yearStr}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              disabled={savingNote || noteText === null}
              onClick={saveNote}
            >
              <Save className="mr-1 h-3 w-3" />
              {savingNote ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={4}
            placeholder="Notiz für diesen Monat..."
            value={displayNote}
            onChange={(e) => setNoteText(e.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
