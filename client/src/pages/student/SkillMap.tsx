import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Card, CardHeader, CardBody, Button, StatusBadge,
  Skeleton, EmptyState, ProgressBar, Alert, toast
} from '@/components/ui';
import { Brain, Zap, RefreshCw, TrendingUp, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import type { Skill } from '@/types';

const CATEGORY_COLORS: Record<string, string> = {
  Technical: '#3b82f6',
  'Soft Skills': '#8b5cf6',
  'Domain Knowledge': '#f59e0b',
  Tools: '#10b981',
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === 'acquired') return <CheckCircle size={14} className="text-emerald-500" />;
  if (status === 'in-progress') return <Circle size={14} className="text-amber-500" />;
  return <AlertCircle size={14} className="text-red-400" />;
};

export const SkillMapPage: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const fetchSkills = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/skills/map');
      setSkills(data.skills || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSkills(); }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true); setError('');
    try {
      const { data } = await api.post('/skills/analyze');
      setSkills(data.skills || []);
      toast(`Analyzed ${data.analyzed} skills successfully`, 'success');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Analysis failed. Check your Gemini API key.';
      setError(msg);
    } finally { setAnalyzing(false); }
  };

  const categories = ['All', ...Array.from(new Set(skills.map(s => s.category)))];
  const filtered = activeCategory === 'All' ? skills : skills.filter(s => s.category === activeCategory);

  const radarData = skills.slice(0, 8).map(s => ({
    subject: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    proficiency: s.proficiency,
  }));

  const barData = skills
    .sort((a, b) => b.proficiency - a.proficiency)
    .slice(0, 10)
    .map(s => ({ name: s.name.length > 16 ? s.name.slice(0, 16) + '…' : s.name, proficiency: s.proficiency, category: s.category }));

  const acquired = skills.filter(s => s.status === 'acquired').length;
  const inProgress = skills.filter(s => s.status === 'in-progress').length;
  const gaps = skills.filter(s => s.status === 'gap').length;
  const avgProficiency = skills.length ? Math.round(skills.reduce((a, s) => a + s.proficiency, 0) / skills.length) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Skill Map</h1>
          <p className="page-subtitle">AI-powered analysis of your current competencies and learning gaps.</p>
        </div>
        <Button variant="secondary" onClick={handleAnalyze} loading={analyzing} className="gap-2">
          {analyzing ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
          {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
        </Button>
      </div>

      {error && <Alert variant="error"><AlertCircle size={16} />{error}</Alert>}

      {/* Summary stats */}
      {!loading && skills.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Skills Acquired', value: acquired, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: <CheckCircle size={20} /> },
            { label: 'In Progress', value: inProgress, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: <Circle size={20} /> },
            { label: 'Skill Gaps', value: gaps, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', icon: <AlertCircle size={20} /> },
            { label: 'Avg. Proficiency', value: `${avgProficiency}%`, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: <TrendingUp size={20} /> },
          ].map(s => (
            <div key={s.label} className="stat-card flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>{s.icon}</div>
              <div>
                <div className="text-xl font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts row */}
      {!loading && skills.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Radar */}
          <Card>
            <CardHeader><h2 className="font-serif text-lg font-normal">Skill Radar</h2></CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData} cx="50%" cy="50%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="proficiency" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Proficiency']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          {/* Bar chart */}
          <Card>
            <CardHeader><h2 className="font-serif text-lg font-normal">Top Skills by Proficiency</h2></CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={110} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Proficiency']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="proficiency" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Skills table */}
      <Card>
        <CardHeader className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-serif text-lg font-normal">All Skills</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {cat}
              </button>
            ))}
          </div>
        </CardHeader>

        {loading ? (
          <CardBody className="space-y-3">
            {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </CardBody>
        ) : filtered.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<Brain size={40} />}
              title="No skills analyzed yet"
              description="Click 'Run AI Analysis' to generate your personalized skill map based on your courses and quiz performance."
              action={<Button variant="secondary" onClick={handleAnalyze} loading={analyzing}>Run AI Analysis</Button>}
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="w-48">Proficiency</th>
                  <th>Last Analyzed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(skill => (
                  <tr key={skill._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={skill.status} />
                        <span className="font-medium">{skill.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge-pill bg-muted text-muted-foreground" style={{ borderLeft: `3px solid ${CATEGORY_COLORS[skill.category] || '#94a3b8'}` }}>
                        {skill.category}
                      </span>
                    </td>
                    <td><StatusBadge status={skill.status} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={skill.proficiency} className="flex-1" color={skill.status === 'acquired' ? 'bg-emerald-500' : skill.status === 'in-progress' ? 'bg-amber-500' : 'bg-red-400'} />
                        <span className="text-xs font-medium text-muted-foreground w-10 text-right">{skill.proficiency}%</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground text-xs">
                      {new Date(skill.lastAnalyzed).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recommendations */}
      {!loading && skills.filter(s => s.status === 'gap').length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="font-serif text-lg font-normal">Recommended Focus Areas</h2>
          </CardHeader>
          <CardBody>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {skills.filter(s => s.status === 'gap').slice(0, 6).map(skill => (
                <div key={skill._id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-red-50/50 dark:bg-red-900/10">
                  <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{skill.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{skill.category} · {skill.proficiency}% proficiency</div>
                    <div className="text-xs text-red-600 mt-1">Enroll in a related course to improve</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
