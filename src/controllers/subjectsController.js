const mongoose = require('mongoose');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');

/**
 * Get all subjects and topics
 */
const getAllSubjects = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] GET /api/subjects - Fetching all subjects`);
  
  try {
    const subjects = await Subject.find().lean();
    console.log(`[${new Date().toISOString()}] Found ${subjects.length} subjects`);
    
    // Transform the data to match the expected format
    const formattedSubjects = await Promise.all(subjects.map(async (subject) => {
      const topics = await Topic.find({ subjectId: subject._id }).lean();
      console.log(`[${new Date().toISOString()}] Subject '${subject.name}' (${subject._id}): Found ${topics.length} topics`);
      
      return {
        id: subject._id.toString(),
        name: subject.name,
        description: subject.description || '',
        topics: topics.map(topic => ({
          id: topic._id.toString(),
          title: topic.title,
          description: topic.description || '',
          markdownContent: topic.markdownContent || ''
        }))
      };
    }));
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] GET /api/subjects completed in ${duration}ms`);
    
    res.json(formattedSubjects);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in getAllSubjects:`, error);
    res.status(500).json({ error: 'Failed to fetch subjects', details: error.message });
  }
};

/**
 * Get a specific subject by ID
 */
const getSubjectById = async (req, res) => {
  const { subjectId } = req.params;
  console.log(`[${new Date().toISOString()}] GET /api/subjects/${subjectId} - Fetching subject`);
  
  try {
    // Validate object ID
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      console.warn(`[${new Date().toISOString()}] Invalid subject ID format: ${subjectId}`);
      return res.status(400).json({ error: 'Invalid subject ID format' });
    }
    
    const subject = await Subject.findById(subjectId).lean();
    
    if (!subject) {
      console.warn(`[${new Date().toISOString()}] Subject not found: ${subjectId}`);
      return res.status(404).json({ error: `Subject with ID ${subjectId} not found` });
    }
    
    console.log(`[${new Date().toISOString()}] Found subject: ${subject.name} (${subject._id})`);
    
    const topics = await Topic.find({ subjectId: subject._id }).lean();
    console.log(`[${new Date().toISOString()}] Found ${topics.length} topics for subject ${subject._id}`);
    
    const formattedSubject = {
      id: subject._id.toString(),
      name: subject.name,
      description: subject.description || '',
      topics: topics.map(topic => ({
        id: topic._id.toString(),
        title: topic.title,
        description: topic.description || '',
        markdownContent: topic.markdownContent || ''
      }))
    };
    
    res.json(formattedSubject);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in getSubjectById for ${subjectId}:`, error);
    res.status(500).json({ error: 'Failed to fetch subject', details: error.message });
  }
};

/**
 * Get a specific topic by ID
 */
const getTopicById = async (req, res) => {
  const { topicId } = req.params;
  console.log(`[${new Date().toISOString()}] GET /api/subjects/topics/${topicId} - Fetching topic`);
  
  try {
    // Validate object ID
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      console.warn(`[${new Date().toISOString()}] Invalid topic ID format: ${topicId}`);
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }
    
    const topic = await Topic.findById(topicId).lean();
    
    if (!topic) {
      console.warn(`[${new Date().toISOString()}] Topic not found: ${topicId}`);
      return res.status(404).json({ error: `Topic with ID ${topicId} not found` });
    }
    
    console.log(`[${new Date().toISOString()}] Found topic: ${topic.title} (${topic._id})`);
    
    const formattedTopic = {
      id: topic._id.toString(),
      title: topic.title,
      description: topic.description || '',
      markdownContent: topic.markdownContent || ''
    };
    
    res.json(formattedTopic);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in getTopicById for ${topicId}:`, error);
    res.status(500).json({ error: 'Failed to fetch topic', details: error.message });
  }
};

/**
 * Get the markdown content for a specific topic
 */
const getTopicMarkdown = async (req, res) => {
  const { topicId } = req.params;
  console.log(`[${new Date().toISOString()}] GET /api/subjects/topics/${topicId}/markdown - Fetching markdown`);
  
  try {
    // Validate object ID
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      console.warn(`[${new Date().toISOString()}] Invalid topic ID format: ${topicId}`);
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }
    
    const topic = await Topic.findById(topicId).lean();
    
    if (!topic) {
      console.warn(`[${new Date().toISOString()}] Topic not found: ${topicId}`);
      return res.status(404).json({ error: `Topic with ID ${topicId} not found` });
    }
    
    console.log(`[${new Date().toISOString()}] Found markdown for topic: ${topic.title} (${topic._id}), content length: ${(topic.markdownContent || '').length} bytes`);
    
    res.json({ markdown: topic.markdownContent || '' });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in getTopicMarkdown for ${topicId}:`, error);
    res.status(500).json({ error: 'Failed to fetch markdown content', details: error.message });
  }
};

module.exports = {
  getAllSubjects,
  getSubjectById,
  getTopicById,
  getTopicMarkdown
}; 