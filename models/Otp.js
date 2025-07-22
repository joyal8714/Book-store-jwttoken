const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true},
  otp: { type: Number, required: true },
  username: String,
  password: String,
  role: String,
  createdAt: { type: Date, default: Date.now, expires: 300 } // expires in 5 mins
});

module.exports = mongoose.model('Otp', otpSchema);
