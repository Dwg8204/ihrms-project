const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const classStudentController = require('../controllers/classStudentController');

router.post('/', classController.createClass);
router.get('/', classController.getClasses);
router.get('/:id', classController.getClassById);
router.patch('/:id', classController.updateClass);
router.delete('/:id', classController.deleteClass);

router.post('/:id/students', classStudentController.addStudent);
router.get('/:id/students', classStudentController.getClassStudents);
router.patch('/:id/students/:classStudentId', classStudentController.updateClassStudent);
router.delete('/:id/students/:classStudentId', classStudentController.deleteClassStudent);

module.exports = router;
