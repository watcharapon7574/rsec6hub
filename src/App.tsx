
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Particles } from "@/components/ui/particles";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import TopBar from "@/components/Layout/TopBar";
import FloatingNavbar from "@/components/Layout/FloatingNavbar";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import LeaveRequestsPage from "@/pages/LeaveRequestsPage";
import DailyReportsPage from "@/pages/DailyReportsPage";
import OfficialDocumentsPage from "@/pages/OfficialDocumentsPage";
import CreateDocumentPage from "@/pages/CreateDocumentPage";
import CreateMemoPage from "@/pages/CreateMemoPage";
import PDFSignaturePage from "@/pages/PDFSignaturePage";
import DocumentManagePage from "@/pages/DocumentManagePage";
import ApproveDocumentPage from "@/pages/ApproveDocumentPage";
import PDFjustPreview from '@/pages/PDFjustPreview';
import NotificationsPage from "@/pages/NotificationsPage";
import InstallPrompt from "@/components/PWA/InstallPrompt";


const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useEmployeeAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 w-full">
        <div className="glass-card p-8 rounded-3xl animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 text-center text-apple">กำลังโหลด...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return (
    <div className="w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 min-h-screen overflow-x-hidden">
      <TopBar />
      <main className="w-full">
        {children}
      </main>
      <FloatingNavbar />
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated, loading } = useEmployeeAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 w-full">
        <div className="glass-card p-8 rounded-3xl animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 text-center text-apple">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
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
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />
      } />
    </Routes>
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
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </div>
);

export default App;
