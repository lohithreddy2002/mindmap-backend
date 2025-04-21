/**
 * Firebase Migration Script
 * 
 * This script migrates markdown files from local storage to Firebase Storage
 * and updates the database references accordingly.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const admin = require('firebase-admin');
const glob = promisify(require('glob'));
const readFileAsync = promisify(fs.readFile);
const statAsync = promisify(fs.stat);

// Load Firebase service account
let serviceAccount;
try {
  serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./firebase-service-account.json');
} catch (error) {
  console.error('Error loading Firebase service account:', error);
  console.log('Please make sure you have a firebase-service-account.json file or FIREBASE_SERVICE_ACCOUNT environment variable set.');
  process.exit(1);
}

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();
const firestore = admin.firestore();
const localStoragePath = process.env.LOCAL_STORAGE_PATH || './uploads';

// Check if file storage path exists
if (!fs.existsSync(localStoragePath)) {
  console.error(`Local storage path ${localStoragePath} does not exist`);
  process.exit(1);
}

/**
 * Upload a file to Firebase Storage
 * @param {string} filePath - Path to the local file
 * @param {string} destination - Destination path in Firebase Storage
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
async function uploadToFirebase(filePath, destination) {
  try {
    const fileContent = await readFileAsync(filePath);
    const contentType = 'text/markdown';
    const file = bucket.file(destination);
    
    // Upload the file
    await file.save(fileContent, {
      metadata: {
        contentType
      }
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    console.log(`File uploaded successfully to ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error(`Error uploading file ${filePath} to Firebase:`, error);
    throw error;
  }
}

/**
 * Update document in Firestore with new Firebase Storage URL
 * @param {string} collection - Firestore collection name
 * @param {string} docId - Document ID
 * @param {string} fieldName - Field name to update
 * @param {string} storageUrl - New Firebase Storage URL
 * @returns {Promise<void>}
 */
async function updateFirestore(collection, docId, fieldName, storageUrl) {
  try {
    await firestore.collection(collection).doc(docId).update({
      [fieldName]: storageUrl,
      storageType: 'firebase',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Updated Firestore document ${collection}/${docId}`);
    return true;
  } catch (error) {
    console.error(`Error updating Firestore document ${collection}/${docId}:`, error);
    return false;
  }
}

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
 * Extract subject ID and topic ID from file path
 * @param {string} filePath - Path to the file
 * @returns {Object} - Object with subjectId and topicId
 */
function extractIds(filePath) {
  // Assuming path structure: uploads/subjects/{subjectId}/topics/{topicId}/content.md
  // OR uploads/{subjectId}/{topicId}.md
  
  const relativePath = path.relative(localStoragePath, filePath);
  const parts = relativePath.split(path.sep);
  
  // Try to extract IDs from different path formats
  if (parts.includes('subjects') && parts.includes('topics')) {
    // Format: uploads/subjects/{subjectId}/topics/{topicId}/content.md
    const subjectIndex = parts.indexOf('subjects') + 1;
    const topicIndex = parts.indexOf('topics') + 1;
    
    if (subjectIndex < parts.length && topicIndex < parts.length) {
      return {
        subjectId: parts[subjectIndex],
        topicId: parts[topicIndex],
        filename: path.basename(filePath)
      };
    }
  }
  
  // Simpler format: uploads/{subjectName}/{topicName}.md
  if (parts.length >= 2 && path.extname(parts[parts.length - 1]) === '.md') {
    return {
      subjectName: parts[0],
      topicName: path.basename(parts[1], '.md'),
      filename: parts[1]
    };
  }
  
  console.warn(`Could not extract IDs from path: ${filePath}`);
  return null;
}

/**
 * Main migration function
 */
async function migrateToFirebase() {
  try {
    console.log('Starting migration from local storage to Firebase Storage...');
    
    // Find all markdown files
    const files = await findMarkdownFiles(localStoragePath);
    console.log(`Found ${files.length} markdown files to migrate`);
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process each file
    for (const [index, filePath] of files.entries()) {
      try {
        console.log(`\nProcessing file ${index + 1}/${files.length}: ${filePath}`);
        
        // Extract subject and topic information
        const ids = extractIds(filePath);
        if (!ids) {
          console.warn(`Skipping file ${filePath} - could not determine subject/topic IDs`);
          failureCount++;
          continue;
        }
        
        // Determine destination path in Firebase Storage
        let destination;
        if (ids.subjectId && ids.topicId) {
          destination = `subjects/${ids.subjectId}/topics/${ids.topicId}/${ids.filename}`;
        } else {
          destination = `${ids.subjectName}/${ids.filename}`;
        }
        
        console.log(`Uploading to Firebase Storage as: ${destination}`);
        
        // Upload to Firebase Storage
        const storageUrl = await uploadToFirebase(filePath, destination);
        
        // Update database reference
        // This depends on your database structure - adjust as needed
        if (ids.subjectId && ids.topicId) {
          // If using Firestore
          const updated = await updateFirestore('topics', ids.topicId, 'markdownPath', storageUrl);
          if (updated) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          // For simpler structure or if not using Firestore
          console.log(`File uploaded to ${storageUrl}`);
          console.log(`Manual database update may be required for ${ids.subjectName}/${ids.topicName}`);
          // Track as success for now, though manual update may be needed
          successCount++;
        }
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
    console.log('Migration process completed');
    process.exit(0);
  }
}

// Run the migration
migrateToFirebase().catch(error => {
  console.error('Unhandled error during migration:', error);
  process.exit(1);
}); 