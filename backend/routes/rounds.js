const express = require('express');
const router = express.Router();
const Round = require('../models/Round');
const Team = require('../models/Team');

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

    // Apply price changes to all teams' total values (do not mutate quantities)
    const priceChanges = current.priceChanges || {};
    const teams = await Team.find();
    await Promise.all(teams.map(async (team) => {
      const portfolio = team.portfolio || {};
      let totalValue = Number(portfolio.cash || 0);
      Object.keys(portfolio).forEach((asset) => {
        if (asset !== 'cash' && Number(portfolio[asset]) > 0) {
          const change = Number(priceChanges[asset] || 0);
          totalValue += Number(portfolio[asset]) * (1 + change / 100);
        }
      });
      team.totalValue = totalValue;
      await team.save();
    }));

    // Emit leaderboard update
    const leaderboard = (await Team.find({}, '-passwordHash -__v').lean())
      .sort((a, b) => (b.totalValue || 0) - (a.totalValue || 0))
      .map((t, idx) => ({ rank: idx + 1, teamName: t.name, portfolioValue: t.totalValue || 0 }));
    const io = req.app.get('io');
    if (io) io.emit('leaderboard:update', leaderboard);

    res.json({ round: current, leaderboard });
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
