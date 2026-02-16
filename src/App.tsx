
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
import CreateDocReceivePage from "@/pages/CreateDocReceivePage";
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
import TelegramAssigneesPage from "@/pages/TelegramAssigneesPage";
import RegisterInternalPage from "@/pages/RegisterInternalPage";
import RegisterExternalPage from "@/pages/RegisterExternalPage";
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

// ProtectedRoute ใช้ auth state จาก AppContent (props) แทนการสร้าง useEmployeeAuth ใหม่
// เพื่อป้องกัน loading ค้างจากการมีหลาย hook instance
const ProtectedRoute = ({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) => {
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
  const location = useLocation();

  // Check if current path is a public route (no auth required)
  const isPublicRoute = location.pathname.startsWith('/telegram-assignees') || location.pathname === '/auth';

  // For public routes, don't wait for auth loading - render immediately
  if (loading && !isPublicRoute) {
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
        {/* Telegram Mini App - Public routes (no auth required) */}
        {/* Route with documentId in URL (for direct links) */}
        <Route
          path="/telegram-assignees/:documentId"
          element={<TelegramAssigneesPage />}
        />
        {/* Route without documentId (for Telegram startapp parameter) */}
        <Route
          path="/telegram-assignees"
          element={<TelegramAssigneesPage />}
        />
      <Route path="/dashboard" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/leave-requests" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <LeaveRequestsPage />
        </ProtectedRoute>
      } />
      <Route path="/daily-reports" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <DailyReportsPage />
        </ProtectedRoute>
      } />
      <Route path="/documents" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <OfficialDocumentsPage />
        </ProtectedRoute>
      } />
      <Route path="/create-document" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <CreateDocumentPage />
        </ProtectedRoute>
      } />
      <Route path="/create-memo" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <CreateMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/report-memo/:taskId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <CreateReportMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/create-report-memo" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <CreateReportMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/manage-report-memo/:memoId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <ManageReportMemoPage />
        </ProtectedRoute>
      } />
      <Route path="/create-doc-receive" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <CreateDocReceivePage />
        </ProtectedRoute>
      } />
      <Route path="/document-manage/:memoId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <DocumentManagePage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-document-manage/:memoId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <PDFDocumentManagePage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-receive-manage/:memoId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <PDFReceiveManagePage />
        </ProtectedRoute>
      } />
      <Route path="/edit-doc-receive/:memoId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <EditDocReceivePage />
        </ProtectedRoute>
      } />
      <Route path="/register-internal" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <RegisterInternalPage />
        </ProtectedRoute>
      } />
      <Route path="/register-external" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <RegisterExternalPage />
        </ProtectedRoute>
      } />
      <Route path="/approve-document/:memoId" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <ApproveDocumentPage />
        </ProtectedRoute>
      } />
      <Route path="/pdf-just-preview" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <PDFjustPreview />
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <NotificationsPage />
        </ProtectedRoute>
      } />
      <Route path="/task-assignment" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <TaskAssignmentPage />
        </ProtectedRoute>
      } />
      <Route path="/assigned-tasks" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <AssignedTasksPage />
        </ProtectedRoute>
      } />
      <Route path="/document-detail" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <DocumentDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/test-queue" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <TestRequestQueuePage />
        </ProtectedRoute>
      } />
      <Route path="/QRealtime" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <QueueRealtimePage />
        </ProtectedRoute>
      } />
      <Route path="/admin/profiles" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <AdminProfileManagementPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/otp-management" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
          <AdminOtpManagementPage />
        </ProtectedRoute>
      } />
      <Route path="/railway" element={
        <ProtectedRoute isAuthenticated={isAuthenticated}>
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
  <div className="relative w-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 overflow-x-hidden">
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
