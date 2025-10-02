const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: false
  },
  members: [{
    type: String,
    trim: true
  }],
  portfolio: {
    gold: { type: Number, default: 0 },
    crypto: { type: Number, default: 0 },
    stocks: { type: Number, default: 0 },
    realEstate: { type: Number, default: 0 },
    fd: { type: Number, default: 0 },
    cash: { type: Number, default: 500000 }
  },
  totalValue: { type: Number, default: 500000 },
  investments: [{
    round: { type: Number, required: true },
    investments: {
      gold: { type: Number, default: 0 },
      crypto: { type: Number, default: 0 },
      stocks: { type: Number, default: 0 },
      realEstate: { type: Number, default: 0 },
      fd: { type: Number, default: 0 }
    },
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

teamSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Team', teamSchema);
