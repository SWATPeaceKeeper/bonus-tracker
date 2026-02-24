import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "@/components/Layout";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const Import = lazy(() => import("@/pages/Import"));
const FinanceReport = lazy(() => import("@/pages/FinanceReport"));
const CustomerReport = lazy(() => import("@/pages/CustomerReport"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-muted-foreground">Laden...</div>
    </div>
  );
}

export default function App() {
  return (
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
            <Route path="import" element={<Import />} />
            <Route path="finance" element={<FinanceReport />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </BrowserRouter>
  );
}
