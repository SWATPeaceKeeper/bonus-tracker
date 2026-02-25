import { useState } from "react";
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
import { formatCurrency, formatNumber, STATUS_LABELS, STATUS_VARIANTS, type ProjectStatus } from "@/lib/utils";
import type { Project, ProjectCreate } from "@/types";

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
  onsite_hourly_rate: null,
  project_manager: null,
  customer_contact: null,
};

export default function Projects() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi<Project[]>(
    () => get<Project[]>("/projects"),
  );

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectCreate>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
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
      onsite_hourly_rate: project.onsite_hourly_rate,
      project_manager: project.project_manager,
      customer_contact: project.customer_contact,
    });
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
    if (!confirm(`Projekt "${project.name}" wirklich löschen?`)) {
      return;
    }
    try {
      await del(`/projects/${project.id}`);
      toast.success("Projekt gelöscht");
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(msg);
    }
  }

  function updateField<K extends keyof ProjectCreate>(
    key: K,
    value: ProjectCreate[K],
  ) {
    setForm({ ...form, [key]: value });
  }

  function parseOptionalNumber(value: string): number | null {
    if (value === "") return null;
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!data) return;
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((p) => p.id)));
    }
  }

  async function handleBulkStatus(status: string) {
    try {
      await put("/projects/bulk/status", {
        project_ids: Array.from(selectedIds),
        status,
      });
      toast.success(`${selectedIds.size} Projekte aktualisiert`);
      setSelectedIds(new Set());
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler bei Bulk-Aktion";
      toast.error(msg);
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`${selectedIds.size} Projekte wirklich löschen?`)) return;
    try {
      const params = Array.from(selectedIds)
        .map((id) => `project_ids=${id}`)
        .join("&");
      await del(`/projects/bulk?${params}`);
      toast.success(`${selectedIds.size} Projekte gelöscht`);
      setSelectedIds(new Set());
      refetch();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(msg);
    }
  }

  const columns: Column<Project>[] = [
    {
      key: "select",
      header: "",
      render: (r) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={selectedIds.has(r.id)}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelect(r.id);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      className: "w-10",
    },
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
        <div className="flex items-center gap-4">
          {data && data.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={
                  selectedIds.size > 0 &&
                  selectedIds.size === data.length
                }
                onChange={selectAll}
              />
              Alle
            </label>
          )}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neues Projekt
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.size} ausgewählt
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatus("aktiv")}
            >
              Aktivieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatus("pausiert")}
            >
              Pausieren
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkStatus("abgeschlossen")}
            >
              Abschließen
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Löschen
            </Button>
          </div>
        </div>
      )}

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
                <label htmlFor="proj-name" className="text-sm font-medium">
                  Projektname
                </label>
                <Input
                  id="proj-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Projektname"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="proj-project-id" className="text-sm font-medium">
                  Projekt-ID (Clockify)
                </label>
                <Input
                  id="proj-project-id"
                  value={form.project_id}
                  onChange={(e) =>
                    updateField("project_id", e.target.value)
                  }
                  placeholder="z.B. 430980254956"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="proj-client" className="text-sm font-medium">Kunde</label>
              <Input
                id="proj-client"
                value={form.client}
                onChange={(e) => updateField("client", e.target.value)}
                placeholder="Kundenname"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="proj-deal-value" className="text-sm font-medium">
                  Deal-Wert
                </label>
                <Input
                  id="proj-deal-value"
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
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="proj-budget-hours" className="text-sm font-medium">
                  Budget (Stunden)
                </label>
                <Input
                  id="proj-budget-hours"
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
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <label htmlFor="proj-hourly-rate" className="text-sm font-medium">
                  Stundensatz
                </label>
                <Input
                  id="proj-hourly-rate"
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
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="proj-bonus-rate" className="text-sm font-medium">
                  Bonus-Satz
                </label>
                <Input
                  id="proj-bonus-rate"
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
                <label htmlFor="proj-status" className="text-sm font-medium">Status</label>
                <Select
                  value={form.status ?? "aktiv"}
                  onValueChange={(v) => updateField("status", v)}
                >
                  <SelectTrigger id="proj-status">
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
              <label htmlFor="proj-onsite-rate" className="text-sm font-medium">
                OnSite-Stundensatz
              </label>
              <Input
                id="proj-onsite-rate"
                type="number"
                min={0}
                step={0.01}
                value={form.onsite_hourly_rate ?? ""}
                onChange={(e) =>
                  updateField(
                    "onsite_hourly_rate",
                    parseOptionalNumber(e.target.value),
                  )
                }
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="proj-manager" className="text-sm font-medium">Projektleiter</label>
                <Input
                  id="proj-manager"
                  value={form.project_manager ?? ""}
                  onChange={(e) =>
                    updateField("project_manager", e.target.value || null)
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="proj-contact" className="text-sm font-medium">
                  Kundenansprechpartner
                </label>
                <Input
                  id="proj-contact"
                  value={form.customer_contact ?? ""}
                  onChange={(e) =>
                    updateField("customer_contact", e.target.value || null)
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="proj-start-date" className="text-sm font-medium">Startdatum</label>
              <Input
                id="proj-start-date"
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
