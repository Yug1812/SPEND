const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getCurrentRound } = require('./rounds');

// In-memory admin user (for demo purposes only - in production, use proper authentication)
const adminUser = {
  id: '1',
  username: 'admin',
  // Password is 'admin123' hashed with bcrypt
  password: '$2a$10$XFDq3wNxVzH5It8WLRX9Xe7v6vJvQ4eJk9XrLdKQZJf8jKv1LzXHO' 
};

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if admin exists
    if (username !== adminUser.username) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create and return JWT token
    const token = jwt.sign(
      { id: adminUser.id },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware to verify admin token
function verifyToken(req, res, next) {
  // Skip token verification in development for easier testing
  if (process.env.NODE_ENV === 'development' && !process.env.REQUIRE_AUTH) {
    req.adminId = '1';
    return next();
  }

  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
    req.adminId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
}

// Apply token verification to protected routes
router.use(verifyToken);

// Protected admin routes
router.get('/dashboard', (req, res) => {
  try {
    const round = getCurrentRound();
    res.json({
      currentRound: round,
      stats: {
        activeTeams: 0, // You'll need to implement this
        activeRound: round?.roundNumber || 0,
        totalRounds: 5 // Assuming 5 rounds total
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset game (for development/testing)
router.post('/reset', (req, res) => {
  try {
    // Clear all data
    // Note: This is a simple in-memory reset. In a real app, you'd want to be more careful.
    const { rounds } = require('./rounds');
    const { teams } = require('./teams');
    
    rounds.length = 0;
    teams.length = 0;
    
    res.json({ message: 'Game reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
