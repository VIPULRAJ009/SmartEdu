require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Course = require('../models/Course');
const { Badge, Quiz } = require('../models/index');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Badge.deleteMany({}),
    Quiz.deleteMany({}),
  ]);
  console.log('Cleared collections');

  // Create users
  const [admin, teacher1, teacher2, student1, student2] = await User.create([
    { name: 'Platform Admin', email: 'admin@smartedu.com', password: 'Admin@1234', role: 'admin', institution: 'SmartEdu', xp: 9999 },
    { name: 'Dr. Sarah Mitchell', email: 'sarah@smartedu.com', password: 'Teacher@1234', role: 'teacher', institution: 'MIT OpenCourseWare', bio: 'Expert in Data Science and Machine Learning with 10+ years of industry experience.' },
    { name: 'Prof. James Carter', email: 'james@smartedu.com', password: 'Teacher@1234', role: 'teacher', institution: 'Stanford Online', bio: 'Full-stack development expert and open-source contributor.' },
    { name: 'Arjun Sharma', email: 'arjun@smartedu.com', password: 'Student@1234', role: 'student', institution: 'IIT Delhi', course: 'B.Tech Computer Science', careerGoals: 'Become a Machine Learning Engineer at a top tech company', xp: 850, streak: 7 },
    { name: 'Priya Patel', email: 'priya@smartedu.com', password: 'Student@1234', role: 'student', institution: 'BITS Pilani', course: 'B.E. Computer Science', careerGoals: 'Frontend Developer at a product startup', xp: 1200, streak: 14 },
  ]);
  console.log('✅ Users created');

  // Create courses
  const courses = await Course.create([
    {
      title: 'Machine Learning Fundamentals',
      description: 'A comprehensive introduction to machine learning algorithms, model evaluation, and real-world applications using Python and scikit-learn. Covers supervised, unsupervised, and reinforcement learning.',
      instructor: teacher1._id,
      category: 'Data Science',
      difficulty: 'Intermediate',
      tags: ['ML', 'Python', 'scikit-learn', 'AI'],
      objectives: ['Understand core ML algorithms', 'Build and evaluate models', 'Apply ML to real datasets'],
      prerequisites: ['Python basics', 'Linear algebra fundamentals'],
      duration: 40,
      isPublished: true,
      enrollmentCount: 847,
      rating: 4.8,
      ratingCount: 203,
      modules: [
        {
          title: 'Introduction to Machine Learning',
          order: 1,
          lessons: [
            { title: 'What is Machine Learning?', type: 'text', content: 'Machine learning is a subset of AI that enables systems to learn from data...', order: 1, duration: 15 },
            { title: 'Types of ML: Supervised, Unsupervised, Reinforcement', type: 'text', content: 'There are three main types of machine learning...', order: 2, duration: 20 },
          ],
        },
        {
          title: 'Linear Regression',
          order: 2,
          lessons: [
            { title: 'Simple Linear Regression', type: 'text', content: 'Linear regression models the relationship between variables...', order: 1, duration: 25 },
            { title: 'Multiple Regression', type: 'text', content: 'Multiple regression extends linear regression to multiple features...', order: 2, duration: 30 },
          ],
        },
      ],
    },
    {
      title: 'Full-Stack Web Development with React & Node.js',
      description: 'Build production-grade web applications from scratch. Learn React 18, Node.js, Express, MongoDB, REST APIs, authentication, and deployment on AWS.',
      instructor: teacher2._id,
      category: 'Programming',
      difficulty: 'Intermediate',
      tags: ['React', 'Node.js', 'MongoDB', 'Express', 'JavaScript'],
      objectives: ['Build full-stack applications', 'Design RESTful APIs', 'Deploy to cloud platforms'],
      prerequisites: ['JavaScript fundamentals', 'HTML/CSS basics'],
      duration: 60,
      isPublished: true,
      enrollmentCount: 1230,
      rating: 4.9,
      ratingCount: 341,
      modules: [
        {
          title: 'React Fundamentals',
          order: 1,
          lessons: [
            { title: 'Components & JSX', type: 'text', content: 'React components are the building blocks...', order: 1, duration: 20 },
            { title: 'State and Props', type: 'text', content: 'State is mutable data managed by a component...', order: 2, duration: 25 },
            { title: 'Hooks Deep Dive', type: 'text', content: 'React Hooks allow you to use state in functional components...', order: 3, duration: 35 },
          ],
        },
        {
          title: 'Node.js & Express API',
          order: 2,
          lessons: [
            { title: 'RESTful API Design', type: 'text', content: 'REST APIs use HTTP methods and resource-based URLs...', order: 1, duration: 30 },
            { title: 'Authentication with JWT', type: 'text', content: 'JSON Web Tokens provide stateless authentication...', order: 2, duration: 40 },
          ],
        },
      ],
    },
    {
      title: 'UI/UX Design Principles',
      description: 'Master the art and science of user interface and user experience design. From wireframing to high-fidelity prototypes using Figma.',
      instructor: teacher1._id,
      category: 'Design',
      difficulty: 'Beginner',
      tags: ['Figma', 'UX', 'Wireframing', 'Prototyping'],
      objectives: ['Apply design thinking methodology', 'Create wireframes and prototypes', 'Conduct user research'],
      prerequisites: ['None'],
      duration: 25,
      isPublished: true,
      enrollmentCount: 562,
      rating: 4.7,
      ratingCount: 156,
      modules: [
        {
          title: 'Design Thinking',
          order: 1,
          lessons: [
            { title: 'Empathize & Define', type: 'text', content: 'The first two stages of design thinking...', order: 1, duration: 20 },
          ],
        },
      ],
    },
    {
      title: 'Data Structures & Algorithms',
      description: 'Master fundamental data structures and algorithmic thinking. Essential preparation for technical interviews at top tech companies.',
      instructor: teacher2._id,
      category: 'Programming',
      difficulty: 'Advanced',
      tags: ['DSA', 'Python', 'Interview Prep', 'Algorithms'],
      objectives: ['Implement core data structures', 'Analyze time/space complexity', 'Solve LeetCode-style problems'],
      prerequisites: ['Programming in any language', 'Basic math'],
      duration: 50,
      isPublished: true,
      enrollmentCount: 993,
      rating: 4.9,
      ratingCount: 278,
      modules: [],
    },
  ]);
  console.log('✅ Courses created');

  // Create badges
  await Badge.create([
    { name: 'First Steps', description: 'Complete your first lesson', icon: '🎯', criteria: 'complete_first_lesson', xpValue: 50, rarity: 'common' },
    { name: 'Quiz Master', description: 'Score 100% on any quiz', icon: '🏆', criteria: 'perfect_quiz', xpValue: 200, rarity: 'rare' },
    { name: 'Week Warrior', description: 'Maintain a 7-day learning streak', icon: '🔥', criteria: 'streak_7', xpValue: 150, rarity: 'rare' },
    { name: 'Course Champion', description: 'Complete your first course', icon: '🎓', criteria: 'complete_course', xpValue: 500, rarity: 'epic' },
    { name: 'Knowledge Seeker', description: 'Enroll in 5 courses', icon: '📚', criteria: 'enroll_5', xpValue: 300, rarity: 'rare' },
    { name: 'Legend', description: 'Reach Expert level (5000 XP)', icon: '⭐', criteria: 'reach_expert', xpValue: 1000, rarity: 'legendary' },
    { name: 'Discussion Leader', description: 'Start 10 discussions', icon: '💬', criteria: 'discussions_10', xpValue: 250, rarity: 'rare' },
    { name: 'Night Owl', description: 'Study after midnight', icon: '🦉', criteria: 'study_late', xpValue: 75, rarity: 'common' },
  ]);
  console.log('✅ Badges created');

  // Create a quiz
  await Quiz.create({
    course: courses[0]._id,
    title: 'ML Fundamentals Quiz',
    description: 'Test your understanding of core machine learning concepts',
    timeLimit: 20,
    passingScore: 70,
    isPublished: true,
    xpReward: 100,
    questions: [
      {
        text: 'Which type of machine learning uses labeled training data?',
        options: ['Unsupervised Learning', 'Supervised Learning', 'Reinforcement Learning', 'Transfer Learning'],
        correctIndex: 1,
        explanation: 'Supervised learning uses input-output pairs (labeled data) to train models.',
        points: 1,
      },
      {
        text: 'What does overfitting mean in ML?',
        options: ['Model performs poorly on training data', 'Model performs well on training but poorly on new data', 'Model is too simple', 'Model uses too little data'],
        correctIndex: 1,
        explanation: 'Overfitting occurs when a model memorizes training data but fails to generalize.',
        points: 1,
      },
      {
        text: 'Which algorithm is best suited for binary classification?',
        options: ['Linear Regression', 'K-Means', 'Logistic Regression', 'PCA'],
        correctIndex: 2,
        explanation: 'Logistic Regression is designed for binary (two-class) classification problems.',
        points: 1,
      },
      {
        text: 'What is the purpose of cross-validation?',
        options: ['Speed up training', 'Evaluate model generalization', 'Reduce dataset size', 'Increase model complexity'],
        correctIndex: 1,
        explanation: 'Cross-validation estimates how well a model will generalize to unseen data.',
        points: 1,
      },
      {
        text: 'Which metric is most appropriate for imbalanced classification?',
        options: ['Accuracy', 'Precision', 'F1 Score', 'Mean Squared Error'],
        correctIndex: 2,
        explanation: 'F1 Score balances precision and recall, making it suitable for imbalanced datasets.',
        points: 1,
      },
    ],
  });
  console.log('✅ Quizzes created');

  console.log('\n🎉 Seed complete!\n');
  console.log('─────────────────────────────────────');
  console.log('Test Credentials:');
  console.log('  Admin:   admin@smartedu.com   / Admin@1234');
  console.log('  Teacher: sarah@smartedu.com   / Teacher@1234');
  console.log('  Student: arjun@smartedu.com   / Student@1234');
  console.log('─────────────────────────────────────\n');

  await mongoose.disconnect();
};

seed().catch((err) => { console.error(err); process.exit(1); });
