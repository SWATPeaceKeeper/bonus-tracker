import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import { get } from "@/api/client";
import { cn, formatCurrency, formatNumber, getMonthName, CURRENT_YEAR, YEARS, ALL_MONTHS } from "@/lib/utils";
import type { FinanceMonth, MonthlyProjectReport } from "@/types";

interface MonthRow {
  month: number;
  hours: number;
  bonus: number;
  projects: MonthlyProjectReport[];
}

export default function BonusOverview() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [expandedMonth, setExpandedMonth] = useState<number | null>(
    null,
  );

  const { data, loading, error, refetch } = useApi<FinanceMonth[]>(
    () => get<FinanceMonth[]>("/reports/finance", { year }),
    [year],
  );

  const { monthRows, totalHours, totalBonus } = useMemo(() => {
    const monthMap = new Map<number, FinanceMonth>();
    if (data) {
      for (const fm of data) {
        const m = parseInt(fm.month.split("-")[1] ?? "0", 10);
        monthMap.set(m, fm);
      }
    }

    const rows: MonthRow[] = ALL_MONTHS.map((m) => {
      const fm = monthMap.get(m);
      return {
        month: m,
        hours: fm?.total_hours ?? 0,
        bonus: fm?.total_bonus ?? 0,
        projects: fm?.projects ?? [],
      };
    });

    const hours = rows.reduce((sum, r) => sum + r.hours, 0);
    const bonus = rows.reduce((sum, r) => sum + r.bonus, 0);

    return { monthRows: rows, totalHours: hours, totalBonus: bonus };
  }, [data]);

  const monthsWithData = monthRows.filter((r) => r.hours > 0).length;
  const avgBonus = monthsWithData > 0 ? totalBonus / monthsWithData : 0;

  function toggleMonth(month: number) {
    setExpandedMonth((prev) => (prev === month ? null : month));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Bonus-Übersicht</h1>
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

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Stunden YTD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(totalHours)} Std.
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Bonus YTD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalBonus)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ø Monats-Bonus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(avgBonus)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle>Monatliche Aufschlüsselung</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Monat</TableHead>
                    <TableHead className="text-right">
                      Stunden
                    </TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthRows.map((row) => (
                    <>
                      <TableRow
                        key={row.month}
                        className={cn(
                          "cursor-pointer",
                          row.projects.length === 0 &&
                            "cursor-default",
                        )}
                        onClick={() =>
                          row.projects.length > 0 &&
                          toggleMonth(row.month)
                        }
                      >
                        <TableCell className="w-8 pr-0">
                          {row.projects.length > 0 &&
                            (expandedMonth === row.month ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ))}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getMonthName(row.month)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.hours > 0
                            ? `${formatNumber(row.hours)} Std.`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.bonus > 0
                            ? formatCurrency(row.bonus)
                            : "-"}
                        </TableCell>
                      </TableRow>

                      {/* Expanded project rows */}
                      {expandedMonth === row.month &&
                        row.projects.map((proj) => (
                          <TableRow
                            key={`${row.month}-${proj.project_id}`}
                            className="bg-muted/50"
                          >
                            <TableCell />
                            <TableCell className="pl-8">
                              <div className="text-sm">
                                {proj.project_name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {proj.client}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground font-mono">
                                {proj.remote_hours > 0 && (
                                  <span>
                                    {formatNumber(proj.remote_hours)} Std. × {formatCurrency(proj.hourly_rate ?? 0)} × {(proj.bonus_rate * 100).toFixed(0)}%
                                    {proj.onsite_hours > 0 && " + "}
                                  </span>
                                )}
                                {proj.onsite_hours > 0 && (
                                  <span>
                                    {formatNumber(proj.onsite_hours)} Std. (OnSite) × {formatCurrency(proj.onsite_hourly_rate ?? proj.hourly_rate ?? 0)} × {(proj.bonus_rate * 100).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatNumber(proj.total_hours)} Std.
                              {(proj.remote_hours > 0 && proj.onsite_hours > 0) && (
                                <div className="text-xs text-muted-foreground">
                                  {formatNumber(proj.remote_hours)} Remote + {formatNumber(proj.onsite_hours)} OnSite
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {formatCurrency(proj.bonus_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </>
                  ))}

                  {/* Totals row */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell />
                    <TableCell>Gesamt</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(totalHours)} Std.
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totalBonus)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
