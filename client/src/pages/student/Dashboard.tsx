import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  Card, CardHeader, CardBody, ProgressBar, StatusBadge,
  Skeleton, EmptyState, Button, toast
} from '@/components/ui';
import {
  BookOpen, Trophy, Brain, TrendingUp, Zap,
  Star, ArrowRight, Target, Flame, CalendarClock, Radio, BarChart2
} from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { Enrollment, Skill, Badge, LiveClass } from '@/types';

const LEVEL_XP: Record<string, number> = { Beginner: 500, Intermediate: 2000, Advanced: 5000, Expert: 5000 };

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      const [enrollmentResult, skillResult, badgeResult, liveClassResult] = await Promise.allSettled([
        api.get('/courses/enrolled'),
        api.get('/skills/map'),
        api.get('/badges'),
        api.get('/live-classes'),
      ]);

      if (enrollmentResult.status === 'fulfilled') {
        setEnrollments(enrollmentResult.value.data.enrollments || []);
      } else {
        setEnrollments([]);
      }

      if (skillResult.status === 'fulfilled') {
        setSkills(skillResult.value.data.skills || []);
      } else {
        setSkills([]);
      }

      if (badgeResult.status === 'fulfilled') {
        setBadges(badgeResult.value.data.badges?.filter((badge: Badge) => badge.earned) || []);
      } else {
        setBadges([]);
      }

      if (liveClassResult.status === 'fulfilled') {
        const classes = Array.isArray(liveClassResult.value.data.classes)
          ? liveClassResult.value.data.classes
          : [];

        setLiveClasses(
          classes
            .filter((item: LiveClass) => item.status === 'scheduled' || item.status === 'live')
            .sort((a: LiveClass, b: LiveClass) => (
              new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
            ))
        );
      } else {
        setLiveClasses([]);
      }

      setLoading(false);
    };

    loadDashboard();
  }, []);

  const formatClassTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const radarData = skills.slice(0, 7).map(s => ({
    subject: s.name.length > 12 ? s.name.slice(0, 12) + '…' : s.name,
    value: s.proficiency,
  }));

  const xpToNext = LEVEL_XP[user?.level || 'Beginner'];
  const xpPct = user ? Math.min(100, (user.xp / xpToNext) * 100) : 0;

  const statCards = [
    { label: 'Enrolled Courses', value: enrollments.length, icon: <BookOpen size={20} />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Total XP', value: user?.xp || 0, icon: <Zap size={20} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    { label: 'Badges Earned', value: badges.length, icon: <Star size={20} />, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Day Streak', value: user?.streak || 0, icon: <Flame size={20} />, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Good morning, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Here's where your learning stands today.</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">{user?.level} Level</div>
          <div className="w-48">
            <ProgressBar value={xpPct} color="bg-amber-500" />
            <div className="text-xs text-muted-foreground mt-1">{user?.xp} / {xpToNext} XP</div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) :
          statCards.map(s => (
            <div key={s.label} className="stat-card flex items-center gap-4">
              <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))
        }
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-normal">Live Class Schedule</h2>
            <p className="text-xs text-muted-foreground mt-1">Auto-registered sessions and one-tap join when teacher starts.</p>
          </div>
          <Link to="/live-class">
            <Button variant="ghost" size="sm" className="gap-1">Open studio <ArrowRight size={14} /></Button>
          </Link>
        </CardHeader>
        <CardBody className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          ) : liveClasses.length === 0 ? (
            <EmptyState icon={<CalendarClock size={34} />} title="No live classes yet" description="Your scheduled classes will appear here." />
          ) : (
            liveClasses.slice(0, 4).map((liveClass) => (
              <div key={liveClass._id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-card">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{liveClass.title}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      liveClass.status === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      <Radio size={10} /> {liveClass.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{liveClass.course?.title} · {formatClassTime(liveClass.scheduledAt)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {liveClass.registeredCount} registered · {liveClass.joinedCount} present
                  </p>
                </div>

                <Link to={`/live-class/room/${liveClass._id}`}>
                  <Button size="sm" variant={liveClass.status === 'live' ? 'primary' : 'outline'}>
                    {liveClass.status === 'live' ? 'Join now' : 'Open'}
                  </Button>
                </Link>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      {/* Content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active courses */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-normal">Active Courses</h2>
              <Link to="/courses/enrolled">
                <Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight size={14} /></Button>
              </Link>
            </CardHeader>
            <CardBody className="space-y-4 py-4">
              {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />) :
                enrollments.length === 0 ?
                  <EmptyState icon={<BookOpen size={40} />} title="No courses yet" description="Browse the catalog and enroll to get started"
                    action={<Link to="/courses"><Button size="sm">Browse Courses</Button></Link>} /> :
                  enrollments.slice(0, 4).map(e => {
                    const course = e.course as { title: string; category: string; _id: string; instructor: { name: string } };
                    return (
                      <div key={e._id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {course?.title?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link to={`/courses/${course?._id}`} className="text-sm font-medium text-foreground hover:underline truncate block">{course?.title}</Link>
                          <p className="text-xs text-muted-foreground">{course?.instructor?.name}</p>
                          <ProgressBar value={e.progress} className="mt-1.5" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground shrink-0">{e.progress}%</span>
                      </div>
                    );
                  })
              }
            </CardBody>
          </Card>
        </div>

        {/* Skill radar */}
        <div>
          <Card className="h-full">
            <CardHeader className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-normal">Skill Radar</h2>
              <Link to="/skills">
                <Button variant="ghost" size="sm" className="gap-1"><Brain size={14} /> Analyze</Button>
              </Link>
            </CardHeader>
            <CardBody>
              {loading ? <Skeleton className="h-56" /> :
                radarData.length === 0 ?
                  <EmptyState icon={<Brain size={32} />} title="No skills mapped" description="Run a skill analysis to visualize your profile" /> :
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData} cx="50%" cy="50%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Proficiency']} />
                    </RadarChart>
                  </ResponsiveContainer>
              }
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent badges */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-normal">Recent Badges</h2>
            <Link to="/badges"><Button variant="ghost" size="sm">All badges</Button></Link>
          </CardHeader>
          <CardBody>
            {badges.length === 0 ?
              <EmptyState icon={<Trophy size={32} />} title="No badges yet" description="Complete courses and quizzes to earn badges" /> :
              <div className="grid grid-cols-4 gap-3">
                {badges.slice(0, 8).map(b => (
                  <div key={b._id} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-muted transition-colors cursor-default" title={b.description}>
                    <span className="text-2xl">{b.icon}</span>
                    <span className="text-[10px] text-center text-muted-foreground leading-tight">{b.name}</span>
                  </div>
                ))}
              </div>
            }
          </CardBody>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader><h2 className="font-serif text-lg font-normal">Quick Actions</h2></CardHeader>
          <CardBody className="space-y-2">
            {[
              { label: 'Browse Course Catalog', icon: <BookOpen size={16} />, to: '/courses', desc: 'Explore 240+ courses' },
              { label: 'View Skill Map', icon: <Brain size={16} />, to: '/skills', desc: 'AI-powered skill analysis' },
              { label: 'Check Leaderboard', icon: <Trophy size={16} />, to: '/leaderboard', desc: 'See where you rank' },
              { label: 'Market Trends', icon: <TrendingUp size={16} />, to: '/market', desc: 'In-demand skills this month' },
            ].map(a => (
              <Link key={a.to} to={a.to}>
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group">
                  <div className="h-8 w-8 rounded-md bg-muted group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                    {a.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.desc}</div>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground group-hover:text-foreground" />
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

// Teacher Dashboard
export const TeacherDashboard: React.FC = () => {
  const [courses, setCourses] = useState<{ title: string; _id: string; enrollmentCount: number; isPublished: boolean }[]>([]);
  const [stats, setStats] = useState({ total: 0, published: 0, totalStudents: 0 });
  const [publishingCourseId, setPublishingCourseId] = useState<string | null>(null);
  const [endingCourseId, setEndingCourseId] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateStats = (items: { isPublished: boolean; enrollmentCount: number }[]) => ({
    total: items.length,
    published: items.filter((item) => item.isPublished).length,
    totalStudents: items.reduce((acc, item) => acc + (item.enrollmentCount || 0), 0),
  });

  const replaceCourses = (items: { title: string; _id: string; enrollmentCount: number; isPublished: boolean }[]) => {
    setCourses(items);
    setStats(calculateStats(items));
  };

  useEffect(() => {
    api.get('/courses/my-courses').then(r => {
      const c = r.data.courses || [];
      replaceCourses(c);
    }).finally(() => setLoading(false));
  }, []);

  const publishCourse = async (courseId: string) => {
    setPublishingCourseId(courseId);
    try {
      await api.put(`/courses/${courseId}`, { isPublished: true });

      setCourses((prev) => {
        const updated = prev.map((course) => (
          course._id === courseId ? { ...course, isPublished: true } : course
        ));
        setStats(calculateStats(updated));
        return updated;
      });

      toast('Course published successfully.', 'success');
    } catch {
      toast('Could not publish the course right now.', 'error');
    } finally {
      setPublishingCourseId(null);
    }
  };

  const endCourse = async (courseId: string) => {
    setEndingCourseId(courseId);
    try {
      await api.put(`/courses/${courseId}`, { isPublished: false });

      setCourses((prev) => {
        const updated = prev.map((course) => (
          course._id === courseId ? { ...course, isPublished: false } : course
        ));
        setStats(calculateStats(updated));
        return updated;
      });

      toast('Course ended and moved to draft.', 'success');
    } catch {
      toast('Could not end this course right now.', 'error');
    } finally {
      setEndingCourseId(null);
    }
  };

  const deleteCourse = async (courseId: string, title: string) => {
    const confirmed = window.confirm(`Delete "${title}" permanently? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingCourseId(courseId);
    try {
      await api.delete(`/courses/${courseId}`);

      setCourses((prev) => {
        const updated = prev.filter((course) => course._id !== courseId);
        setStats(calculateStats(updated));
        return updated;
      });

      toast('Course deleted successfully.', 'success');
    } catch {
      toast('Could not delete this course right now.', 'error');
    } finally {
      setDeletingCourseId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Instructor Dashboard</h1>
          <p className="page-subtitle">Manage your courses and track student progress. Drafts stay here until you publish.</p>
        </div>
        <Link to="/courses/new">
          <Button variant="secondary">+ New Course</Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Courses', value: stats.total, icon: <BookOpen size={20} />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Published', value: stats.published, icon: <Target size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Students', value: stats.totalStudents, icon: <Trophy size={20} />, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-4">
            <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-normal">My Courses</h2>
          <Link to="/courses/my-courses"><Button variant="ghost" size="sm">View all</Button></Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Title</th><th>Enrollments</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? Array(3).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={4}><Skeleton className="h-10" /></td></tr>
              )) : courses.map(c => (
                <tr key={c._id}>
                  <td className="font-medium">{c.title}</td>
                  <td>{c.enrollmentCount}</td>
                  <td><StatusBadge status={c.isPublished ? 'published' : 'draft'} /></td>
                  <td>
                    <div className="flex gap-2">
                      {!c.isPublished && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={publishingCourseId === c._id}
                          onClick={() => publishCourse(c._id)}
                        >
                          Publish
                        </Button>
                      )}
                      {c.isPublished && (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={endingCourseId === c._id}
                          onClick={() => endCourse(c._id)}
                        >
                          End
                        </Button>
                      )}
                      <Link to={`/courses/${c._id}/edit`}><Button variant="outline" size="sm">Edit</Button></Link>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deletingCourseId === c._id}
                        onClick={() => deleteCourse(c._id, c.title)}
                      >
                        Delete
                      </Button>
                      <Link to={`/courses/${c._id}/analytics`}><Button variant="ghost" size="sm"><BarChart2 size={14} /></Button></Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && courses.length === 0 && (
            <div className="px-6 py-8">
              <EmptyState icon={<BookOpen size={36} />} title="No courses yet" description="Create your first course to start teaching"
                action={<Link to="/courses/new"><Button variant="secondary">Create Course</Button></Link>} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
