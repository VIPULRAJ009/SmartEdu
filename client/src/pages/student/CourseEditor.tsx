import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, BookOpen, Image as ImageIcon, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader, Button, Input, Textarea, Select, Alert, toast, EmptyState } from '@/components/ui';

const COURSE_CATEGORIES = ['Programming', 'Data Science', 'Design', 'Business', 'Mathematics', 'Science', 'Language', 'Other'];
const COURSE_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];

interface CurriculumItemForm {
  id: string;
  title: string;
  description: string;
}

interface AICourseDraft {
  description?: string;
  content?: string;
  objectives?: string[];
  prerequisites?: string[];
  tags?: string[];
  stages?: string[];
  curriculum?: { title?: string; description?: string }[];
}

const createCurriculumItem = (): CurriculumItemForm => ({
  id: Math.random().toString(36).slice(2),
  title: '',
  description: '',
});

const splitTokens = (value: string) =>
  value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const asLines = (value: string[]) => value.filter(Boolean).join('\n');

export const CourseCreatePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: courseId } = useParams();
  const isEditMode = Boolean(courseId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('0');
  const [banner, setBanner] = useState('');
  const [category, setCategory] = useState('Programming');
  const [difficulty, setDifficulty] = useState('Beginner');
  const [duration, setDuration] = useState('0');
  const [objectivesText, setObjectivesText] = useState('');
  const [prerequisitesText, setPrerequisitesText] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [stagesText, setStagesText] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [chapterContexts, setChapterContexts] = useState<CurriculumItemForm[]>([createCurriculumItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [error, setError] = useState('');

  const curriculumPreviewCount = useMemo(
    () => chapterContexts.filter((item) => item.title.trim()).length,
    [chapterContexts]
  );

  useEffect(() => {
    if (!isEditMode || !courseId) return;

    let mounted = true;
    setLoadingCourse(true);
    setError('');

    api.get(`/courses/${courseId}`)
      .then(({ data }) => {
        if (!mounted) return;

        const course = data?.course;
        if (!course) {
          setError('Course not found.');
          return;
        }

        const curriculum = Array.isArray(course.curriculum)
          ? course.curriculum
              .sort((a: { order?: number }, b: { order?: number }) => (a.order || 0) - (b.order || 0))
              .map((item: { title?: string; description?: string }) => ({
                id: Math.random().toString(36).slice(2),
                title: String(item.title || '').trim(),
                description: String(item.description || '').trim(),
              }))
              .filter((item: CurriculumItemForm) => item.title)
          : [];

        setTitle(String(course.title || ''));
        setDescription(String(course.description || ''));
        setContent(String(course.content || ''));
        setPrice(String(Number(course.price) || 0));
        setBanner(String(course.banner || ''));
        setCategory(
          COURSE_CATEGORIES.includes(String(course.category))
            ? String(course.category)
            : 'Other'
        );
        setDifficulty(
          COURSE_DIFFICULTIES.includes(String(course.difficulty))
            ? String(course.difficulty)
            : 'Beginner'
        );
        setDuration(String(Number(course.duration) || 0));
        setObjectivesText(asLines(Array.isArray(course.objectives) ? course.objectives : []));
        setPrerequisitesText(asLines(Array.isArray(course.prerequisites) ? course.prerequisites : []));
        setTagsText(asLines(Array.isArray(course.tags) ? course.tags : []));
        setStagesText(asLines(Array.isArray(course.stages) ? course.stages : []));
        setIsPublished(Boolean(course.isPublished));
        setChapterContexts(curriculum.length > 0 ? curriculum : [createCurriculumItem()]);
      })
      .catch(() => {
        if (!mounted) return;
        setError('Could not load course details.');
      })
      .finally(() => {
        if (mounted) setLoadingCourse(false);
      });

    return () => {
      mounted = false;
    };
  }, [courseId, isEditMode]);

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <EmptyState
        icon={<BookOpen size={40} />}
        title="Teachers only"
        description="Only teachers and admins can create courses."
      />
    );
  }

  if (isEditMode && loadingCourse) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-muted-foreground">Loading course details...</p>
        </CardBody>
      </Card>
    );
  }

  const updateCurriculumItem = (id: string, patch: Partial<CurriculumItemForm>) => {
    setChapterContexts((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeCurriculumItem = (id: string) => {
    setChapterContexts((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], title: '', description: '' }];
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const addCurriculumItem = () => {
    setChapterContexts((prev) => [...prev, createCurriculumItem()]);
  };

  const handleGenerateWithAI = async () => {
    setError('');

    if (!title.trim()) {
      setError('Please enter course title first, then use AI generate.');
      return;
    }

    setGeneratingAI(true);
    try {
      const { data } = await api.post('/courses/ai-draft', {
        title: title.trim(),
        category,
        difficulty,
        durationHours: Number(duration) || 0,
        existingDescription: description,
        existingContent: content,
        objectives: splitTokens(objectivesText),
        prerequisites: splitTokens(prerequisitesText),
        tags: splitTokens(tagsText),
        chapterHints: chapterContexts.map((chapter) => ({
          title: chapter.title,
          description: chapter.description,
        })),
      });

      const draft = (data?.draft || {}) as AICourseDraft;

      if (draft.description) setDescription(draft.description);
      if (draft.content) setContent(draft.content);
      if (Array.isArray(draft.objectives)) setObjectivesText(asLines(draft.objectives));
      if (Array.isArray(draft.prerequisites)) setPrerequisitesText(asLines(draft.prerequisites));
      if (Array.isArray(draft.tags)) setTagsText(asLines(draft.tags));
      if (Array.isArray(draft.stages)) setStagesText(asLines(draft.stages));

      if (Array.isArray(draft.curriculum) && draft.curriculum.length > 0) {
        const mapped = draft.curriculum
          .map((chapter) => ({
            id: Math.random().toString(36).slice(2),
            title: String(chapter.title || '').trim(),
            description: String(chapter.description || '').trim(),
          }))
          .filter((chapter) => chapter.title);

        if (mapped.length > 0) {
          setChapterContexts(mapped);
        }
      }

      toast('AI draft generated. Review and edit before creating the course.', 'success');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Could not generate AI draft right now.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!title.trim() || !description.trim()) {
      setError('Course title and description are required.');
      return;
    }

    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Price must be a non-negative number.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      price: parsedPrice,
      banner: banner.trim(),
      category,
      difficulty,
      duration: Number(duration) || 0,
      isPublished,
      objectives: splitTokens(objectivesText),
      prerequisites: splitTokens(prerequisitesText),
      tags: splitTokens(tagsText),
      stages: splitTokens(stagesText),
      curriculum: chapterContexts
        .map((item, index) => ({
          title: item.title.trim(),
          description: item.description.trim(),
          order: index + 1,
        }))
        .filter((item) => item.title),
    };

    setSubmitting(true);
    try {
      if (isEditMode && courseId) {
        const { data } = await api.put(`/courses/${courseId}`, payload);
        toast('Course updated successfully.', 'success');
        navigate(`/courses/${data.course._id}`);
      } else {
        const { data } = await api.post('/courses', payload);
        toast('Course created successfully.', 'success');
        navigate(`/courses/${data.course._id}`);
      }
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || (isEditMode ? 'Failed to update course.' : 'Failed to create course.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6 animate-fade-in" onSubmit={handleSubmit}>
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{isEditMode ? 'Edit Course' : 'Create Course'}</h1>
          <p className="page-subtitle">
            {isEditMode
              ? 'Update your course details, visibility, and chapter context.'
              : 'Add full course details, pricing, banner, context, and curriculum.'}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            Publish immediately
          </label>
          <Button type="button" variant="outline" onClick={handleGenerateWithAI} loading={generatingAI} className="gap-1">
            <Sparkles size={14} /> Generate With AI
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>Cancel</Button>
          <Button type="submit" variant="secondary" loading={submitting}>{isEditMode ? 'Save Changes' : 'Create Course'}</Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-normal">Core Details</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Course Title"
            placeholder="e.g. Full Stack Web Development"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            rows={4}
            placeholder="Describe what this course covers"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />

          <Textarea
            label="Course Context / Content"
            rows={5}
            placeholder="Share the full context and content plan for this course"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              label="Price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Duration (hours)"
              type="number"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="0"
            />
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {COURSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
            <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {COURSE_DIFFICULTIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </div>

          <Input
            label="Banner URL"
            placeholder="https://example.com/course-banner.jpg"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            icon={<ImageIcon size={16} />}
          />

          {banner.trim() && (
            <div className="rounded-lg border border-border overflow-hidden bg-muted">
              <img
                src={banner}
                alt="Course banner preview"
                className="w-full h-44 object-cover"
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-normal">Chapter-wise Course Context</h2>
          <span className="text-xs text-muted-foreground">{curriculumPreviewCount} chapters</span>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Add chapter title and context for each chapter. These will be shown chapter-wise to students.
          </p>

          {chapterContexts.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-border p-3 space-y-2 bg-background">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Chapter {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCurriculumItem(item.id)}
                  className="text-destructive"
                >
                  <Trash2 size={14} /> Remove
                </Button>
              </div>
              <Input
                placeholder="Chapter title"
                value={item.title}
                onChange={(e) => updateCurriculumItem(item.id, { title: e.target.value })}
              />
              <Textarea
                rows={3}
                placeholder="Chapter context"
                value={item.description}
                onChange={(e) => updateCurriculumItem(item.id, { description: e.target.value })}
              />
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addCurriculumItem} className="gap-1">
            <Plus size={14} /> Add Chapter Context
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-serif text-lg font-normal">Learning Metadata</h2>
        </CardHeader>
        <CardBody className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Textarea
            label="Objectives"
            rows={5}
            placeholder="One objective per line or comma-separated"
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
          />
          <Textarea
            label="Prerequisites"
            rows={5}
            placeholder="One prerequisite per line or comma-separated"
            value={prerequisitesText}
            onChange={(e) => setPrerequisitesText(e.target.value)}
          />
          <Textarea
            label="Tags"
            rows={5}
            placeholder="React, Node.js, MongoDB"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
          />
          <Textarea
            label="Stages"
            rows={5}
            placeholder="Stage 1: Foundations"
            value={stagesText}
            onChange={(e) => setStagesText(e.target.value)}
          />
        </CardBody>
      </Card>
    </form>
  );
};
