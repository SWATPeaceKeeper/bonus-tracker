import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DataTable, { type Column } from "@/components/DataTable";
import { LoadingState, ErrorState } from "@/components/PageState";
import { useApi } from "@/hooks/useApi";
import { get, post, put, del } from "@/api/client";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { Project, ProjectCreate } from "@/types";

type CalcField = "deal_value" | "budget_hours" | "hourly_rate";
const CALC_FIELDS: CalcField[] = [
  "deal_value",
  "budget_hours",
  "hourly_rate",
];


type ProjectStatus = Project["status"];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen",
};

const STATUS_VARIANTS: Record<
  ProjectStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  aktiv: "default",
  pausiert: "outline",
  abgeschlossen: "secondary",
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const EMPTY_FORM: ProjectCreate = {
  name: "",
  client: "",
  project_id: "",
  deal_value: null,
  budget_hours: null,
  hourly_rate: null,
  bonus_rate: 0.02,
  status: "aktiv",
  start_date: null,
};

export default function Projects() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi<Project[]>(
    () => get<Project[]>("/projects"),
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectCreate>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [autoCalcField, setAutoCalcField] = useState<CalcField | null>(
    null,
  );

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setAutoCalcField(null);
    setDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditId(project.id);
    setForm({
      name: project.name,
      client: project.client,
      project_id: project.project_id,
      deal_value: project.deal_value,
      budget_hours: project.budget_hours,
      hourly_rate: project.hourly_rate,
      bonus_rate: project.bonus_rate,
      status: project.status,
      start_date: project.start_date,
    });
    setAutoCalcField(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editId) {
        await put(`/projects/${editId}`, form);
        toast.success("Projekt aktualisiert");
      } else {
        await post("/projects", form);
        toast.success("Projekt erstellt");
      }
      setDialogOpen(false);
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Speichern";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!confirm(`Projekt "${project.name}" wirklich loeschen?`)) {
      return;
    }
    try {
      await del(`/projects/${project.id}`);
      toast.success("Projekt geloescht");
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Loeschen";
      toast.error(msg);
    }
  }

  const autoCalc = useCallback(
    (next: ProjectCreate, changed: keyof ProjectCreate) => {
      if (!CALC_FIELDS.includes(changed as CalcField)) return;

      const dv = next.deal_value;
      const bh = next.budget_hours;
      const hr = next.hourly_rate;

      const filled = [dv, bh, hr].filter(
        (v) => v != null && v !== 0,
      ).length;

      // All 3 manually filled or <2 filled → no auto-calc
      if (filled !== 2) {
        setAutoCalcField(null);
        return;
      }

      if (dv != null && bh != null && hr == null && bh > 0) {
        setForm((f) => ({
          ...f,
          hourly_rate: Math.round((dv / bh) * 100) / 100,
        }));
        setAutoCalcField("hourly_rate");
      } else if (dv != null && hr != null && bh == null && hr > 0) {
        setForm((f) => ({
          ...f,
          budget_hours: Math.round((dv / hr) * 100) / 100,
        }));
        setAutoCalcField("budget_hours");
      } else if (bh != null && hr != null && dv == null) {
        setForm((f) => ({
          ...f,
          deal_value: Math.round(bh * hr * 100) / 100,
        }));
        setAutoCalcField("deal_value");
      } else {
        setAutoCalcField(null);
      }
    },
    [],
  );

  function updateField<K extends keyof ProjectCreate>(
    key: K,
    value: ProjectCreate[K],
  ) {
    const next = { ...form, [key]: value };
    setForm(next);
    autoCalc(next, key);
  }

  function parseOptionalNumber(value: string): number | null {
    if (value === "") return null;
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }

  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <div>
          <div className="font-medium">{r.name}</div>
          <div className="text-xs text-muted-foreground">{r.client}</div>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "hourly_rate",
      header: "Stundensatz",
      render: (r) =>
        r.hourly_rate != null ? formatCurrency(r.hourly_rate) : "-",
      sortValue: (r) => r.hourly_rate ?? 0,
      className: "text-right",
    },
    {
      key: "budget_hours",
      header: "Budget (Std.)",
      render: (r) =>
        r.budget_hours != null ? formatNumber(r.budget_hours) : "-",
      sortValue: (r) => r.budget_hours ?? 0,
      className: "text-right",
    },
    {
      key: "total_hours",
      header: "Verbraucht (Std.)",
      render: (r) => formatNumber(r.total_hours),
      sortValue: (r) => r.total_hours,
      className: "text-right",
    },
    {
      key: "bonus_rate",
      header: "Bonus-Satz",
      render: (r) => `${(r.bonus_rate * 100).toFixed(0)}%`,
      sortValue: (r) => r.bonus_rate,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status} />,
      sortValue: (r) => r.status,
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      className: "w-24",
    },
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projekte</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Projekt
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alle Projekte</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data ?? []}
            keyFn={(r) => r.id}
            onRowClick={(r) => navigate(`/projects/${r.id}`)}
          />
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Projekt bearbeiten" : "Neues Projekt"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Projektname
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Projektname"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Projekt-ID (Clockify)
                </label>
                <Input
                  value={form.project_id}
                  onChange={(e) =>
                    updateField("project_id", e.target.value)
                  }
                  placeholder="z.B. 430980254956"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Kunde</label>
              <Input
                value={form.client}
                onChange={(e) => updateField("client", e.target.value)}
                placeholder="Kundenname"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Deal-Wert
                  {autoCalcField === "deal_value" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Berechnet)
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.deal_value ?? ""}
                  onChange={(e) =>
                    updateField(
                      "deal_value",
                      parseOptionalNumber(e.target.value),
                    )
                  }
                  placeholder="Optional"
                  className={cn(
                    autoCalcField === "deal_value" && "bg-muted",
                  )}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Budget (Stunden)
                  {autoCalcField === "budget_hours" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Berechnet)
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.budget_hours ?? ""}
                  onChange={(e) =>
                    updateField(
                      "budget_hours",
                      parseOptionalNumber(e.target.value),
                    )
                  }
                  placeholder="Optional"
                  className={cn(
                    autoCalcField === "budget_hours" && "bg-muted",
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Stundensatz
                  {autoCalcField === "hourly_rate" && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Berechnet)
                    </span>
                  )}
                </label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.hourly_rate ?? ""}
                  onChange={(e) =>
                    updateField(
                      "hourly_rate",
                      parseOptionalNumber(e.target.value),
                    )
                  }
                  placeholder="Optional"
                  className={cn(
                    autoCalcField === "hourly_rate" && "bg-muted",
                  )}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">
                  Bonus-Satz
                </label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={form.bonus_rate ?? 0.02}
                  onChange={(e) =>
                    updateField(
                      "bonus_rate",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  placeholder="z.B. 0.02"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={form.status ?? "aktiv"}
                  onValueChange={(v) => updateField("status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="pausiert">Pausiert</SelectItem>
                    <SelectItem value="abgeschlossen">
                      Abgeschlossen
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Startdatum</label>
              <Input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) =>
                  updateField(
                    "start_date",
                    e.target.value || null,
                  )
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? "Speichern..." : "Speichern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
