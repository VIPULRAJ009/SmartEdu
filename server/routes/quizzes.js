const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');
const { Quiz, QuizAttempt, Enrollment } = require('../models/index');
const { getQuizFeedback } = require('../controllers/aiController');
const Course = require('../models/Course');
const { addXpToUser, awardEligibleBadges } = require('../utils/gamification');
const { createNotifications } = require('../utils/notifications');

const ensureTeacherOwnsCourse = (course, user) => {
  if (user.role === 'admin') return true;
  return String(course.instructor) === String(user._id);
};

// GET /api/quizzes/course/:courseId
router.get('/course/:courseId', protect, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId).select('instructor');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const query = { course: req.params.courseId };

    if (req.user.role === 'student') {
      const enrolled = await Enrollment.exists({ student: req.user._id, course: req.params.courseId });
      if (!enrolled) {
        return res.status(403).json({ error: 'Enroll in this course before viewing quizzes.' });
      }
      query.isPublished = true;
    } else if (req.user.role === 'teacher' && !ensureTeacherOwnsCourse(course, req.user)) {
      return res.status(403).json({ error: 'You can only access quizzes for your own courses.' });
    }

    let quizzesQuery = Quiz.find(query).sort('-createdAt');
    if (req.user.role === 'student') {
      quizzesQuery = quizzesQuery.select('-questions.correctIndex');
    }

    const quizzes = await quizzesQuery;

    res.json({ quizzes });
  } catch (err) { next(err); }
});

// GET /api/quizzes/:id  (with answers — teacher/admin only)
router.get('/:id', protect, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id).populate('course', 'title instructor');
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

    const isInstructor =
      req.user.role === 'admin' ||
      quiz.course?.instructor?.toString() === req.user._id.toString();

    if (!isInstructor) {
      quiz.questions.forEach((q) => { q.correctIndex = undefined; });
    }
    res.json({ quiz });
  } catch (err) { next(err); }
});

// POST /api/quizzes
router.post('/', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    const { course: courseId, title, description, timeLimit, passingScore, xpReward, isPublished, questions } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required.' });
    }

    const course = await Course.findById(courseId).select('title instructor');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (!ensureTeacherOwnsCourse(course, req.user)) {
      return res.status(403).json({ error: 'You can only create quizzes for your own courses.' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required.' });
    }

    const normalizedQuestions = questions
      .map((item) => ({
        text: String(item.text || '').trim(),
        options: Array.isArray(item.options)
          ? item.options.map((option) => String(option || '').trim()).filter(Boolean)
          : [],
        correctIndex: Number(item.correctIndex),
        explanation: String(item.explanation || '').trim(),
        points: Number(item.points) > 0 ? Number(item.points) : 1,
      }))
      .filter((item) => item.text && item.options.length >= 2 && Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < item.options.length);

    if (normalizedQuestions.length === 0) {
      return res.status(400).json({ error: 'Provide valid quiz questions with options and correct answers.' });
    }

    const quiz = await Quiz.create({
      course: courseId,
      title: String(title || '').trim(),
      description: String(description || '').trim(),
      timeLimit: Number(timeLimit) > 0 ? Number(timeLimit) : 30,
      passingScore: Number(passingScore) > 0 ? Number(passingScore) : 70,
      xpReward: Number(xpReward) > 0 ? Number(xpReward) : 50,
      isPublished: Boolean(isPublished),
      questions: normalizedQuestions,
    });

    let notifiedStudents = 0;

    if (quiz.isPublished) {
      const enrollments = await Enrollment.find({ course: courseId }).select('student');
      const studentIds = Array.from(new Set(enrollments.map((enrollment) => String(enrollment.student))));
      notifiedStudents = studentIds.length;

      if (studentIds.length > 0) {
        await createNotifications({
          io: req.io,
          entries: studentIds.map((studentId) => ({
            user: studentId,
            type: 'quiz-created',
            title: 'New quiz available',
            message: `${req.user.name} published quiz "${quiz.title}" in ${course.title}.`,
            payload: {
              courseId: course._id,
              quizId: quiz._id,
              route: `/courses/${course._id}?tab=assessments`,
            },
          })),
        });
      }
    }

    res.status(201).json({ quiz, notifiedStudents });
  } catch (err) { next(err); }
});

// PUT /api/quizzes/:id
router.put('/:id', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ quiz });
  } catch (err) { next(err); }
});

// POST /api/quizzes/:id/attempt
router.post('/:id/attempt', protect, restrictTo('student'), async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

    const { answers, timeTaken } = req.body;

    let correct = 0;
    const details = answers.map((a, i) => {
      const q = quiz.questions[i];
      const isCorrect = q && a.selectedIndex === q.correctIndex;
      if (isCorrect) correct++;
      return { questionIndex: i, selectedIndex: a.selectedIndex, isCorrect };
    });

    const score = Math.round((correct / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    const attempt = await QuizAttempt.create({
      student: req.user._id,
      quiz: quiz._id,
      answers: answers.map((a, i) => ({ questionIndex: i, selectedIndex: a.selectedIndex })),
      score,
      passed,
      timeTaken,
      completedAt: new Date(),
    });

    let awardedBadges = [];

    // Award XP if passed
    if (passed) {
      const updatedUser = await addXpToUser(req.user._id, quiz.xpReward);

      const badgeCriteria = ['reach_expert'];
      if (score === 100) {
        badgeCriteria.push('perfect_quiz');
      }

      awardedBadges = await awardEligibleBadges(req.user._id, badgeCriteria, {
        score,
        userDoc: updatedUser,
      });
    }

    res.json({
      attempt: { ...attempt.toObject(), details, totalQuestions: quiz.questions.length, correct },
      awardedBadges,
    });
  } catch (err) { next(err); }
});

// GET /api/quizzes/:id/results
router.get('/:id/results', protect, async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ quiz: req.params.id, student: req.user._id })
      .sort('-completedAt').limit(5);
    res.json({ attempts });
  } catch (err) { next(err); }
});

// POST /api/quizzes/feedback
router.post('/feedback', protect, getQuizFeedback);

module.exports = router;
