import { Fragment, useState } from "react";
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
import { Users, ChevronDown, ChevronRight } from "lucide-react";
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
import { cn, formatNumber, CURRENT_YEAR, YEARS } from "@/lib/utils";
import type { EmployeeUtilization } from "@/types";

export default function Employees() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, loading, error, refetch } = useApi<EmployeeUtilization[]>(
    () => get<EmployeeUtilization[]>("/reports/employees", { year }),
    [year],
  );

  const totalHours = (data ?? []).reduce((sum, e) => sum + e.total_hours, 0);

  function toggleExpand(employee: string) {
    setExpanded((prev) => (prev === employee ? null : employee));
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mitarbeiter</h1>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mitarbeiter</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gesamtstunden</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(totalHours)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">&#216; pro Mitarbeiter</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data && data.length > 0 ? formatNumber(totalHours / data.length) : "0"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auslastung {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Mitarbeiter</TableHead>
                <TableHead className="text-right">Stunden</TableHead>
                <TableHead className="text-center">Projekte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Keine Daten f&#252;r {year}
                  </TableCell>
                </TableRow>
              )}
              {(data ?? []).map((emp) => (
                <Fragment key={emp.employee}>
                  <TableRow
                    className={cn("cursor-pointer")}
                    onClick={() => toggleExpand(emp.employee)}
                  >
                    <TableCell className="w-8 pr-0">
                      {expanded === emp.employee ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{emp.employee}</TableCell>
                    <TableCell className="text-right">{formatNumber(emp.total_hours)} Std.</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{emp.project_count}</Badge>
                    </TableCell>
                  </TableRow>
                  {expanded === emp.employee &&
                    emp.projects.map((proj) => (
                      <TableRow key={`${emp.employee}-${proj.project_id}`} className="bg-muted/50">
                        <TableCell />
                        <TableCell className="pl-8 text-sm">{proj.project_name}</TableCell>
                        <TableCell className="text-right text-sm">{formatNumber(proj.hours)} Std.</TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
