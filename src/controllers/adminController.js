/**
 * Admin Controller for Mind Map Viewer
 * Includes methods for managing subjects and topics with MongoDB storage
 */

const mongoose = require('mongoose');
const multer = require('multer');
const JSZip = require('jszip');
const { v4: uuidv4 } = require('uuid');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');

/**
 * Get all subjects and topics (for admin)
 */
const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().lean();
    
    // Transform the data to match the expected format
    const formattedSubjects = await Promise.all(subjects.map(async (subject) => {
      const topics = await Topic.find({ subjectId: subject._id }).lean();
      
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
    
    res.json(formattedSubjects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects', details: error.message });
  }
};

/**
 * Create a new subject
 */
const createSubject = async (req, res) => {
  try {
    const { name, description = '' } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' });
    }

    // Create new subject in MongoDB
    const newSubject = new Subject({
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newSubject.save();

    res.status(201).json({
      id: newSubject._id.toString(),
      name: newSubject.name,
      description: newSubject.description,
      topics: []
    });
  } catch (error) {
    if (error.code === 11000) { // MongoDB duplicate key error
      return res.status(400).json({ error: 'A subject with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create subject', details: error.message });
  }
};

/**
 * Create a new topic within a subject
 */
const createTopic = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { title, description = '', markdown = '' } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Topic title is required' });
    }

    // Validate subject ID format
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ error: 'Invalid subject ID format' });
    }

    // Find the subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ error: `Subject with ID ${subjectId} not found` });
    }

    // Create new topic in MongoDB
    const newTopic = new Topic({
      title,
      description,
      markdownContent: markdown,
      subjectId: subject._id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newTopic.save();

    // Update the subject's updatedAt
    subject.updatedAt = new Date();
    await subject.save();

    res.status(201).json({
      id: newTopic._id.toString(),
      title: newTopic.title,
      description: newTopic.description,
      markdownContent: newTopic.markdownContent
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create topic', details: error.message });
  }
};

/**
 * Upload a markdown file for a topic
 */
const uploadMarkdown = async (req, res) => {
  try {
    const { topicId } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate topic ID format
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }

    // Find the topic
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ error: `Topic with ID ${topicId} not found` });
    }

    // Read the uploaded file content
    const markdownContent = req.file.buffer.toString('utf8');

    // Update the topic with the markdown content
    topic.markdownContent = markdownContent;
    topic.updatedAt = new Date();
    await topic.save();

    res.json({ 
      message: 'Markdown file uploaded successfully',
      topic: {
        id: topic._id.toString(),
        title: topic.title,
        description: topic.description,
        markdownContent: topic.markdownContent
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload markdown file', details: error.message });
  }
};

/**
 * Update a topic's markdown content
 */
const updateTopicMarkdown = async (req, res) => {
  try {
    const { topicId } = req.params;
    const { markdown } = req.body;

    if (markdown === undefined) {
      return res.status(400).json({ error: 'Markdown content is required' });
    }

    // Validate topic ID format
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }

    // Find and update the topic
    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({ error: `Topic with ID ${topicId} not found` });
    }

    // Update markdown content
    topic.markdownContent = markdown;
    topic.updatedAt = new Date();
    await topic.save();

    res.json({
      id: topic._id.toString(),
      title: topic.title,
      description: topic.description,
      markdownContent: topic.markdownContent
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update markdown content', details: error.message });
  }
};

/**
 * Delete a topic
 */
const deleteTopic = async (req, res) => {
  try {
    const { topicId } = req.params;

    // Validate topic ID format
    if (!mongoose.Types.ObjectId.isValid(topicId)) {
      return res.status(400).json({ error: 'Invalid topic ID format' });
    }

    // Find and delete the topic
    const topic = await Topic.findByIdAndDelete(topicId);
    if (!topic) {
      return res.status(404).json({ error: `Topic with ID ${topicId} not found` });
    }

    res.json({ message: `Topic ${topicId} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete topic', details: error.message });
  }
};

/**
 * Delete a subject and all its topics
 */
const deleteSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    // Validate subject ID format
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ error: 'Invalid subject ID format' });
    }

    // Find the subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ error: `Subject with ID ${subjectId} not found` });
    }

    // Delete all topics associated with this subject
    await Topic.deleteMany({ subjectId: subject._id });

    // Delete the subject
    await Subject.findByIdAndDelete(subjectId);

    res.json({ message: `Subject ${subjectId} and all its topics deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete subject', details: error.message });
  }
};

/**
 * Helper function to create a subject (used by processZipFile)
 */
const createSubjectInternal = async (name, description = '') => {
  // Check if subject already exists
  let subject = await Subject.findOne({ name });
  
  if (!subject) {
    // Create new subject
    subject = new Subject({
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await subject.save();
    console.log(`Created new subject: ${name} (${subject._id})`);
  } else {
    console.log(`Using existing subject: ${name} (${subject._id})`);
  }
  
  return subject;
};

/**
 * Helper function to create a topic (used by processZipFile)
 */
const createTopicInternal = async (title, subjectId, markdown, description = '') => {
  // Check if topic already exists in this subject
  let topic = await Topic.findOne({ title, subjectId });
  
  if (!topic) {
    // Create new topic
    topic = new Topic({
      title,
      description,
      markdownContent: markdown,
      subjectId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await topic.save();
    console.log(`Created new topic: ${title} (${topic._id})`);
  } else {
    // Update existing topic
    topic.markdownContent = markdown;
    topic.updatedAt = new Date();
    if (description) topic.description = description;
    
    await topic.save();
    console.log(`Updated existing topic: ${title} (${topic._id})`);
  }
  
  return topic;
};

/**
 * Process a zip file for bulk import
 * 
 * Expected ZIP structure:
 * - subject1/
 *   - topic1.md
 *   - topic2.md
 * - subject2/
 *   - topic1.md
 *   - topic2.md
 */
const processZipFile = async (req, res) => {
  console.log('Starting ZIP file processing');
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing ZIP file: ${req.file.originalname}, size: ${req.file.size} bytes`);
    
    // Load the ZIP file from the buffer
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(req.file.buffer);
    
    // Counters for created items
    let subjectsCreated = 0;
    let topicsCreated = 0;
    
    // Process each file in the ZIP
    const topicsPromises = [];
    const subjectMap = new Map(); // To track subjects and avoid duplicates
    
    // First pass: identify all subjects and create them
    for (const [filePath, fileObj] of Object.entries(zipContents.files)) {
      // Skip directories and hidden files
      if (fileObj.dir || filePath.startsWith('__MACOSX') || filePath.startsWith('.')) {
        continue;
      }
      
      // Extract subject and topic names from the file path
      const pathParts = filePath.split('/');
      
      // Skip files not in a subject folder
      if (pathParts.length < 2) {
        console.log(`Skipping file not in a subject folder: ${filePath}`);
        continue;
      }
      
      const subjectName = pathParts[0];
      
      // Skip if not a markdown file
      if (!pathParts[pathParts.length - 1].endsWith('.md')) {
        console.log(`Skipping non-markdown file: ${filePath}`);
        continue;
      }
      
      // Create or get subject if not already processed
      if (!subjectMap.has(subjectName)) {
        try {
          const subject = await createSubjectInternal(subjectName);
          subjectMap.set(subjectName, subject);
          subjectsCreated++;
        } catch (error) {
          console.error(`Error creating subject ${subjectName}:`, error);
        }
      }
    }
    
    // Second pass: create topics
    for (const [filePath, fileObj] of Object.entries(zipContents.files)) {
      // Skip directories and hidden files
      if (fileObj.dir || filePath.startsWith('__MACOSX') || filePath.startsWith('.')) {
        continue;
      }
      
      // Extract subject and topic names from the file path
      const pathParts = filePath.split('/');
      
      // Skip files not in a subject folder
      if (pathParts.length < 2) {
        continue;
      }
      
      const subjectName = pathParts[0];
      const fileName = pathParts[pathParts.length - 1];
      
      // Skip if not a markdown file
      if (!fileName.endsWith('.md')) {
        continue;
      }
      
      // Get subject
      const subject = subjectMap.get(subjectName);
      if (!subject) {
        console.error(`Subject not found in map: ${subjectName}`);
        continue;
      }
      
      // Extract topic title from filename (remove .md extension)
      const topicTitle = fileName.replace(/\.md$/, '');
      
      // Extract markdown content
      try {
        const markdownContent = await fileObj.async('string');
        
        // Create topic asynchronously
        topicsPromises.push(
          createTopicInternal(topicTitle, subject._id, markdownContent)
            .then(() => {
              topicsCreated++;
            })
            .catch(error => {
              console.error(`Error creating topic ${topicTitle}:`, error);
            })
        );
      } catch (error) {
        console.error(`Error extracting content from ${filePath}:`, error);
      }
    }
    
    // Wait for all topic creation promises to resolve
    await Promise.all(topicsPromises);
    
    console.log(`ZIP processing complete. Created ${subjectsCreated} subjects and ${topicsCreated} topics.`);
    
    res.json({
      message: 'ZIP file processed successfully',
      subjects: subjectsCreated,
      topics: topicsCreated
    });
  } catch (error) {
    console.error('Error processing ZIP file:', error);
    res.status(500).json({ error: 'Failed to process ZIP file', details: error.message });
  }
};

module.exports = {
  getAllSubjects,
  createSubject,
  createTopic,
  uploadMarkdown,
  updateTopicMarkdown,
  deleteTopic,
  deleteSubject,
  processZipFile
}; 