const User = require('../models/User');
const { Badge, UserBadge, Enrollment, QuizAttempt, Discussion } = require('../models/index');

const BADGE_CATALOG = [
  {
    name: 'First Steps',
    description: 'Complete your first lesson',
    icon: '🎯',
    criteria: 'complete_first_lesson',
    xpValue: 50,
    rarity: 'common',
  },
  {
    name: 'Quiz Master',
    description: 'Score 100% on any quiz',
    icon: '🏆',
    criteria: 'perfect_quiz',
    xpValue: 200,
    rarity: 'rare',
  },
  {
    name: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    criteria: 'streak_7',
    xpValue: 150,
    rarity: 'rare',
  },
  {
    name: 'Course Champion',
    description: 'Complete your first course',
    icon: '🎓',
    criteria: 'complete_course',
    xpValue: 500,
    rarity: 'epic',
  },
  {
    name: 'Knowledge Seeker',
    description: 'Enroll in 5 courses',
    icon: '📚',
    criteria: 'enroll_5',
    xpValue: 300,
    rarity: 'rare',
  },
  {
    name: 'Legend',
    description: 'Reach Expert level (5000 XP)',
    icon: '⭐',
    criteria: 'reach_expert',
    xpValue: 1000,
    rarity: 'legendary',
  },
  {
    name: 'Discussion Leader',
    description: 'Start 10 discussions',
    icon: '💬',
    criteria: 'discussions_10',
    xpValue: 250,
    rarity: 'rare',
  },
  {
    name: 'Night Owl',
    description: 'Study after midnight',
    icon: '🦉',
    criteria: 'study_late',
    xpValue: 75,
    rarity: 'common',
  },
];

let badgeCatalogReadyPromise = null;

const ensureBadgeCatalog = async () => {
  if (!badgeCatalogReadyPromise) {
    badgeCatalogReadyPromise = Promise.all(
      BADGE_CATALOG.map((badge) =>
        Badge.findOneAndUpdate(
          { criteria: badge.criteria },
          { $set: badge },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      )
    )
      .then(() => undefined)
      .catch((error) => {
        badgeCatalogReadyPromise = null;
        throw error;
      });
  }

  return badgeCatalogReadyPromise;
};

const addXpToUser = async (userId, amount) => {
  const xpToAdd = Number(amount) || 0;

  const user = await User.findById(userId);
  if (!user) return null;

  if (xpToAdd !== 0) {
    user.xp = Math.max(0, Number(user.xp || 0) + xpToAdd);
    await user.save({ validateBeforeSave: false });
  }

  return user;
};

const getUserForChecks = async (userId, context) => {
  if (context.userDoc) return context.userDoc;

  const user = await User.findById(userId).select('xp level streak lastActiveDate');
  context.userDoc = user;
  return user;
};

const isCriteriaMet = async (userId, criteria, context) => {
  switch (criteria) {
    case 'complete_first_lesson': {
      if (Number(context.completedLessonsCount || 0) >= 1) return true;

      const hasAnyLesson = await Enrollment.exists({
        student: userId,
        'completedLessons.0': { $exists: true },
      });
      return Boolean(hasAnyLesson);
    }

    case 'perfect_quiz': {
      if (Number(context.score) === 100) return true;

      const hasPerfectQuiz = await QuizAttempt.exists({
        student: userId,
        score: 100,
      });
      return Boolean(hasPerfectQuiz);
    }

    case 'streak_7': {
      const user = await getUserForChecks(userId, context);
      return Boolean(user && Number(user.streak || 0) >= 7);
    }

    case 'complete_course': {
      if (Number(context.progress || 0) >= 100) return true;
      if (context.completedAt) return true;

      const hasCompletedCourse = await Enrollment.exists({
        student: userId,
        progress: { $gte: 100 },
      });
      return Boolean(hasCompletedCourse);
    }

    case 'enroll_5': {
      if (Number(context.enrollmentCount || 0) >= 5) return true;

      const enrollCount = await Enrollment.countDocuments({ student: userId });
      return enrollCount >= 5;
    }

    case 'reach_expert': {
      const user = await getUserForChecks(userId, context);
      return Boolean(user && (user.level === 'Expert' || Number(user.xp || 0) >= 5000));
    }

    case 'discussions_10': {
      if (Number(context.discussionCount || 0) >= 10) return true;

      const discussionCount = await Discussion.countDocuments({
        'messages.0.author': userId,
      });
      return discussionCount >= 10;
    }

    case 'study_late': {
      if (typeof context.loginHour === 'number') {
        return context.loginHour >= 0 && context.loginHour < 5;
      }

      const user = await getUserForChecks(userId, context);
      if (!user?.lastActiveDate) return false;

      const hour = new Date(user.lastActiveDate).getHours();
      return hour >= 0 && hour < 5;
    }

    default:
      return false;
  }
};

const awardBadgeByCriteria = async (userId, criteria, context) => {
  const badge = await Badge.findOne({ criteria }).select('_id name icon criteria rarity xpValue');
  if (!badge) return null;

  const alreadyAwarded = await UserBadge.exists({
    user: userId,
    badge: badge._id,
  });

  if (alreadyAwarded) return null;

  await UserBadge.create({ user: userId, badge: badge._id });

  if (Number(badge.xpValue || 0) > 0) {
    const updatedUser = await addXpToUser(userId, badge.xpValue);
    context.userDoc = updatedUser;
  }

  return {
    _id: badge._id,
    name: badge.name,
    icon: badge.icon,
    criteria: badge.criteria,
    rarity: badge.rarity,
    xpValue: badge.xpValue,
  };
};

const awardEligibleBadges = async (userId, criteriaList = [], context = {}) => {
  if (!userId || !Array.isArray(criteriaList) || criteriaList.length === 0) return [];

  await ensureBadgeCatalog();

  const uniqueCriteria = Array.from(new Set(criteriaList.filter(Boolean)));
  const awarded = [];

  for (const criteria of uniqueCriteria) {
    const eligible = await isCriteriaMet(userId, criteria, context);
    if (!eligible) continue;

    const awardedBadge = await awardBadgeByCriteria(userId, criteria, context);
    if (awardedBadge) awarded.push(awardedBadge);
  }

  // Re-check expert badge after any XP updates caused by newly awarded badges.
  if (!uniqueCriteria.includes('reach_expert')) {
    const canAwardExpert = await isCriteriaMet(userId, 'reach_expert', context);
    if (canAwardExpert) {
      const expertBadge = await awardBadgeByCriteria(userId, 'reach_expert', context);
      if (expertBadge) awarded.push(expertBadge);
    }
  }

  return awarded;
};

module.exports = {
  addXpToUser,
  ensureBadgeCatalog,
  awardEligibleBadges,
};
