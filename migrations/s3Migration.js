/**
 * S3 Migration Script
 * 
 * This script migrates markdown files from local storage to AWS S3
 * and updates MongoDB with the new file locations.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { MongoClient, ObjectId } = require('mongodb');
const AWS = require('aws-sdk');
const glob = promisify(require('glob'));

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const bucketName = process.env.S3_BUCKET_NAME;
const localStoragePath = process.env.LOCAL_STORAGE_PATH;
const mongoUri = process.env.MONGODB_URI;

// Connect to MongoDB
async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    console.log('Connected to MongoDB successfully');
    return client;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

// Upload file to S3
async function uploadToS3(filePath, s3Key) {
  try {
    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'text/markdown'
    };
    
    const uploadResult = await s3.upload(params).promise();
    console.log(`File uploaded successfully to ${uploadResult.Location}`);
    return uploadResult.Location;
  } catch (error) {
    console.error(`Error uploading file to S3: ${error}`);
    throw error;
  }
}

// Update MongoDB record with S3 URL
async function updateMongoRecord(db, topicId, s3Url) {
  try {
    const result = await db.collection('topics').updateOne(
      { _id: ObjectId(topicId) },
      { $set: { contentUrl: s3Url, storageType: 's3' } }
    );
    
    if (result.modifiedCount === 1) {
      console.log(`Updated MongoDB record for topic ${topicId}`);
      return true;
    } else {
      console.warn(`No MongoDB record found for topic ${topicId}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating MongoDB record: ${error}`);
    throw error;
  }
}

// Find all markdown files and their corresponding topic IDs
async function findMarkdownFiles() {
  try {
    // Assuming directory structure is /subject/topic-id.md
    const files = await glob(`${localStoragePath}/*/*.md`);
    
    return files.map(file => {
      const filename = path.basename(file, '.md');
      const subject = path.basename(path.dirname(file));
      
      return {
        filePath: file,
        topicId: filename,
        subject,
        s3Key: `${subject}/${filename}.md`
      };
    });
  } catch (error) {
    console.error(`Error finding markdown files: ${error}`);
    throw error;
  }
}

// Main migration function
async function migrateToS3() {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db();
    
    console.log('Finding markdown files...');
    const files = await findMarkdownFiles();
    console.log(`Found ${files.length} markdown files to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const [index, file] of files.entries()) {
      try {
        console.log(`Processing file ${index + 1}/${files.length}: ${file.filePath}`);
        
        // Upload to S3
        const s3Url = await uploadToS3(file.filePath, file.s3Key);
        
        // Update MongoDB
        const updated = await updateMongoRecord(db, file.topicId, s3Url);
        
        if (updated) {
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to migrate file ${file.filePath}:`, error);
        errorCount++;
      }
    }
    
    console.log('\nMigration Summary:');
    console.log(`Total files: ${files.length}`);
    console.log(`Successfully migrated: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run migration
migrateToS3().then(() => {
  console.log('Migration process completed');
}).catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 