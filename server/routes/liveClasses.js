const express = require('express');
const mongoose = require('mongoose');
const { protect, restrictTo } = require('../middleware/auth');
const LiveClass = require('../models/LiveClass');
const Notification = require('../models/Notification');
const Course = require('../models/Course');
const { Enrollment, Chat } = require('../models/index');
const { createNotifications } = require('../utils/notifications');

const router = express.Router();

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createMeetingCode = (courseId) => {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `CLS-${String(courseId).slice(-4).toUpperCase()}-${suffix}`;
};

const ensureTeacherOwnership = (course, user) => {
  if (user.role === 'admin') return true;
  return String(course.instructor) === String(user._id);
};

const ensureCourseGroupChat = async ({ courseId, courseTitle, teacherId, studentIds }) => {
  const participants = Array.from(
    new Set([String(teacherId), ...(studentIds || []).map((studentId) => String(studentId))])
  );

  let groupChat = await Chat.findOne({ type: 'group', course: courseId }).select('_id participants');

  if (!groupChat) {
    return Chat.create({
      type: 'group',
      name: `${String(courseTitle || 'Course').trim()} Live Class`,
      course: courseId,
      createdBy: teacherId,
      participants,
      messages: [],
    });
  }

  const existingParticipants = new Set(groupChat.participants.map((participantId) => String(participantId)));
  const missingParticipants = participants.filter((participantId) => !existingParticipants.has(participantId));

  if (missingParticipants.length > 0) {
    await Chat.findByIdAndUpdate(groupChat._id, {
      $addToSet: {
        participants: { $each: missingParticipants },
      },
    });
  }

  return groupChat;
};

const serializeClass = (liveClass, currentUserId) => {
  const serialized = liveClass.toObject();
  const participants = serialized.participants || [];
  const teacherId = serialized.teacher?._id || serialized.teacher;

  const currentParticipant = participants.find(
    (participant) => String(participant.student?._id || participant.student) === String(currentUserId)
  );
  const isRegistered = Boolean(currentParticipant);
  const joinedCount = participants.filter((participant) => Boolean(participant.joinedAt)).length;
  const currentUserCameraApproved = String(teacherId) === String(currentUserId)
    || Boolean(currentParticipant?.cameraApproved);

  return {
    ...serialized,
    registeredCount: participants.length,
    joinedCount,
    isRegistered,
    currentUserCameraApproved,
    canJoin: serialized.status === 'live' && (isRegistered || String(serialized.teacher?._id || serialized.teacher) === String(currentUserId)),
  };
};

router.get('/', protect, async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status && ['scheduled', 'live', 'completed', 'cancelled'].includes(String(status))) {
      query.status = String(status);
    }

    if (req.user.role === 'student') {
      query['participants.student'] = req.user._id;
      if (!query.status) {
        query.status = { $in: ['scheduled', 'live'] };
      }
    } else if (req.user.role === 'teacher') {
      query.teacher = req.user._id;
    }

    const classes = await LiveClass.find(query)
      .populate('course', 'title instructor banner thumbnail')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role')
      .sort({ scheduledAt: 1, createdAt: -1 })
      .limit(120);

    res.json({
      classes: classes.map((item) => serializeClass(item, req.user._id)),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/schedule', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    const { courseId, title, agenda = '', scheduledAt, durationMinutes = 45 } = req.body;

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ error: 'A valid course ID is required.' });
    }

    if (!String(title || '').trim()) {
      return res.status(400).json({ error: 'Class topic is required.' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'A valid class date and time is required.' });
    }

    const course = await Course.findById(courseId).select('title instructor');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    if (!ensureTeacherOwnership(course, req.user)) {
      return res.status(403).json({ error: 'You can only schedule live classes for your own courses.' });
    }

    const enrollments = await Enrollment.find({ course: courseId }).select('student');
    const uniqueStudentIds = Array.from(
      new Set(enrollments.map((enrollment) => String(enrollment.student)))
    );

    const participants = uniqueStudentIds.map((studentId) => ({
      student: studentId,
      registeredAt: new Date(),
      joinedAt: null,
    }));

    await ensureCourseGroupChat({
      courseId: course._id,
      courseTitle: course.title,
      teacherId: req.user._id,
      studentIds: uniqueStudentIds,
    });

    let meetingCode = createMeetingCode(courseId);
    const existing = await LiveClass.findOne({ meetingCode }).select('_id');
    if (existing) {
      meetingCode = createMeetingCode(`${courseId}-${Date.now()}`);
    }

    const liveClass = await LiveClass.create({
      course: courseId,
      teacher: req.user._id,
      title: String(title).trim(),
      agenda: String(agenda || '').trim(),
      scheduledAt: scheduledDate,
      durationMinutes: Math.max(10, Math.min(300, Number(durationMinutes) || 45)),
      status: 'scheduled',
      meetingCode,
      participants,
    });

    if (participants.length > 0) {
      await createNotifications({
        io: req.io,
        entries: participants.map((participant) => ({
          user: participant.student,
          type: 'live-class-scheduled',
          title: 'New live class scheduled',
          message: `${req.user.name} scheduled ${liveClass.title} for ${course.title}.`,
          payload: {
            liveClassId: liveClass._id,
            courseId: course._id,
            scheduledAt: liveClass.scheduledAt,
            status: liveClass.status,
          },
        })),
      });
    }

    const populated = await LiveClass.findById(liveClass._id)
      .populate('course', 'title instructor banner thumbnail')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role');

    res.status(201).json({
      liveClass: serializeClass(populated, req.user._id),
      autoRegisteredStudents: participants.length,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid live class ID.' });
    }

    const liveClass = await LiveClass.findById(req.params.id)
      .populate('course', 'title instructor')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role');

    if (!liveClass) {
      return res.status(404).json({ error: 'Live class not found.' });
    }

    if (req.user.role !== 'admin' && String(liveClass.teacher._id || liveClass.teacher) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the class teacher can start this class.' });
    }

    if (liveClass.status !== 'live') {
      liveClass.status = 'live';
      liveClass.startedAt = new Date();
      await liveClass.save();

      const studentIds = liveClass.participants.map((participant) => participant.student?._id || participant.student);

      await ensureCourseGroupChat({
        courseId: liveClass.course?._id || liveClass.course,
        courseTitle: liveClass.course?.title || liveClass.title,
        teacherId: liveClass.teacher?._id || liveClass.teacher,
        studentIds,
      });

      if (studentIds.length > 0) {
        await createNotifications({
          io: req.io,
          entries: studentIds.map((studentId) => ({
            user: studentId,
            type: 'live-class-started',
            title: 'Live class is starting now',
            message: `${liveClass.title} is now live. Tap to join.`,
            payload: {
              liveClassId: liveClass._id,
              courseId: liveClass.course?._id || liveClass.course,
              meetingCode: liveClass.meetingCode,
              status: 'live',
            },
          })),
        });
      }
    }

    const refreshed = await LiveClass.findById(liveClass._id)
      .populate('course', 'title instructor banner thumbnail')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role');

    res.json({
      liveClass: serializeClass(refreshed, req.user._id),
      message: 'Class is now live. Students have been notified.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/end', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid live class ID.' });
    }

    const liveClass = await LiveClass.findById(req.params.id)
      .populate('teacher', 'name avatar');

    if (!liveClass) {
      return res.status(404).json({ error: 'Live class not found.' });
    }

    if (req.user.role !== 'admin' && String(liveClass.teacher._id || liveClass.teacher) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the class teacher can end this class.' });
    }

    if (liveClass.status !== 'completed') {
      liveClass.status = 'completed';
      liveClass.endedAt = new Date();
      await liveClass.save();
    }

    res.json({ message: 'Class has been ended.' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/join', protect, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid live class ID.' });
    }

    const liveClass = await LiveClass.findById(req.params.id)
      .populate('teacher', 'name avatar')
      .populate('course', 'title');

    if (!liveClass) {
      return res.status(404).json({ error: 'Live class not found.' });
    }

    const isTeacher = String(liveClass.teacher._id || liveClass.teacher) === String(req.user._id);
    const participantIndex = liveClass.participants.findIndex(
      (participant) => String(participant.student) === String(req.user._id)
    );

    if (!isTeacher && participantIndex === -1 && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not registered for this class.' });
    }

    if (liveClass.status !== 'live') {
      return res.status(400).json({ error: 'Class has not started yet.' });
    }

    if (participantIndex >= 0 && !liveClass.participants[participantIndex].joinedAt) {
      liveClass.participants[participantIndex].joinedAt = new Date();
      await liveClass.save();
    }

    res.json({
      message: 'Joined live class.',
      liveClassId: liveClass._id,
      meetingCode: liveClass.meetingCode,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/participants/:studentId/camera/grant', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid live class or student ID.' });
    }

    const liveClass = await LiveClass.findById(req.params.id)
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar role')
      .populate('spotlightStudent', 'name avatar role');

    if (!liveClass) {
      return res.status(404).json({ error: 'Live class not found.' });
    }

    if (req.user.role !== 'admin' && String(liveClass.teacher._id || liveClass.teacher) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the class teacher can grant camera access.' });
    }

    const participantIndex = liveClass.participants.findIndex(
      (participant) => String(participant.student?._id || participant.student) === String(req.params.studentId)
    );

    if (participantIndex < 0) {
      return res.status(404).json({ error: 'Student is not registered for this class.' });
    }

    liveClass.participants[participantIndex].cameraApproved = true;
    liveClass.participants[participantIndex].cameraApprovedAt = new Date();
    await liveClass.save();

    req.io.to(`live-class:${liveClass._id}`).emit('live-class:settings-updated', {
      liveClassId: String(liveClass._id),
      type: 'camera-granted',
      studentId: String(req.params.studentId),
    });

    const refreshed = await LiveClass.findById(liveClass._id)
      .populate('course', 'title instructor banner thumbnail')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role');

    res.json({
      message: 'Student camera permission granted.',
      liveClass: serializeClass(refreshed, req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/participants/:studentId/camera/revoke', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ error: 'Invalid live class or student ID.' });
    }

    const liveClass = await LiveClass.findById(req.params.id)
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar role')
      .populate('spotlightStudent', 'name avatar role');

    if (!liveClass) {
      return res.status(404).json({ error: 'Live class not found.' });
    }

    if (req.user.role !== 'admin' && String(liveClass.teacher._id || liveClass.teacher) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the class teacher can revoke camera access.' });
    }

    const participantIndex = liveClass.participants.findIndex(
      (participant) => String(participant.student?._id || participant.student) === String(req.params.studentId)
    );

    if (participantIndex < 0) {
      return res.status(404).json({ error: 'Student is not registered for this class.' });
    }

    liveClass.participants[participantIndex].cameraApproved = false;
    liveClass.participants[participantIndex].cameraApprovedAt = null;

    if (String(liveClass.spotlightStudent || '') === String(req.params.studentId)) {
      liveClass.spotlightStudent = null;
    }

    await liveClass.save();

    req.io.to(`live-class:${liveClass._id}`).emit('live-class:settings-updated', {
      liveClassId: String(liveClass._id),
      type: 'camera-revoked',
      studentId: String(req.params.studentId),
    });

    const refreshed = await LiveClass.findById(liveClass._id)
      .populate('course', 'title instructor banner thumbnail')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role');

    res.json({
      message: 'Student camera permission revoked.',
      liveClass: serializeClass(refreshed, req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/spotlight', protect, restrictTo('teacher', 'admin'), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid live class ID.' });
    }

    const { studentId = null } = req.body;

    if (studentId !== null && !isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID.' });
    }

    const liveClass = await LiveClass.findById(req.params.id)
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar role')
      .populate('spotlightStudent', 'name avatar role');

    if (!liveClass) {
      return res.status(404).json({ error: 'Live class not found.' });
    }

    if (req.user.role !== 'admin' && String(liveClass.teacher._id || liveClass.teacher) !== String(req.user._id)) {
      return res.status(403).json({ error: 'Only the class teacher can set spotlight camera.' });
    }

    if (studentId === null) {
      liveClass.spotlightStudent = null;
    } else {
      const participant = liveClass.participants.find(
        (item) => String(item.student?._id || item.student) === String(studentId)
      );

      if (!participant) {
        return res.status(404).json({ error: 'Student is not registered for this class.' });
      }

      if (!participant.cameraApproved) {
        return res.status(400).json({ error: 'Grant camera permission before spotlighting this student.' });
      }

      liveClass.spotlightStudent = studentId;
    }

    await liveClass.save();

    req.io.to(`live-class:${liveClass._id}`).emit('live-class:settings-updated', {
      liveClassId: String(liveClass._id),
      type: 'spotlight-updated',
      studentId: studentId ? String(studentId) : null,
    });

    const refreshed = await LiveClass.findById(liveClass._id)
      .populate('course', 'title instructor banner thumbnail')
      .populate('teacher', 'name avatar')
      .populate('participants.student', 'name avatar')
      .populate('spotlightStudent', 'name avatar role');

    res.json({
      message: 'Spotlight updated.',
      liveClass: serializeClass(refreshed, req.user._id),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/feed', protect, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(limit),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/:id/read', protect, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid notification ID.' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications/read-all', protect, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
