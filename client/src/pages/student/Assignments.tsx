import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader, Button, EmptyState, Skeleton } from '@/components/ui';
import { BookOpen, ClipboardList, FileText, ArrowRight } from 'lucide-react';
import type { Course } from '@/types';

interface CourseStub {
  _id: string;
  title: string;
  category?: string;
}

const useCourseList = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseStub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setCourses([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const endpoint = user.role === 'student' ? '/courses/enrolled' : '/courses/my-courses';
        const { data } = await api.get(endpoint);

        if (Array.isArray(data.enrollments)) {
          setCourses(
            data.enrollments
              .map((enrollment: { course: Course }) => enrollment.course)
              .filter(Boolean)
              .map((course: Course) => ({
                _id: course._id,
                title: course.title,
                category: course.category,
              }))
          );
        } else {
          setCourses((data.courses || []).map((course: Course) => ({
            _id: course._id,
            title: course.title,
            category: course.category,
          })));
        }
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  return { courses, loading };
};

const CourseAccessGrid: React.FC<{ mode: 'assignment' | 'quiz' }> = ({ mode }) => {
  const { user } = useAuth();
  const { courses, loading } = useCourseList();
  const canCreateAssessments = user?.role === 'teacher' || user?.role === 'admin';

  const title = mode === 'assignment' ? 'Assignments' : 'Quizzes';
  const subtitle = canCreateAssessments
    ? 'Pick a course to create and manage assignments or quizzes.'
    : mode === 'assignment'
      ? 'Open a course to submit, review, and manage assignments.'
      : 'Open a course to take or manage quizzes.';

  const emptyDescription = user?.role === 'student'
    ? 'Enroll in courses to access assessments.'
    : 'Create a course first to start publishing assessments.';

  const icon = mode === 'assignment' ? <FileText size={34} /> : <ClipboardList size={34} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-normal">Choose Course</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {Array(4).fill(0).map((_, index) => <Skeleton key={index} className="h-20" />)}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} description={emptyDescription} />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {courses.map((course) => (
                <div key={course._id} className="rounded-lg border border-border p-3 flex items-center gap-3 flex-wrap">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{course.title}</p>
                    <p className="text-xs text-muted-foreground">{course.category || 'General'}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {canCreateAssessments && (
                      <>
                        <Link to={`/courses/${course._id}?tab=assessments#create-assignment`}>
                          <Button size="sm" variant={mode === 'assignment' ? 'secondary' : 'outline'}>
                            Create Assignment
                          </Button>
                        </Link>
                        <Link to={`/courses/${course._id}?tab=assessments#create-quiz`}>
                          <Button size="sm" variant={mode === 'quiz' ? 'secondary' : 'outline'}>
                            Create Quiz
                          </Button>
                        </Link>
                      </>
                    )}

                    <Link to={`/courses/${course._id}?tab=assessments`}>
                      <Button size="sm" variant="outline" className="gap-1">
                        Open <ArrowRight size={12} />
                      </Button>
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

export const AssignmentsHubPage: React.FC = () => <CourseAccessGrid mode="assignment" />;

export const QuizzesHubPage: React.FC = () => <CourseAccessGrid mode="quiz" />;
