const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory storage for teams
const teams = [];

// Get all teams
router.get('/', (req, res) => {
  try {
    res.json(teams);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new team
router.post('/', (req, res) => {
  try {
    const team = {
      id: uuidv4(),
      name: req.body.name,
      members: req.body.members || [],
      portfolio: {
        gold: 0,
        crypto: 0,
        stocks: 0,
        realEstate: 0,
        fd: 0,
        cash: 500000 // Starting cash
      },
      totalValue: 500000,
      investments: []
    };

    teams.push(team);
    res.status(201).json(team);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get a specific team
router.get('/:id', (req, res) => {
  const team = teams.find(t => t.id === req.params.id);
  if (!team) {
    return res.status(404).json({ message: 'Team not found' });
  }
  res.json(team);
});

// Helper function to find team by ID
function getTeam(teamId) {
  return teams.find(t => t.id === teamId);
}

// Update team's portfolio
function updateTeamPortfolio(teamId, investments, priceChanges) {
  const team = getTeam(teamId);
  if (!team) return null;

  // Update investments for current round
  const round = currentRound || 1;
  team.investments.push({
    round,
    investments: { ...investments },
    timestamp: new Date()
  });

  // Calculate new portfolio values based on price changes
  if (priceChanges) {
    Object.keys(priceChanges).forEach(asset => {
      if (team.portfolio.hasOwnProperty(asset)) {
        team.portfolio[asset] *= (1 + priceChanges[asset]);
      }
    });
  }

  // Recalculate total portfolio value
  team.totalValue = Object.values(team.portfolio).reduce((sum, val) => sum + val, 0);
  
  return team;
}

module.exports = router;
module.exports.getTeam = getTeam;
module.exports.updateTeamPortfolio = updateTeamPortfolio;
