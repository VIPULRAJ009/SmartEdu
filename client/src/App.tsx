import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage, RegisterPage } from '@/pages/auth/AuthPages';
import { StudentDashboard, TeacherDashboard } from '@/pages/student/Dashboard';
import { CourseCatalog, CourseDetail } from '@/pages/student/Courses';
import { CourseCreatePage } from '@/pages/student/CourseEditor';
import { AssignmentsHubPage, QuizzesHubPage } from '@/pages/student/Assignments';
import { AnalyticsOverviewPage, CourseAnalyticsPage } from '@/pages/student/Analytics';
import { SkillMapPage } from '@/pages/student/SkillMap';
import { QuizPage } from '@/pages/student/Quizzes';
import { LeaderboardPage, BadgesPage, MarketTrendsPage } from '@/pages/student/Social';
import { ProfilePage } from '@/pages/student/Profile';
import { DiscussionsPage } from '@/pages/student/Discussions';
import { LiveClassPage } from '@/pages/student/LiveClass';
import { LiveClassRoomPage } from '@/pages/student/LiveClassRoom';
import { StudentsPage } from '@/pages/student/Students';
import { AdminPanel } from '@/pages/admin/AdminPanel';
import { ToastContainer } from '@/components/ui';
import { Spinner } from '@/components/ui';

// Route guards
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const RoleRoute: React.FC<{ children: React.ReactNode; roles: string[] }> = ({ children, roles }) => {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const DashboardRouter: React.FC = () => {
  const { user } = useAuth();
  if (user?.role === 'teacher') return <TeacherDashboard />;
  if (user?.role === 'admin') return <AdminPanel />;
  return <StudentDashboard />;
};

const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />

      {/* Protected — shared layout */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardRouter />} />
        <Route path="courses" element={<CourseCatalog />} />
        <Route path="assignments" element={<AssignmentsHubPage />} />
        <Route path="quizzes" element={<QuizzesHubPage />} />
        <Route path="courses/new" element={
          <RoleRoute roles={['teacher', 'admin']}><CourseCreatePage /></RoleRoute>
        } />
        <Route path="courses/:id/edit" element={
          <RoleRoute roles={['teacher', 'admin']}><CourseCreatePage /></RoleRoute>
        } />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="courses/:id/analytics" element={
          <RoleRoute roles={['teacher', 'admin']}><CourseAnalyticsPage /></RoleRoute>
        } />
        <Route path="analytics" element={
          <RoleRoute roles={['teacher', 'admin']}><AnalyticsOverviewPage /></RoleRoute>
        } />
        <Route path="skills" element={
          <RoleRoute roles={['student']}><SkillMapPage /></RoleRoute>
        } />
        <Route path="quizzes/:id" element={
          <RoleRoute roles={['student']}><QuizPage /></RoleRoute>
        } />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="badges" element={
          <RoleRoute roles={['student']}><BadgesPage /></RoleRoute>
        } />
        <Route path="discussions" element={<DiscussionsPage />} />
        <Route path="live-class" element={<LiveClassPage />} />
        <Route path="live-class/room/:classId" element={<LiveClassRoomPage />} />
        <Route path="students" element={
          <RoleRoute roles={['teacher', 'admin']}><StudentsPage /></RoleRoute>
        } />
        <Route path="market" element={<MarketTrendsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin" element={
          <RoleRoute roles={['admin']}><AdminPanel /></RoleRoute>
        } />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
      <ToastContainer />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
