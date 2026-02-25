import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const numberFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFormatter.format(d);
}

/** Map month number (1-12) or ISO date string to German month name */
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
] as const;

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Monat ${month}`;
}

/** Current year and common year/month arrays for selectors. */
export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 5 }, (_, i) =>
  String(CURRENT_YEAR - i),
);
export const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Project status display labels and badge variants. */
export type ProjectStatus = "aktiv" | "pausiert" | "abgeschlossen";

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  abgeschlossen: "Abgeschlossen",
};

export const STATUS_VARIANTS: Record<
  ProjectStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  aktiv: "default",
  pausiert: "outline",
  abgeschlossen: "secondary",
};
