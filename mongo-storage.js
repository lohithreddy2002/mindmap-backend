/**
 * MongoDB Storage Implementation for Mind Map Viewer
 * 
 * This module provides functions to store markdown content directly in MongoDB documents
 * instead of using external storage services like S3 or Firebase.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB if not already connected
async function connectToMongoDB() {
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('Connected to MongoDB successfully');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }
}

// Define the schemas if they don't exist
const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const TopicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  // Store markdown content directly in the document
  markdownContent: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create models if they don't exist
const Subject = mongoose.models.Subject || mongoose.model('Subject', SubjectSchema);
const Topic = mongoose.models.Topic || mongoose.model('Topic', TopicSchema);

/**
 * Save markdown content to a topic in MongoDB
 * @param {string} topicId - Topic ID
 * @param {string} markdownContent - Markdown content to save
 * @returns {Promise<Object>} - Updated topic object
 */
async function saveMarkdownToMongoDB(topicId, markdownContent) {
  try {
    await connectToMongoDB();
    
    const updatedTopic = await Topic.findByIdAndUpdate(
      topicId,
      {
        markdownContent,
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!updatedTopic) {
      throw new Error(`Topic with ID ${topicId} not found`);
    }
    
    console.log(`Markdown content saved to topic ${topicId}`);
    return updatedTopic;
  } catch (error) {
    console.error(`Error saving markdown to MongoDB:`, error);
    throw error;
  }
}

/**
 * Get markdown content from a topic in MongoDB
 * @param {string} topicId - Topic ID
 * @returns {Promise<string>} - Markdown content
 */
async function getMarkdownFromMongoDB(topicId) {
  try {
    await connectToMongoDB();
    
    const topic = await Topic.findById(topicId);
    
    if (!topic) {
      throw new Error(`Topic with ID ${topicId} not found`);
    }
    
    return topic.markdownContent;
  } catch (error) {
    console.error(`Error getting markdown from MongoDB:`, error);
    throw error;
  }
}

/**
 * Create a new subject in MongoDB
 * @param {string} name - Subject name
 * @param {string} description - Subject description
 * @returns {Promise<Object>} - Created subject object
 */
async function createSubject(name, description = '') {
  try {
    await connectToMongoDB();
    
    const subject = new Subject({
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    await subject.save();
    console.log(`Subject ${name} created with ID ${subject._id}`);
    return subject;
  } catch (error) {
    console.error(`Error creating subject:`, error);
    throw error;
  }
}

/**
 * Create a new topic with markdown content in MongoDB
 * @param {string} name - Topic name
 * @param {string} subjectId - Subject ID
 * @param {string} markdownContent - Markdown content
 * @returns {Promise<Object>} - Created topic object
 */
async function createTopicWithMarkdown(name, subjectId, markdownContent = '') {
  try {
    await connectToMongoDB();
    
    const topic = new Topic({
      name,
      subject: subjectId,
      markdownContent,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    await topic.save();
    console.log(`Topic ${name} created with ID ${topic._id}`);
    return topic;
  } catch (error) {
    console.error(`Error creating topic:`, error);
    throw error;
  }
}

/**
 * Get all topics for a subject
 * @param {string} subjectId - Subject ID
 * @returns {Promise<Array>} - Array of topic objects
 */
async function getTopicsBySubject(subjectId) {
  try {
    await connectToMongoDB();
    
    const topics = await Topic.find({ subject: subjectId });
    return topics;
  } catch (error) {
    console.error(`Error getting topics for subject ${subjectId}:`, error);
    throw error;
  }
}

/**
 * Delete a topic and its markdown content
 * @param {string} topicId - Topic ID
 * @returns {Promise<boolean>} - Success status
 */
async function deleteTopic(topicId) {
  try {
    await connectToMongoDB();
    
    const result = await Topic.findByIdAndDelete(topicId);
    
    if (!result) {
      console.warn(`Topic with ID ${topicId} not found for deletion`);
      return false;
    }
    
    console.log(`Topic ${topicId} deleted successfully`);
    return true;
  } catch (error) {
    console.error(`Error deleting topic ${topicId}:`, error);
    throw error;
  }
}

module.exports = {
  saveMarkdownToMongoDB,
  getMarkdownFromMongoDB,
  createSubject,
  createTopicWithMarkdown,
  getTopicsBySubject,
  deleteTopic,
  models: {
    Subject,
    Topic
  }
}; 