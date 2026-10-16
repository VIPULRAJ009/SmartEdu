import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Textarea,
  toast,
} from '@/components/ui';
import {
  CalendarClock,
  Clock3,
  PlayCircle,
  Presentation,
  Radio,
  StopCircle,
  Users,
  Video,
} from 'lucide-react';
import type { Course, LiveClass } from '@/types';

const extractCourses = (payload: unknown): Course[] => {
  const data = payload as { enrollments?: { course?: Course }[]; courses?: Course[] };

  if (Array.isArray(data.enrollments)) {
    return data.enrollments
      .map((enrollment) => enrollment.course)
      .filter((course): course is Course => Boolean(course));
  }

  return Array.isArray(data.courses) ? data.courses : [];
};

const toLocalDatetimeValue = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const statusTone = (status: LiveClass['status']) => {
  if (status === 'live') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'scheduled') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'completed') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
};

export const LiveClassPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState('');
  const [topic, setTopic] = useState('');
  const [agenda, setAgenda] = useState('');
  const [scheduledAt, setScheduledAt] = useState(toLocalDatetimeValue(new Date(Date.now() + 30 * 60000)));
  const [durationMinutes, setDurationMinutes] = useState('45');

  const [scheduling, setScheduling] = useState(false);
  const [startingId, setStartingId] = useState('');
  const [endingId, setEndingId] = useState('');
  const [joiningId, setJoiningId] = useState('');

  const fetchCourses = useCallback(async () => {
    if (!user) {
      setLoadingCourses(false);
      return;
    }

    setLoadingCourses(true);
    try {
      const endpoint = user.role === 'student' ? '/courses/enrolled' : '/courses/my-courses';
      const { data } = await api.get(endpoint);
      const list = extractCourses(data);
      setCourses(list);

      if (!selectedCourse && list.length > 0) {
        setSelectedCourse(list[0]._id);
      }
    } catch {
      setCourses([]);
      toast('Unable to load courses.', 'error');
    } finally {
      setLoadingCourses(false);
    }
  }, [selectedCourse, user]);

  const fetchClasses = useCallback(async (silently = false) => {
    if (!silently) setLoadingClasses(true);

    try {
      const { data } = await api.get('/live-classes');
      const incoming = Array.isArray(data.classes) ? data.classes : [];
      setClasses(
        incoming
          .slice()
          .sort((a: LiveClass, b: LiveClass) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      );
    } catch {
      if (!silently) toast('Unable to load live classes.', 'error');
      setClasses([]);
    } finally {
      if (!silently) setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    fetchClasses();
    const intervalId = window.setInterval(() => fetchClasses(true), 20000);
    return () => window.clearInterval(intervalId);
  }, [fetchClasses]);

  useEffect(() => {
    const classId = searchParams.get('classId');
    if (!classId) return;
    navigate(`/live-class/room/${classId}`, { replace: true });
  }, [navigate, searchParams]);

  const scheduleClass = async () => {
    if (!isTeacher) {
      toast('Only teachers can schedule classes.', 'error');
      return;
    }

    if (!selectedCourse) {
      toast('Please select a course first.', 'error');
      return;
    }

    if (!topic.trim()) {
      toast('Please enter a class topic.', 'error');
      return;
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      toast('Please choose a valid date and time.', 'error');
      return;
    }

    setScheduling(true);
    try {
      const { data } = await api.post('/live-classes/schedule', {
        courseId: selectedCourse,
        title: topic.trim(),
        agenda: agenda.trim(),
        scheduledAt: scheduledDate.toISOString(),
        durationMinutes: Number(durationMinutes),
      });

      toast(`Class scheduled. ${Number(data.autoRegisteredStudents || 0)} students were auto-registered.`, 'success');

      setTopic('');
      setAgenda('');
      await fetchClasses(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to schedule class.', 'error');
    } finally {
      setScheduling(false);
    }
  };

  const openRoom = (classId: string) => {
    navigate(`/live-class/room/${classId}`);
  };

  const startAndOpenRoom = async (classId: string) => {
    setStartingId(classId);
    try {
      await api.post(`/live-classes/${classId}/start`);
      toast('Class started.', 'success');
      openRoom(classId);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to start class.', 'error');
    } finally {
      setStartingId('');
    }
  };

  const joinAndOpenRoom = async (classId: string) => {
    setJoiningId(classId);
    try {
      await api.post(`/live-classes/${classId}/join`);
      toast('Joining live room.', 'success');
      openRoom(classId);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to join class right now.', 'error');
    } finally {
      setJoiningId('');
    }
  };

  const endClass = async (classId: string) => {
    setEndingId(classId);
    try {
      await api.post(`/live-classes/${classId}/end`);
      toast('Class ended.', 'success');
      await fetchClasses(true);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast(message || 'Unable to end class right now.', 'error');
    } finally {
      setEndingId('');
    }
  };

  const liveCount = useMemo(
    () => classes.filter((item) => item.status === 'live').length,
    [classes]
  );

  const upcomingCount = useMemo(
    () => classes.filter((item) => item.status === 'scheduled').length,
    [classes]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Class Management</h1>
          <p className="page-subtitle">Schedule classes here. Live sessions open in a separate classroom page.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center"><CalendarClock size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{classes.length}</p>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center"><Radio size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{liveCount}</p>
            <p className="text-xs text-muted-foreground">Live Now</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center"><Clock3 size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{upcomingCount}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center"><Users size={18} /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{classes.reduce((sum, item) => sum + (item.registeredCount || 0), 0)}</p>
            <p className="text-xs text-muted-foreground">Registered Learners</p>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[380px_minmax(0,1fr)] gap-4">
        {isTeacher ? (
          <Card>
            <CardHeader>
              <h3 className="font-sans text-sm font-semibold">Schedule A Class</h3>
              <p className="text-xs text-muted-foreground mt-1">Enter details once and students are auto-registered.</p>
            </CardHeader>
            <CardBody className="space-y-3">
              {loadingCourses ? (
                <Skeleton className="h-10 rounded-md" />
              ) : courses.length === 0 ? (
                <Alert variant="warning">Create a course first to schedule classes.</Alert>
              ) : (
                <Select label="Course" value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>{course.title}</option>
                  ))}
                </Select>
              )}

              <Input
                label="Class Topic"
                placeholder="Example: DSA Revision"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />

              <Input
                label="Date & Time"
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />

              <Select
                label="Duration"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              >
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
                <option value="120">120 minutes</option>
              </Select>

              <Textarea
                label="Agenda (optional)"
                rows={4}
                value={agenda}
                onChange={(event) => setAgenda(event.target.value)}
                placeholder="What will be covered in this class?"
              />

              <Button onClick={scheduleClass} loading={scheduling} variant="secondary" className="w-full gap-1">
                <CalendarClock size={14} /> Schedule Class
              </Button>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <h3 className="font-sans text-sm font-semibold">Student View</h3>
            </CardHeader>
            <CardBody className="space-y-2 text-sm text-muted-foreground">
              <p>1. Teacher schedules the class from this page.</p>
              <p>2. When class is live, click Join Live Room.</p>
              <p>3. Classroom opens on a separate page with whiteboard, chat, and roster tabs.</p>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <h3 className="font-sans text-sm font-semibold">Scheduled Classes</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {loadingClasses ? (
              <>
                <Skeleton className="h-20 rounded-lg" />
                <Skeleton className="h-20 rounded-lg" />
              </>
            ) : classes.length === 0 ? (
              <EmptyState
                icon={<Presentation size={30} />}
                title="No classes yet"
                description={isTeacher ? 'Schedule your first class from the form on the left.' : 'Classes scheduled by your teacher will appear here.'}
              />
            ) : (
              classes.map((item) => {
                const canTeacherStart = isTeacher && item.status === 'scheduled';
                const canTeacherEnd = isTeacher && item.status === 'live';
                const canStudentJoin = !isTeacher && item.status === 'live' && item.canJoin;

                return (
                  <div key={item._id} className="rounded-xl border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.course?.title || 'Course'}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-2 grid md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1"><Clock3 size={12} /> {formatDateTime(item.scheduledAt)}</div>
                      <div className="inline-flex items-center gap-1"><Users size={12} /> {item.registeredCount} registered</div>
                      <div className="inline-flex items-center gap-1"><Video size={12} /> {item.joinedCount} present</div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openRoom(item._id)}>Open Room</Button>

                      {canTeacherStart && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => startAndOpenRoom(item._id)}
                          loading={startingId === item._id}
                        >
                          <PlayCircle size={13} /> Start & Open
                        </Button>
                      )}

                      {!canTeacherStart && isTeacher && item.status === 'live' && (
                        <>
                          <Button size="sm" onClick={() => openRoom(item._id)} className="gap-1">
                            <Video size={13} /> Enter Live Room
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => endClass(item._id)}
                            className="gap-1"
                            loading={endingId === item._id}
                          >
                            <StopCircle size={13} /> End Class
                          </Button>
                        </>
                      )}

                      {!canTeacherStart && !canTeacherEnd && isTeacher && (
                        <Button size="sm" variant="outline" onClick={() => openRoom(item._id)}>View Room</Button>
                      )}

                      {canStudentJoin && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => joinAndOpenRoom(item._id)}
                          loading={joiningId === item._id}
                        >
                          <Video size={13} /> Join Live Room
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
