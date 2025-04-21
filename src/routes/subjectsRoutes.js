const express = require('express');
const router = express.Router();
const subjectsController = require('../controllers/subjectsController');

// Get all subjects 
router.get('/', subjectsController.getAllSubjects);

// Get a specific subject by ID
router.get('/:subjectId', subjectsController.getSubjectById);

// Get a specific topic by ID
router.get('/topics/:topicId', subjectsController.getTopicById);

// Get the markdown content for a specific topic
router.get('/topics/:topicId/markdown', subjectsController.getTopicMarkdown);

module.exports = router; 