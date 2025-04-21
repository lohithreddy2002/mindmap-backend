# Backend Migrations

This directory contains migration scripts for the Mind Map Viewer application.

## Available Migrations

### S3 Migration (`s3Migration.js`)

This script migrates markdown content files from local storage to AWS S3 bucket storage.

#### Prerequisites:
- AWS account with S3 bucket created
- AWS credentials configured in `.env` file
- MongoDB connection string in `.env` file
- Node.js and npm installed

#### Configuration:
Make sure your `.env` file contains the following variables:
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region
S3_BUCKET_NAME=your_bucket_name
MONGODB_URI=your_mongodb_connection_string
LOCAL_STORAGE_PATH=path_to_your_local_storage
```

#### Running the migration:
```bash
cd backend
node migrations/s3Migration.js
```

#### What it does:
1. Connects to MongoDB
2. Finds all markdown files in the local storage directory
3. Uploads each file to S3
4. Updates the MongoDB records with the new S3 URLs
5. Provides a summary of the migration results

#### Expected output:
The script will print progress and summary information to the console, including:
- Number of files found
- Upload status for each file
- MongoDB update status
- Final summary showing success and failure counts

## Creating New Migrations

To add a new migration script:
1. Create a new JavaScript file in this directory
2. Follow the pattern of existing migrations
3. Document the migration in this README 