const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Admin = require('./models/Admin');

// Import routes
const teamRoutes = require('./routes/teams');
const roundRoutes = require('./routes/rounds');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ["GET", "POST"]
  }
});

// MongoDB connection is initialized in start()

// Middleware
app.use(cors());
app.use(express.json());

// Make io available to routes
app.set('io', io);

// Routes
app.get("/",(req,res) => {res.status(200).json({success:true,msg:200})})
app.use('/api/teams', teamRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current game state to newly connected client
  const { getCurrentRound } = require('./routes/rounds');
  const currentRound = getCurrentRound();
  if (currentRound) {
    socket.emit('round:update', currentRound);
    
    // Send latest news if any
    if (currentRound.news && currentRound.news.length > 0) {
      socket.emit('news', currentRound.news[currentRound.news.length - 1]);
    }
    
    // Send latest prices
    socket.emit('prices', currentRound.priceChanges);
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
const port = process.env.PORT || 4000;
async function start() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/spend'
    await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'spend' })
    console.log('MongoDB connected')

    // Create default admin user if it doesn't exist
    await createDefaultAdmin();

    server.listen(port, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
      
      // Log available routes
      console.log('Available routes:');
      console.log(`- GET  /api/health`);
      console.log(`- GET  /api/teams`);
      console.log(`- POST /api/teams/register`);
      console.log(`- POST /api/teams/login`);
      console.log(`- POST /api/teams/:id/invest`);
      console.log(`- POST /api/teams/:id/transfer`);
      console.log(`- GET  /api/teams/:id`);
      console.log(`- GET  /api/rounds/current`);
      console.log(`- POST /api/rounds`);
      console.log(`- POST /api/rounds/end`);
      console.log(`- POST /api/rounds/news`);
      console.log(`- POST /api/rounds/prices`);
      console.log(`- POST /api/admin/login`);
      console.log(`- GET  /api/admin/dashboard`);
      console.log(`- POST /api/admin/reset`);
    });
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()

// Create default admin user
async function createDefaultAdmin() {
  try {
    const Admin = require('./models/Admin');
    const adminExists = await Admin.findOne({ username: 'admin' });
    if (!adminExists) {
      const admin = new Admin({
        username: 'admin',
        password: 'admin123'
      });
      await admin.save();
      console.log('Default admin user created: admin/admin123');
    } else {
      console.log('Admin user already exists');
    }
  } catch (err) {
    console.error('Error creating default admin:', err);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Close server & exit process
  server.close(() => process.exit(1));
});