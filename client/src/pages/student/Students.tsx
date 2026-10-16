import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from '@/components/ui';
import { Search, Users, BookOpen, TrendingUp, Flame } from 'lucide-react';

interface StudentCourse {
  courseId: string;
  courseTitle: string;
  progress: number;
  completedAt?: string | null;
}

interface StudentItem {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  level?: string;
  xp?: number;
  streak?: number;
  enrollments: StudentCourse[];
}

interface CourseOption {
  _id: string;
  title: string;
}

export const StudentsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('all');

  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);

  const loadStudents = async (overrideSearch?: string) => {
    setLoading(true);
    setError('');

    try {
      const params: Record<string, string> = {};
      const activeSearch = String(overrideSearch ?? search).trim();
      if (activeSearch) params.search = activeSearch;
      if (courseId !== 'all') params.courseId = courseId;

      const { data } = await api.get('/users/students', { params });
      setCourses(Array.isArray(data.courses) ? data.courses : []);
      setStudents(Array.isArray(data.students) ? data.students : []);
    } catch (requestError: unknown) {
      const message = (requestError as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Could not load student list.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const stats = useMemo(() => {
    const enrollmentRows = students.flatMap((student) => student.enrollments || []);
    const totalEnrollments = enrollmentRows.length;
    const avgProgress = totalEnrollments > 0
      ? Math.round(enrollmentRows.reduce((sum, row) => sum + Number(row.progress || 0), 0) / totalEnrollments)
      : 0;

    return {
      studentCount: students.length,
      totalEnrollments,
      avgProgress,
    };
  }, [students]);

  if (user?.role !== 'teacher' && user?.role !== 'admin') {
    return (
      <EmptyState
        icon={<Users size={36} />}
        title="Students view is restricted"
        description="Only teachers and admins can access this page."
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Students</h1>
        <p className="page-subtitle">Monitor learners enrolled in your courses and track completion progress.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="text-2xl font-semibold text-foreground mt-1 inline-flex items-center gap-2">
            <Users size={18} className="text-blue-600" /> {stats.studentCount}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Enrollments</p>
          <p className="text-2xl font-semibold text-foreground mt-1 inline-flex items-center gap-2">
            <BookOpen size={18} className="text-amber-600" /> {stats.totalEnrollments}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Average Progress</p>
          <p className="text-2xl font-semibold text-foreground mt-1 inline-flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-600" /> {stats.avgProgress}%
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Input
                label="Search students"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && loadStudents(search)}
                placeholder="Name or email"
                icon={<Search size={14} />}
              />
            </div>
            <div className="sm:w-64">
              <Select
                label="Course"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
              >
                <option value="all">All courses</option>
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>{course.title}</option>
                ))}
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => loadStudents(search)}>Apply</Button>
          </div>
        </CardHeader>

        <CardBody className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}

          {loading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : students.length === 0 ? (
            <EmptyState
              icon={<Users size={30} />}
              title="No students found"
              description="Students will appear here once they enroll."
            />
          ) : (
            students.map((student) => {
              const averageProgress = student.enrollments.length > 0
                ? Math.round(
                    student.enrollments.reduce((sum, enrollment) => sum + Number(enrollment.progress || 0), 0)
                    / student.enrollments.length
                  )
                : 0;

              return (
                <div key={student._id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={student.name} src={student.avatar} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{student.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {student.level || 'Beginner'} • {Number(student.xp || 0).toLocaleString()} XP
                          {' '}• <span className="inline-flex items-center gap-1"><Flame size={11} /> {Number(student.streak || 0)} day streak</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Avg progress</p>
                      <p className="text-sm font-semibold text-foreground">{averageProgress}%</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {student.enrollments.map((enrollment) => (
                      <span
                        key={`${student._id}-${enrollment.courseId}`}
                        className="badge-pill bg-muted text-muted-foreground"
                        title={`${enrollment.progress}% complete`}
                      >
                        {enrollment.courseTitle} ({enrollment.progress}%)
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
};
