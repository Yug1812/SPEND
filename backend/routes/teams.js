const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Team = require('../models/Team');

// Utility to remove sensitive fields
function sanitize(teamDoc) {
  if (!teamDoc) return null
  const obj = teamDoc.toObject ? teamDoc.toObject() : teamDoc
  const { passwordHash, __v, ...rest } = obj
  return rest
}

// GET /api/teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find({}, '-passwordHash -__v').lean()
    res.json(teams)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// POST /api/teams/register
router.post('/register', async (req, res) => {
  try {
    const { name, members, password } = req.body || {}
    if (!name || !password) return res.status(400).json({ message: 'Name and password are required' })

    // Check if team name already exists (case insensitive)
    const exists = await Team.findOne({ name: new RegExp(`^${name}$`, 'i') })
    if (exists) return res.status(400).json({ message: 'Team name already exists' })

    // Process members - filter out empty strings
    const processedMembers = Array.isArray(members) 
      ? members.map(m => String(m).trim()).filter(m => m.length > 0)
      : []

    const passwordHash = await bcrypt.hash(password, 10)
    const team = await Team.create({ 
      name, 
      members: processedMembers, 
      passwordHash 
    })
    res.status(201).json(sanitize(team))
  } catch (err) {
    console.error('Registration error:', err)
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Invalid data provided' })
    }
    res.status(500).json({ message: err.message })
  }
})

// POST /api/teams/login
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body || {}
    if (!name || !password) return res.status(400).json({ message: 'Name and password are required' })

    const team = await Team.findOne({ name: new RegExp(`^${name}$`, 'i') })
    if (!team) return res.status(400).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, team.passwordHash)
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' })

    res.json(sanitize(team))
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: err.message })
  }
})

// POST /api/teams/:id/invest
router.post('/:id/invest', async (req, res) => {
  try {
    const { id } = req.params;
    const { investments } = req.body || {};
    
    if (!investments || typeof investments !== 'object') {
      return res.status(400).json({ message: 'Investments data is required' });
    }
    
    // Find the team
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Validate investments
    const validAssets = ['gold', 'crypto', 'stocks', 'realEstate', 'fd'];
    let totalInvestment = 0;
    
    for (const [asset, amount] of Object.entries(investments)) {
      if (!validAssets.includes(asset)) {
        return res.status(400).json({ message: `Invalid asset type: ${asset}` });
      }
      
      const investmentAmount = Number(amount);
      if (isNaN(investmentAmount) || investmentAmount <= 0) {
        return res.status(400).json({ message: `Invalid investment amount for ${asset}` });
      }
      
      totalInvestment += investmentAmount;
    }
    
    // Check if team has enough cash
    if (totalInvestment > (team.portfolio.cash || 0)) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }
    
    // Update portfolio
    for (const [asset, amount] of Object.entries(investments)) {
      team.portfolio[asset] = (team.portfolio[asset] || 0) + Number(amount);
    }
    
    // Deduct from cash
    team.portfolio.cash = (team.portfolio.cash || 0) - totalInvestment;
    
    // Save investment record
    team.investments.push({
      round: 1, // This should be dynamic based on current round
      investments: { ...investments },
      timestamp: new Date()
    });
    
    // Save team
    await team.save();
    
    res.json(sanitize(team));
  } catch (err) {
    console.error('Investment error:', err);
    res.status(500).json({ message: err.message });
  }
})

// POST /api/teams/:id/transfer
router.post('/:id/transfer', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, amount } = req.body || {};
    
    if (!from || !to || !amount) {
      return res.status(400).json({ message: 'From, to, and amount are required' });
    }
    
    // Restrict transfers to cash only
    if (to !== 'cash') {
      return res.status(400).json({ message: 'Transfers are only allowed to cash' });
    }
    
    if (from === to) {
      return res.status(400).json({ message: 'Cannot transfer to the same asset' });
    }
    
    // Find the team
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Validate assets
    const validAssets = ['cash', 'gold', 'crypto', 'stocks', 'realEstate', 'fd'];
    if (!validAssets.includes(from) || !validAssets.includes(to)) {
      return res.status(400).json({ message: 'Invalid asset type' });
    }
    
    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ message: 'Invalid transfer amount' });
    }
    
    // Check if team has enough in the source asset
    const sourceAmount = team.portfolio[from] || 0;
    if (transferAmount > sourceAmount) {
      return res.status(400).json({ message: `Insufficient ${from} balance` });
    }
    
    // Update portfolio
    team.portfolio[from] = sourceAmount - transferAmount;
    team.portfolio[to] = (team.portfolio[to] || 0) + transferAmount;
    
    // Save team
    await team.save();
    
    res.json(sanitize(team));
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ message: err.message });
  }
})

// POST /api/teams/:id/award-auction-item
router.post('/:id/award-auction-item', async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, auctionItems } = req.body || {};
    
    if (!itemId) {
      return res.status(400).json({ message: 'Item ID is required' });
    }
    
    // Find the team
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Find the auction item
    const item = auctionItems.find(item => item.id === itemId);
    if (!item) {
      return res.status(400).json({ message: 'Invalid auction item' });
    }
    
    // Check if team has enough cash
    if (team.portfolio.cash < item.price) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }
    
    // Deduct price from cash
    team.portfolio.cash = team.portfolio.cash - item.price;
    
    // Add item to auctionItems array
    if (!team.portfolio.auctionItems) {
      team.portfolio.auctionItems = [];
    }
    team.portfolio.auctionItems.push(item);
    
    // Save team
    await team.save();
    
    res.json(sanitize(team));
  } catch (err) {
    console.error('Award auction item error:', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/teams/:id/deduct-cash
router.post('/:id/deduct-cash', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body || {};
    
    if (amount === undefined || amount === null) {
      return res.status(400).json({ message: 'Amount is required' });
    }
    
    const deductionAmount = Number(amount);
    if (isNaN(deductionAmount) || deductionAmount <= 0) {
      return res.status(400).json({ message: 'Invalid deduction amount' });
    }
    
    // Find the team
    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    // Check if team has enough cash
    if (team.portfolio.cash < deductionAmount) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }
    
    // Deduct amount from cash
    team.portfolio.cash = team.portfolio.cash - deductionAmount;
    
    // Save team
    await team.save();
    
    res.json(sanitize(team));
  } catch (err) {
    console.error('Deduct cash error:', err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/teams/:id
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id, '-passwordHash -__v')
    if (!team) return res.status(404).json({ message: 'Team not found' })
    res.json(team)
  } catch (err) {
    console.error('Get team error:', err)
    res.status(400).json({ message: 'Invalid team id' })
  }
})

module.exports = router;