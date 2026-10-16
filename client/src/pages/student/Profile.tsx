import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Card, CardHeader, CardBody, Button, Input, Select, Textarea, Alert, Avatar, ProgressBar, toast } from '@/components/ui';
import { User, Building, BookOpen, Target, Save, Edit3, Zap, Flame, GraduationCap } from 'lucide-react';
import type { Skill } from '@/types';

const LEVEL_XP: Record<string, number> = { Beginner: 500, Intermediate: 2000, Advanced: 5000, Expert: 5000 };
const LEVEL_COLOR: Record<string, string> = {
  Beginner: 'text-slate-500', Intermediate: 'text-blue-600',
  Advanced: 'text-purple-600', Expert: 'text-amber-600',
};
const SKILL_CATEGORIES = ['Technical', 'Soft Skills', 'Domain Knowledge', 'Tools'];

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    institution: user?.institution || '',
    course: user?.course || '',
    careerGoals: user?.careerGoals || '',
  });
  const [profileSkills, setProfileSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [addingSkill, setAddingSkill] = useState(false);
  const [skillForm, setSkillForm] = useState({
    name: '',
    category: 'Technical',
    proficiency: '50',
  });

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const { data } = await api.put('/users/profile', form);
      updateUser(data.user);
      setEditing(false);
      toast('Profile updated successfully', 'success');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const fetchProfileSkills = async () => {
    setSkillsLoading(true);
    try {
      const { data } = await api.get('/skills/map');
      const manualSkills = Array.isArray(data.skills)
        ? data.skills.filter((skill: Skill) => skill.source === 'user')
        : [];
      setProfileSkills(manualSkills);
    } catch {
      setProfileSkills([]);
    } finally {
      setSkillsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileSkills();
  }, []);

  const handleAddSkill = async () => {
    const skillName = String(skillForm.name || '').trim();
    if (!skillName) {
      toast('Please enter a skill name.', 'error');
      return;
    }

    const rawProficiency = Number(skillForm.proficiency);
    const proficiency = Number.isFinite(rawProficiency)
      ? Math.min(100, Math.max(0, Math.round(rawProficiency)))
      : 0;

    setAddingSkill(true);
    setError('');

    try {
      const { data } = await api.post('/skills/manual', {
        name: skillName,
        category: skillForm.category,
        proficiency,
      });

      const manualSkills = Array.isArray(data.skills)
        ? data.skills.filter((skill: Skill) => skill.source === 'user')
        : [];

      setProfileSkills(manualSkills);
      setSkillForm({
        name: '',
        category: 'Technical',
        proficiency: '50',
      });

      toast('Skill added to profile and mapping.', 'success');
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not add skill');
    } finally {
      setAddingSkill(false);
    }
  };

  if (!user) return null;

  const xpToNext = LEVEL_XP[user.level];
  const xpPct = Math.min(100, (user.xp / xpToNext) * 100);
  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your personal information and career goals.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Profile card */}
      <Card>
        <CardBody>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar name={user.name} src={user.avatar} size="xl" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-serif text-2xl font-normal text-foreground">{user.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-pill bg-primary/10 text-primary capitalize">{roleLabel}</span>
                    <span className={`text-sm font-medium ${LEVEL_COLOR[user.level]}`}>{user.level}</span>
                  </div>
                  {user.institution && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1"><Building size={13} />{user.institution}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(e => !e)} className="gap-1">
                  <Edit3 size={14} />{editing ? 'Cancel' : 'Edit Profile'}
                </Button>
              </div>

              {/* XP / Level progress */}
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Zap size={12} /> {user.xp.toLocaleString()} XP</span>
                  <span>Next: {xpToNext.toLocaleString()} XP</span>
                </div>
                <ProgressBar value={xpPct} color="bg-amber-500" />
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total XP', value: user.xp.toLocaleString(), icon: <Zap size={18} />, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Day Streak', value: user.streak, icon: <Flame size={18} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Level', value: user.level, icon: <GraduationCap size={18} />, color: LEVEL_COLOR[user.level], bg: 'bg-muted' },
        ].map(s => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>{s.icon}</div>
            <div>
              <div className="font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-sans text-base font-semibold">Profile Skills</h3>
          <span className="text-xs text-muted-foreground">Used in AI skill mapping</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <Input
              label="Skill Name"
              value={skillForm.name}
              placeholder="e.g. React Development"
              onChange={(e) => setSkillForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <Select
              label="Category"
              value={skillForm.category}
              onChange={(e) => setSkillForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {SKILL_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </Select>
            <Input
              label="Proficiency (0-100)"
              type="number"
              min={0}
              max={100}
              value={skillForm.proficiency}
              onChange={(e) => setSkillForm((prev) => ({ ...prev, proficiency: e.target.value }))}
            />
          </div>

          <Button type="button" variant="secondary" onClick={handleAddSkill} loading={addingSkill}>
            Add Skill
          </Button>

          {skillsLoading ? (
            <p className="text-sm text-muted-foreground">Loading profile skills...</p>
          ) : profileSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No profile skills added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profileSkills.map((skill) => (
                <span key={skill._id} className="badge-pill bg-muted text-muted-foreground">
                  {skill.name} • {skill.category} • {skill.proficiency}%
                </span>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Editable form */}
      {editing ? (
        <Card>
          <CardHeader><h3 className="font-sans text-base font-semibold">Edit Information</h3></CardHeader>
          <CardBody className="space-y-4">
            <Input label="Full Name" value={form.name} icon={<User size={16} />}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            <Textarea label="Bio" value={form.bio} rows={3} placeholder="Tell others about yourself…"
              onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
            <Input label="Institution" value={form.institution} icon={<Building size={16} />}
              onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} />
            <Input label="Current Course / Degree" value={form.course} icon={<BookOpen size={16} />}
              onChange={e => setForm(p => ({ ...p, course: e.target.value }))} />
            <Textarea label="Career Goals" value={form.careerGoals} rows={2} placeholder="e.g., Become a Machine Learning Engineer…"
              onChange={e => setForm(p => ({ ...p, careerGoals: e.target.value }))} />
            <div className="flex gap-3">
              <Button onClick={handleSave} loading={saving} className="gap-1"><Save size={15} />Save Changes</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader><h3 className="font-sans text-base font-semibold">Profile Information</h3></CardHeader>
          <CardBody className="space-y-4">
            {[
              { label: 'Bio', value: user.bio, icon: <User size={15} /> },
              { label: 'Institution', value: user.institution, icon: <Building size={15} /> },
              { label: 'Course / Degree', value: user.course, icon: <BookOpen size={15} /> },
              { label: 'Career Goals', value: user.careerGoals, icon: <Target size={15} /> },
            ].map(f => (
              <div key={f.label}>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  {f.icon}{f.label}
                </div>
                <p className="text-sm text-foreground">{f.value || <span className="text-muted-foreground italic">Not specified</span>}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
};
