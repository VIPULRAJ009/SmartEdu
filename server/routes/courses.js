const express = require('express');
const { protect, restrictTo } = require('../middleware/auth');
const courseCtrl = require('../controllers/courseController');
const { generateCourseDraft } = require('../controllers/aiController');
const router = express.Router();

router.get('/', courseCtrl.getCourses);
router.get('/my-courses', protect, restrictTo('teacher', 'admin'), courseCtrl.getMyCourses);
router.get('/enrolled', protect, restrictTo('student'), courseCtrl.getEnrolledCourses);
router.post('/ai-draft', protect, restrictTo('teacher', 'admin'), generateCourseDraft);
router.post('/', protect, restrictTo('teacher', 'admin'), courseCtrl.createCourse);
router.get('/:id/analytics', protect, restrictTo('teacher', 'admin'), courseCtrl.getCourseAnalytics);
router.get('/:id', protect, courseCtrl.getCourse);
router.put('/:id', protect, restrictTo('teacher', 'admin'), courseCtrl.updateCourse);
router.delete('/:id', protect, restrictTo('teacher', 'admin'), courseCtrl.deleteCourse);
router.post('/:id/enroll', protect, restrictTo('student'), courseCtrl.enrollCourse);
router.post('/:id/progress', protect, restrictTo('student'), courseCtrl.updateCourseProgress);

module.exports = router;
