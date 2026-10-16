import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ProgressBar,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import {
  BarChart2,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { CourseAnalyticsPayload } from '@/types';

interface CourseListItem {
  _id: string;
  title: string;
  enrollmentCount: number;
  isPublished?: boolean;
}

const AnalyticsStat: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'blue' | 'emerald' | 'amber' | 'slate';
}> = ({ title, value, icon, tone }) => {
  const toneClass: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="stat-card flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </div>
    </div>
  );
};

export const AnalyticsOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        if (!cancelled) {
          setCourses([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const endpoint = user.role === 'admin'
          ? '/courses?limit=100&page=1'
          : '/courses/my-courses';

        const { data } = await api.get(endpoint);
        const items = Array.isArray(data.courses) ? data.courses : [];

        if (!cancelled) {
          setCourses(items.map((course: Partial<CourseListItem>) => ({
            _id: String(course._id || ''),
            title: String(course.title || 'Untitled course'),
            enrollmentCount: Number(course.enrollmentCount || 0),
            isPublished: Boolean(course.isPublished),
          })).filter((course: CourseListItem) => Boolean(course._id)));
        }
      } catch {
        if (!cancelled) {
          setCourses([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const totals = useMemo(() => ({
    totalCourses: courses.length,
    totalStudents: courses.reduce((sum, course) => sum + Number(course.enrollmentCount || 0), 0),
    published: courses.filter((course) => course.isPublished).length,
  }), [courses]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Track enrollments, assignment completion, and quiz performance by course.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <AnalyticsStat title="Courses" value={totals.totalCourses} icon={<BookOpen size={18} />} tone="blue" />
        <AnalyticsStat title="Students" value={totals.totalStudents} icon={<Users size={18} />} tone="amber" />
        <AnalyticsStat title="Published" value={totals.published} icon={<CheckCircle2 size={18} />} tone="emerald" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-normal">Course Analytics</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              icon={<BarChart2 size={36} />}
              title="No courses to analyze"
              description="Create or publish a course to unlock analytics."
            />
          ) : (
            <div className="space-y-2">
              {courses.map((course) => (
                <div key={course._id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{course.enrollmentCount} students enrolled</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {course.isPublished !== undefined && (
                      <StatusBadge status={course.isPublished ? 'published' : 'draft'} />
                    )}
                    <Link to={`/courses/${course._id}/analytics`}>
                      <Button size="sm" variant="outline">Open</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export const CourseAnalyticsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<CourseAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Course id is missing.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get(`/courses/${id}/analytics`);
        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (requestError: unknown) {
        if (!cancelled) {
          const message = (requestError as { response?: { data?: { error?: string } } })?.response?.data?.error;
          setError(message || 'Could not load course analytics.');
          setAnalytics(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Alert variant="error">{error}</Alert>
        <Button variant="outline" onClick={() => navigate('/analytics')}>Back to Analytics</Button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <EmptyState
        icon={<BarChart2 size={36} />}
        title="No analytics available"
        description="Try again in a moment."
        action={<Button variant="outline" onClick={() => navigate('/analytics')}>Back</Button>}
      />
    );
  }

  const overview = analytics.overview;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{analytics.course.title}</h1>
          <p className="page-subtitle">Course analytics and completion trends.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/analytics')}>Back</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsStat title="Registered Students" value={overview.totalStudents} icon={<Users size={18} />} tone="blue" />
        <AnalyticsStat title="Course Completes" value={overview.completedCourseStudents} icon={<CheckCircle2 size={18} />} tone="emerald" />
        <AnalyticsStat title="Assignments" value={overview.totalAssignments} icon={<FileText size={18} />} tone="amber" />
        <AnalyticsStat title="Quizzes" value={overview.totalQuizzes} icon={<ClipboardList size={18} />} tone="slate" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-normal">Completion Overview</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Course completion rate</span>
              <span>{overview.courseCompletionRate}%</span>
            </div>
            <ProgressBar value={overview.courseCompletionRate} color="bg-emerald-500" />
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Assignment submissions</p>
              <p className="text-lg font-semibold text-foreground">{overview.totalAssignmentSubmissions}</p>
              <p className="text-xs text-muted-foreground mt-1">{overview.uniqueAssignmentCompleters} unique students</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Quiz attempts</p>
              <p className="text-lg font-semibold text-foreground">{overview.totalQuizAttempts}</p>
              <p className="text-xs text-muted-foreground mt-1">{overview.uniqueQuizCompleters} unique students</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Average quiz score</p>
              <p className="text-lg font-semibold text-foreground">{overview.averageQuizScore.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                <TrendingUp size={12} /> Overall performance signal
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg font-normal inline-flex items-center gap-2">
              <FileText size={16} /> Assignment Analytics
            </h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {analytics.assignments.length === 0 ? (
              <EmptyState icon={<FileText size={28} />} title="No assignments" description="Create assignments to see completion data." />
            ) : analytics.assignments.map((assignment) => (
              <div key={assignment._id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{assignment.title}</p>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{new Date(assignment.dueDate).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignment.submissions} submissions • {assignment.uniqueStudents} students
                </p>
                <p className="text-xs text-muted-foreground">
                  {assignment.onTimeSubmissions} on time • {assignment.lateSubmissions} late • {assignment.gradedSubmissions} graded
                </p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg font-normal inline-flex items-center gap-2">
              <ClipboardCheck size={16} /> Quiz Analytics
            </h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {analytics.quizzes.length === 0 ? (
              <EmptyState icon={<ClipboardList size={28} />} title="No quizzes" description="Create quizzes to see attempt and pass data." />
            ) : analytics.quizzes.map((quiz) => (
              <div key={quiz._id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{quiz.title}</p>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">Pass {quiz.passingScore}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {quiz.attempts} attempts • {quiz.uniqueStudents} students • {quiz.passedAttempts} passed
                </p>
                <p className="text-xs text-muted-foreground">Average score: {quiz.averageScore.toFixed(1)}%</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
