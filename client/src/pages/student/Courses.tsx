import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Card, CardBody, CardHeader, CardFooter,
  Button, Input, Select, StatusBadge, Skeleton, EmptyState, Alert, ProgressBar, toast
} from '@/components/ui';
import {
  Search, Clock, Users, Star, BookOpen, ChevronRight, Award, CheckCircle, IndianRupee,
  ClipboardList, FileText, Plus, Trash2, Upload
} from 'lucide-react';
import type { Assignment, AwardedBadge, Course, Enrollment, Quiz } from '@/types';

const CATEGORIES = ['All', 'Programming', 'Data Science', 'Design', 'Business', 'Mathematics', 'Science', 'Language', 'Other'];
const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const COURSE_DETAIL_TABS = ['overview', 'curriculum', 'assessments', 'reviews'] as const;
type CourseDetailTab = typeof COURSE_DETAIL_TABS[number];

interface QuizQuestionForm {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
}

const createQuizQuestion = (): QuizQuestionForm => ({
  id: Math.random().toString(36).slice(2),
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  points: 1,
});

const parseTabFromSearch = (search: string): CourseDetailTab => {
  const params = new URLSearchParams(search);
  const tab = String(params.get('tab') || '').toLowerCase();
  return COURSE_DETAIL_TABS.includes(tab as CourseDetailTab)
    ? (tab as CourseDetailTab)
    : 'overview';
};

const showAwardedBadgeToasts = (badges: AwardedBadge[] = []) => {
  badges.forEach((badge) => {
    toast(`🏅 Badge earned: ${badge.icon ? `${badge.icon} ` : ''}${badge.name}`, 'success');
  });
};

// ── Course Card ───────────────────────────────────────────────────────────────
const CourseCard: React.FC<{ course: Course }> = ({ course }) => {
  const diffColor: Record<string, string> = {
    Beginner: 'text-emerald-700 bg-emerald-50',
    Intermediate: 'text-blue-700 bg-blue-50',
    Advanced: 'text-purple-700 bg-purple-50',
  };
  return (
    <Link to={`/courses/${course._id}`}>
      <Card className="h-full flex flex-col hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
        <div className="h-36 bg-gradient-to-br from-slate-800 to-slate-900 rounded-t-xl flex items-center justify-center relative overflow-hidden">
          {course.banner || course.thumbnail ? (
            <>
              <img
                src={course.banner || course.thumbnail}
                alt={course.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-950/40" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(38,92%,50%) 0%, transparent 60%)'
              }} />
              <span className="text-4xl relative z-10">{course.category === 'Programming' ? '💻' : course.category === 'Data Science' ? '📊' : course.category === 'Design' ? '🎨' : course.category === 'Business' ? '📈' : course.category === 'Mathematics' ? '📐' : '📚'}</span>
            </>
          )}
          <div className={`absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full ${diffColor[course.difficulty] || 'bg-muted text-muted-foreground'}`}>
            {course.difficulty}
          </div>
          <div className="absolute top-3 left-3 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/90 text-slate-900">
            {course.price > 0 ? `INR ${course.price.toFixed(2)}` : 'Free'}
          </div>
        </div>
        <CardBody className="flex-1 flex flex-col gap-2 py-4">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{course.category}</span>
          <h3 className="font-sans text-sm font-semibold text-foreground leading-snug line-clamp-2">{course.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{course.description}</p>
          <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
            <IndianRupee size={14} className="text-amber-600" />
            {course.price > 0 ? course.price.toFixed(2) : 'Free'}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><Users size={12} /> {course.enrollmentCount.toLocaleString()}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {course.duration}h</span>
            <span className="flex items-center gap-1 text-amber-600"><Star size={12} fill="currentColor" /> {course.rating.toFixed(1)}</span>
          </div>
        </CardBody>
        <CardFooter className="py-3">
          <div className="flex items-center gap-2 w-full">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(course.instructor?.name || 'Instructor')}&size=24&background=1e293b&color=fff`}
              alt="" className="h-6 w-6 rounded-full" />
            <span className="text-xs text-muted-foreground truncate">{course.instructor?.name}</span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};

// ── Course Catalog ────────────────────────────────────────────────────────────
export const CourseCatalog: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchCourses = async (
    page = 1,
    overrides?: { search?: string; category?: string; difficulty?: string }
  ) => {
    setLoading(true);
    try {
      const activeSearch = String(overrides?.search ?? search).trim();
      const activeCategory = overrides?.category ?? category;
      const activeDifficulty = overrides?.difficulty ?? difficulty;
      const params: Record<string, string> = { page: String(page), limit: '12' };
      if (activeSearch) params.search = activeSearch;
      if (activeCategory !== 'All') params.category = activeCategory;
      if (activeDifficulty !== 'All') params.difficulty = activeDifficulty;

      const { data } = await api.get('/courses', { params });
      setCourses(data.courses);
      setPagination(data.pagination);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, [category, difficulty]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchCourses(); };

  const clearFilters = () => {
    setSearch('');
    setCategory('All');
    setDifficulty('All');
    fetchCourses(1, { search: '', category: 'All', difficulty: 'All' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Course Catalog</h1>
        <p className="page-subtitle">{pagination.total} courses available across all disciplines</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input placeholder="Search courses…" icon={<Search size={16} />} value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <Button type="submit" variant="outline"><Search size={16} /></Button>
        </form>
        <Select value={category} onChange={e => setCategory(e.target.value)} className="sm:w-44">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </Select>
        <Select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="sm:w-40">
          {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState icon={<BookOpen size={40} />} title="No courses found" description="Try adjusting your filters" action={<Button onClick={clearFilters} variant="outline">Clear Filters</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {courses.map(c => <CourseCard key={c._id} course={c} />)}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page === 1} onClick={() => fetchCourses(pagination.page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.pages}</span>
          <Button variant="outline" size="sm" disabled={pagination.page === pagination.pages} onClick={() => fetchCourses(pagination.page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};

// ── Course Detail ─────────────────────────────────────────────────────────────
export const CourseDetail: React.FC = () => {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollment, setEnrollment] = useState<Pick<Enrollment, 'progress' | 'completedLessons' | 'completedAt'> | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [uploadingAssignmentFiles, setUploadingAssignmentFiles] = useState(false);
  const [submittingAssignmentId, setSubmittingAssignmentId] = useState<string | null>(null);
  const [progressingLessonId, setProgressingLessonId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<CourseDetailTab>(() => parseTabFromSearch(location.search));
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    maxScore: '100',
    xpReward: '100',
    attachments: [] as string[],
  });
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    timeLimit: '30',
    passingScore: '70',
    xpReward: '50',
    isPublished: true,
    questions: [createQuizQuestion()],
  });

  useEffect(() => {
    api.get(`/courses/${id}`).then(r => {
      setCourse(r.data.course);
      setIsEnrolled(Boolean(r.data.isEnrolled));
      setEnrollment(r.data.enrollment || null);
    }).catch(() => navigate('/courses')).finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    const tabFromUrl = parseTabFromSearch(location.search);
    setActiveTab(tabFromUrl);
  }, [location.search]);

  useEffect(() => {
    if (activeTab !== 'assessments') return;

    const targetId = String(location.hash || '').replace('#', '').trim();
    if (!targetId) return;

    const timer = window.setTimeout(() => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 140);

    return () => window.clearTimeout(timer);
  }, [activeTab, location.hash, assignments.length, quizzes.length]);

  const completedLessonIds = useMemo(
    () => new Set((enrollment?.completedLessons || []).map((lessonId) => String(lessonId))),
    [enrollment?.completedLessons]
  );

  const studentCanTrackProgress = Boolean(user && user.role === 'student' && isEnrolled);
  const teacherCanManageCourse = Boolean(
    user && course && (
      user.role === 'admin' ||
      (user.role === 'teacher' && String(course.instructor?._id || '') === String(user._id))
    )
  );

  useEffect(() => {
    if (!id || !user) return;
    if (user.role === 'student' && !isEnrolled) {
      setAssignments([]);
      setQuizzes([]);
      setMySubmissions({});
      return;
    }

    const loadAssessments = async () => {
      setLoadingAssessments(true);
      try {
        const [assignmentsResult, quizzesResult] = await Promise.allSettled([
          api.get(`/assignments/course/${id}`),
          api.get(`/quizzes/course/${id}`),
        ]);

        if (assignmentsResult.status === 'fulfilled') {
          setAssignments(assignmentsResult.value.data.assignments || []);
        } else {
          setAssignments([]);
        }

        if (quizzesResult.status === 'fulfilled') {
          setQuizzes(quizzesResult.value.data.quizzes || []);
        } else {
          setQuizzes([]);
        }

        if (user.role === 'student') {
          const { data } = await api.get(`/assignments/course/${id}/my-submissions`);
          const submittedMap: Record<string, boolean> = {};
          (data.submissions || []).forEach((submission: { assignment: string | { _id: string } }) => {
            const assignmentId = typeof submission.assignment === 'string'
              ? submission.assignment
              : submission.assignment?._id;
            if (assignmentId) submittedMap[String(assignmentId)] = true;
          });
          setMySubmissions(submittedMap);
        }
      } catch {
        if (user.role === 'student' && isEnrolled) {
          toast('Could not load assignments or quizzes right now.', 'error');
        }
      } finally {
        setLoadingAssessments(false);
      }
    };

    loadAssessments();
  }, [id, isEnrolled, user]);

  const handleEnroll = async () => {
    if (!user) { navigate('/login'); return; }
    setEnrolling(true); setError('');
    try {
      const { data } = await api.post(`/courses/${id}/enroll`);
      setIsEnrolled(true);
      setEnrollment(data.enrollment || {
        progress: 0,
        completedLessons: [],
        completedAt: null,
      });

      const awardedBadges = Array.isArray(data.awardedBadges) ? data.awardedBadges : [];
      showAwardedBadgeToasts(awardedBadges);
      if (awardedBadges.length > 0) {
        await refreshUser();
      }

      toast('Successfully enrolled!', 'success');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Enrollment failed');
    } finally { setEnrolling(false); }
  };

  const handleMarkLessonComplete = async (lessonId: string, lessonTitle: string) => {
    if (!id || !studentCanTrackProgress) return;

    setProgressingLessonId(lessonId);
    setError('');

    try {
      const { data } = await api.post(`/courses/${id}/progress`, { lessonId });
      if (data?.enrollment) {
        setEnrollment(data.enrollment);
      }

      const awardedBadges = Array.isArray(data?.awardedBadges) ? data.awardedBadges : [];
      showAwardedBadgeToasts(awardedBadges);
      if (awardedBadges.length > 0) {
        await refreshUser();
      }

      toast(`Progress updated for "${lessonTitle}".`, 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Could not update progress right now.');
    } finally {
      setProgressingLessonId(null);
    }
  };

  const uploadAssignmentFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    setUploadingAssignmentFiles(true);
    try {
      const { data } = await api.post('/assignments/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const urls = Array.isArray(data.urls) ? data.urls : [];
      setAssignmentForm((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...urls],
      }));

      toast(`${urls.length} file(s) uploaded.`, 'success');
    } catch {
      toast('Could not upload assignment files.', 'error');
    } finally {
      setUploadingAssignmentFiles(false);
    }
  };

  const removeAssignmentAttachment = (target: string) => {
    setAssignmentForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((item) => item !== target),
    }));
  };

  const handleCreateAssignment = async () => {
    if (!id || !teacherCanManageCourse) return;

    const parsedDueDate = new Date(assignmentForm.dueDate);
    if (!assignmentForm.title.trim() || !assignmentForm.description.trim() || Number.isNaN(parsedDueDate.getTime())) {
      toast('Provide assignment title, description, and valid due date/time.', 'error');
      return;
    }

    setCreatingAssignment(true);
    try {
      const { data } = await api.post('/assignments', {
        course: id,
        title: assignmentForm.title.trim(),
        description: assignmentForm.description.trim(),
        dueDate: parsedDueDate.toISOString(),
        maxScore: Number(assignmentForm.maxScore) || 100,
        xpReward: Number(assignmentForm.xpReward) || 100,
        attachments: assignmentForm.attachments,
      });

      setAssignments((prev) => [data.assignment, ...prev]);
      setAssignmentForm({
        title: '',
        description: '',
        dueDate: '',
        maxScore: '100',
        xpReward: '100',
        attachments: [],
      });

      toast(`Assignment created. ${Number(data.notifiedStudents) || 0} students notified.`, 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Could not create assignment.', 'error');
    } finally {
      setCreatingAssignment(false);
    }
  };

  const addQuizQuestion = () => {
    setQuizForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createQuizQuestion()],
    }));
  };

  const removeQuizQuestion = (questionId: string) => {
    setQuizForm((prev) => ({
      ...prev,
      questions: prev.questions.length <= 1
        ? prev.questions
        : prev.questions.filter((question) => question.id !== questionId),
    }));
  };

  const updateQuizQuestion = (questionId: string, patch: Partial<QuizQuestionForm>) => {
    setQuizForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => (
        question.id === questionId ? { ...question, ...patch } : question
      )),
    }));
  };

  const updateQuizOption = (questionId: string, optionIndex: number, value: string) => {
    setQuizForm((prev) => ({
      ...prev,
      questions: prev.questions.map((question) => {
        if (question.id !== questionId) return question;
        const options = [...question.options];
        options[optionIndex] = value;
        return { ...question, options };
      }),
    }));
  };

  const handleCreateQuiz = async () => {
    if (!id || !teacherCanManageCourse) return;

    const normalizedQuestions = quizForm.questions
      .map((question) => ({
        text: question.text.trim(),
        options: question.options.map((option) => option.trim()).filter(Boolean),
        correctIndex: Number(question.correctIndex),
        explanation: question.explanation.trim(),
        points: Number(question.points) > 0 ? Number(question.points) : 1,
      }))
      .filter((question) => question.text && question.options.length >= 2 && question.correctIndex >= 0 && question.correctIndex < question.options.length);

    if (!quizForm.title.trim() || normalizedQuestions.length === 0) {
      toast('Provide quiz title and at least one valid question.', 'error');
      return;
    }

    setCreatingQuiz(true);
    try {
      const { data } = await api.post('/quizzes', {
        course: id,
        title: quizForm.title.trim(),
        description: quizForm.description.trim(),
        timeLimit: Number(quizForm.timeLimit) || 30,
        passingScore: Number(quizForm.passingScore) || 70,
        xpReward: Number(quizForm.xpReward) || 50,
        isPublished: quizForm.isPublished,
        questions: normalizedQuestions,
      });

      setQuizzes((prev) => [data.quiz, ...prev]);
      setQuizForm({
        title: '',
        description: '',
        timeLimit: '30',
        passingScore: '70',
        xpReward: '50',
        isPublished: true,
        questions: [createQuizQuestion()],
      });

      toast(`Quiz created. ${Number(data.notifiedStudents) || 0} students notified.`, 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Could not create quiz.', 'error');
    } finally {
      setCreatingQuiz(false);
    }
  };

  const handleSubmitAssignment = async (assignment: Assignment) => {
    if (!user || user.role !== 'student') return;

    const content = String(assignmentDrafts[assignment._id] || '').trim();
    if (!content) {
      toast('Please add submission details before submitting.', 'error');
      return;
    }

    setSubmittingAssignmentId(assignment._id);
    try {
      await api.post(`/assignments/${assignment._id}/submit`, { content });
      setMySubmissions((prev) => ({ ...prev, [assignment._id]: true }));
      setAssignmentDrafts((prev) => ({ ...prev, [assignment._id]: '' }));
      toast('Assignment submitted successfully.', 'success');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Could not submit assignment.', 'error');
    } finally {
      setSubmittingAssignmentId(null);
    }
  };

  const isAssignmentClosed = (assignment: Assignment) => {
    if (assignment.isClosed !== undefined) return Boolean(assignment.isClosed);
    return new Date(assignment.dueDate).getTime() < Date.now();
  };

  const scrollToAssessmentForm = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!course) return null;

  const hasModules = Array.isArray(course.modules) && course.modules.length > 0;
  const hasCurriculum = Array.isArray(course.curriculum) && course.curriculum.length > 0;
  const priceLabel = course.price > 0 ? `Enroll Now - INR ${course.price.toFixed(2)}` : 'Enroll Now - Free';

  const tabs = COURSE_DETAIL_TABS;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
        {(course.banner || course.thumbnail) && (
          <>
            <img
              src={course.banner || course.thumbnail}
              alt={course.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/65" />
          </>
        )}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 70%)'
        }} />
        <div className="relative z-10 max-w-2xl">
          <div className="flex gap-2 mb-3">
            <StatusBadge status={course.difficulty} />
            <span className="badge-pill bg-white/10 text-white/80">{course.category}</span>
            <span className="badge-pill bg-amber-400/90 text-slate-900 font-semibold">
              {course.price > 0 ? `INR ${course.price.toFixed(2)}` : 'Free'}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-normal text-white mb-3">{course.title}</h1>
          <p className="text-sm text-white/70 mb-5">{course.description}</p>
          <div className="flex items-center gap-5 text-sm text-white/70">
            <span className="flex items-center gap-1.5"><Users size={14} /> {course.enrollmentCount.toLocaleString()} students</span>
            <span className="flex items-center gap-1.5"><Clock size={14} /> {course.duration}h total</span>
            <span className="flex items-center gap-1.5 text-amber-400"><Star size={14} fill="currentColor" /> {course.rating.toFixed(1)} ({course.ratingCount})</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(course.instructor?.name || '')}&background=f59e0b&color=111&size=32`} className="h-8 w-8 rounded-full" alt="" />
            <span className="text-sm text-white/80">by <strong className="text-white">{course.instructor?.name}</strong></span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-5">
              {!!course.content && (
                <Card>
                  <CardHeader><h3 className="font-sans text-sm font-semibold">Course Content</h3></CardHeader>
                  <CardBody>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{course.content}</p>
                  </CardBody>
                </Card>
              )}

              {course.objectives?.length > 0 && (
                <Card>
                  <CardHeader><h3 className="font-sans text-sm font-semibold">What you'll learn</h3></CardHeader>
                  <CardBody>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {course.objectives.map((o, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm"><CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" /><span>{o}</span></div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}
              {course.prerequisites?.length > 0 && (
                <Card>
                  <CardHeader><h3 className="font-sans text-sm font-semibold">Prerequisites</h3></CardHeader>
                  <CardBody>
                    <ul className="space-y-1">{course.prerequisites.map((p, i) => <li key={i} className="text-sm text-muted-foreground flex items-center gap-2"><ChevronRight size={14} />{p}</li>)}</ul>
                  </CardBody>
                </Card>
              )}
              {course.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {course.tags.map(t => <span key={t} className="badge-pill bg-muted text-muted-foreground">{t}</span>)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'curriculum' && (
            <div className="space-y-3">
              {studentCanTrackProgress && (
                <Card>
                  <CardHeader className="py-3">
                    <h3 className="text-sm font-semibold text-foreground">Your Progress</h3>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{enrollment?.completedLessons?.length || 0} items completed</span>
                      <span>{enrollment?.progress || 0}%</span>
                    </div>
                    <ProgressBar value={enrollment?.progress || 0} />
                  </CardBody>
                </Card>
              )}

              {hasModules &&
                course.modules?.map((mod, mi) => (
                  <Card key={mod._id}>
                    <CardHeader className="py-3">
                      <h3 className="text-sm font-semibold text-foreground">Module {mi + 1}: {mod.title}</h3>
                    </CardHeader>
                    <CardBody className="py-2">
                      {mod.lessons.map((lesson, li) => (
                        <div key={lesson._id} className="flex items-center gap-3 py-2 border-b last:border-0 border-border/50">
                          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">{mi + 1}.{li + 1}</div>
                          <span className="text-sm flex-1">{lesson.title}</span>
                          {lesson.duration && <span className="text-xs text-muted-foreground">{lesson.duration}m</span>}

                          {studentCanTrackProgress && (() => {
                            const lessonKey = String(lesson._id || `${mod._id || mi}-lesson-${li + 1}`);
                            const completed = completedLessonIds.has(lessonKey);

                            return (
                              <Button
                                type="button"
                                size="sm"
                                variant={completed ? 'outline' : 'secondary'}
                                loading={progressingLessonId === lessonKey}
                                disabled={completed}
                                onClick={() => handleMarkLessonComplete(lessonKey, lesson.title)}
                              >
                                {completed ? 'Completed' : 'Mark Complete'}
                              </Button>
                            );
                          })()}
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                ))}

              {!hasModules && hasCurriculum && (
                <Card>
                  <CardHeader className="py-3">
                    <h3 className="text-sm font-semibold text-foreground">Chapter-wise Course Context</h3>
                  </CardHeader>
                  <CardBody className="py-2">
                    {course.curriculum
                      ?.sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((item, index) => (
                        <div key={item._id || `${item.title}-${index}`} className="py-2 border-b last:border-0 border-border/50">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium text-foreground flex-1">{index + 1}. {item.title}</div>

                            {studentCanTrackProgress && (() => {
                              const chapterKey = String(item._id || `chapter-${index + 1}-${item.title}`);
                              const completed = completedLessonIds.has(chapterKey);

                              return (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={completed ? 'outline' : 'secondary'}
                                  loading={progressingLessonId === chapterKey}
                                  disabled={completed}
                                  onClick={() => handleMarkLessonComplete(chapterKey, item.title)}
                                >
                                  {completed ? 'Completed' : 'Mark Complete'}
                                </Button>
                              );
                            })()}
                          </div>

                          {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                        </div>
                      ))}
                  </CardBody>
                </Card>
              )}

              {!hasModules && !hasCurriculum && (
                <EmptyState icon={<BookOpen size={32} />} title="Curriculum coming soon" description="The instructor is still adding content" />
              )}
            </div>
          )}

          {activeTab === 'assessments' && (
            <div className="space-y-4">
              {teacherCanManageCourse && (
                <Card>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Create Assessments</p>
                      <p className="text-xs text-muted-foreground">Use quick actions to jump directly to assignment or quiz creation.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="button" size="sm" variant="secondary" onClick={() => scrollToAssessmentForm('create-assignment')}>
                        Create Assignment
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => scrollToAssessmentForm('create-quiz')}>
                        Create Quiz
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

              {loadingAssessments ? (
                <>
                  <Skeleton className="h-40" />
                  <Skeleton className="h-40" />
                </>
              ) : (
                <>
                  <Card>
                    <CardHeader className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                        <FileText size={14} /> Assignments
                      </h3>
                      <span className="text-xs text-muted-foreground">{assignments.length} total</span>
                    </CardHeader>
                    <CardBody className="space-y-3">
                      {assignments.length === 0 ? (
                        <EmptyState icon={<FileText size={26} />} title="No assignments yet" description="Assignments will appear here once published." />
                      ) : assignments.map((assignment) => {
                        const closed = isAssignmentClosed(assignment);
                        const submitted = Boolean(mySubmissions[assignment._id]);

                        return (
                          <div key={assignment._id} className="rounded-lg border border-border p-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">{assignment.title}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground">
                                  Due {new Date(assignment.dueDate).toLocaleString()}
                                </span>
                                <StatusBadge status={closed ? 'returned' : 'submitted'} className={closed ? '' : 'bg-emerald-100 text-emerald-800'} />
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">{assignment.description}</p>

                            {Array.isArray(assignment.attachments) && assignment.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {assignment.attachments.map((url) => (
                                  <a
                                    key={url}
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-medium text-primary hover:underline"
                                  >
                                    Attachment
                                  </a>
                                ))}
                              </div>
                            )}

                            {user?.role === 'student' && isEnrolled && (
                              <div className="pt-1 space-y-2">
                                {submitted ? (
                                  <Alert variant="success">Assignment submitted.</Alert>
                                ) : closed ? (
                                  <Alert variant="warning">Submission closed (deadline passed).</Alert>
                                ) : (
                                  <>
                                    <textarea
                                      rows={3}
                                      placeholder="Add your answer / submission details"
                                      value={assignmentDrafts[assignment._id] || ''}
                                      onChange={(event) => setAssignmentDrafts((prev) => ({
                                        ...prev,
                                        [assignment._id]: event.target.value,
                                      }))}
                                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      loading={submittingAssignmentId === assignment._id}
                                      onClick={() => handleSubmitAssignment(assignment)}
                                    >
                                      Submit Assignment
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground inline-flex items-center gap-2">
                        <ClipboardList size={14} /> Quizzes
                      </h3>
                      <span className="text-xs text-muted-foreground">{quizzes.length} total</span>
                    </CardHeader>
                    <CardBody className="space-y-2">
                      {quizzes.length === 0 ? (
                        <EmptyState icon={<ClipboardList size={26} />} title="No quizzes yet" description="Published quizzes will appear here." />
                      ) : quizzes.map((quiz) => (
                        <div key={quiz._id} className="rounded-lg border border-border p-3 flex flex-wrap items-center gap-3">
                          <div className="flex-1 min-w-[210px]">
                            <p className="text-sm font-medium text-foreground">{quiz.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {quiz.questions.length} questions · {quiz.timeLimit} min · pass {quiz.passingScore}% · +{quiz.xpReward} XP
                            </p>
                          </div>

                          {user?.role === 'student' && isEnrolled && (
                            <Link to={`/quizzes/${quiz._id}`}>
                              <Button size="sm" variant="secondary">Start Quiz</Button>
                            </Link>
                          )}

                          {(user?.role === 'teacher' || user?.role === 'admin') && (
                            <StatusBadge status={quiz.isPublished ? 'published' : 'draft'} />
                          )}
                        </div>
                      ))}
                    </CardBody>
                  </Card>

                  {teacherCanManageCourse && (
                    <>
                      <div id="create-assignment">
                        <Card>
                          <CardHeader>
                            <h3 className="text-sm font-semibold text-foreground">Create Assignment</h3>
                          </CardHeader>
                          <CardBody className="space-y-3">
                            <Input
                              label="Assignment title"
                              value={assignmentForm.title}
                              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, title: event.target.value }))}
                              placeholder="e.g. Build REST API"
                            />
                            <textarea
                              rows={4}
                              value={assignmentForm.description}
                              onChange={(event) => setAssignmentForm((prev) => ({ ...prev, description: event.target.value }))}
                              placeholder="Assignment instructions"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                            />

                            <div className="grid sm:grid-cols-3 gap-3">
                              <Input
                                label="Due date/time"
                                type="datetime-local"
                                value={assignmentForm.dueDate}
                                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                              />
                              <Input
                                label="Max score"
                                type="number"
                                value={assignmentForm.maxScore}
                                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, maxScore: event.target.value }))}
                              />
                              <Input
                                label="XP reward"
                                type="number"
                                value={assignmentForm.xpReward}
                                onChange={(event) => setAssignmentForm((prev) => ({ ...prev, xpReward: event.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="file"
                                  multiple
                                  onChange={(event) => uploadAssignmentFiles(event.target.files)}
                                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                                />
                                <Button type="button" size="sm" variant="outline" loading={uploadingAssignmentFiles} className="shrink-0">
                                  <Upload size={12} /> Upload
                                </Button>
                              </div>

                              {assignmentForm.attachments.length > 0 && (
                                <div className="space-y-1">
                                  {assignmentForm.attachments.map((url) => (
                                    <div key={url} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
                                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate">
                                        {url.split('/').pop() || 'Attachment'}
                                      </a>
                                      <button type="button" className="text-xs text-destructive" onClick={() => removeAssignmentAttachment(url)}>
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <Button type="button" variant="secondary" loading={creatingAssignment} onClick={handleCreateAssignment}>
                              Create Assignment
                            </Button>
                          </CardBody>
                        </Card>
                      </div>

                      <div id="create-quiz">
                        <Card>
                          <CardHeader className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">Create Quiz</h3>
                            <Button type="button" size="sm" variant="outline" onClick={addQuizQuestion}>
                              <Plus size={12} /> Add Question
                            </Button>
                          </CardHeader>
                          <CardBody className="space-y-3">
                            <Input
                              label="Quiz title"
                              value={quizForm.title}
                              onChange={(event) => setQuizForm((prev) => ({ ...prev, title: event.target.value }))}
                              placeholder="e.g. Module 1 Quiz"
                            />
                            <textarea
                              rows={3}
                              value={quizForm.description}
                              onChange={(event) => setQuizForm((prev) => ({ ...prev, description: event.target.value }))}
                              placeholder="Quiz description"
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
                            />

                            <div className="grid sm:grid-cols-4 gap-3">
                              <Input
                                label="Time (min)"
                                type="number"
                                value={quizForm.timeLimit}
                                onChange={(event) => setQuizForm((prev) => ({ ...prev, timeLimit: event.target.value }))}
                              />
                              <Input
                                label="Pass (%)"
                                type="number"
                                value={quizForm.passingScore}
                                onChange={(event) => setQuizForm((prev) => ({ ...prev, passingScore: event.target.value }))}
                              />
                              <Input
                                label="XP reward"
                                type="number"
                                value={quizForm.xpReward}
                                onChange={(event) => setQuizForm((prev) => ({ ...prev, xpReward: event.target.value }))}
                              />
                              <label className="inline-flex items-center gap-2 mt-6 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={quizForm.isPublished}
                                  onChange={(event) => setQuizForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
                                />
                                Publish now
                              </label>
                            </div>

                            {quizForm.questions.map((question, index) => (
                              <div key={question.id} className="rounded-lg border border-border p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-muted-foreground">Question {index + 1}</p>
                                  <button
                                    type="button"
                                    className="text-xs text-destructive inline-flex items-center gap-1"
                                    onClick={() => removeQuizQuestion(question.id)}
                                  >
                                    <Trash2 size={12} /> Remove
                                  </button>
                                </div>

                                <Input
                                  value={question.text}
                                  onChange={(event) => updateQuizQuestion(question.id, { text: event.target.value })}
                                  placeholder="Question text"
                                />

                                <div className="grid sm:grid-cols-2 gap-2">
                                  {question.options.map((option, optionIndex) => (
                                    <Input
                                      key={`${question.id}-option-${optionIndex}`}
                                      value={option}
                                      onChange={(event) => updateQuizOption(question.id, optionIndex, event.target.value)}
                                      placeholder={`Option ${optionIndex + 1}`}
                                    />
                                  ))}
                                </div>

                                <div className="grid sm:grid-cols-3 gap-2">
                                  <Select
                                    value={String(question.correctIndex)}
                                    onChange={(event) => updateQuizQuestion(question.id, { correctIndex: Number(event.target.value) })}
                                  >
                                    {question.options.map((_, optionIndex) => (
                                      <option key={`${question.id}-correct-${optionIndex}`} value={optionIndex}>
                                        Correct: Option {optionIndex + 1}
                                      </option>
                                    ))}
                                  </Select>
                                  <Input
                                    type="number"
                                    value={String(question.points)}
                                    onChange={(event) => updateQuizQuestion(question.id, { points: Number(event.target.value) || 1 })}
                                    placeholder="Points"
                                  />
                                  <Input
                                    value={question.explanation}
                                    onChange={(event) => updateQuizQuestion(question.id, { explanation: event.target.value })}
                                    placeholder="Explanation (optional)"
                                  />
                                </div>
                              </div>
                            ))}

                            <Button type="button" variant="secondary" loading={creatingQuiz} onClick={handleCreateQuiz}>
                              Create Quiz
                            </Button>
                          </CardBody>
                        </Card>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <EmptyState icon={<Star size={36} />} title="No reviews yet" description="Be the first to review this course after completing it" />
          )}
        </div>

        {/* Sidebar — enrollment */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardBody className="space-y-4">
              {error && <Alert variant="error">{error}</Alert>}
              {isEnrolled ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                    <CheckCircle size={16} /> Enrolled
                  </div>

                  {studentCanTrackProgress && (
                    <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Course progress</span>
                        <span>{enrollment?.progress || 0}%</span>
                      </div>
                      <ProgressBar value={enrollment?.progress || 0} />
                    </div>
                  )}

                  <Link to={`/courses/${course._id}/learn`}>
                    <Button className="w-full" variant="secondary">Continue Learning</Button>
                  </Link>
                </div>
              ) : (
                <Button className="w-full" onClick={handleEnroll} loading={enrolling} disabled={!user || user.role !== 'student'}>
                  {!user ? 'Login to Enroll' : user.role !== 'student' ? 'Students Only' : priceLabel}
                </Button>
              )}

              <div className="space-y-2 text-sm">
                {[
                  { icon: <Clock size={14} />, text: `${course.duration} hours of content` },
                  { icon: <IndianRupee size={14} />, text: course.price > 0 ? `Course price: INR ${course.price.toFixed(2)}` : 'Course price: Free' },
                  { icon: <BookOpen size={14} />, text: `${course.modules?.reduce((a, m) => a + m.lessons.length, 0) || 0} lessons` },
                  { icon: <Award size={14} />, text: 'Certificate on completion' },
                  { icon: <Users size={14} />, text: `${course.enrollmentCount.toLocaleString()} enrolled` },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-muted-foreground">
                    {item.icon} {item.text}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
