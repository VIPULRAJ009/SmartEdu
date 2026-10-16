const mongoose = require('mongoose');

// ── Enrollment ──────────────────────────────────────────────────────────────
const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    completedLessons: [String], // lesson IDs
    completedAt: Date,
    grade: { type: String, default: null },
  },
  { timestamps: true }
);
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

// ── Quiz ─────────────────────────────────────────────────────────────────────
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctIndex: { type: Number, required: true },
  explanation: String,
  points: { type: Number, default: 1 },
});

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    description: String,
    timeLimit: { type: Number, default: 30 }, // minutes
    passingScore: { type: Number, default: 70 }, // percentage
    questions: [questionSchema],
    isPublished: { type: Boolean, default: false },
    xpReward: { type: Number, default: 50 },
  },
  { timestamps: true }
);
const Quiz = mongoose.model('Quiz', quizSchema);

// ── Quiz Attempt ─────────────────────────────────────────────────────────────
const quizAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    answers: [{ questionIndex: Number, selectedIndex: Number }],
    score: Number, // percentage
    passed: Boolean,
    timeTaken: Number, // seconds
    aiFeedback: String,
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

// ── Assignment ────────────────────────────────────────────────────────────────
const assignmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    dueDate: { type: Date, required: true },
    maxScore: { type: Number, default: 100 },
    attachments: [String],
    xpReward: { type: Number, default: 100 },
  },
  { timestamps: true }
);
const Assignment = mongoose.model('Assignment', assignmentSchema);

// ── Submission ────────────────────────────────────────────────────────────────
const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: String,
    attachments: [String],
    score: { type: Number, default: null },
    feedback: String,
    aiFeedback: String,
    gradedAt: Date,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['submitted', 'graded', 'returned'],
      default: 'submitted',
    },
  },
  { timestamps: true }
);
const Submission = mongoose.model('Submission', submissionSchema);

// ── Skill ─────────────────────────────────────────────────────────────────────
const skillSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    proficiency: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['acquired', 'in-progress', 'gap'],
      default: 'gap',
    },
    source: {
      type: String,
      enum: ['ai', 'user'],
      default: 'ai',
    },
    lastAnalyzed: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
skillSchema.index({ user: 1, name: 1 }, { unique: true });
const Skill = mongoose.model('Skill', skillSchema);

// ── Badge ──────────────────────────────────────────────────────────────────
const badgeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    icon: String, // emoji or URL
    criteria: String,
    xpValue: { type: Number, default: 100 },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
  },
  { timestamps: true }
);
const Badge = mongoose.model('Badge', badgeSchema);

// ── User Badge ────────────────────────────────────────────────────────────────
const userBadgeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    badge: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
userBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
const UserBadge = mongoose.model('UserBadge', userBadgeSchema);

// ── Discussion ───────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    isPinned: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    replies: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        content: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const discussionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true },
    messages: [messageSchema],
    isLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Discussion = mongoose.model('Discussion', discussionSchema);

// ── Chat ─────────────────────────────────────────────────────────────────────
const chatMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    directKey: {
      type: String,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
    messages: [chatMessageSchema],
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

chatSchema.index({ directKey: 1 }, { unique: true, sparse: true });
chatSchema.index({ participants: 1, updatedAt: -1 });

const Chat = mongoose.model('Chat', chatSchema);

// ── Market Trends ────────────────────────────────────────────────────────────
const marketTrendSchema = new mongoose.Schema(
  {
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);
const MarketTrend = mongoose.model('MarketTrend', marketTrendSchema);

module.exports = {
  Enrollment,
  Quiz,
  QuizAttempt,
  Assignment,
  Submission,
  Skill,
  Badge,
  UserBadge,
  Discussion,
  Chat,
  MarketTrend,
};
