const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Book = require('../models/Book');
const cookieParser = require('cookie-parser');
const User=require('../models/User');
let refreshTokens = [];

// View Routes
router.get('/login', (req, res) => res.render('user/login'));
router.get('/register', (req, res) => res.render('user/register'));




router.post('/register',async(req,res)=>{
const{username,password,role}=req.body

try{
const existingUser=await User.findOne({username}) 
if (existingUser) return res.send('user already exist')

  const newUser=new User({username,password,role})
  await newUser.save()
res.redirect('/login')
}catch (err){
  console.error("reg error",err)
res.send('registration failed')
}

})


router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.send("Invalid credentials");
    }

   const accessToken = jwt.sign(
  { _id: user._id, username, role: user.role }, 
  process.env.JWT_SECRET, 
  { expiresIn: '15m' }
);
const refreshToken = jwt.sign(
  { _id: user._id, username, role: user.role }, 
  process.env.JWT_REFRESH_SECRET
);

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });

  
    if (user.role === 'admin') {
      res.redirect('/admin/add-book');
    } else {
      res.redirect('/books');
    }
    // res.send({"Login successful": true, "role": user.role, "username": user.username});

  } catch (err) {
    console.error("Login error:", err);
    res.send("Login failed");
  }
});


router.get('/logout', (req, res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.redirect('/login');
});




const Cart = require('../models/Cart');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/add-to-cart/:bookId', authenticateToken, authorizeRoles('user'), async (req, res) => {
  const userId = req.user._id;
  const bookId = req.params.bookId;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if book already in cart
    const existingItem = cart.items.find(item => item.bookId.equals(bookId));

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.items.push({ bookId });
    }

    await cart.save();
    res.redirect('/books'); // or to /cart if you prefer

  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).send('Failed to add to cart');
  }
});



router.get('/cart', authenticateToken, authorizeRoles('user'), async (req, res) => {
  const userId = req.user._id;

  try {
    const cart = await Cart.findOne({ userId }).populate('items.bookId');
    console.log("🛒 Cart Data:", JSON.stringify(cart, null, 2)); // Log entire cart

    const items = cart?.items || [];

   const plainCart = cart?.toObject() || {};

res.render('user/cart', {
  cart: plainCart,
  hasItems: plainCart.items && plainCart.items.length > 0
});

  } catch (err) {
    console.error('Cart fetch error:', err);
    res.status(500).send('Error loading cart');
  }
});






router.get('/books', authenticateToken, async (req, res) => {
  const booksData = await Book.find().sort({ createdAt: -1 });
  const books = booksData.map(book => book.toObject());
    console.log("✅ REQ.USER in /books route:", req.user);  // Debug here

  res.render('user/books', { books, user: req.user }); });

router.get('/', (req, res) => res.redirect('/login'));

module.exports = router;
