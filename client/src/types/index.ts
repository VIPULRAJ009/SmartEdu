// src/types/index.ts

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  avatar?: string;
  bio?: string;
  institution?: string;
  course?: string;
  careerGoals?: string;
  xp: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  streak: number;
  isActive: boolean;
  createdAt: string;
}

export interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  instructor: Pick<User, '_id' | 'name' | 'avatar' | 'bio'>;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  banner?: string;
  tags: string[];
  thumbnail?: string;
  objectives: string[];
  prerequisites: string[];
  curriculum?: CurriculumItem[];
  stages?: string[];
  duration: number;
  isPublished: boolean;
  enrollmentCount: number;
  rating: number;
  ratingCount: number;
  modules?: Module[];
  createdAt: string;
}

export interface Module {
  _id: string;
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
}

export interface Lesson {
  _id: string;
  title: string;
  type: 'video' | 'text' | 'document';
  content?: string;
  videoUrl?: string;
  duration?: number;
  order: number;
}

export interface CurriculumItem {
  _id?: string;
  title: string;
  description?: string;
  order: number;
}

export interface Enrollment {
  _id: string;
  student: string | User;
  course: string | Course;
  progress: number;
  completedLessons: string[];
  completedAt?: string;
  grade?: string;
  createdAt: string;
}

export interface Quiz {
  _id: string;
  course: string | Course;
  title: string;
  description?: string;
  timeLimit: number;
  passingScore: number;
  questions: Question[];
  isPublished: boolean;
  xpReward: number;
}

export interface Question {
  _id?: string;
  text: string;
  options: string[];
  correctIndex?: number;
  explanation?: string;
  points: number;
}

export interface QuizAttempt {
  _id: string;
  student: string;
  quiz: string | Quiz;
  score: number;
  passed: boolean;
  timeTaken?: number;
  aiFeedback?: string;
  completedAt: string;
  details?: { questionIndex: number; selectedIndex: number; isCorrect: boolean }[];
  totalQuestions?: number;
  correct?: number;
}

export interface Assignment {
  _id: string;
  course: string | Course;
  title: string;
  description: string;
  dueDate: string;
  maxScore: number;
  xpReward: number;
  attachments?: string[];
  isClosed?: boolean;
}

export interface Submission {
  _id: string;
  assignment: string | Assignment;
  student: string | User;
  content?: string;
  attachments?: string[];
  score?: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'returned';
  gradedAt?: string;
  createdAt: string;
}

export interface Skill {
  _id: string;
  user: string;
  name: string;
  category: string;
  proficiency: number;
  status: 'acquired' | 'in-progress' | 'gap';
  source?: 'ai' | 'user';
  lastAnalyzed: string;
}

export interface Badge {
  _id: string;
  name: string;
  description?: string;
  icon: string;
  criteria: string;
  xpValue: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earned?: boolean;
  earnedAt?: string;
}

export interface AwardedBadge {
  _id: string;
  name: string;
  icon?: string;
  criteria: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpValue: number;
}

export interface Discussion {
  _id: string;
  course: string;
  title: string;
  messages: Message[];
  isLocked: boolean;
  createdAt: string;
}

export interface Message {
  _id: string;
  author: Pick<User, '_id' | 'name' | 'avatar' | 'role'>;
  content: string;
  isPinned: boolean;
  likes: string[];
  replies: Reply[];
  createdAt: string;
}

export interface Reply {
  _id?: string;
  author: Pick<User, '_id' | 'name' | 'avatar'>;
  content: string;
  createdAt: string;
}

export interface ChatMessage {
  _id: string;
  sender: Pick<User, '_id' | 'name' | 'avatar' | 'role'>;
  content: string;
  createdAt: string;
}

export interface ChatConversation {
  _id: string;
  type: 'direct' | 'group';
  name?: string;
  course?: Pick<Course, '_id' | 'title' | 'banner' | 'thumbnail'> | null;
  participants: Pick<User, '_id' | 'name' | 'avatar' | 'role'>[];
  otherParticipant?: Pick<User, '_id' | 'name' | 'avatar' | 'role'>;
  messages: ChatMessage[];
  lastMessageAt: string;
  createdAt: string;
}

export interface MarketTrend {
  topSkills: { skill: string; demand: number; growth: number; category: string; avgSalary: string }[];
  industries: { name: string; topSkills: string[]; hiringTrend: string }[];
  emergingTech: string[];
  careerPaths: { title: string; requiredSkills: string[]; avgSalary: string; demand: string }[];
  summary: string;
}

export interface LiveClassParticipant {
  student: Pick<User, '_id' | 'name' | 'avatar'>;
  registeredAt: string;
  joinedAt?: string | null;
  cameraApproved?: boolean;
  cameraApprovedAt?: string | null;
}

export interface LiveClass {
  _id: string;
  course: Pick<Course, '_id' | 'title' | 'banner' | 'thumbnail'>;
  teacher: Pick<User, '_id' | 'name' | 'avatar'>;
  title: string;
  agenda?: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  meetingCode: string;
  participants: LiveClassParticipant[];
  registeredCount: number;
  joinedCount: number;
  isRegistered: boolean;
  canJoin: boolean;
  currentUserCameraApproved?: boolean;
  spotlightStudent?: Pick<User, '_id' | 'name' | 'avatar' | 'role'> | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  payload?: {
    liveClassId?: string;
    courseId?: string;
    assignmentId?: string;
    quizId?: string;
    submissionId?: string;
    route?: string;
    meetingCode?: string;
    scheduledAt?: string;
    status?: string;
  };
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface CourseAnalyticsOverview {
  totalStudents: number;
  completedCourseStudents: number;
  courseCompletionRate: number;
  totalAssignments: number;
  totalQuizzes: number;
  totalAssignmentSubmissions: number;
  totalQuizAttempts: number;
  uniqueAssignmentCompleters: number;
  uniqueQuizCompleters: number;
  averageQuizScore: number;
}

export interface CourseAssignmentAnalytics {
  _id: string;
  title: string;
  dueDate: string;
  submissions: number;
  gradedSubmissions: number;
  uniqueStudents: number;
  onTimeSubmissions: number;
  lateSubmissions: number;
}

export interface CourseQuizAnalytics {
  _id: string;
  title: string;
  passingScore: number;
  attempts: number;
  passedAttempts: number;
  uniqueStudents: number;
  averageScore: number;
}

export interface CourseAnalyticsPayload {
  course: {
    _id: string;
    title: string;
  };
  overview: CourseAnalyticsOverview;
  assignments: CourseAssignmentAnalytics[];
  quizzes: CourseQuizAnalytics[];
}

export interface ApiError {
  error: string;
  errors?: { msg: string; path: string }[];
}

export interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}
