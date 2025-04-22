/**
 * Mind Map Viewer Backend Server
 * Uses MongoDB for storing both metadata and markdown content
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs');
const subjectsRoutes = require('./routes/subjectsRoutes');
const adminRoutes = require('./routes/adminRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Configure logging - use /tmp for Vercel compatibility
const isVercel = process.env.VERCEL === '1';
const logDirectory = isVercel 
  ? '/tmp/logs' 
  : path.join(__dirname, '../logs');

// Ensure log directory exists
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

// Create a write stream for access logs
let accessLogStream;
try {
  accessLogStream = fs.createWriteStream(
    path.join(logDirectory, 'access.log'), 
    { flags: 'a' }
  );
} catch (err) {
  console.warn(`Unable to create log file: ${err.message}. Logs will only go to console.`);
}

// Configure Morgan logging
// Development: Console colored logs
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Only log to file if we successfully created the stream
if (accessLogStream) {
  app.use(morgan('combined', { stream: accessLogStream }));
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*", // In production, use CORS_ORIGIN env var
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - could be used to serve uploaded markdown files later
app.use('/static', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/subjects', subjectsRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Basic route for API status
app.get('/api/status', (req, res) => {
  res.json({ status: 'API is running', timestamp: new Date() });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start the server if not running as a module (for Vercel serverless)
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/subjects`);
    console.log(`Admin API available at http://localhost:${PORT}/api/admin`);
  });
}

// Export for serverless
module.exports = app; 