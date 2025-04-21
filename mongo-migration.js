/**
 * MongoDB Migration Script
 * 
 * This script migrates markdown files from local storage to MongoDB documents.
 * It reads the markdown files and stores their content directly in the Topic documents.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const mongoose = require('mongoose');
const glob = promisify(require('glob'));
const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);

// Configuration
const localStoragePath = process.env.LOCAL_STORAGE_PATH || './uploads';
const mongoUri = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Define schemas
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
  // Keep track of the old file path for reference
  oldMarkdownPath: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create models
const Subject = mongoose.model('Subject', SubjectSchema);
const Topic = mongoose.model('Topic', TopicSchema);

/**
 * Check if a path is a directory
 * @param {string} path - Path to check
 * @returns {Promise<boolean>}
 */
async function isDirectory(path) {
  try {
    const stats = await statAsync(path);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Find all markdown files recursively in a directory
 * @param {string} dir - Directory to search
 * @returns {Promise<Array<string>>} - Array of file paths
 */
async function findMarkdownFiles(dir) {
  try {
    const pattern = path.join(dir, '**/*.md');
    return await glob(pattern);
  } catch (error) {
    console.error('Error finding markdown files:', error);
    return [];
  }
}

/**
 * Extract subject name and topic name from file path
 * @param {string} filePath - Path to the file
 * @returns {Object} - Object with subjectName and topicName
 */
function extractNamesFromPath(filePath) {
  // Assuming path structure like: uploads/{subjectName}/{topicName}.md
  const relativePath = path.relative(localStoragePath, filePath);
  const parts = relativePath.split(path.sep);
  
  if (parts.length >= 2 && path.extname(parts[parts.length - 1]) === '.md') {
    return {
      subjectName: parts[0],
      topicName: path.basename(parts[1], '.md'),
      filePath
    };
  }
  
  // Alternative structure: uploads/subjects/{subjectName}/topics/{topicName}/content.md
  if (parts.includes('subjects') && parts.includes('topics')) {
    const subjectIndex = parts.indexOf('subjects') + 1;
    const topicIndex = parts.indexOf('topics') + 1;
    
    if (subjectIndex < parts.length && topicIndex < parts.length) {
      return {
        subjectName: parts[subjectIndex],
        topicName: parts[topicIndex],
        filePath
      };
    }
  }
  
  console.warn(`Could not extract names from path: ${filePath}`);
  return null;
}

/**
 * Get or create a subject
 * @param {string} name - Subject name
 * @returns {Promise<Object>} - Subject document
 */
async function getOrCreateSubject(name) {
  let subject = await Subject.findOne({ name });
  
  if (!subject) {
    subject = new Subject({
      name,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await subject.save();
    console.log(`Created new subject: ${name}`);
  } else {
    console.log(`Found existing subject: ${name}`);
  }
  
  return subject;
}

/**
 * Get or create a topic
 * @param {string} name - Topic name
 * @param {string} subjectId - Subject ID
 * @returns {Promise<Object>} - Topic document
 */
async function getOrCreateTopic(name, subjectId) {
  let topic = await Topic.findOne({ name, subject: subjectId });
  
  if (!topic) {
    topic = new Topic({
      name,
      subject: subjectId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await topic.save();
    console.log(`Created new topic: ${name}`);
  } else {
    console.log(`Found existing topic: ${name}`);
  }
  
  return topic;
}

/**
 * Main migration function
 */
async function migrateToMongoDB() {
  try {
    console.log('Starting migration from local storage to MongoDB...');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Check if local storage path exists
    if (!fs.existsSync(localStoragePath)) {
      console.error(`Local storage path ${localStoragePath} does not exist`);
      process.exit(1);
    }
    
    // Find all markdown files
    const files = await findMarkdownFiles(localStoragePath);
    console.log(`Found ${files.length} markdown files to migrate`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process each file
    for (const [index, filePath] of files.entries()) {
      try {
        console.log(`\nProcessing file ${index + 1}/${files.length}: ${filePath}`);
        
        // Extract subject and topic names
        const names = extractNamesFromPath(filePath);
        if (!names) {
          console.warn(`Skipping file ${filePath} - could not determine subject/topic names`);
          failureCount++;
          continue;
        }
        
        const { subjectName, topicName } = names;
        
        // Get or create the subject
        const subject = await getOrCreateSubject(subjectName);
        
        // Get or create the topic
        const topic = await getOrCreateTopic(topicName, subject._id);
        
        // Read markdown content
        const markdownContent = await readFileAsync(filePath, 'utf8');
        
        // Update topic with markdown content
        topic.markdownContent = markdownContent;
        topic.oldMarkdownPath = filePath;
        topic.updatedAt = Date.now();
        await topic.save();
        
        console.log(`Updated topic ${topicName} with markdown content`);
        successCount++;
      } catch (error) {
        console.error(`Failed to migrate file ${filePath}:`, error);
        failureCount++;
      }
    }
    
    console.log('\nMigration Summary:');
    console.log(`Total files: ${files.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Cleanup
    mongoose.connection.close();
    console.log('MongoDB connection closed');
    console.log('Migration process completed');
    process.exit(0);
  }
}

// Run the migration
migrateToMongoDB().catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 