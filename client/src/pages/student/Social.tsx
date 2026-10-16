import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardBody, Button, Skeleton, EmptyState, StatusBadge, Alert, ProgressBar } from '@/components/ui';
import { Trophy, Star, TrendingUp, RefreshCw, Zap, Medal, Lock, BarChart2, AlertCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';
import type { Badge, MarketTrend } from '@/types';

// ── Leaderboard ──────────────────────────────────────────────────────────────
interface LeaderUser {
  _id: string;
  name: string;
  avatar?: string;
  xp: number;
  level: string;
  streak: number;
}

export const LeaderboardPage: React.FC = () => {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/leaderboard').then(r => setLeaders(r.data.leaderboard || [])).finally(() => setLoading(false));
  }, []);

  const rankIcon = (i: number) => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `#${i + 1}`;
  };

  const levelColor: Record<string, string> = {
    Beginner: 'text-slate-500', Intermediate: 'text-blue-600',
    Advanced: 'text-purple-600', Expert: 'text-amber-600',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
        <p className="page-subtitle">Top learners by total XP earned on the platform.</p>
      </div>

      {/* Top 3 podium */}
      {!loading && leaders.length >= 3 && (
        <div className="flex items-end justify-center gap-4 py-6">
          {[leaders[1], leaders[0], leaders[2]].map((l, i) => {
            const pos = i === 1 ? 0 : i === 0 ? 1 : 2;
            const heights = ['h-20', 'h-28', 'h-16'];
            const colors = ['bg-slate-200 dark:bg-slate-700', 'bg-amber-400', 'bg-orange-300 dark:bg-orange-600'];
            return (
              <div key={l._id} className="flex flex-col items-center gap-2">
                <div className="text-2xl">{rankIcon(pos)}</div>
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  {l.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-foreground max-w-[80px] truncate">{l.name.split(' ')[0]}</div>
                  <div className="text-xs text-amber-600 font-medium">{l.xp.toLocaleString()} XP</div>
                </div>
                <div className={`w-20 ${heights[i]} ${colors[i]} rounded-t-md`} />
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader><h2 className="font-serif text-lg font-normal">Full Rankings</h2></CardHeader>
        {loading ? (
          <CardBody className="space-y-3">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th className="w-12">Rank</th><th>Learner</th><th>Level</th><th>XP</th><th>Streak</th></tr></thead>
              <tbody>
                {leaders.map((l, i) => (
                  <tr key={l._id} className={l._id === user?._id ? 'bg-primary/5 font-medium' : ''}>
                    <td>
                      <span className={`font-bold ${i < 3 ? 'text-lg' : 'text-muted-foreground text-sm'}`}>{rankIcon(i)}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                          {l.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{l.name}{l._id === user?._id && <span className="ml-2 text-xs text-primary">(You)</span>}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`text-sm font-medium ${levelColor[l.level] || ''}`}>{l.level}</span></td>
                    <td>
                      <div className="flex items-center gap-1.5 text-amber-600 font-semibold">
                        <Zap size={14} />{l.xp.toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 text-orange-500">
                        🔥 {l.streak}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

// ── Badges Page ───────────────────────────────────────────────────────────────
const RARITY_COLORS: Record<string, string> = {
  common: 'border-slate-200 dark:border-slate-700',
  rare: 'border-blue-300 dark:border-blue-700',
  epic: 'border-purple-300 dark:border-purple-700',
  legendary: 'border-amber-400 dark:border-amber-600',
};

export const BadgesPage: React.FC = () => {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');

  useEffect(() => {
    api.get('/badges').then(r => setBadges(r.data.badges || [])).finally(() => setLoading(false));
  }, []);

  const filtered = badges.filter(b =>
    filter === 'all' ? true : filter === 'earned' ? b.earned : !b.earned
  );

  const earned = badges.filter(b => b.earned).length;
  const totalBadges = badges.length;
  const progressMax = totalBadges > 0 ? totalBadges : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Badges & Achievements</h1>
        <p className="page-subtitle">{earned} of {totalBadges} badges earned.</p>
      </div>

      {/* Progress */}
      {!loading && (
        <Card>
          <CardBody className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Collection Progress</span>
              <span className="text-sm text-muted-foreground">{earned}/{totalBadges}</span>
            </div>
            <ProgressBar value={earned} max={progressMax} color="bg-amber-500" />
          </CardBody>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'earned', 'locked'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Medal size={40} />} title="No badges here" description="Complete courses, quizzes, and maintain your streak to earn badges." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(badge => (
            <div key={badge._id} className={`relative rounded-xl border-2 p-5 flex flex-col items-center gap-3 text-center transition-all duration-200
              ${RARITY_COLORS[badge.rarity]} ${badge.earned ? 'bg-card hover:shadow-md' : 'bg-muted/40 opacity-60'}`}>
              {!badge.earned && <Lock size={14} className="absolute top-3 right-3 text-muted-foreground" />}
              <span className={`text-4xl ${!badge.earned ? 'grayscale opacity-50' : ''}`}>{badge.icon}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.earned
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {badge.earned ? 'Earned' : 'Locked'}
              </span>
              <div>
                <div className="font-semibold text-sm text-foreground">{badge.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={badge.rarity} />
                <span className="text-xs text-amber-600 font-medium">+{badge.xpValue} XP</span>
              </div>
              {badge.earned && badge.earnedAt && (
                <div className="text-[10px] text-muted-foreground">Earned {new Date(badge.earnedAt).toLocaleDateString()}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Market Trends Page ────────────────────────────────────────────────────────
const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'];

export const MarketTrendsPage: React.FC = () => {
  const [trends, setTrends] = useState<MarketTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'skills' | 'industries' | 'careers' | 'tech'>('skills');

  const fetchTrends = async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/market/trends');
      setTrends(data.trends);
      setCached(data.cached);
      setFetchedAt(data.fetchedAt);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to fetch trends. Check your Gemini API key.');
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchTrends(); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Market Intelligence</h1>
          <p className="page-subtitle">
            AI-powered industry skill demand analysis.
            {fetchedAt && <span className="ml-2 text-xs text-muted-foreground">Last updated: {new Date(fetchedAt).toLocaleString()}{cached && ' (cached)'}</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTrends(true)} loading={refreshing} className="gap-1">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </Button>
      </div>

      {error && <Alert variant="error"><AlertCircle size={16} />{error}</Alert>}

      {loading ? (
        <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
      ) : trends ? (
        <>
          {/* Summary */}
          <Card>
            <CardBody>
              <p className="text-sm text-foreground leading-relaxed">{trends.summary}</p>
            </CardBody>
          </Card>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-border">
            {(['skills', 'industries', 'careers', 'tech'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {t === 'tech' ? 'Emerging Tech' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'skills' && (
            <Card>
              <CardHeader><h2 className="font-serif text-lg font-normal">Top In-Demand Skills</h2></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={trends.topSkills} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="skill" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v, n) => [`${v}%`, n === 'demand' ? 'Demand Score' : 'Growth']} />
                    <Legend />
                    <Bar dataKey="demand" name="Demand Score" radius={[4, 4, 0, 0]}>
                      {trends.topSkills.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Skill</th><th>Category</th><th>Demand</th><th>Growth</th><th>Avg. Salary</th></tr></thead>
                    <tbody>
                      {trends.topSkills.map((s, i) => (
                        <tr key={i}>
                          <td className="font-medium">{s.skill}</td>
                          <td><span className="badge-pill bg-muted text-muted-foreground">{s.category}</span></td>
                          <td>
                            <div className="flex items-center gap-2">
                              <ProgressBar value={s.demand} className="w-20" color={s.demand >= 80 ? 'bg-emerald-500' : s.demand >= 60 ? 'bg-amber-500' : 'bg-slate-400'} />
                              <span className="text-xs font-medium">{s.demand}%</span>
                            </div>
                          </td>
                          <td><span className="text-emerald-600 font-medium text-sm">+{s.growth}%</span></td>
                          <td className="text-muted-foreground">{s.avgSalary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'industries' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.industries.map((ind, i) => (
                <Card key={i}>
                  <CardBody>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-foreground">{ind.name}</h3>
                      <StatusBadge status={ind.hiringTrend} />
                    </div>
                    <div className="space-y-1.5">
                      {ind.topSkills.map((skill, si) => (
                        <div key={si} className="flex items-center gap-2 text-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span className="text-muted-foreground">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'careers' && (
            <div className="grid sm:grid-cols-2 gap-4">
              {trends.careerPaths.map((path, i) => (
                <Card key={i}>
                  <CardBody>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground">{path.title}</h3>
                      <StatusBadge status={path.demand} />
                    </div>
                    <div className="text-lg font-bold text-amber-600 mb-3">{path.avgSalary}</div>
                    <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Required Skills</div>
                    <div className="flex flex-wrap gap-1.5">
                      {path.requiredSkills.map(skill => (
                        <span key={skill} className="badge-pill bg-primary/10 text-primary">{skill}</span>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'tech' && (
            <Card>
              <CardHeader><h2 className="font-serif text-lg font-normal">Emerging Technologies</h2></CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-3">
                  {trends.emergingTech.map((tech, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-colors">
                      <span className="text-lg">{['🤖', '🧠', '⛓️', '☁️', '🔐', '📡', '🎮', '🔬'][i % 8]}</span>
                      <span className="font-medium text-sm text-foreground">{tech}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      ) : (
        <EmptyState icon={<TrendingUp size={40} />} title="No market data" description="Click Refresh to fetch the latest industry skill trends powered by AI."
          action={<Button variant="secondary" onClick={() => fetchTrends(true)}>Fetch Trends</Button>} />
      )}
    </div>
  );
};
