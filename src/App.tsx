
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Particles } from "@/components/ui/particles";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import TopBar from "@/components/Layout/TopBar";
import FloatingNavbar from "@/components/Layout/FloatingNavbar";
import { LoadingQueue } from "@/components/ui/LoadingQueue";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import LeaveRequestsPage from "@/pages/LeaveRequestsPage";
import DailyReportsPage from "@/pages/DailyReportsPage";
import OfficialDocumentsPage from "@/pages/OfficialDocumentsPage";
import CreateDocumentPage from "@/pages/CreateDocumentPage";
import CreateMemoPage from "@/pages/CreateMemoPage";
import CreateReportMemoPage from "@/pages/CreateReportMemoPage";
import ManageReportMemoPage from "@/pages/ManageReportMemoPage";
import PDFSignaturePage from "@/pages/PDFSignaturePage";
import DocumentManagePage from "@/pages/DocumentManagePage";
import PDFDocumentManagePage from "@/pages/PDFDocumentManagePage";
import PDFReceiveManagePage from "@/pages/PDFReceiveManagePage";
import ApproveDocumentPage from "@/pages/ApproveDocumentPage";
import PDFjustPreview from '@/pages/PDFjustPreview';
import NotificationsPage from "@/pages/NotificationsPage";
import EditDocReceivePage from "@/pages/EditDocReceivePage";
import TaskAssignmentPage from "@/pages/TaskAssignmentPage";
import AssignedTasksPage from "@/pages/AssignedTasksPage";
import DocumentDetailPage from "@/pages/DocumentDetailPage";
import TestRequestQueuePage from "@/pages/TestRequestQueuePage";
import QueueRealtimePage from "@/pages/QueueRealtimePage";
import AdminProfileManagementPage from "@/pages/AdminProfileManagementPage";
import AdminOtpManagementPage from "@/pages/AdminOtpManagementPage";
import RailwayManagementPage from "@/pages/RailwayManagementPage";
import InstallPrompt from "@/components/PWA/InstallPrompt";
import DarkModeToggle from "@/components/Layout/DarkModeToggle";


const queryClient = new QueryClient();

// ScrollToTop - scroll to top เมื่อเปลี่ยน route
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // ใช้ทั้ง scrollTo และ documentElement.scrollTop เพื่อให้แน่ใจว่าทำงาน
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useEmployeeAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background w-full">
        <div className="p-8 rounded-lg animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 text-center">กำลังโหลด...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <div className="w-full bg-background min-h-screen overflow-x-hidden">
      <TopBar />
      <main className="w-full">
        {children}
      </main>
      <FloatingNavbar />
      <DarkModeToggle />
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, loading } = useEmployeeAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background w-full">
        <div className="p-8 rounded-lg animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 text-center">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          path="/auth"
          element={<AuthPage />}
        />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/leave-requests" element={
        <ProtectedRoute>
          <LeaveRequestsPage />
        </ProtectedRoute>
      } />
      <Route path="/daily-reports" element={
        <ProtectedRoute>
          <DailyReportsPage />
        </ProtectedRoute>
      } />
      <Route path="/documents" element={
        <ProtectedRoute>
          <OfficialDocumentsPage />
        </ProtectedRoute>
      } />
      <Route path="/create-document" element={
        <ProtectedRoute>
          <CreateDocumentPage />
        </ProtectedRoute>
      } />
      <Route path="/create-memo" element={
        <ProtectedRoute>
          <CreateMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/report-memo/:taskId" element={
        <ProtectedRoute>
          <CreateReportMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/manage-report-memo/:memoId" element={
        <ProtectedRoute>
          <ManageReportMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-signature" element={
        <ProtectedRoute>
          <PDFSignaturePage />
        </ProtectedRoute>
      } />
      <Route path="/document-manage/:memoId" element={
        <ProtectedRoute>
          <DocumentManagePage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-document-manage/:memoId" element={
        <ProtectedRoute>
          <PDFDocumentManagePage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-receive-manage/:memoId" element={
        <ProtectedRoute>
          <PDFReceiveManagePage />
        </ProtectedRoute>
      } />
      <Route path="/edit-doc-receive/:memoId" element={
        <ProtectedRoute>
          <EditDocReceivePage />
        </ProtectedRoute>
      } />
      <Route path="/approve-document/:memoId" element={
        <ProtectedRoute>
          <ApproveDocumentPage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-just-preview" element={
        <ProtectedRoute>
          <PDFjustPreview />
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <NotificationsPage />
        </ProtectedRoute>
      } />
      <Route path="/task-assignment" element={
        <ProtectedRoute>
          <TaskAssignmentPage />
        </ProtectedRoute>
      } />
      <Route path="/assigned-tasks" element={
        <ProtectedRoute>
          <AssignedTasksPage />
        </ProtectedRoute>
      } />
      <Route path="/document-detail" element={
        <ProtectedRoute>
          <DocumentDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/test-queue" element={
        <ProtectedRoute>
          <TestRequestQueuePage />
        </ProtectedRoute>
      } />
      <Route path="/QRealtime" element={
        <ProtectedRoute>
          <QueueRealtimePage />
        </ProtectedRoute>
      } />
      <Route path="/admin/profiles" element={
        <ProtectedRoute>
          <AdminProfileManagementPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/otp-management" element={
        <ProtectedRoute>
          <AdminOtpManagementPage />
        </ProtectedRoute>
      } />
      <Route path="/railway" element={
        <ProtectedRoute>
          <RailwayManagementPage />
        </ProtectedRoute>
      } />
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />
      } />
      </Routes>
    </>
  );
};

const App = () => (
  <div className="relative w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 overflow-x-hidden">
    <Particles
      className="absolute inset-0 -z-10"
      quantity={100}
      color="#3b82f6"
      radius={3}
    />
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
          <InstallPrompt />
          <LoadingQueue />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </div>
);

export default App;
