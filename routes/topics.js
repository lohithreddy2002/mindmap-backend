/**
 * Topics API Routes
 * Uses MongoDB for storing both topic metadata and markdown content
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const mongoStorage = require('../mongo-storage');

// Get all topics for a subject
router.get('/subjects/:subjectId/topics', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const topics = await mongoStorage.getTopicsBySubject(subjectId);
    
    res.json({
      success: true,
      topics: topics.map(topic => ({
        id: topic._id,
        name: topic.name,
        subjectId: topic.subject,
        markdownContent: topic.markdownContent || '',
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error getting topics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get topics',
      message: error.message
    });
  }
});

// Get a specific topic
router.get('/subjects/:subjectId/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const topic = await mongoStorage.models.Topic.findById(topicId);
    
    if (!topic) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    res.json({
      success: true,
      topic: {
        id: topic._id,
        name: topic.name,
        subjectId: topic.subject,
        markdownContent: topic.markdownContent || '',
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting topic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get topic',
      message: error.message 
    });
  }
});

// Get markdown content for a topic
router.get('/subjects/:subjectId/topics/:topicId/markdown', async (req, res) => {
  try {
    const { topicId } = req.params;
    const markdownContent = await mongoStorage.getMarkdownFromMongoDB(topicId);
    
    res.json({
      success: true,
      markdown: markdownContent
    });
  } catch (error) {
    console.error('Error getting markdown:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get markdown content',
      message: error.message
    });
  }
});

// Create a new topic
router.post('/subjects/:subjectId/topics', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic name is required' 
      });
    }
    
    const topic = await mongoStorage.createTopicWithMarkdown(name, subjectId);
    
    res.status(201).json({
      success: true,
      topic: {
        id: topic._id,
        name: topic.name,
        subjectId: topic.subject,
        markdownContent: topic.markdownContent || ''
      }
    });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create topic',
      message: error.message
    });
  }
});

// Upload markdown content for a topic
router.post('/subjects/:subjectId/topics/:topicId/upload', upload.single('markdown'), async (req, res) => {
  try {
    const { topicId } = req.params;
    
    // Check if file was uploaded
    if (!req.file && !req.body.content) {
      return res.status(400).json({ 
        success: false, 
        error: 'No markdown content provided' 
      });
    }
    
    // Get markdown content from file buffer or request body
    const markdownContent = req.file 
      ? req.file.buffer.toString('utf8')
      : req.body.content;
    
    // Save markdown content to MongoDB
    const updatedTopic = await mongoStorage.saveMarkdownToMongoDB(topicId, markdownContent);
    
    res.json({
      success: true,
      topic: {
        id: updatedTopic._id,
        name: updatedTopic.name,
        subjectId: updatedTopic.subject,
        markdownContent: updatedTopic.markdownContent || '',
        updatedAt: updatedTopic.updatedAt
      }
    });
  } catch (error) {
    console.error('Error uploading markdown:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload markdown',
      message: error.message 
    });
  }
});

// Update a topic
router.put('/subjects/:subjectId/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic name is required' 
      });
    }
    
    const updatedTopic = await mongoStorage.models.Topic.findByIdAndUpdate(
      topicId,
      {
        name,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!updatedTopic) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    res.json({
      success: true,
      topic: {
        id: updatedTopic._id,
        name: updatedTopic.name,
        subjectId: updatedTopic.subject,
        markdownContent: updatedTopic.markdownContent || '',
        updatedAt: updatedTopic.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update topic',
      message: error.message 
    });
  }
});

// Delete a topic
router.delete('/subjects/:subjectId/topics/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const success = await mongoStorage.deleteTopic(topicId);
    
    if (!success) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete topic',
      message: error.message 
    });
  }
});

// Delete/clear markdown content for a topic
router.delete('/subjects/:subjectId/topics/:topicId/markdown', async (req, res) => {
  try {
    const { topicId } = req.params;
    
    // Find the topic and clear its markdown content
    const updatedTopic = await mongoStorage.models.Topic.findByIdAndUpdate(
      topicId,
      {
        markdownContent: '',
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!updatedTopic) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    res.json({
      success: true,
      topic: {
        id: updatedTopic._id,
        name: updatedTopic.name,
        subjectId: updatedTopic.subject,
        markdownContent: '',
        updatedAt: updatedTopic.updatedAt
      },
      message: 'Markdown content cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing markdown content:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear markdown content',
      message: error.message 
    });
  }
});

module.exports = router; 