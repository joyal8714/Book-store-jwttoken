const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book'
    },
    quantity: Number
  }],
  amount: Number,
  status: {
    type: String,
    default: 'pending'
  }
}, { timestamps: true });  //  This adds createdAt and updatedAt automatically

module.exports = mongoose.model('Order', orderSchema);
