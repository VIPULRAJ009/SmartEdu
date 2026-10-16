const express = require('express');
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/auth');
const {
  getSkillMap,
  analyzeSkills,
  addManualSkill,
  getMarketTrends,
} = require('../controllers/aiController');
const { Badge, UserBadge, Discussion, Enrollment, Chat } = require('../models/index');
const Course = require('../models/Course');
const User = require('../models/User');
const { awardEligibleBadges, ensureBadgeCatalog } = require('../utils/gamification');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const toDirectKey = (leftId, rightId) => [String(leftId), String(rightId)].sort().join(':');
const isChatParticipant = (chat, userId) =>
  chat.participants.some((participantId) => participantId.toString() === userId.toString());
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toSafeRegex = (value = '') => {
  const keyword = String(value || '').trim();
  return keyword ? new RegExp(escapeRegex(keyword), 'i') : null;
};

// ─── Skills ───────────────────────────────────────────────────────────────────
const skillRouter = express.Router();
skillRouter.get('/map', protect, getSkillMap);
skillRouter.post('/analyze', protect, analyzeSkills);
skillRouter.post('/manual', protect, addManualSkill);

// ─── Market ───────────────────────────────────────────────────────────────────
const marketRouter = express.Router();
marketRouter.get('/trends', protect, getMarketTrends);

// ─── Badges ───────────────────────────────────────────────────────────────────
const badgeRouter = express.Router();
badgeRouter.get('/', protect, async (req, res, next) => {
  try {
    await ensureBadgeCatalog();

    const [all, earned] = await Promise.all([
      Badge.find().sort('rarity name'),
      UserBadge.find({ user: req.user._id }).populate('badge'),
    ]);
    const earnedIds = new Set(earned.map(ub => ub.badge._id.toString()));
    const badges = all.map(b => ({
      ...b.toObject(),
      earned: earnedIds.has(b._id.toString()),
      earnedAt: earned.find(ub => ub.badge._id.toString() === b._id.toString())?.awardedAt || null,
    }));
    res.json({ badges });
  } catch (err) { next(err); }
});

badgeRouter.post('/', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const badge = await Badge.create(req.body);
    res.status(201).json({ badge });
  } catch (err) { next(err); }
});

// ─── Discussions ──────────────────────────────────────────────────────────────
const discussionRouter = express.Router();

// Legacy course thread discussions
discussionRouter.get('/course/:courseId', protect, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.courseId)) {
      return res.status(400).json({ error: 'Invalid course ID.' });
    }

    const discussions = await Discussion.find({ course: req.params.courseId })
      .populate('messages.author', 'name avatar role')
      .populate('messages.replies.author', 'name avatar')
      .sort('-updatedAt');
    res.json({ discussions });
  } catch (err) { next(err); }
});

discussionRouter.post('/', protect, async (req, res, next) => {
  try {
    const { courseId, title, content } = req.body;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ error: 'A valid course ID is required.' });
    }
    if (!title?.trim()) {
      return res.status(400).json({ error: 'Discussion title is required.' });
    }
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Discussion content is required.' });
    }

    const course = await Course.findById(courseId).select('instructor');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (req.user.role === 'student') {
      const isEnrolled = await Enrollment.exists({ student: req.user._id, course: courseId });
      if (!isEnrolled) {
        return res.status(403).json({ error: 'Enroll in this course before posting discussions.' });
      }
    }

    if (req.user.role === 'teacher' && course.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only create discussions for your own courses.' });
    }

    const discussion = await Discussion.create({
      course: courseId,
      title: title.trim(),
      messages: [{
        author: req.user._id,
        content: content.trim(),
      }],
    });
    const populated = await discussion.populate('messages.author', 'name avatar role');

    const discussionCount = await Discussion.countDocuments({ 'messages.0.author': req.user._id });
    const awardedBadges = await awardEligibleBadges(req.user._id, ['discussions_10'], {
      discussionCount,
    });

    req.io.to(`course:${courseId}`).emit('new-discussion', populated);
    res.status(201).json({ discussion: populated, awardedBadges });
  } catch (err) { next(err); }
});

discussionRouter.post('/:id/reply', protect, async (req, res, next) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    if (!discussion) return res.status(404).json({ error: 'Discussion not found.' });

    const msgIndex = discussion.messages.findIndex(m => m._id.toString() === req.body.messageId);
    if (msgIndex === -1) return res.status(404).json({ error: 'Message not found.' });

    discussion.messages[msgIndex].replies.push({
      author: req.user._id,
      content: req.body.content,
    });
    await discussion.save();

    req.io.to(`course:${discussion.course.toString()}`).emit('new-reply', {
      discussionId: discussion._id,
      messageId: req.body.messageId,
    });
    res.json({ discussion });
  } catch (err) { next(err); }
});

// Search users for starting a direct chat
discussionRouter.get('/contacts', protect, async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const searchRegex = toSafeRegex(search);

    const query = {
      _id: { $ne: req.user._id },
      isActive: true,
      role: { $in: ['student', 'teacher'] },
    };

    if (searchRegex) {
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
      ];
    }

    if (req.user.role === 'admin') {
      delete query.role;
    }

    const users = await User.find(query)
      .select('name email avatar role')
      .sort('name');

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

discussionRouter.get('/chats/direct', protect, async (req, res, next) => {
  try {
    const { search = '' } = req.query;

    const chats = await Chat.find({
      type: 'direct',
      participants: req.user._id,
    })
      .populate('participants', 'name avatar role')
      .sort('-lastMessageAt');

    const mapped = chats.map((chat) => {
      const serialized = chat.toObject();
      const otherParticipant = serialized.participants.find(
        (participant) => participant._id.toString() !== req.user._id.toString()
      ) || serialized.participants[0];

      return {
        ...serialized,
        otherParticipant,
      };
    });

    const filtered = search
      ? mapped.filter((chat) =>
          chat.otherParticipant?.name?.toLowerCase().includes(String(search).toLowerCase())
        )
      : mapped;

    res.json({ chats: filtered });
  } catch (err) {
    next(err);
  }
});

discussionRouter.post('/chats/direct', protect, async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ error: 'A valid user ID is required.' });
    }

    if (String(userId) === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot start a direct chat with yourself.' });
    }

    const targetUser = await User.findById(userId).select('role isActive');
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const directKey = toDirectKey(req.user._id, userId);
    let chat = await Chat.findOne({ type: 'direct', directKey })
      .populate('participants', 'name avatar role');

    if (!chat) {
      chat = await Chat.create({
        type: 'direct',
        directKey,
        createdBy: req.user._id,
        participants: [req.user._id, userId],
        messages: [],
      });

      chat = await Chat.findById(chat._id)
        .populate('participants', 'name avatar role');
    }

    const serialized = chat.toObject();
    const otherParticipant = serialized.participants.find(
      (participant) => participant._id.toString() !== req.user._id.toString()
    ) || serialized.participants[0];

    res.json({
      chat: {
        ...serialized,
        otherParticipant,
      },
    });
  } catch (err) {
    next(err);
  }
});

discussionRouter.get('/chats/groups', protect, async (req, res, next) => {
  try {
    const query = {
      type: 'group',
      participants: req.user._id,
    };

    if (req.query.courseId && isValidObjectId(req.query.courseId)) {
      query.course = req.query.courseId;
    }

    const chats = await Chat.find(query)
      .populate('participants', 'name avatar role')
      .populate('course', 'title banner thumbnail')
      .sort('-lastMessageAt');

    res.json({ chats });
  } catch (err) {
    next(err);
  }
});

discussionRouter.post('/chats/groups', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    const { courseId, name } = req.body;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ error: 'A valid course ID is required.' });
    }

    const course = await Course.findById(courseId).select('title instructor');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (req.user.role === 'teacher' && course.instructor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only create groups for your own courses.' });
    }

    const enrollments = await Enrollment.find({ course: courseId }).select('student');
    const enrolledStudents = enrollments.map((enrollment) => enrollment.student.toString());

    const participants = Array.from(new Set([req.user._id.toString(), ...enrolledStudents]));

    const chat = await Chat.create({
      type: 'group',
      name: String(name || '').trim() || `${course.title} Group`,
      course: courseId,
      createdBy: req.user._id,
      participants,
      messages: [],
    });

    const populated = await Chat.findById(chat._id)
      .populate('participants', 'name avatar role')
      .populate('course', 'title banner thumbnail');

    res.status(201).json({
      chat: populated,
      addedStudents: participants.length - 1,
    });
  } catch (err) {
    next(err);
  }
});

discussionRouter.get('/chats/:chatId', protect, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID.' });
    }

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    if (!isChatParticipant(chat, req.user._id)) {
      return res.status(403).json({ error: 'You are not part of this chat.' });
    }

    await chat.populate('participants', 'name avatar role');
    await chat.populate('messages.sender', 'name avatar role');
    await chat.populate('course', 'title banner thumbnail');

    res.json({ chat });
  } catch (err) {
    next(err);
  }
});

discussionRouter.post('/chats/:chatId/messages', protect, async (req, res, next) => {
  try {
    const { content } = req.body;

    if (!isValidObjectId(req.params.chatId)) {
      return res.status(400).json({ error: 'Invalid chat ID.' });
    }

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    if (!isChatParticipant(chat, req.user._id)) {
      return res.status(403).json({ error: 'You are not part of this chat.' });
    }

    chat.messages.push({
      sender: req.user._id,
      content: String(content).trim(),
    });
    chat.lastMessageAt = new Date();
    await chat.save();

    await chat.populate('messages.sender', 'name avatar role');
    const message = chat.messages[chat.messages.length - 1];

    req.io.to(`chat:${chat._id.toString()}`).emit('new-chat-message', {
      chatId: chat._id.toString(),
      message,
    });

    res.status(201).json({ message, chatId: chat._id.toString() });
  } catch (err) {
    next(err);
  }
});

// ─── Users ────────────────────────────────────────────────────────────────────
const userRouter = express.Router();
userRouter.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

userRouter.put('/profile', protect, async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'institution', 'course', 'careerGoals', 'avatar'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true,
    });
    res.json({ user });
  } catch (err) { next(err); }
});

userRouter.get('/leaderboard', protect, async (req, res, next) => {
  try {
    const users = await User.find({ isActive: true, role: 'student' })
      .select('name avatar xp level streak')
      .sort('-xp').limit(20);
    res.json({ leaderboard: users });
  } catch (err) { next(err); }
});

userRouter.get('/students', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    const { courseId = '', search = '' } = req.query;

    const baseCourseQuery = req.user.role === 'teacher'
      ? { instructor: req.user._id }
      : {};

    const availableCourses = await Course.find(baseCourseQuery)
      .select('title')
      .sort('title');

    if (availableCourses.length === 0) {
      return res.json({ courses: [], students: [] });
    }

    let allowedCourseIds = availableCourses.map((course) => course._id.toString());

    if (courseId) {
      if (!isValidObjectId(courseId)) {
        return res.status(400).json({ error: 'Invalid course ID.' });
      }

      const targetId = String(courseId);
      if (!allowedCourseIds.includes(targetId)) {
        return res.status(403).json({ error: 'Not authorized to view students for this course.' });
      }

      allowedCourseIds = [targetId];
    }

    const enrollments = await Enrollment.find({
      course: { $in: allowedCourseIds },
    })
      .populate('student', 'name email avatar level xp streak role isActive')
      .populate('course', 'title')
      .sort('-updatedAt');

    const keyword = String(search || '').trim().toLowerCase();
    const studentMap = new Map();

    enrollments.forEach((enrollment) => {
      const student = enrollment.student;
      const course = enrollment.course;

      if (!student || !course) return;
      if (student.role !== 'student') return;

      const fullName = String(student.name || '').trim();
      const email = String(student.email || '').trim();

      if (
        keyword &&
        !fullName.toLowerCase().includes(keyword) &&
        !email.toLowerCase().includes(keyword)
      ) {
        return;
      }

      const studentId = String(student._id);
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          _id: student._id,
          name: fullName,
          email,
          avatar: student.avatar || '',
          level: student.level,
          xp: Number(student.xp || 0),
          streak: Number(student.streak || 0),
          enrollments: [],
        });
      }

      const row = studentMap.get(studentId);
      row.enrollments.push({
        courseId: course._id,
        courseTitle: course.title,
        progress: Number(enrollment.progress || 0),
        completedAt: enrollment.completedAt || null,
      });
    });

    const students = Array.from(studentMap.values())
      .sort((left, right) => right.xp - left.xp || left.name.localeCompare(right.name));

    res.json({
      courses: availableCourses.map((course) => ({
        _id: course._id,
        title: course.title,
      })),
      students,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────
const adminRouter = express.Router();
adminRouter.use(protect, restrictTo('admin'));

adminRouter.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, totalCourses, totalEnrollments, activeStudents] = await Promise.all([
      User.countDocuments(),
      require('../models/Course').countDocuments(),
      Enrollment.countDocuments(),
      User.countDocuments({ role: 'student', isActive: true }),
    ]);
    res.json({ stats: { totalUsers, totalCourses, totalEnrollments, activeStudents } });
  } catch (err) { next(err); }
});

adminRouter.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const pageNumber = Math.max(Number.parseInt(String(page), 10) || 1, 1);
    const pageLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 20, 1), 100);
    const searchRegex = toSafeRegex(search);
    const query = {};
    if (role) query.role = String(role).trim();
    if (searchRegex) query.$or = [
      { name: searchRegex },
      { email: searchRegex },
    ];

    const [users, total] = await Promise.all([
      User.find(query).sort('-createdAt').skip((pageNumber - 1) * pageLimit).limit(pageLimit),
      User.countDocuments(query),
    ]);
    res.json({ users, total, page: pageNumber, limit: pageLimit });
  } catch (err) { next(err); }
});

adminRouter.put('/users/:id/toggle', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ user });
  } catch (err) { next(err); }
});

adminRouter.put('/users/:id/role', async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true }
    );
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = { skillRouter, marketRouter, badgeRouter, discussionRouter, userRouter, adminRouter };
