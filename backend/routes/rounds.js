const express = require('express');
const router = express.Router();
const Round = require('../models/Round');

// Get current round
router.get('/current', async (req, res) => {
  try {
    const current = await Round.findOne({ status: 'active' }).lean();
    if (!current) return res.status(404).json({ message: 'No active round found' });
    res.json(current);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start a new round
router.post('/', async (req, res) => {
  try {
    // End any currently active round
    await Round.updateMany({ status: 'active' }, { $set: { status: 'completed', endTime: new Date() } });

    const latest = await Round.findOne().sort({ roundNumber: -1 }).lean();
    const roundNumber = latest ? latest.roundNumber + 1 : 1;
    const duration = Number(req.body.duration) || 300;

    const newRound = await Round.create({
      roundNumber,
      status: 'active',
      startTime: new Date(),
      duration,
      priceChanges: { gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0 },
      news: []
    });

    res.status(201).json(newRound);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// End current round
router.post('/end', async (req, res) => {
  try {
    const current = await Round.findOne({ status: 'active' });
    if (!current) return res.status(404).json({ message: 'No active round to end' });
    if (req.body.priceChanges) {
      current.priceChanges = { ...current.priceChanges.toObject?.() || current.priceChanges, ...req.body.priceChanges };
    }
    current.status = 'completed';
    current.endTime = new Date();
    await current.save();
    res.json(current);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add news to current round
router.post('/news', async (req, res) => {
  try {
    const current = await Round.findOne({ status: 'active' });
    if (!current) return res.status(400).json({ message: 'No active round' });
    const newsItem = { title: req.body.title, content: req.body.content, publishedAt: new Date() };
    current.news.push(newsItem);
    await current.save();
    const io = req.app.get('io');
    if (io) io.emit('news', { ...newsItem, roundNumber: current.roundNumber });
    res.status(201).json(newsItem);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update prices for current round
router.post('/prices', async (req, res) => {
  try {
    const current = await Round.findOne({ status: 'active' });
    if (!current) return res.status(400).json({ message: 'No active round' });
    current.priceChanges = { ...current.priceChanges.toObject?.() || current.priceChanges, ...req.body.priceChanges };
    await current.save();
    const io = req.app.get('io');
    if (io) io.emit('prices', current.priceChanges);
    res.json(current.priceChanges);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Helper function to get current round data
async function getCurrentRound() {
  return await Round.findOne({ status: 'active' }).lean();
}

module.exports = router;
module.exports.getCurrentRound = getCurrentRound;
