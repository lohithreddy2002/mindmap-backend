/**
 * Subjects API Routes
 * Uses MongoDB for storing subject data
 */

const express = require('express');
const router = express.Router();
const mongoStorage = require('../mongo-storage');

// Get all subjects
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await mongoStorage.models.Subject.find({})
      .sort({ name: 1 }); // Sort alphabetically by name
    
    res.json({
      success: true,
      subjects: subjects.map(subject => ({
        id: subject._id,
        name: subject.name,
        description: subject.description,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error getting subjects:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get subjects',
      message: error.message 
    });
  }
});

// Get a specific subject
router.get('/subjects/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const subject = await mongoStorage.models.Subject.findById(subjectId);
    
    if (!subject) {
      return res.status(404).json({ 
        success: false, 
        error: 'Subject not found' 
      });
    }
    
    res.json({
      success: true,
      subject: {
        id: subject._id,
        name: subject.name,
        description: subject.description,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }
    });
  } catch (error) {
    console.error('Error getting subject:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get subject',
      message: error.message 
    });
  }
});

// Create a new subject
router.post('/subjects', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subject name is required' 
      });
    }
    
    // Check if subject with same name already exists
    const existingSubject = await mongoStorage.models.Subject.findOne({ name });
    if (existingSubject) {
      return res.status(409).json({ 
        success: false, 
        error: 'Subject with this name already exists' 
      });
    }
    
    const subject = await mongoStorage.createSubject(name, description || '');
    
    res.status(201).json({
      success: true,
      subject: {
        id: subject._id,
        name: subject.name,
        description: subject.description,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create subject',
      message: error.message 
    });
  }
});

// Update a subject
router.put('/subjects/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subject name is required' 
      });
    }
    
    // Check if another subject with the same name exists
    const existingSubject = await mongoStorage.models.Subject.findOne({ 
      name, 
      _id: { $ne: subjectId } // Exclude current subject from check
    });
    
    if (existingSubject) {
      return res.status(409).json({ 
        success: false, 
        error: 'Another subject with this name already exists' 
      });
    }
    
    const updatedSubject = await mongoStorage.models.Subject.findByIdAndUpdate(
      subjectId,
      {
        name,
        description: description || '',
        updatedAt: Date.now()
      },
      { new: true }
    );
    
    if (!updatedSubject) {
      return res.status(404).json({ 
        success: false, 
        error: 'Subject not found' 
      });
    }
    
    res.json({
      success: true,
      subject: {
        id: updatedSubject._id,
        name: updatedSubject.name,
        description: updatedSubject.description,
        updatedAt: updatedSubject.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update subject',
      message: error.message 
    });
  }
});

// Delete a subject
router.delete('/subjects/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    
    // Check if the subject exists
    const subject = await mongoStorage.models.Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ 
        success: false, 
        error: 'Subject not found' 
      });
    }
    
    // Find all topics associated with this subject
    const topics = await mongoStorage.models.Topic.find({ subject: subjectId });
    
    // Delete all associated topics
    if (topics.length > 0) {
      await mongoStorage.models.Topic.deleteMany({ subject: subjectId });
      console.log(`Deleted ${topics.length} topics associated with subject ${subjectId}`);
    }
    
    // Delete the subject
    await mongoStorage.models.Subject.findByIdAndDelete(subjectId);
    
    res.json({
      success: true,
      message: 'Subject and all associated topics deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete subject',
      message: error.message 
    });
  }
});

module.exports = router; 