import { useParams, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FileText, ArrowLeft } from "lucide-react";
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
import { formatCurrency, formatNumber, getMonthName, STATUS_LABELS } from "@/lib/utils";
import type { ProjectReport } from "@/types";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();

  const { data, loading, error, refetch } = useApi<ProjectReport>(
    () => get<ProjectReport>(`/reports/project/${id}`),
    [id],
  );

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? undefined} onRetry={refetch} />
    );
  }

  const { project } = data;
  const budgetPct =
    project.budget_hours != null && project.budget_hours > 0
      ? Math.min(
          (data.total_hours / project.budget_hours) * 100,
          100,
        )
      : null;

  const chartData = data.monthly_breakdown.map((m) => ({
    name: getMonthName(parseInt(m.month.split("-")[1] ?? "1", 10)),
    hours: m.hours,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/projects"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">{project.client}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              project.status === "aktiv" ? "default" : "secondary"
            }
          >
            {STATUS_LABELS[project.status] ?? project.status}
          </Badge>
          <Button variant="outline" asChild>
            <Link to={`/projects/${id}/customer-report`}>
              <FileText className="mr-2 h-4 w-4" />
              Kundenbericht
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Budget (Stunden)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {project.budget_hours != null
                ? formatNumber(project.budget_hours)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Verbraucht (Stunden)
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
              Verbleibend (Stunden)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.budget_remaining != null
                ? formatNumber(data.budget_remaining)
                : "-"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Gesamtbonus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.total_bonus)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Budget progress bar */}
      {budgetPct != null && (
        <Card>
          <CardHeader>
            <CardTitle>Budget-Auslastung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium">
                {formatNumber(budgetPct)}%
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly hours chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stunden pro Monat</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: number | undefined) =>
                    `${formatNumber(value ?? 0)} Std.`
                  }
                />
                <Bar
                  dataKey="hours"
                  name="Stunden"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Employee breakdown */}
      {data.employee_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiter</CardTitle>
          </CardHeader>
          <CardContent>
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
                {data.employee_breakdown.map((emp) => (
                  <TableRow key={emp.employee}>
                    <TableCell>{emp.employee}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(emp.total_hours)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
