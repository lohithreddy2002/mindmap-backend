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

// Vercel-compatible logging setup
const isServerlessEnv = process.env.VERCEL === '1' || !fs.existsSync(path.join(__dirname, '../logs'));
let logDirectory = '/tmp';  // Default to /tmp for serverless

// Only attempt to create logs directory if not in serverless
if (!isServerlessEnv) {
  try {
    logDirectory = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
  } catch (err) {
    console.warn(`Warning: Could not create logs directory. Using /tmp: ${err.message}`);
    logDirectory = '/tmp';
  }
}

// Configure Morgan logging
let accessLogStream;
try {
  // Always attempt to use /tmp in Vercel environment
  const logPath = isServerlessEnv ? 
    path.join('/tmp', 'access.log') : 
    path.join(logDirectory, 'access.log');
  
  accessLogStream = fs.createWriteStream(logPath, { flags: 'a' });
  
  // Log file path for debugging
  console.log(`Log file created at: ${logPath}`);
} catch (err) {
  console.warn(`Unable to create log file: ${err.message}. Logs will only go to console.`);
}

// Development: Console colored logs
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // In production, just use basic logging to avoid console clutter
  app.use(morgan('combined'));
}

// Only log to file if we successfully created the stream
if (accessLogStream) {
  app.use(morgan('combined', { stream: accessLogStream }));
}

// Connect to MongoDB
console.log(`Connecting to MongoDB...`);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  // Don't exit in serverless environment as it will kill the function
  if (!isServerlessEnv) {
    process.exit(1);
  }
});

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/static', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/subjects', subjectsRoutes);
app.use('/api/admin', adminRoutes);

// Basic route for API status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'API is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    vercel: isServerlessEnv ? 'true' : 'false',
    mongodbConnected: mongoose.connection.readyState === 1
  });
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