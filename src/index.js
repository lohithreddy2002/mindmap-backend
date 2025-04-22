/**
 * Mind Map Viewer Backend Server
 * Uses MongoDB for storing both metadata and markdown content
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const subjectsRoutes = require('./routes/subjectsRoutes');
const adminRoutes = require('./routes/adminRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Configure Morgan logging
// Development: Console colored logs
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
    
    // Log request body for POST/PUT requests (but sanitize sensitive data)
    if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
      let sanitizedBody = { ...req.body };
      // Remove sensitive fields if any
      if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
      if (sanitizedBody.apiKey) sanitizedBody.apiKey = '[REDACTED]';
      
      console.log(`Request body: ${JSON.stringify(sanitizedBody)}`);
    }
  });
  next();
});

// Connect to MongoDB
console.log(`[${new Date().toISOString()}] Connecting to MongoDB...`);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log(`[${new Date().toISOString()}] Connected to MongoDB successfully`);
  console.log(`[${new Date().toISOString()}] Database name: ${mongoose.connection.db.databaseName}`);
})
.catch(err => {
  console.error(`[${new Date().toISOString()}] MongoDB connection error:`, err);
  // Don't exit in serverless environment
  if (process.env.VERCEL !== '1') {
    process.exit(1);
  }
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

// Log MongoDB queries in development
if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    console.log(`[${new Date().toISOString()}] MongoDB Query: ${collectionName}.${method}`, JSON.stringify(query), doc);
  });
}

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
  res.json({
    status: 'API is running',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    mongodbConnected: mongoose.connection.readyState === 1,
    isServerless: process.env.VERCEL === '1'
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] Error:`, err);
  
  // Log detailed error information
  console.error(`[${timestamp}] Request: ${req.method} ${req.originalUrl}`);
  console.error(`[${timestamp}] Request IP: ${req.ip}`);
  console.error(`[${timestamp}] Error Stack:`, err.stack);
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: timestamp,
    path: req.originalUrl,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start the server if not running as a module (for Vercel serverless)
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${PORT}`);
    console.log(`[${new Date().toISOString()}] API available at http://localhost:${PORT}/api/subjects`);
    console.log(`[${new Date().toISOString()}] Admin API available at http://localhost:${PORT}/api/admin`);
    console.log(`[${new Date().toISOString()}] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[${new Date().toISOString()}] CORS origin: ${process.env.CORS_ORIGIN || '*'}`);
  });
}

// Export for serverless
module.exports = app; 