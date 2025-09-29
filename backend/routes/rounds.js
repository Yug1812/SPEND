const express = require('express');
const router = express.Router();
const { updateTeamPortfolio } = require('./teams');

// In-memory storage for rounds
let rounds = [];
let currentRound = null;

// Get current round
router.get('/current', (req, res) => {
  try {
    if (!currentRound) {
      return res.status(404).json({ message: 'No active round found' });
    }
    res.json(currentRound);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start a new round
router.post('/', (req, res) => {
  try {
    // End current round if any
    if (currentRound) {
      currentRound.status = 'completed';
      currentRound.endTime = Date.now();
      rounds = rounds.map(r => r.roundNumber === currentRound.roundNumber ? currentRound : r);
    }

    // Create new round
    const roundNumber = rounds.length > 0 ? Math.max(...rounds.map(r => r.roundNumber)) + 1 : 1;
    
    const newRound = {
      roundNumber,
      status: 'active',
      startTime: Date.now(),
      duration: 300, // 5 minutes in seconds
      priceChanges: {
        gold: 0,
        crypto: 0,
        stocks: 0,
        realEstate: 0,
        fd: 0
      },
      news: []
    };

    currentRound = newRound;
    rounds.push(newRound);
    
    res.status(201).json(newRound);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// End current round
router.post('/end', (req, res) => {
  try {
    if (!currentRound || currentRound.status !== 'active') {
      return res.status(404).json({ message: 'No active round to end' });
    }

    // Update round status
    currentRound.status = 'completed';
    currentRound.endTime = Date.now();
    currentRound.priceChanges = req.body.priceChanges || currentRound.priceChanges;

    // Update all teams' portfolios with the price changes
    // This would be implemented based on your teams data structure
    // teams.forEach(team => updateTeamPortfolio(team.id, currentRound.priceChanges));

    // Update rounds array
    rounds = rounds.map(r => r.roundNumber === currentRound.roundNumber ? currentRound : r);
    
    res.json(currentRound);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add news to current round
router.post('/news', (req, res) => {
  try {
    if (!currentRound) {
      return res.status(400).json({ message: 'No active round' });
    }

    const newsItem = {
      id: Date.now().toString(),
      title: req.body.title,
      content: req.body.content,
      timestamp: new Date()
    };

    currentRound.news.push(newsItem);
    
    // Emit news event to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('news', newsItem);
    }

    res.status(201).json(newsItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update prices for current round
router.post('/prices', (req, res) => {
  try {
    if (!currentRound) {
      return res.status(400).json({ message: 'No active round' });
    }

    currentRound.priceChanges = {
      ...currentRound.priceChanges,
      ...req.body.priceChanges
    };

    // Emit price update to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('prices', currentRound.priceChanges);
    }

    res.json(currentRound.priceChanges);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Helper function to get current round data
function getCurrentRound() {
  return currentRound;
}

module.exports = router;
module.exports.getCurrentRound = getCurrentRound;
