import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui';
import api from '@/lib/api';
import {
  LayoutDashboard, BookOpen, Brain, Trophy, BarChart2,
  MessageSquare, Users, LogOut, Menu, X,
  GraduationCap, TrendingUp, ClipboardList, Star, Shield,
  Bell, CheckCheck, Clock3
} from 'lucide-react';
import { Video } from 'lucide-react';
import { cn } from '@/components/ui';
import type { AppNotification } from '@/types';

interface NavItem { label: string; to: string; icon: React.ReactNode; roles?: string[] }

const getSocketBaseUrl = () => {
  const configuredApiBase = import.meta.env.VITE_API_BASE_URL;
  if (configuredApiBase) {
    try {
      const parsed = new URL(configuredApiBase);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return configuredApiBase.replace(/\/api\/?$/, '');
    }
  }

  const configuredTarget = import.meta.env.VITE_API_PROXY_TARGET;
  if (configuredTarget) {
    try {
      const parsed = new URL(configuredTarget);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return configuredTarget;
    }
  }

  return window.location.origin;
};

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Courses', to: '/courses', icon: <BookOpen size={18} /> },
  { label: 'Skill Map', to: '/skills', icon: <Brain size={18} />, roles: ['student'] },
  { label: 'Quizzes', to: '/quizzes', icon: <ClipboardList size={18} /> },
  { label: 'Assignments', to: '/assignments', icon: <ClipboardList size={18} /> },
  { label: 'Leaderboard', to: '/leaderboard', icon: <Trophy size={18} /> },
  { label: 'Badges', to: '/badges', icon: <Star size={18} />, roles: ['student'] },
  { label: 'Discussions', to: '/discussions', icon: <MessageSquare size={18} /> },
  { label: 'Live Class', to: '/live-class', icon: <Video size={18} /> },
  { label: 'Market Trends', to: '/market', icon: <TrendingUp size={18} /> },
  { label: 'Analytics', to: '/analytics', icon: <BarChart2 size={18} />, roles: ['teacher', 'admin'] },
  { label: 'Students', to: '/students', icon: <Users size={18} />, roles: ['teacher', 'admin'] },
  { label: 'Admin Panel', to: '/admin', icon: <Shield size={18} />, roles: ['admin'] },
];

const levelColors: Record<string, string> = {
  Beginner: 'text-slate-500',
  Intermediate: 'text-blue-600',
  Advanced: 'text-purple-600',
  Expert: 'text-amber-600',
};

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [dismissedLivePromptIds, setDismissedLivePromptIds] = useState<string[]>([]);

  const notificationRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filtered = navItems.filter((item) =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  const fetchNotifications = useCallback(async (silently = false) => {
    if (!silently) setLoadingNotifications(true);

    try {
      const { data } = await api.get('/live-classes/notifications/feed?limit=12');
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      if (!silently) setLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const timer = window.setInterval(() => fetchNotifications(true), 30000);

    return () => window.clearInterval(timer);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?._id) return;

    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    const joinUserRoom = () => {
      socket.emit('join-user', user._id);
    };

    const handleIncomingNotification = (notification: AppNotification) => {
      setLoadingNotifications(false);
      setNotifications((prev) => {
        if (prev.some((item) => item._id === notification._id)) {
          return prev;
        }
        return [notification, ...prev].slice(0, 12);
      });

      if (!notification.isRead) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('connect', joinUserRoom);
    socket.on('notification:new', handleIncomingNotification);

    if (socket.connected) {
      joinUserRoom();
    }

    return () => {
      socket.emit('leave-user', user._id);
      socket.off('connect', joinUserRoom);
      socket.off('notification:new', handleIncomingNotification);
      socket.disconnect();
    };
  }, [user?._id]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const liveClassPrompt = useMemo(
    () => notifications.find((notification) => (
      notification.type === 'live-class-started'
      && !notification.isRead
      && Boolean(notification.payload?.liveClassId)
      && !dismissedLivePromptIds.includes(notification._id)
    )) || null,
    [dismissedLivePromptIds, notifications]
  );

  const getNotificationRoute = (notification: AppNotification) => {
    const explicitRoute = String(notification.payload?.route || '').trim();
    if (explicitRoute) return explicitRoute;

    if (notification.payload?.liveClassId) {
      return `/live-class/room/${notification.payload.liveClassId}`;
    }

    if (notification.payload?.courseId) {
      return `/courses/${notification.payload.courseId}?tab=assessments`;
    }

    return null;
  };

  const markRead = async (notification: AppNotification, shouldNavigate = true) => {
    try {
      if (!notification.isRead) {
        await api.post(`/live-classes/notifications/${notification._id}/read`);
        setNotifications((prev) => prev.map((item) => (
          item._id === notification._id ? { ...item, isRead: true } : item
        )));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      setDismissedLivePromptIds((prev) => prev.filter((item) => item !== notification._id));

      const destination = getNotificationRoute(notification);
      if (destination && shouldNavigate) {
        navigate(destination);
        setNotificationOpen(false);
      }
    } catch {
      // Ignore failed read updates.
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/live-classes/notifications/read-all');
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore failed bulk read update.
    }
  };

  const formatNotificationTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const Sidebar = ({ mobile = false }) => (
    <aside className={cn(
      'flex flex-col h-full bg-card border-r border-border',
      mobile ? 'w-72' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap size={18} className="text-primary-foreground" />
        </div>
        <div>
          <span className="font-serif text-lg font-normal text-foreground leading-tight">SmartEdu</span>
          <span className="block text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Platform</span>
        </div>
        {mobile && (
          <button className="ml-auto text-muted-foreground" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer" onClick={() => navigate('/profile')}>
          <Avatar name={user?.name || ''} src={user?.avatar} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className={cn('text-xs font-medium truncate', levelColors[user?.level || 'Beginner'])}>
              {user?.level} · {user?.xp} XP
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-1 w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full w-72 animate-slide-in-left">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 flex items-center gap-4 px-6 border-b border-border bg-card/80 backdrop-blur-sm">
          <button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="relative" ref={notificationRef}>
              <button
                className="relative h-9 w-9 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                onClick={() => setNotificationOpen((prev) => !prev)}
                aria-label="Open notifications"
              >
                <Bell size={17} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-xl border border-border bg-card shadow-xl z-40">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Notifications</p>
                      <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                    </div>
                    <button
                      className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                      onClick={markAllRead}
                      disabled={unreadCount === 0}
                    >
                      <span className="inline-flex items-center gap-1"><CheckCheck size={12} /> Mark all read</span>
                    </button>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto p-2 space-y-1">
                    {loadingNotifications ? (
                      <div className="px-3 py-6 text-sm text-muted-foreground text-center">Loading notifications...</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-muted-foreground text-center">No notifications yet.</div>
                    ) : notifications.map((notification) => (
                      <button
                        key={notification._id}
                        onClick={() => markRead(notification)}
                        className={cn(
                          'w-full text-left rounded-lg border px-3 py-2 transition-colors',
                          notification.isRead
                            ? 'border-border bg-background hover:bg-muted/50'
                            : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-snug">{notification.title}</p>
                          {!notification.isRead && <span className="h-2 w-2 rounded-full bg-blue-600 mt-1.5" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-snug">{notification.message}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Clock3 size={11} /> {formatNotificationTime(notification.createdAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground">
              <span className="text-base">🔥</span> {user?.streak} day streak
            </div>
            <Avatar name={user?.name || ''} src={user?.avatar} size="sm" className="cursor-pointer" />
          </div>
        </header>

        {liveClassPrompt && (
          <div className="mx-6 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-amber-900">{liveClassPrompt.title}</p>
              <p className="text-xs text-amber-800 mt-0.5">{liveClassPrompt.message}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-amber-900 hover:bg-amber-100"
                onClick={() => setDismissedLivePromptIds((prev) => [...prev, liveClassPrompt._id])}
              >
                Dismiss
              </button>
              <button
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-900 text-white hover:bg-amber-800"
                onClick={() => markRead(liveClassPrompt, true)}
              >
                Join Now
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
