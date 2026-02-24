import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, FolderKanban, Clock } from "lucide-react";
import DataTable, { type Column } from "@/components/DataTable";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get } from "@/api/client";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardStats, Project } from "@/types";

const STATUS_LABELS: Record<string, string> = {
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen",
};

const projectColumns: Column<Project>[] = [
  {
    key: "name",
    header: "Projekt",
    render: (r) => (
      <div>
        <div className="font-medium">{r.name}</div>
        <div className="text-xs text-muted-foreground">{r.client}</div>
      </div>
    ),
    sortValue: (r) => r.name,
  },
  {
    key: "budget",
    header: "Budget (Std.)",
    render: (r) =>
      r.budget_hours != null ? formatNumber(r.budget_hours) : "-",
    sortValue: (r) => r.budget_hours ?? 0,
    className: "text-right",
  },
  {
    key: "used",
    header: "Verbraucht (Std.)",
    render: (r) => formatNumber(r.total_hours),
    sortValue: (r) => r.total_hours,
    className: "text-right",
  },
  {
    key: "percentage",
    header: "Budget %",
    render: (r) => {
      if (r.budget_hours == null || r.budget_hours === 0) {
        return <span className="text-muted-foreground">-</span>;
      }
      const pct = Math.round((r.total_hours / r.budget_hours) * 100);
      return (
        <Badge variant={pct > 90 ? "destructive" : "secondary"}>
          {pct}%
        </Badge>
      );
    },
    sortValue: (r) =>
      r.budget_hours ? r.total_hours / r.budget_hours : 0,
    className: "text-center",
  },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <Badge
        variant={r.status === "aktiv" ? "default" : "secondary"}
      >
        {STATUS_LABELS[r.status] ?? r.status}
      </Badge>
    ),
    sortValue: (r) => r.status,
  },
  {
    key: "bonus",
    header: "Bonus",
    render: (r) => formatCurrency(r.bonus_amount),
    sortValue: (r) => r.bonus_amount,
    className: "text-right",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi<DashboardStats>(
    () => get<DashboardStats>("/reports/dashboard"),
  );

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? undefined} onRetry={refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Bonus (aktueller Monat)
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.total_bonus_current_month)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Aktive Projekte
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.active_projects}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Stunden (aktueller Monat)
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(data.total_hours_current_month)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active projects table */}
      <Card>
        <CardHeader>
          <CardTitle>Aktive Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={projectColumns}
            data={data.projects}
            keyFn={(r) => r.id}
            onRowClick={(r) => navigate(`/projects/${r.id}`)}
            emptyMessage="Keine aktiven Projekte"
          />
        </CardContent>
      </Card>
    </div>
  );
}
