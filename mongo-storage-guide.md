# Using MongoDB for Markdown Storage

This guide explains how to store markdown content directly in MongoDB documents instead of using external storage services like AWS S3 or Firebase Storage.

## Advantages of MongoDB Storage

1. **Simplicity**: No need to manage separate storage services
2. **Reduced Complexity**: Fewer dependencies and integrations
3. **Performance**: Fewer network requests when retrieving content
4. **Cost Efficiency**: No additional storage service costs
5. **Portability**: Easier to migrate and deploy with just MongoDB
6. **Vercel Compatibility**: Works seamlessly with Vercel serverless functions

## MongoDB Storage Implementation

Our approach stores markdown content directly in the MongoDB document instead of storing file paths or URLs:

```javascript
// Topic schema with embedded markdown content
const TopicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  // Store markdown content directly in the document
  markdownContent: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

## API Endpoints

When using MongoDB storage, the API endpoints remain mostly the same, but the implementation changes:

- `GET /api/subjects/:subjectId/topics/:topicId/markdown` - Retrieves markdown content directly from the MongoDB document
- `POST /api/subjects/:subjectId/topics/:topicId/upload` - Saves markdown content to the MongoDB document

## Implementation Details

1. **Reading Markdown Content**:
   ```javascript
   async function getMarkdownFromMongoDB(topicId) {
     const topic = await Topic.findById(topicId);
     if (!topic) {
       throw new Error(`Topic with ID ${topicId} not found`);
     }
     return topic.markdownContent;
   }
   ```

2. **Saving Markdown Content**:
   ```javascript
   async function saveMarkdownToMongoDB(topicId, markdownContent) {
     const updatedTopic = await Topic.findByIdAndUpdate(
       topicId,
       {
         markdownContent,
         updatedAt: Date.now()
       },
       { new: true }
     );
     return updatedTopic;
   }
   ```

## Migration from File System to MongoDB

To migrate existing markdown files from the file system to MongoDB, use the `mongo-migration.js` script:

```bash
npm run migrate:mongodb
```

This script:
1. Scans the local storage directory for markdown files
2. Creates or finds the corresponding subjects and topics in MongoDB
3. Reads the markdown content from each file
4. Stores the content directly in the MongoDB documents

## Considerations

### Document Size Limits

MongoDB has a document size limit of 16MB per document. If your markdown files are larger than this, consider alternative approaches like:

1. **GridFS**: MongoDB's solution for files larger than 16MB
2. **Content Chunking**: Split large content into multiple documents
3. **External Storage**: Use S3 or Firebase for very large files only

### Performance

For most use cases, storing markdown directly in MongoDB provides good performance. However, for very large files or high-traffic applications, consider:

1. **Caching**: Implement Redis or in-memory caching
2. **Read/Write Optimization**: Separate read and write operations if needed
3. **Database Indexing**: Properly index fields for faster queries

## MongoDB Atlas Setup

For production, we recommend using MongoDB Atlas:

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Set up a database user and whitelist your IP
4. Get your connection string and update your `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mind-map-db
   ```

## Production Deployment with Vercel

When deploying to Vercel with MongoDB storage:

1. Add your MongoDB URI as an environment variable in Vercel
2. No need to set up S3 or Firebase credentials
3. Ensure your MongoDB Atlas cluster allows connections from Vercel's IP ranges (or allow connections from anywhere for simplicity)

## Troubleshooting

**Issue**: MongoDB connection fails
**Solution**: Check your MongoDB URI and ensure your IP is whitelisted in MongoDB Atlas

**Issue**: Markdown content too large
**Solution**: Consider using GridFS for files over 16MB

**Issue**: Slow performance
**Solution**: Implement caching and ensure proper database indexing 