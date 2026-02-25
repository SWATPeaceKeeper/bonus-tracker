import { useState, useMemo } from "react";
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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
import { get } from "@/api/client";
import {
  formatCurrency,
  formatNumber,
  CURRENT_YEAR,
  YEARS,
} from "@/lib/utils";
import type { RevenueData } from "@/types";

export default function ProjectComparison() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(),
  );

  const { data, loading, error, refetch } = useApi<RevenueData>(
    () => get<RevenueData>("/reports/revenue", { year }),
    [year],
  );

  function toggleProject(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    if (!data) return;
    if (selectedIds.size === data.projects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.projects.map((p) => p.id)));
    }
  }

  const selected = useMemo(
    () =>
      (data?.projects ?? []).filter((p) => selectedIds.has(p.id)),
    [data, selectedIds],
  );

  const chartData = useMemo(
    () =>
      selected.map((p) => ({
        name:
          p.name.length > 15
            ? p.name.slice(0, 15) + "\u2026"
            : p.name,
        Stunden: p.total_hours,
        Umsatz: p.revenue,
        Budget: p.budget_hours ?? 0,
      })),
    [selected],
  );

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? undefined} onRetry={refetch} />
    );
  }

  const allSelected =
    selectedIds.size === data.projects.length &&
    data.projects.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projektvergleich</h1>
        <Select value={year} onValueChange={setYear}>
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
      </div>

      {/* Project selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={allSelected}
              onChange={selectAll}
            />
            Projekte auswählen ({selectedIds.size} /{" "}
            {data.projects.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleProject(p.id)}
                />
                <div className="text-sm">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.client}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Comparison chart */}
      {selected.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Vergleich</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="Stunden"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Umsatz"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Comparison table */}
      {selected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailvergleich</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kennzahl</TableHead>
                    {selected.map((p) => (
                      <TableHead
                        key={p.id}
                        className="text-right min-w-[120px]"
                      >
                        {p.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      Deal-Wert
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {p.deal_value != null
                          ? formatCurrency(p.deal_value)
                          : "\u2013"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Budget (Std.)
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {p.budget_hours != null
                          ? formatNumber(p.budget_hours)
                          : "\u2013"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Stunden gesamt
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {formatNumber(p.total_hours)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Remote / OnSite
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell
                        key={p.id}
                        className="text-right text-sm"
                      >
                        {formatNumber(p.remote_hours)} /{" "}
                        {formatNumber(p.onsite_hours)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Umsatz
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {formatCurrency(p.revenue)}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Budget-Auslastung
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {p.budget_utilization != null
                          ? `${Math.round(p.budget_utilization * 100)}%`
                          : "\u2013"}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      Umsatz/Stunde
                    </TableCell>
                    {selected.map((p) => (
                      <TableCell key={p.id} className="text-right">
                        {p.total_hours > 0
                          ? formatCurrency(p.revenue / p.total_hours)
                          : "\u2013"}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selected.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Wähle mindestens ein Projekt zum Vergleichen aus.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
