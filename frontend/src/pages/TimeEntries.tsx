import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import DataTable, { type Column } from "@/components/DataTable";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get } from "@/api/client";
import {
  formatNumber,
  formatDate,
  CURRENT_YEAR,
  YEARS,
  ALL_MONTHS,
  getMonthName,
} from "@/lib/utils";
import type { TimeEntry } from "@/types";

const columns: Column<TimeEntry>[] = [
  {
    key: "date",
    header: "Datum",
    render: (r) => formatDate(r.date),
    sortValue: (r) => r.date,
  },
  {
    key: "employee",
    header: "Mitarbeiter",
    render: (r) => r.employee,
    sortValue: (r) => r.employee,
  },
  {
    key: "description",
    header: "Beschreibung",
    render: (r) => (
      <div className="max-w-md truncate" title={r.description}>
        {r.description || (
          <span className="text-muted-foreground">&ndash;</span>
        )}
      </div>
    ),
    sortValue: (r) => r.description,
  },
  {
    key: "time",
    header: "Zeit",
    render: (r) => {
      if (!r.start_time && !r.end_time) {
        return <span className="text-muted-foreground">&ndash;</span>;
      }
      const start = r.start_time?.slice(0, 5) ?? "\u2013";
      const end = r.end_time?.slice(0, 5) ?? "\u2013";
      return (
        <span className="text-sm">
          {start} &ndash; {end}
        </span>
      );
    },
  },
  {
    key: "hours",
    header: "Stunden",
    render: (r) => formatNumber(r.duration_decimal),
    sortValue: (r) => r.duration_decimal,
    className: "text-right",
  },
  {
    key: "type",
    header: "Typ",
    render: (r) => (
      <Badge variant={r.is_onsite ? "default" : "secondary"}>
        {r.is_onsite ? "OnSite" : "Remote"}
      </Badge>
    ),
    sortValue: (r) => (r.is_onsite ? 1 : 0),
    className: "text-center",
  },
];

export default function TimeEntries() {
  const { id } = useParams<{ id: string }>();
  const currentMonth = `${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const selectedMonth = month === "all" ? undefined : month;
  const params: Record<string, string> = { project_id: id ?? "" };
  if (selectedMonth) params.month = selectedMonth;

  const { data, loading, error, refetch } = useApi<TimeEntry[]>(
    () => get<TimeEntry[]>("/time-entries", params),
    [id, month],
  );

  const totalHours = useMemo(
    () => (data ?? []).reduce((sum, e) => sum + e.duration_decimal, 0),
    [data],
  );

  // Build month options from selected year
  const monthOptions = ALL_MONTHS.map((m) => {
    const value = `${year}-${String(m).padStart(2, "0")}`;
    return { value, label: getMonthName(m) };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/projects/${id}`}
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurueck zum Projekt
        </Link>
        <h1 className="text-2xl font-bold">Zeiteintraege</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={year}
          onValueChange={(y) => {
            setYear(y);
            setMonth(`${y}-${month.split("-")[1] ?? "01"}`);
          }}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Monate</SelectItem>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <span className="ml-auto text-sm text-muted-foreground">
            {data.length} Eintraege &middot; {formatNumber(totalHours)}{" "}
            Std.
          </span>
        )}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedMonth
                ? getMonthName(
                    parseInt(
                      selectedMonth.split("-")[1] ?? "1",
                      10,
                    ),
                  )
                : "Alle"}{" "}
              {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={data ?? []}
              keyFn={(r) => r.id}
              emptyMessage="Keine Zeiteintraege fuer diesen Zeitraum"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
