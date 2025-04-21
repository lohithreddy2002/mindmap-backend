const mongoose = require('mongoose');

const TopicSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String, 
    default: '' 
  },
  // Store the full markdown content directly in the document
  markdownContent: { 
    type: String, 
    default: '' 
  },
  // Reference to the parent subject
  subjectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Subject', 
    required: true,
    index: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Create a compound index on subjectId and title to ensure unique titles within a subject
TopicSchema.index({ subjectId: 1, title: 1 }, { unique: true });

module.exports = mongoose.model('Topic', TopicSchema); 