const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Round = require('../models/Round');

// Get all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().lean();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new team
router.post('/', async (req, res) => {
  try {
    const { name, members = [], passwordHash } = req.body;
    const existing = await Team.findOne({ name });
    if (existing) {
      return res.status(409).json({ message: 'Team name already exists' });
    }
    const team = await Team.create({
      name,
      passwordHash,
      members,
      portfolio: {
        gold: 0, crypto: 0, stocks: 0, realEstate: 0, fd: 0, cash: 500000
      },
      totalValue: 500000,
      investments: []
    });
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get a specific team
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch (err) {
    res.status(404).json({ message: 'Team not found' });
  }
});

// Helper function to find team by ID
async function getTeam(teamId) {
  try {
    return await Team.findById(teamId);
  } catch {
    return null;
  }
}

// Update team's portfolio
async function updateTeamPortfolio(teamId, investments, priceChanges) {
  const team = await getTeam(teamId);
  if (!team) return null;

  const round = 1;
  team.investments.push({ round, investments: { ...investments }, timestamp: new Date() });

  if (priceChanges) {
    Object.keys(priceChanges).forEach(asset => {
      if (team.portfolio[asset] != null) {
        team.portfolio[asset] *= (1 + priceChanges[asset]);
      }
    });
  }

  team.totalValue = Object.values(team.portfolio).reduce((sum, val) => sum + val, 0);
  await team.save();
  return team;
}

module.exports = router;
module.exports.getTeam = getTeam;
module.exports.updateTeamPortfolio = updateTeamPortfolio;

// Persist investments for a team
router.post('/:id/invest', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const current = await Round.findOne({ status: 'active' }).lean();
    const roundNum = current?.roundNumber || 1;

    const investments = req.body?.investments || {};
    let totalInvested = 0;
    const newPortfolio = { ...team.portfolio };

    Object.keys(investments).forEach(key => {
      const amt = Number(investments[key]) || 0;
      if (amt > 0 && newPortfolio[key] != null) {
        newPortfolio[key] = (Number(newPortfolio[key]) || 0) + amt;
        totalInvested += amt;
      }
    });

    newPortfolio.cash = Math.max(0, Number(newPortfolio.cash || 0) - totalInvested);

    // Recompute total value with current price changes
    const priceChanges = current?.priceChanges || {};
    let totalValue = newPortfolio.cash;
    Object.keys(newPortfolio).forEach(asset => {
      if (asset !== 'cash' && Number(newPortfolio[asset]) > 0) {
        const change = Number(priceChanges[asset] || 0);
        totalValue += Number(newPortfolio[asset]) * (1 + change / 100);
      }
    });

    team.portfolio = newPortfolio;
    team.totalValue = totalValue;
    team.investments.push({ round: roundNum, investments, timestamp: new Date() });
    await team.save();

    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Transfer funds between buckets or to/from cash
router.post('/:id/transfer', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const { from, to, amount } = req.body || {};
    const src = String(from);
    const dst = String(to);
    const amt = Number(amount);
    const valid = ['cash','gold','crypto','stocks','realEstate','fd'];
    if (!valid.includes(src) || !valid.includes(dst) || src === dst) {
      return res.status(400).json({ message: 'Invalid transfer' });
    }
    if (!(amt > 0)) return res.status(400).json({ message: 'Amount must be positive' });

    const portfolio = { ...team.portfolio };
    const available = Number(portfolio[src] || 0);
    if (available < amt) return res.status(400).json({ message: 'Insufficient funds' });

    portfolio[src] = available - amt;
    portfolio[dst] = Number(portfolio[dst] || 0) + amt;

    // Recompute total value with current price changes
    const current = await Round.findOne({ status: 'active' }).lean();
    const priceChanges = current?.priceChanges || {};
    let totalValue = portfolio.cash;
    Object.keys(portfolio).forEach(asset => {
      if (asset !== 'cash' && Number(portfolio[asset]) > 0) {
        const change = Number(priceChanges[asset] || 0);
        totalValue += Number(portfolio[asset]) * (1 + change / 100);
      }
    });

    team.portfolio = portfolio;
    team.totalValue = totalValue;
    await team.save();

    res.json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
