import {
  Component,
  lazy,
  Suspense,
  type ReactNode,
  type ErrorInfo,
} from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const Import = lazy(() => import("@/pages/Import"));
const FinanceReport = lazy(() => import("@/pages/FinanceReport"));
const BonusOverview = lazy(() => import("@/pages/BonusOverview"));
const CustomerReport = lazy(() => import("@/pages/CustomerReport"));
const Revenue = lazy(() => import("@/pages/Revenue"));
const Employees = lazy(() => import("@/pages/Employees"));
const TimeEntries = lazy(() => import("@/pages/TimeEntries"));

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <h1 className="text-xl font-bold">Etwas ist schiefgelaufen</h1>
          <button
            className="px-4 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.href = "/";
            }}
          >
            Zur Startseite
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground">Laden...</div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:id" element={<ProjectDetail />} />
              <Route
                path="projects/:id/customer-report"
                element={<CustomerReport />}
              />
              <Route
                path="projects/:id/time-entries"
                element={<TimeEntries />}
              />
              <Route path="import" element={<Import />} />
              <Route path="finance" element={<FinanceReport />} />
              <Route path="bonus" element={<BonusOverview />} />
              <Route path="revenue" element={<Revenue />} />
              <Route path="employees" element={<Employees />} />
            </Route>
          </Routes>
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
