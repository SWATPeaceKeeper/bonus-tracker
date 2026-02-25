import { useState } from "react";
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
import { Euro, TrendingUp, Target } from "lucide-react";
import DataTable, { type Column } from "@/components/DataTable";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get } from "@/api/client";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { RevenueData, RevenueProject } from "@/types";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) =>
  String(CURRENT_YEAR - i),
);

const columns: Column<RevenueProject>[] = [
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
    key: "deal_value",
    header: "Deal-Wert",
    render: (r) =>
      r.deal_value != null ? formatCurrency(r.deal_value) : "-",
    sortValue: (r) => r.deal_value ?? 0,
    className: "text-right",
  },
  {
    key: "hours",
    header: "Stunden",
    render: (r) => formatNumber(r.total_hours),
    sortValue: (r) => r.total_hours,
    className: "text-right",
  },
  {
    key: "revenue",
    header: "Umsatz",
    render: (r) => formatCurrency(r.revenue),
    sortValue: (r) => r.revenue,
    className: "text-right",
  },
  {
    key: "budget",
    header: "Budget %",
    render: (r) => {
      if (r.budget_utilization == null) {
        return <span className="text-muted-foreground">-</span>;
      }
      const pct = Math.round(r.budget_utilization * 100);
      return (
        <Badge variant={pct > 90 ? "destructive" : "secondary"}>
          {pct}%
        </Badge>
      );
    },
    sortValue: (r) => r.budget_utilization ?? 0,
    className: "text-center",
  },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <Badge variant="default">
        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
      </Badge>
    ),
    sortValue: (r) => r.status,
  },
];

export default function Revenue() {
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const { data, loading, error, refetch } = useApi<RevenueData>(
    () => get<RevenueData>("/reports/revenue", { year }),
    [year],
  );

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? undefined} onRetry={refetch} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Umsatz</h1>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Dealvolumen
            </CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.total_deal_value)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Umsatz
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(data.total_revenue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Budget-Auslastung
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {Math.round(data.avg_budget_utilization * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data.projects}
            keyFn={(r) => r.id}
            emptyMessage="Keine aktiven Projekte"
          />
        </CardContent>
      </Card>
    </div>
  );
}
