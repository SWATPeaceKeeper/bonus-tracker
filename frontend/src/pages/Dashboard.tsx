import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, FolderKanban, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import DataTable, { type Column } from "@/components/DataTable";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get } from "@/api/client";
import { formatCurrency, formatNumber, STATUS_LABELS } from "@/lib/utils";
import type { DashboardStats, Project } from "@/types";

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
      const variant =
        pct > 90 ? "destructive" : pct > 60 ? "outline" : "secondary";
      return <Badge variant={variant}>{pct}%</Badge>;
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

  useEffect(() => {
    if (!data) return;
    const warnings = data.projects.filter(
      (p) =>
        p.budget_hours != null &&
        p.budget_hours > 0 &&
        p.total_hours / p.budget_hours > 0.9,
    );
    for (const p of warnings) {
      const pct = Math.round((p.total_hours / p.budget_hours!) * 100);
      toast.warning(`${p.name}: ${pct}% Budget verbraucht`, {
        id: `budget-${p.id}`,
        duration: 8000,
      });
    }
  }, [data]);

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

      {/* YTD KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Bonus (YTD)
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.ytd_bonus)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Umsatz (YTD)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.ytd_revenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Stunden (YTD)
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(data.ytd_hours)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast */}
      {(() => {
        const currentMonthNum = new Date().getMonth() + 1;
        if (currentMonthNum < 2 || data.ytd_hours === 0) return null;
        const projectedBonus = (data.ytd_bonus / currentMonthNum) * 12;
        const projectedRevenue = (data.ytd_revenue / currentMonthNum) * 12;
        const projectedHours = (data.ytd_hours / currentMonthNum) * 12;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Prognose {new Date().getFullYear()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Bonus (Prognose)</p>
                  <p className="text-xl font-bold">{formatCurrency(projectedBonus)}</p>
                  <p className="text-xs text-muted-foreground">
                    aktuell {formatCurrency(data.ytd_bonus)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Umsatz (Prognose)</p>
                  <p className="text-xl font-bold">{formatCurrency(projectedRevenue)}</p>
                  <p className="text-xs text-muted-foreground">
                    aktuell {formatCurrency(data.ytd_revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stunden (Prognose)</p>
                  <p className="text-xl font-bold">{formatNumber(projectedHours)}</p>
                  <p className="text-xs text-muted-foreground">
                    aktuell {formatNumber(data.ytd_hours)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
