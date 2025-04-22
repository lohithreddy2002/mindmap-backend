/**
 * MongoDB Database Health Check Script
 * 
 * This script verifies the MongoDB connection and performs basic health checks
 * including checking collection counts, indexes, and document structure.
 */

const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the models
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');

// Configure logging - use /tmp for Vercel compatibility
const isServerlessEnv = process.env.VERCEL === '1' || !fs.existsSync(path.join(__dirname, '../../logs'));
let logDirectory = '/tmp';  // Default to /tmp for serverless

// Only attempt to create logs directory if not in serverless
if (!isServerlessEnv) {
  try {
    logDirectory = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
  } catch (err) {
    console.warn(`Warning: Could not create logs directory. Using /tmp: ${err.message}`);
    logDirectory = '/tmp';
  }
}

// Create a log file for the check result
let logStream;
try {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const logFile = path.join(logDirectory, `db-health-check-${timestamp}.log`);
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  console.log(`Log file created at: ${logFile}`);
} catch (err) {
  console.warn(`Unable to create log file: ${err.message}. Logs will only go to console.`);
}

// Helper function to log to console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  if (logStream) {
    logStream.write(formattedMessage + '\n');
  }
}

async function checkDatabaseHealth() {
  try {
    log('Starting MongoDB health check...');
    log(`Connecting to: ${process.env.MONGODB_URI.replace(/\/\/(.+?):(.+?)@/, '//***:***@')}`);

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    log('Successfully connected to MongoDB');
    log(`Database name: ${mongoose.connection.db.databaseName}`);

    // Check connection state
    log(`MongoDB connection state: ${mongoose.connection.readyState} (0: disconnected, 1: connected, 2: connecting, 3: disconnecting)`);

    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    log(`Collections: ${collections.map(c => c.name).join(', ')}`);

    // Check Subjects collection
    const subjectCount = await Subject.countDocuments();
    log(`Subject count: ${subjectCount}`);

    // Check Topics collection
    const topicCount = await Topic.countDocuments();
    log(`Topic count: ${topicCount}`);

    // Check indexes
    log('Subject indexes:');
    const subjectIndexes = await Subject.collection.indexes();
    subjectIndexes.forEach(index => {
      log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    log('Topic indexes:');
    const topicIndexes = await Topic.collection.indexes();
    topicIndexes.forEach(index => {
      log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Check for orphaned topics (topics without a valid subject)
    const orphanedTopicsCount = await Topic.countDocuments({
      subjectId: { $nin: (await Subject.find().select('_id')).map(s => s._id) }
    });
    log(`Orphaned topics (without a valid subject): ${orphanedTopicsCount}`);
    
    if (orphanedTopicsCount > 0) {
      log('WARNING: Orphaned topics detected. Consider cleaning up the database.');
    }

    // Check for topics without markdown content
    const noMarkdownCount = await Topic.countDocuments({ 
      $or: [
        { markdownContent: { $exists: false } },
        { markdownContent: null },
        { markdownContent: '' }
      ]
    });
    log(`Topics without markdown content: ${noMarkdownCount}`);

    // Sample a subject and topic
    if (subjectCount > 0) {
      const sampleSubject = await Subject.findOne().lean();
      log(`Sample subject: ${JSON.stringify(sampleSubject, null, 2)}`);
    }

    if (topicCount > 0) {
      const sampleTopic = await Topic.findOne().lean();
      log(`Sample topic: ${JSON.stringify({
        ...sampleTopic,
        markdownContent: sampleTopic.markdownContent ? 
          `[${sampleTopic.markdownContent.length} characters]` : 'null'
      }, null, 2)}`);
    }

    log('Database health check completed successfully.');
  } catch (error) {
    log(`ERROR: ${error.message}`);
    log(error.stack);
  } finally {
    await mongoose.connection.close();
    log('MongoDB connection closed');
    if (logStream) {
      logStream.end();
      log(`Log file written to: ${logFile}`);
    }
  }
}

// Run the health check
checkDatabaseHealth(); 