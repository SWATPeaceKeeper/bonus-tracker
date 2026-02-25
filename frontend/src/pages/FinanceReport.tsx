import { useState, useMemo } from "react";
import { Download } from "lucide-react";
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
import { get, getDownloadUrl } from "@/api/client";
import { formatCurrency, formatNumber, getMonthName, CURRENT_YEAR, YEARS, ALL_MONTHS } from "@/lib/utils";
import type { FinanceMonth, MonthlyProjectReport } from "@/types";

interface ProjectRow {
  project_id: string;
  project_name: string;
  client: string;
  months: Record<number, MonthlyProjectReport>;
  total_hours: number;
  total_bonus: number;
}

export default function FinanceReport() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [month, setMonth] = useState<string>("");

  const { data, loading, error, refetch } = useApi<FinanceMonth[]>(
    () => get<FinanceMonth[]>("/reports/finance", { year }),
    [year],
  );

  // Pivot the FinanceMonth[] array into a project-row matrix
  const { projectRows, monthlyTotals, grandTotal } = useMemo(() => {
    if (!data) {
      return {
        projectRows: [],
        monthlyTotals: {} as Record<number, { hours: number; bonus: number }>,
        grandTotal: { hours: 0, bonus: 0 },
      };
    }

    const rowMap = new Map<string, ProjectRow>();
    const totals: Record<number, { hours: number; bonus: number }> = {};
    let totalHours = 0;
    let totalBonus = 0;

    for (const fm of data) {
      const monthNum = parseInt(fm.month.split("-")[1] ?? "0", 10);
      totals[monthNum] = { hours: fm.total_hours, bonus: fm.total_bonus };
      totalHours += fm.total_hours;
      totalBonus += fm.total_bonus;

      for (const proj of fm.projects) {
        let row = rowMap.get(proj.project_id);
        if (!row) {
          row = {
            project_id: proj.project_id,
            project_name: proj.project_name,
            client: proj.client,
            months: {},
            total_hours: 0,
            total_bonus: 0,
          };
          rowMap.set(proj.project_id, row);
        }
        row.months[monthNum] = proj;
        row.total_hours += proj.total_hours;
        row.total_bonus += proj.bonus_amount;
      }
    }

    return {
      projectRows: Array.from(rowMap.values()),
      monthlyTotals: totals,
      grandTotal: { hours: totalHours, bonus: totalBonus },
    };
  }, [data]);

  function handleExport(format: "pdf" | "csv") {
    const params: Record<string, string> = { year, format };
    if (month && month !== "all") {
      params.month = month;
    }
    const url = getDownloadUrl("/exports/finance", params);
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Finanzbericht</h1>
        <div className="flex items-center gap-2">
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
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Ganzes Jahr" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ganzes Jahr</SelectItem>
              {ALL_MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {getMonthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => handleExport("csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("pdf")}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Projekt x Monat Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card">
                      Projekt
                    </TableHead>
                    {ALL_MONTHS.map((m) => (
                      <TableHead
                        key={m}
                        className="text-right min-w-[100px]"
                      >
                        {getMonthName(m)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-bold min-w-[120px]">
                      Gesamt
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectRows.map((proj) => (
                    <TableRow key={proj.project_id}>
                      <TableCell className="sticky left-0 bg-card font-medium">
                        <div>{proj.project_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {proj.client}
                        </div>
                      </TableCell>
                      {ALL_MONTHS.map((m) => {
                        const md = proj.months[m];
                        return (
                          <TableCell key={m} className="text-right">
                            {md && md.total_hours > 0 ? (
                              <div>
                                <div>
                                  {formatNumber(md.total_hours)} Std.
                                </div>
                                {(md.remote_hours > 0 && md.onsite_hours > 0) && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatNumber(md.remote_hours)}R / {formatNumber(md.onsite_hours)}O
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(md.bonus_amount)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                -
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-medium">
                        <div>
                          {formatNumber(proj.total_hours)} Std.
                        </div>
                        <div className="text-xs">
                          {formatCurrency(proj.total_bonus)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals row */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-card">
                      Gesamt
                    </TableCell>
                    {ALL_MONTHS.map((m) => {
                      const mt = monthlyTotals[m];
                      return (
                        <TableCell key={m} className="text-right">
                          {mt && mt.hours > 0 ? (
                            <div>
                              <div>
                                {formatNumber(mt.hours)} Std.
                              </div>
                              <div className="text-xs">
                                {formatCurrency(mt.bonus)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      <div>
                        {formatNumber(grandTotal.hours)} Std.
                      </div>
                      <div className="text-xs">
                        {formatCurrency(grandTotal.bonus)}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
