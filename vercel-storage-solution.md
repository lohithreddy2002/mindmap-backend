# File Storage Solution for Vercel Deployment

When deploying the Mind Map Viewer backend to Vercel, you'll need a different approach for file storage since Vercel's serverless functions don't support persistent file storage. This guide outlines how to modify your backend to use cloud storage services.

## Why Local Storage Won't Work on Vercel

Vercel serverless functions:
- Are ephemeral (short-lived)
- Don't have persistent file systems
- Start fresh on each invocation

Your current implementation that saves markdown files to the local filesystem will not work as expected on Vercel.

## Recommended Solutions

### Option 1: AWS S3 (Recommended)

1. **Create an AWS Account and S3 Bucket**
   - Sign up for [AWS](https://aws.amazon.com/)
   - Create an S3 bucket for storing markdown files
   - Set up IAM credentials with appropriate permissions

2. **Install Required Packages**
   ```bash
   npm install aws-sdk
   ```

3. **Update File Upload Code**
   
   ```javascript
   const AWS = require('aws-sdk');
   
   // Configure AWS
   const s3 = new AWS.S3({
     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
     region: process.env.AWS_REGION
   });
   
   // Upload file to S3
   async function uploadToS3(file, key) {
     const params = {
       Bucket: process.env.S3_BUCKET_NAME,
       Key: key,
       Body: file.buffer,
       ContentType: file.mimetype
     };
   
     return s3.upload(params).promise();
   }
   
   // Example usage in your route handler
   app.post('/api/admin/subjects/:subjectId/topics/:topicId/upload', upload.single('markdown'), async (req, res) => {
     try {
       const { subjectId, topicId } = req.params;
       const file = req.file;
       
       // Generate a key for S3 (like a filepath)
       const key = `subjects/${subjectId}/topics/${topicId}/content.md`;
       
       // Upload to S3
       const s3Response = await uploadToS3(file, key);
       
       // Store the S3 URL or key in your database, not a local file path
       const markdownPath = s3Response.Location;
       
       // Update your database with the S3 URL rather than a local file path
       // ...
       
       res.status(200).json({ success: true, markdownPath });
     } catch (error) {
       console.error('Error uploading file:', error);
       res.status(500).json({ error: 'Failed to upload file' });
     }
   });
   ```

4. **Update File Retrieval Code**

   ```javascript
   // Get file from S3
   async function getFromS3(key) {
     const params = {
       Bucket: process.env.S3_BUCKET_NAME,
       Key: key
     };
   
     const data = await s3.getObject(params).promise();
     return data.Body.toString('utf-8');
   }
   
   // Example usage in your route handler
   app.get('/api/subjects/:subjectId/topics/:topicId/markdown', async (req, res) => {
     try {
       const { subjectId, topicId } = req.params;
       
       // Get the key from your database
       // Assuming you store the S3 key in your database
       const topic = await getTopicFromDatabase(subjectId, topicId);
       
       // If you stored the full S3 URL, extract the key or convert the URL to a key
       const key = topic.markdownPath.includes('amazonaws.com') 
         ? topic.markdownPath.split('.com/')[1] 
         : topic.markdownPath;
       
       // Get the markdown content from S3
       const markdownContent = await getFromS3(key);
       
       res.status(200).json({ markdown: markdownContent });
     } catch (error) {
       console.error('Error getting markdown:', error);
       res.status(500).json({ error: 'Failed to get markdown content' });
     }
   });
   ```

5. **Add Environment Variables to Vercel**
   
   Add these environment variables to your Vercel project:
   
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=your_region
   S3_BUCKET_NAME=your_bucket_name
   ```

### Option 2: Firebase Storage

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Storage

2. **Install Required Packages**
   ```bash
   npm install firebase-admin
   ```

3. **Initialize Firebase**
   ```javascript
   const admin = require('firebase-admin');
   
   // Initialize Firebase
   admin.initializeApp({
     credential: admin.credential.cert({
       projectId: process.env.FIREBASE_PROJECT_ID,
       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
       privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
     }),
     storageBucket: process.env.FIREBASE_STORAGE_BUCKET
   });
   
   const bucket = admin.storage().bucket();
   ```

4. **Update File Upload Code**
   ```javascript
   // Upload file to Firebase Storage
   async function uploadToFirebase(file, filePath) {
     const fileBuffer = file.buffer;
     const fileUpload = bucket.file(filePath);
     
     const blobStream = fileUpload.createWriteStream({
       metadata: {
         contentType: file.mimetype
       }
     });
     
     return new Promise((resolve, reject) => {
       blobStream.on('error', (error) => {
         reject(error);
       });
       
       blobStream.on('finish', () => {
         const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileUpload.name}`;
         resolve(publicUrl);
       });
       
       blobStream.end(fileBuffer);
     });
   }
   ```

5. **Add Environment Variables to Vercel**
   ```
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_client_email
   FIREBASE_PRIVATE_KEY=your_private_key
   FIREBASE_STORAGE_BUCKET=your_bucket_name
   ```

## Updating Your Database Schema

With cloud storage, your database should now store:

- For AWS S3: The S3 object key or full URL
- For Firebase: The storage URL

Instead of local file paths like `/uploads/subjects/abc123/topics/def456/content.md`

## Testing Before Deployment

1. Set up your chosen cloud storage locally
2. Update your code to use the cloud storage
3. Test all file operations:
   - Upload
   - Retrieval
   - Deletion
4. Verify the front end can display markdown files correctly

## Migration Strategy

If you already have markdown files stored locally:

1. Write a migration script to:
   - Read all existing markdown files
   - Upload them to your cloud storage
   - Update your database with the new storage URLs/paths
2. Test the migration script thoroughly
3. Run the migration before switching to the cloud storage implementation

## Security Considerations

1. **S3 Bucket Permissions**
   - Set appropriate CORS configuration
   - Limit public access to only what's necessary
   - Use IAM roles with least privilege

2. **Firebase Security Rules**
   - Configure rules to control read/write access
   - Consider authentication requirements

3. **API Security**
   - Ensure your API endpoints verify authentication/authorization before file operations
   - Validate file types and sizes before upload 