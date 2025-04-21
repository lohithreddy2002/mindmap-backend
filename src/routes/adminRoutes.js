const express = require('express');
const router = express.Router();
const multer = require('multer');
const adminController = require('../controllers/adminController');

// Configure multer for memory storage (for MongoDB storage)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept markdown files and ZIP files
    if (
      file.mimetype === 'text/markdown' || 
      file.originalname.endsWith('.md') || 
      file.originalname.endsWith('.markdown') ||
      file.mimetype === 'application/zip' ||
      file.originalname.endsWith('.zip')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only markdown and ZIP files are allowed'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 10 // 10MB file size limit
  }
});

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // Simple auth check (replace with proper auth in production)
  if (apiKey === 'admin-secret-key') {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized - Invalid API key' });
  }
};

// Apply authentication middleware to all admin routes
router.use(authenticateAdmin);

// GET all subjects (admin version)
router.get('/subjects', adminController.getAllSubjects);

// Create a new subject
router.post('/subjects', adminController.createSubject);

// Delete a subject
router.delete('/subjects/:subjectId', adminController.deleteSubject);

// Create a new topic
router.post('/subjects/:subjectId/topics', adminController.createTopic);

// Update a topic's markdown content
router.put('/topics/:topicId/markdown', adminController.updateTopicMarkdown);

// Delete a topic
router.delete('/topics/:topicId', adminController.deleteTopic);

// Upload a markdown file for a topic
router.post(
  '/topics/:topicId/markdown',
  upload.single('markdown'),
  adminController.uploadMarkdown
);

// Upload a ZIP file for bulk import
router.post(
  '/import/zip',
  upload.single('zipFile'),
  adminController.processZipFile
);

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    return res.status(400).json({ error: 'File upload error', details: err.message });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
  next();
});

module.exports = router; 