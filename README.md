# Mind Map Viewer Backend

This is the backend API server for the Mind Map Viewer application. It provides endpoints for managing subjects and topics, and uses MongoDB for storing both metadata and markdown content.

## Features

- RESTful API for managing subjects and topics
- Markdown content storage directly in MongoDB (no file system)
- Admin API endpoints with API key authentication
- CORS support for frontend integration

## Prerequisites

- Node.js (v14 or later)
- MongoDB (local or Atlas)
- npm or yarn

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the environment variables file:
   ```
   cp .env.example .env
   ```
4. Edit the `.env` file to configure your MongoDB connection:
   ```
   MONGODB_URI=mongodb://localhost:27017/mind-map-db
   ```
   Or for MongoDB Atlas:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mind-map-db
   ```
5. Start the development server:
   ```
   npm run dev
   ```
   The server will run on http://localhost:3002 by default.

## MongoDB Storage

This application has been migrated to use MongoDB exclusively for storage. All markdown content is stored directly in the database, rather than in the file system. This provides several benefits:

- **Simplified Deployment**: No need to manage file storage separately
- **Improved Data Integrity**: All data is stored in one place
- **Better Scalability**: MongoDB scales horizontally and is cloud-ready
- **Simplified Backups**: Backing up one database instead of files + database

### Bulk Import with ZIP Files

The application supports bulk import of content using ZIP files. To use this feature:

1. Create a ZIP file with the following structure:
   ```
   my-zip-file.zip
   ├── Subject1/
   │   ├── Topic1.md
   │   ├── Topic2.md
   │   └── ...
   ├── Subject2/
   │   ├── Topic1.md
   │   └── ...
   └── ...
   ```

2. Upload the ZIP file through the Admin Panel's Import tab, or use the API endpoint:
   ```
   POST /api/admin/import/zip
   ```

3. The system will:
   - Create subjects based on top-level directories
   - Create topics based on markdown files within each directory
   - Store the markdown content directly in MongoDB
   - Handle duplicates by updating existing content

**Notes:**
- Topic titles are derived from filenames (without the .md extension)
- Subject names are derived from directory names
- The system will ignore non-markdown files and directories without markdown files
- If a subject or topic already exists, it will be updated rather than duplicated
- Files not in a subject folder will be ignored
- The import process is optimized to handle large ZIP files efficiently

### Database Health Check

A database health check script is included to help diagnose issues with the MongoDB connection or data. Run it with:

```
npm run db:check
```

This will:
- Test the MongoDB connection
- Count subjects and topics
- Check for orphaned topics (topics without a valid subject)
- Check for topics without markdown content
- Display sample data structure
- Generate a log file in the `logs` directory

### Logging

All API operations are now logged extensively:
- Request and response details
- MongoDB query diagnostics in development mode
- Error details with timestamps
- Performance metrics for API calls

Logs are stored in the `logs` directory, with separate files for:
- Access logs (HTTP requests)
- Application logs (startup, shutdown, errors)
- Database health check logs

## Database Structure

The application uses MongoDB with two main collections:

### Subjects Collection

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Topics Collection

```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  markdownContent: String,
  subjectId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Public Endpoints

- `GET /api/subjects` - Get all subjects
- `GET /api/subjects/:subjectId` - Get a specific subject with its topics
- `GET /api/subjects/topics/:topicId` - Get a specific topic
- `GET /api/subjects/topics/:topicId/markdown` - Get markdown content for a topic

### Admin Endpoints

These endpoints require the `X-API-Key` header:

- `GET /api/admin/subjects` - Get all subjects (admin)
- `POST /api/admin/subjects` - Create a new subject
- `DELETE /api/admin/subjects/:subjectId` - Delete a subject
- `POST /api/admin/subjects/:subjectId/topics` - Create a new topic
- `PUT /api/admin/topics/:topicId/markdown` - Update topic markdown
- `DELETE /api/admin/topics/:topicId` - Delete a topic
- `POST /api/admin/topics/:topicId/markdown` - Upload markdown for a topic
- `POST /api/admin/import/zip` - Process ZIP file for bulk import

## Environment Variables

- `PORT` - Server port (default: 3002)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - CORS allowed origin
- `MONGODB_URI` - MongoDB connection string
- `API_KEY` - Secret key for admin API access

## License

MIT 