/**
 * Firebase Storage Implementation for Mind Map Viewer
 * 
 * This module provides functions to upload, download, and manage markdown files
 * using Firebase Storage instead of AWS S3.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase with credentials
// The service account key can be downloaded from Firebase Console > Project Settings > Service Accounts
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./firebase-service-account.json');

// Initialize Firebase if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const bucket = admin.storage().bucket();

/**
 * Upload a file to Firebase Storage
 * @param {Buffer|string} fileContent - File content or path to file
 * @param {string} destination - Destination path in Firebase Storage
 * @param {object} metadata - Optional metadata
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
async function uploadToFirebase(fileContent, destination, metadata = {}) {
  try {
    // Determine if fileContent is a file path or a buffer
    let buffer;
    if (typeof fileContent === 'string' && fs.existsSync(fileContent)) {
      buffer = fs.readFileSync(fileContent);
    } else if (Buffer.isBuffer(fileContent)) {
      buffer = fileContent;
    } else {
      throw new Error('Invalid file content provided');
    }

    // Create a reference to the file in Firebase Storage
    const file = bucket.file(destination);
    
    // Set content type based on file extension or provided metadata
    const contentType = metadata.contentType || 
      (path.extname(destination) === '.md' ? 'text/markdown' : 'application/octet-stream');
    
    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType,
        ...metadata
      }
    });
    
    // Make the file publicly accessible (optional)
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    console.log(`File uploaded successfully to ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Firebase Storage:', error);
    throw error;
  }
}

/**
 * Download a file from Firebase Storage
 * @param {string} filePath - Path to the file in Firebase Storage
 * @returns {Promise<Buffer>} - File content as a buffer
 */
async function downloadFromFirebase(filePath) {
  try {
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File ${filePath} does not exist in Firebase Storage`);
    }
    
    // Download the file
    const [fileContent] = await file.download();
    return fileContent;
  } catch (error) {
    console.error(`Error downloading file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Get a file as a string from Firebase Storage (for text files like markdown)
 * @param {string} filePath - Path to the file in Firebase Storage
 * @returns {Promise<string>} - File content as a string
 */
async function getFileAsString(filePath) {
  try {
    const buffer = await downloadFromFirebase(filePath);
    return buffer.toString('utf8');
  } catch (error) {
    console.error(`Error getting file ${filePath} as string:`, error);
    throw error;
  }
}

/**
 * Delete a file from Firebase Storage
 * @param {string} filePath - Path to the file in Firebase Storage
 * @returns {Promise<void>}
 */
async function deleteFromFirebase(filePath) {
  try {
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`File ${filePath} does not exist in Firebase Storage`);
      return;
    }
    
    // Delete the file
    await file.delete();
    console.log(`File ${filePath} deleted successfully`);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw error;
  }
}

/**
 * List files in a directory in Firebase Storage
 * @param {string} directoryPath - Directory path in Firebase Storage
 * @returns {Promise<Array>} - Array of file objects
 */
async function listFiles(directoryPath) {
  try {
    // Ensure directory path ends with a slash
    const directory = directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`;
    
    // List files in the directory
    const [files] = await bucket.getFiles({ prefix: directory });
    
    return files.map(file => ({
      name: file.name,
      fullPath: file.name,
      downloadUrl: `https://storage.googleapis.com/${bucket.name}/${file.name}`,
      contentType: file.metadata.contentType,
      timeCreated: file.metadata.timeCreated,
      updated: file.metadata.updated,
      size: parseInt(file.metadata.size, 10)
    }));
  } catch (error) {
    console.error(`Error listing files in ${directoryPath}:`, error);
    throw error;
  }
}

module.exports = {
  uploadToFirebase,
  downloadFromFirebase,
  getFileAsString,
  deleteFromFirebase,
  listFiles
}; 