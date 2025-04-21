/**
 * Migration Script: Local Storage to AWS S3
 * 
 * This script migrates existing markdown files from local storage to AWS S3
 * and updates the database with the new S3 URLs.
 * 
 * Usage:
 * - Set up your AWS credentials as environment variables
 * - Update the database connection details
 * - Run with Node.js: node migration-script.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;
const localStoragePath = process.env.LOCAL_STORAGE_PATH;

// MongoDB Schema Definitions
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const TopicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  content: { type: String, default: '' },
  s3Key: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Topic = mongoose.model('Topic', TopicSchema);

// Helper function to upload file to S3
const uploadToS3 = async (fileContent, key) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: 'text/markdown'
  };

  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully to ${data.Location}`);
    return data.Key;
  } catch (error) {
    console.error(`Error uploading file to S3: ${error}`);
    throw error;
  }
};

// Function to check if a path is a directory
const isDirectory = async (path) => {
  const stats = await statAsync(path);
  return stats.isDirectory();
};

// Migrate function
const migrateContent = async () => {
  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Get all subject directories
    const subjectDirs = await readdirAsync(localStoragePath);
    
    console.log(`Found ${subjectDirs.length} potential subjects to migrate`);
    
    for (const subjectDir of subjectDirs) {
      const subjectPath = path.join(localStoragePath, subjectDir);
      
      // Skip if not a directory
      if (!(await isDirectory(subjectPath))) {
        console.log(`Skipping ${subjectDir} as it's not a directory`);
        continue;
      }

      // Create or find subject
      console.log(`Processing subject: ${subjectDir}`);
      let subject = await Subject.findOne({ name: subjectDir });
      
      if (!subject) {
        subject = new Subject({ name: subjectDir });
        await subject.save();
        console.log(`Created new subject: ${subjectDir}`);
      } else {
        console.log(`Found existing subject: ${subjectDir}`);
      }

      // Get all topic files in the subject directory
      const topicFiles = await readdirAsync(subjectPath);
      console.log(`Found ${topicFiles.length} potential topics for subject ${subjectDir}`);
      
      for (const topicFile of topicFiles) {
        // Check if it's a markdown file
        if (!topicFile.endsWith('.md')) {
          console.log(`Skipping ${topicFile} as it's not a markdown file`);
          continue;
        }

        const topicName = path.basename(topicFile, '.md');
        const topicPath = path.join(subjectPath, topicFile);
        const fileContent = await readFileAsync(topicPath, 'utf8');
        
        // Create S3 key
        const s3Key = `${subjectDir}/${topicFile}`;
        
        // Upload to S3
        console.log(`Uploading ${topicFile} to S3...`);
        const uploadedKey = await uploadToS3(fileContent, s3Key);
        
        // Create or update topic in MongoDB
        let topic = await Topic.findOne({ 
          name: topicName,
          subject: subject._id
        });
        
        if (!topic) {
          topic = new Topic({
            name: topicName,
            subject: subject._id,
            content: fileContent,
            s3Key: uploadedKey
          });
          await topic.save();
          console.log(`Created new topic: ${topicName}`);
        } else {
          topic.content = fileContent;
          topic.s3Key = uploadedKey;
          topic.updatedAt = Date.now();
          await topic.save();
          console.log(`Updated existing topic: ${topicName}`);
        }
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the migration
migrateContent().then(() => {
  console.log('Migration script completed');
  process.exit(0);
}).catch(error => {
  console.error('Migration script failed:', error);
  process.exit(1);
}); 