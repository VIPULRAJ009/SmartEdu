const Course = require('../models/Course');
const {
  Enrollment,
  Assignment,
  Submission,
  Quiz,
  QuizAttempt,
} = require('../models/index');
const { awardEligibleBadges } = require('../utils/gamification');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
};

const normalizeCurriculum = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (typeof item === 'string') {
        const title = item.trim();
        if (!title) return null;
        return { title, description: '', order: index + 1 };
      }

      if (!item || typeof item !== 'object') return null;

      const title = String(item.title || '').trim();
      if (!title) return null;

      return {
        title,
        description: String(item.description || '').trim(),
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      };
    })
    .filter(Boolean);
};

const sanitizeCoursePayload = (body, { partial = false } = {}) => {
  const payload = { ...body };

  delete payload.instructor;
  delete payload.slug;
  delete payload.createdAt;
  delete payload.updatedAt;

  const shouldMap = (field) => !partial || Object.prototype.hasOwnProperty.call(body, field);

  if (shouldMap('price')) {
    const price = Number(body.price);
    payload.price = Number.isFinite(price) ? Math.max(0, price) : 0;
  }

  if (shouldMap('banner')) {
    payload.banner = String(body.banner || '').trim();
  }

  if (shouldMap('content')) {
    payload.content = String(body.content || '').trim();
  }

  if (shouldMap('curriculum')) {
    payload.curriculum = normalizeCurriculum(body.curriculum);
  }

  if (shouldMap('objectives')) {
    payload.objectives = normalizeStringArray(body.objectives);
  }

  if (shouldMap('prerequisites')) {
    payload.prerequisites = normalizeStringArray(body.prerequisites);
  }

  if (shouldMap('tags')) {
    payload.tags = normalizeStringArray(body.tags);
  }

  if (shouldMap('stages')) {
    payload.stages = normalizeStringArray(body.stages);
  }

  if (shouldMap('thumbnail')) {
    payload.thumbnail = String(body.thumbnail || '').trim();
  }

  // Keep legacy thumbnail aligned with the new banner field when thumbnail isn't explicitly set.
  if (payload.banner && (!payload.thumbnail || !String(payload.thumbnail).trim())) {
    payload.thumbnail = payload.banner;
  }

  return payload;
};

const getTotalCourseUnits = (course) => {
  const moduleUnits = Array.isArray(course.modules)
    ? course.modules.reduce((count, moduleItem) => count + (Array.isArray(moduleItem.lessons) ? moduleItem.lessons.length : 0), 0)
    : 0;

  if (moduleUnits > 0) return moduleUnits;

  const curriculumUnits = Array.isArray(course.curriculum) ? course.curriculum.length : 0;
  if (curriculumUnits > 0) return curriculumUnits;

  return 1;
};

// GET /api/courses
exports.getCourses = async (req, res, next) => {
  try {
    const {
      search,
      category,
      difficulty,
      page = 1,
      limit = 12,
      sort = '-createdAt',
    } = req.query;
    const normalizedSearch = String(search || '').trim();
    const pageNumber = Math.max(Number.parseInt(String(page), 10) || 1, 1);
    const pageLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 12, 1), 50);
    const sortValue = String(sort || '').trim() || '-createdAt';

    const query = { isPublished: true };

    if (normalizedSearch) {
      const searchRegex = new RegExp(escapeRegex(normalizedSearch), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { content: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
      ];
    }
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const skip = (pageNumber - 1) * pageLimit;

    const [courses, total] = await Promise.all([
      Course.find(query)
        .populate('instructor', 'name avatar')
        .sort(sortValue)
        .skip(skip)
        .limit(pageLimit)
        .select('-modules'),
      Course.countDocuments(query),
    ]);

    res.json({
      courses,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageLimit),
        limit: pageLimit,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/courses/:id
exports.getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name avatar bio');

    if (!course) return res.status(404).json({ error: 'Course not found.' });

    // Check if user is enrolled (for authenticated requests)
    let isEnrolled = false;
    let enrollment = null;

    if (req.user?.role === 'student') {
      enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: course._id,
      }).select('progress completedLessons completedAt grade');

      isEnrolled = !!enrollment;
    }

    res.json({ course, isEnrolled, enrollment });
  } catch (err) {
    next(err);
  }
};

// POST /api/courses
exports.createCourse = async (req, res, next) => {
  try {
    const payload = sanitizeCoursePayload(req.body, { partial: false });
    const course = await Course.create({
      ...payload,
      instructor: req.user._id,
    });
    res.status(201).json({ course });
  } catch (err) {
    next(err);
  }
};

// PUT /api/courses/:id
exports.updateCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    if (
      course.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized to update this course.' });
    }

    const payload = sanitizeCoursePayload(req.body, { partial: true });

    const updated = await Course.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );
    res.json({ course: updated });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/courses/:id
exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    if (
      course.instructor.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized to delete this course.' });
    }

    await course.deleteOne();
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/courses/:id/enroll
exports.enrollCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });
    if (!course.isPublished) return res.status(400).json({ error: 'Course is not published yet.' });

    const existing = await Enrollment.findOne({ student: req.user._id, course: course._id });
    if (existing) return res.status(409).json({ error: 'Already enrolled in this course.' });

    const enrollment = await Enrollment.create({
      student: req.user._id,
      course: course._id,
    });

    await Course.findByIdAndUpdate(course._id, { $inc: { enrollmentCount: 1 } });

    const enrollmentCount = await Enrollment.countDocuments({ student: req.user._id });
    const awardedBadges = await awardEligibleBadges(req.user._id, ['enroll_5'], {
      enrollmentCount,
    });

    res.status(201).json({ enrollment, awardedBadges });
  } catch (err) {
    next(err);
  }
};

// POST /api/courses/:id/progress
exports.updateCourseProgress = async (req, res, next) => {
  try {
    const lessonId = String(req.body.lessonId || '').trim();
    if (!lessonId) {
      return res.status(400).json({ error: 'lessonId is required.' });
    }

    const [course, enrollment] = await Promise.all([
      Course.findById(req.params.id).select('modules curriculum'),
      Enrollment.findOne({ student: req.user._id, course: req.params.id }),
    ]);

    if (!course) return res.status(404).json({ error: 'Course not found.' });
    if (!enrollment) {
      return res.status(403).json({ error: 'You must enroll in this course before updating progress.' });
    }

    if (!enrollment.completedLessons.includes(lessonId)) {
      enrollment.completedLessons.push(lessonId);
    }

    const uniqueCompletedLessons = Array.from(
      new Set(
        enrollment.completedLessons
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    );

    enrollment.completedLessons = uniqueCompletedLessons;

    const totalUnits = getTotalCourseUnits(course);
    const completedUnits = uniqueCompletedLessons.length;
    enrollment.progress = Math.min(100, Math.round((completedUnits / totalUnits) * 100));

    if (enrollment.progress >= 100 && !enrollment.completedAt) {
      enrollment.completedAt = new Date();
    }

    await enrollment.save();

    const awardedBadges = await awardEligibleBadges(req.user._id, ['complete_first_lesson', 'complete_course'], {
      completedLessonsCount: completedUnits,
      progress: enrollment.progress,
      completedAt: enrollment.completedAt,
    });

    res.json({ enrollment, awardedBadges });
  } catch (err) {
    next(err);
  }
};

// GET /api/courses/my-courses (teacher's courses)
exports.getMyCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ instructor: req.user._id })
      .sort('-createdAt')
      .select('-modules');
    res.json({ courses });
  } catch (err) {
    next(err);
  }
};

// GET /api/courses/enrolled (student's enrollments)
exports.getEnrolledCourses = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate({
        path: 'course',
        populate: { path: 'instructor', select: 'name avatar' },
        select: '-modules',
      })
      .sort('-updatedAt');
    res.json({ enrollments });
  } catch (err) {
    next(err);
  }
};

// GET /api/courses/:id/analytics
exports.getCourseAnalytics = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id).select('title instructor');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (
      req.user.role !== 'admin' &&
      String(course.instructor) !== String(req.user._id)
    ) {
      return res.status(403).json({ error: 'Not authorized to view analytics for this course.' });
    }

    const [enrollments, assignments, quizzes] = await Promise.all([
      Enrollment.find({ course: course._id }).select('student progress completedAt'),
      Assignment.find({ course: course._id }).select('title dueDate createdAt'),
      Quiz.find({ course: course._id }).select('title passingScore createdAt'),
    ]);

    const assignmentIds = assignments.map((assignment) => assignment._id);
    const quizIds = quizzes.map((quiz) => quiz._id);

    const [submissions, quizAttempts] = await Promise.all([
      assignmentIds.length > 0
        ? Submission.find({ assignment: { $in: assignmentIds } })
            .select('assignment student status score createdAt')
        : [],
      quizIds.length > 0
        ? QuizAttempt.find({ quiz: { $in: quizIds } })
            .select('quiz student score passed completedAt')
        : [],
    ]);

    const totalStudents = enrollments.length;
    const completedCourseStudents = enrollments.filter((enrollment) => Number(enrollment.progress || 0) >= 100).length;

    const assignmentSummaryMap = new Map(
      assignments.map((assignment) => [String(assignment._id), {
        _id: assignment._id,
        title: assignment.title,
        dueDate: assignment.dueDate,
        submissions: 0,
        gradedSubmissions: 0,
        uniqueStudents: 0,
        onTimeSubmissions: 0,
        lateSubmissions: 0,
      }])
    );

    const assignmentStudentsMap = new Map();

    submissions.forEach((submission) => {
      const assignmentId = String(submission.assignment);
      const summary = assignmentSummaryMap.get(assignmentId);
      if (!summary) return;

      summary.submissions += 1;
      if (submission.status === 'graded') {
        summary.gradedSubmissions += 1;
      }

      const studentSet = assignmentStudentsMap.get(assignmentId) || new Set();
      studentSet.add(String(submission.student));
      assignmentStudentsMap.set(assignmentId, studentSet);

      const dueDate = summary.dueDate ? new Date(summary.dueDate).getTime() : null;
      const submittedAt = new Date(submission.createdAt).getTime();
      if (dueDate && submittedAt <= dueDate) summary.onTimeSubmissions += 1;
      else summary.lateSubmissions += 1;
    });

    assignmentSummaryMap.forEach((summary, assignmentId) => {
      summary.uniqueStudents = (assignmentStudentsMap.get(assignmentId) || new Set()).size;
    });

    const quizSummaryMap = new Map(
      quizzes.map((quiz) => [String(quiz._id), {
        _id: quiz._id,
        title: quiz.title,
        passingScore: quiz.passingScore,
        attempts: 0,
        passedAttempts: 0,
        uniqueStudents: 0,
        averageScore: 0,
      }])
    );

    const quizStudentsMap = new Map();
    const quizScoreSum = new Map();

    quizAttempts.forEach((attempt) => {
      const quizId = String(attempt.quiz);
      const summary = quizSummaryMap.get(quizId);
      if (!summary) return;

      summary.attempts += 1;
      if (attempt.passed) summary.passedAttempts += 1;

      const studentSet = quizStudentsMap.get(quizId) || new Set();
      studentSet.add(String(attempt.student));
      quizStudentsMap.set(quizId, studentSet);

      const scoreTotal = Number(quizScoreSum.get(quizId) || 0) + Number(attempt.score || 0);
      quizScoreSum.set(quizId, scoreTotal);
    });

    quizSummaryMap.forEach((summary, quizId) => {
      summary.uniqueStudents = (quizStudentsMap.get(quizId) || new Set()).size;
      summary.averageScore = summary.attempts > 0
        ? Math.round((Number(quizScoreSum.get(quizId) || 0) / summary.attempts) * 100) / 100
        : 0;
    });

    const uniqueAssignmentCompleters = new Set(submissions.map((submission) => String(submission.student))).size;
    const uniqueQuizCompleters = new Set(quizAttempts.map((attempt) => String(attempt.student))).size;
    const averageQuizScore = quizAttempts.length > 0
      ? Math.round((quizAttempts.reduce((acc, attempt) => acc + Number(attempt.score || 0), 0) / quizAttempts.length) * 100) / 100
      : 0;

    res.json({
      course: {
        _id: course._id,
        title: course.title,
      },
      overview: {
        totalStudents,
        completedCourseStudents,
        courseCompletionRate: totalStudents > 0 ? Math.round((completedCourseStudents / totalStudents) * 100) : 0,
        totalAssignments: assignments.length,
        totalQuizzes: quizzes.length,
        totalAssignmentSubmissions: submissions.length,
        totalQuizAttempts: quizAttempts.length,
        uniqueAssignmentCompleters,
        uniqueQuizCompleters,
        averageQuizScore,
      },
      assignments: Array.from(assignmentSummaryMap.values()),
      quizzes: Array.from(quizSummaryMap.values()),
    });
  } catch (err) {
    next(err);
  }
};
