import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardBody, CardFooter, Button, Alert, Skeleton, EmptyState, ProgressBar, toast } from '@/components/ui';
import { ClipboardList, Clock, CheckCircle, XCircle, ChevronRight, Trophy, Brain, AlertCircle } from 'lucide-react';
import type { Quiz, QuizAttempt, AwardedBadge } from '@/types';

const showAwardedBadgeToasts = (badges: AwardedBadge[] = []) => {
  badges.forEach((badge) => {
    toast(`🏅 Badge earned: ${badge.icon ? `${badge.icon} ` : ''}${badge.name}`, 'success');
  });
};

// ── Quiz List (for a course) ───────────────────────────────────────────────────
export const QuizListPage: React.FC = () => {
  const { courseId } = useParams();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId) {
      api.get(`/quizzes/course/${courseId}`)
        .then(r => setQuizzes(r.data.quizzes || []))
        .finally(() => setLoading(false));
    }
  }, [courseId]);

  if (loading) return <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      {quizzes.length === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />} title="No quizzes yet" description="The instructor hasn't published any quizzes for this course." />
      ) : quizzes.map(q => (
        <Card key={q._id}>
          <CardBody className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <ClipboardList size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground">{q.title}</h3>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock size={12} /> {q.timeLimit} min</span>
                <span>{q.questions.length} questions</span>
                <span>Pass: {q.passingScore}%</span>
                <span className="text-amber-600 font-medium">+{q.xpReward} XP</span>
              </div>
            </div>
            <Link to={`/quizzes/${q._id}`}>
              <Button variant="secondary" size="sm" className="gap-1">Start Quiz <ChevronRight size={14} /></Button>
            </Link>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};

// ── Quiz Taking Page ──────────────────────────────────────────────────────────
export const QuizPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttempt | null>(null);
  const [error, setError] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    api.get(`/quizzes/${id}`).then(r => {
      setQuiz(r.data.quiz);
      setTimeLeft(r.data.quiz.timeLimit * 60);
    }).finally(() => setLoading(false));
  }, [id]);

  // Timer
  useEffect(() => {
    if (started && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (started && timeLeft === 0 && !result) {
      handleSubmit();
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [started, timeLeft]);

  const handleStart = () => {
    setAnswers(new Array(quiz!.questions.length).fill(-1));
    setStarted(true);
  };

  const handleAnswer = (optionIndex: number) => {
    setAnswers(prev => { const a = [...prev]; a[currentQ] = optionIndex; return a; });
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    setSubmitting(true); setError('');
    const timeTaken = quiz.timeLimit * 60 - timeLeft;
    try {
      const { data } = await api.post(`/quizzes/${id}/attempt`, {
        answers: answers.map((selectedIndex, questionIndex) => ({ questionIndex, selectedIndex })),
        timeTaken,
      });
      setResult(data.attempt);
      toast(data.attempt.passed ? '🎉 Quiz passed!' : 'Quiz completed', data.attempt.passed ? 'success' : 'info');

      const awardedBadges = Array.isArray(data.awardedBadges) ? data.awardedBadges : [];
      showAwardedBadgeToasts(awardedBadges);

      if (data.attempt?.passed || awardedBadges.length > 0) {
        await refreshUser();
      }
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Submission failed');
    } finally { setSubmitting(false); }
  };

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timePercent = quiz ? (timeLeft / (quiz.timeLimit * 60)) * 100 : 100;
  const answeredCount = answers.filter(a => a !== -1).length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!quiz) return null;

  // Results screen
  if (result) {
    const correct = result.correct ?? 0;
    const total = result.totalQuestions ?? quiz.questions.length;
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Card>
          <CardBody className="py-8 text-center space-y-4">
            <div className={`h-20 w-20 rounded-full mx-auto flex items-center justify-center text-4xl ${result.passed ? 'bg-emerald-100 dark:bg-emerald-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
              {result.passed ? '🎉' : '📖'}
            </div>
            <div>
              <h1 className="font-serif text-3xl font-normal">{result.passed ? 'Quiz Passed!' : 'Keep Practising'}</h1>
              <p className="text-muted-foreground mt-1">You scored <strong className="text-foreground">{result.score}%</strong> ({correct}/{total} correct)</p>
            </div>
            <div className="max-w-xs mx-auto">
              <ProgressBar value={result.score} color={result.passed ? 'bg-emerald-500' : 'bg-red-400'} />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-amber-600 font-medium">Pass: {quiz.passingScore}%</span>
                <span>100%</span>
              </div>
            </div>
            {result.passed && (
              <div className="flex items-center justify-center gap-2 text-amber-600 font-medium">
                <Trophy size={18} /> +{quiz.xpReward} XP Earned!
              </div>
            )}
          </CardBody>
        </Card>

        {/* Question breakdown */}
        <Card>
          <CardHeader><h2 className="font-serif text-lg font-normal">Question Breakdown</h2></CardHeader>
          <CardBody className="space-y-3">
            {quiz.questions.map((q, i) => {
              const detail = result.details?.[i];
              const isCorrect = detail?.isCorrect;
              return (
                <div key={i} className={`p-4 rounded-lg border ${isCorrect ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10'}`}>
                  <div className="flex items-start gap-2">
                    {isCorrect ? <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" /> : <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{q.text}</p>
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, oi) => {
                          const selected = detail?.selectedIndex === oi;
                          const correct = quiz.questions[i].correctIndex === oi;
                          return (
                            <div key={oi} className={`text-xs px-3 py-1.5 rounded flex items-center gap-2
                              ${correct ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium' :
                                selected && !correct ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                'text-muted-foreground'}`}>
                              {correct && <CheckCircle size={12} />}
                              {selected && !correct && <XCircle size={12} />}
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                      {q.explanation && <p className="text-xs text-muted-foreground mt-2 italic">💡 {q.explanation}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setStarted(false); setCurrentQ(0); setAnswers([]); setTimeLeft(quiz.timeLimit * 60); }}>
            Retake Quiz
          </Button>
          <Button className="flex-1" onClick={() => navigate('/courses')}>Browse Courses</Button>
        </div>
      </div>
    );
  }

  // Pre-start screen
  if (!started) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <Card>
          <CardBody className="py-8 text-center space-y-5">
            <div className="h-16 w-16 rounded-xl bg-primary/10 mx-auto flex items-center justify-center text-primary">
              <ClipboardList size={30} />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-normal">{quiz.title}</h1>
              {quiz.description && <p className="text-sm text-muted-foreground mt-1">{quiz.description}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Questions', value: quiz.questions.length },
                { label: 'Time Limit', value: `${quiz.timeLimit} min` },
                { label: 'Pass Score', value: `${quiz.passingScore}%` },
              ].map(s => (
                <div key={s.label} className="p-3 rounded-lg bg-muted text-center">
                  <div className="font-semibold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <Alert variant="warning"><AlertCircle size={14} className="shrink-0 mt-0.5" /><span>Once started, the timer cannot be paused. Ensure you have a stable connection.</span></Alert>
            <Button className="w-full" variant="secondary" size="lg" onClick={handleStart}>Start Quiz</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Quiz in progress
  const question = quiz.questions[currentQ];
  const answered = answers[currentQ];
  const allAnswered = answers.every(a => a !== -1);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      {/* Header bar */}
      <Card>
        <CardBody className="py-3 flex items-center gap-4">
          <div className={`font-mono text-lg font-bold ${timeLeft < 60 ? 'text-red-600 animate-pulse' : timeLeft < 180 ? 'text-amber-600' : 'text-foreground'}`}>
            <Clock size={16} className="inline mr-1" />
            {formatTime(timeLeft)}
          </div>
          <div className="flex-1">
            <ProgressBar value={timePercent} color={timeLeft < 60 ? 'bg-red-500' : timeLeft < 180 ? 'bg-amber-500' : 'bg-primary'} />
          </div>
          <span className="text-sm text-muted-foreground">{answeredCount}/{quiz.questions.length} answered</span>
        </CardBody>
      </Card>

      {/* Question navigation pills */}
      <div className="flex flex-wrap gap-1.5">
        {quiz.questions.map((_, i) => (
          <button key={i} onClick={() => setCurrentQ(i)}
            className={`h-8 w-8 rounded-md text-xs font-medium transition-all ${i === currentQ ? 'bg-primary text-primary-foreground' : answers[i] !== -1 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Question {currentQ + 1} of {quiz.questions.length}</span>
            <span className="text-xs text-amber-600 font-medium">{question.points} pt{question.points !== 1 ? 's' : ''}</span>
          </div>
          <h2 className="text-base font-medium text-foreground">{question.text}</h2>
        </CardHeader>
        <CardBody className="space-y-2">
          {question.options.map((opt, oi) => (
            <button key={oi} onClick={() => handleAnswer(oi)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${answered === oi ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-muted-foreground hover:bg-muted/50'}`}>
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border mr-3 text-xs font-medium
                border-current opacity-60">{String.fromCharCode(65 + oi)}</span>
              {opt}
            </button>
          ))}
        </CardBody>
        <CardFooter className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={currentQ === 0} onClick={() => setCurrentQ(c => c - 1)}>← Previous</Button>
          {currentQ < quiz.questions.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentQ(c => c + 1)}>Next →</Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleSubmit} loading={submitting} disabled={!allAnswered && answers.some(a => a !== -1)}>
              Submit Quiz
            </Button>
          )}
        </CardFooter>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
};
