
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
import PullToRefresh from "@/components/PWA/PullToRefresh";
import { LoadingQueue } from "@/components/ui/LoadingQueue";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import LeaveRequestsPage from "@/pages/LeaveRequestsPage";
import NewsfeedPage from "@/pages/NewsfeedPage";
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
import OcrUploadPage from "@/pages/OcrUploadPage";
import OcrSearchPage from "@/pages/OcrSearchPage";
import OcrSearchEmbedPage from "@/pages/OcrSearchEmbedPage";
import PayslipPage from "@/pages/PayslipPage";
import RegisterInternalPage from "@/pages/RegisterInternalPage";
import RegisterExternalPage from "@/pages/RegisterExternalPage";
import InstallPrompt from "@/components/PWA/InstallPrompt";
import DarkModeToggle from "@/components/Layout/DarkModeToggle";
import APIMaintenanceBanner from "@/components/Layout/APIMaintenanceBanner";
import AdminChatsPage from "@/pages/AdminChatsPage";
import AdminChatSheet from "@/components/Chat/AdminChatSheet";
import { ChatProvider, useChatContext } from "@/contexts/ChatContext";
import { useIsMobile } from "@/hooks/use-mobile";


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
const ProtectedRouteInner = ({ children }: { children: React.ReactNode }) => {
  const { isChatOpen } = useChatContext();
  const isMobile = useIsMobile();

  return (
    <PullToRefresh>
      <div className="w-full bg-background min-h-screen overflow-x-hidden">
        <APIMaintenanceBanner />
        <TopBar />
        <main
          className="w-full transition-[margin] duration-300 ease-in-out"
          style={{ marginRight: isChatOpen && !isMobile ? 400 : 0 }}
        >
          {children}
        </main>
        <FloatingNavbar />
        <DarkModeToggle />
        <AdminChatSheet />
      </div>
    </PullToRefresh>
  );
};

const ProtectedRouteWithAuth = ({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) => {
  const { user, profile } = useEmployeeAuth();
  const userIsAdmin = profile ? (profile.is_admin || profile.position === 'director') : false;

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <ChatProvider userId={user?.id} isAdmin={userIsAdmin}>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </ChatProvider>
  );
};

const AppContent = () => {
  const { isAuthenticated, loading } = useEmployeeAuth();
  const location = useLocation();

  // Check if current path is a public route (no auth required)
  const isPublicRoute = location.pathname.startsWith('/telegram-assignees') || location.pathname.startsWith('/embed/') || location.pathname === '/auth';

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
        {/* Public embed route (no auth required) */}
        <Route path="/embed/search" element={<OcrSearchEmbedPage />} />
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
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <Dashboard />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/profile" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <Profile />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/leave-requests" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <LeaveRequestsPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/newsfeed" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <NewsfeedPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/daily-reports" element={<Navigate to="/newsfeed" replace />} />
      <Route path="/documents" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <OfficialDocumentsPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/create-document" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <CreateDocumentPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/create-memo" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <CreateMemoPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/report-memo/:taskId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <CreateReportMemoPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/create-report-memo" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <CreateReportMemoPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/manage-report-memo/:memoId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <ManageReportMemoPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/create-doc-receive" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <CreateDocReceivePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/document-manage/:memoId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <DocumentManagePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/pdf-document-manage/:memoId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <PDFDocumentManagePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/pdf-receive-manage/:memoId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <PDFReceiveManagePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/edit-doc-receive/:memoId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <EditDocReceivePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/register-internal" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <RegisterInternalPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/register-external" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <RegisterExternalPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/approve-document/:memoId" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <ApproveDocumentPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/pdf-just-preview" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <PDFjustPreview />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/notifications" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <NotificationsPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/task-assignment" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <TaskAssignmentPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/assigned-tasks" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <AssignedTasksPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/document-detail" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <DocumentDetailPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/test-queue" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <TestRequestQueuePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/QRealtime" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <QueueRealtimePage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/admin/profiles" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <AdminProfileManagementPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/admin/otp-management" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <AdminOtpManagementPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/admin/chats" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <AdminChatsPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/railway" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <RailwayManagementPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/ocr" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <OcrUploadPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/ocr-search" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <OcrSearchPage />
        </ProtectedRouteWithAuth>
      } />
      <Route path="/payslips" element={
        <ProtectedRouteWithAuth isAuthenticated={isAuthenticated}>
          <PayslipPage />
        </ProtectedRouteWithAuth>
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
