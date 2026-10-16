import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardHeader, CardBody, Button, Input, StatusBadge, Skeleton, Avatar, Alert, Select, toast } from '@/components/ui';
import { Users, BookOpen, GraduationCap, BarChart2, Search, Shield, RefreshCw } from 'lucide-react';
import type { User } from '@/types';

export const AdminPanel: React.FC = () => {
  const [stats, setStats] = useState({ totalUsers: 0, totalCourses: 0, totalEnrollments: 0, activeStudents: 0 });
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  const [actionLoading, setActionLoading] = useState<string>('');
  const [error, setError] = useState('');

  const fetchStats = () => api.get('/admin/stats').then(r => setStats(r.data.stats));
  const fetchUsers = (s = search, r = roleFilter) => {
    const normalizedSearch = String(s || '').trim();
    const params: Record<string, string> = {};
    if (normalizedSearch) params.search = normalizedSearch;
    if (r) params.role = r;
    return api.get('/admin/users', { params }).then(res => {
      setUsers(res.data.users || []);
      setTotal(res.data.total || 0);
    });
  };

  useEffect(() => {
    Promise.all([fetchStats(), fetchUsers()]).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (userId: string) => {
    setActionLoading(userId); setError('');
    try {
      const { data } = await api.put(`/admin/users/${userId}/toggle`);
      setUsers(prev => prev.map(u => u._id === userId ? data.user : u));
      toast(`User ${data.user.isActive ? 'activated' : 'deactivated'}`, 'success');
    } catch { setError('Action failed'); } finally { setActionLoading(''); }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    setActionLoading(userId); setError('');
    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, { role });
      setUsers(prev => prev.map(u => u._id === userId ? data.user : u));
      toast('Role updated', 'success');
    } catch { setError('Role change failed'); } finally { setActionLoading(''); }
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={20} />, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Active Students', value: stats.activeStudents, icon: <GraduationCap size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Total Courses', value: stats.totalCourses, icon: <BookOpen size={20} />, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Enrollments', value: stats.totalEnrollments, icon: <BarChart2 size={20} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2"><Shield size={22} className="text-primary" />Admin Panel</h1>
          <p className="page-subtitle">Platform management and user administration.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchUsers(); }} className="gap-1">
          <RefreshCw size={14} />Refresh
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {(['overview', 'users'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) :
              statCards.map(s => (
                <div key={s.label} className="stat-card flex items-center gap-4">
                  <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>{s.icon}</div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              ))
            }
          </div>

          {/* Quick actions */}
          <Card>
            <CardHeader><h2 className="font-serif text-lg font-normal">Administrative Actions</h2></CardHeader>
            <CardBody className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Manage Users', desc: 'View, activate, or change roles', action: () => setActiveTab('users') },
                { label: 'Refresh Stats', desc: 'Reload platform statistics', action: () => { fetchStats(); toast('Stats refreshed', 'success'); } },
              ].map(a => (
                <button key={a.label} onClick={a.action}
                  className="flex items-start gap-3 p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 text-left transition-all group">
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Shield size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{a.label}</div>
                    <div className="text-xs text-muted-foreground">{a.desc}</div>
                  </div>
                </button>
              ))}
            </CardBody>
          </Card>
        </>
      )}

      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-lg font-normal flex-1">User Management</h2>
              <span className="text-sm text-muted-foreground">{total} total</span>
            </div>
            <div className="flex gap-3 mt-3">
              <Input placeholder="Search name or email…" icon={<Search size={16} />} value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchUsers(search, roleFilter)}
                className="flex-1" />
              <Select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); fetchUsers(search, e.target.value); }} className="w-36">
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </Select>
              <Button variant="outline" onClick={() => fetchUsers(search, roleFilter)}>Search</Button>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>XP</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? Array(6).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={6}><Skeleton className="h-12" /></td></tr>
                )) : users.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} src={u.avatar} size="sm" />
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Select value={u.role} className="h-8 text-xs w-28"
                        disabled={actionLoading === u._id}
                        onChange={e => handleRoleChange(u._id, e.target.value)}>
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className="text-amber-600 font-medium">{u.xp.toLocaleString()}</td>
                    <td>
                      <StatusBadge status={u.isActive ? 'published' : 'draft'} />
                    </td>
                    <td className="text-muted-foreground text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Button
                        variant={u.isActive ? 'danger' : 'outline'} size="sm"
                        loading={actionLoading === u._id}
                        onClick={() => handleToggle(u._id)}>
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
