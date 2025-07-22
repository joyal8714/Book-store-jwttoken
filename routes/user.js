const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Book = require('../models/Book');
const cookieParser = require('cookie-parser');
const User=require('../models/User');
let refreshTokens = [];
const Otp = require('../models/Otp');

// View Routes
router.get('/register', (req, res) => res.render('user/register'));

router.get('/login',(req,res)=>{
  const accessToken = req.cookies.accessToken

try{
  const decoded=jwt.verify(accessToken,process.env.JWT_SECRET)
  if(decoded.role==='admin'){
    return res.redirect('/admin/add-book')
  }
else{
  return res.redirect('/books')
}
}catch(err){
  console.log("login error",err)
}

  res.set('Cache-Control', 'no-store'); 
  res.render('user/login');
})

const sendOTP = require('../utils/mailer');

router.post('/register', async (req, res) => {
  const { username, password, role, email } = req.body;
  
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.send('User already exists');

  
const otp = Math.floor(100000 + Math.random() * 900000);

// Remove old OTP if exists
await Otp.deleteOne({ email });

await Otp.create({
  email,
  otp,
  username,
  password,
  role
});


    await sendOTP(email, otp);
    res.render('user/verify-email', { email }); 
  } catch (err) {
    console.error("Registration error", err);
    res.send('Registration failed');
  }
});



router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  try {
    const record = await Otp.findOne({ email: email.trim() });

    console.log("Stored record:", record);
    console.log("Submitted OTP:", otp);

    if (!record || record.otp.toString() !== otp.trim()) {
      return res.send('Invalid or expired OTP');
    }

   
   const existingUser = await User.findOne({ username: record.username });


    if (existingUser) {
      return res.send('User with this username or email already exists');
    }

    // Create the new user
    const newUser = new User({
      username: record.username,
      password: record.password,
      role: record.role,
      email: email.trim()
    });

    await newUser.save();

    
    await Otp.deleteOne({ email: email.trim() });

    res.redirect('/login');
  } catch (err) {
    console.error("OTP Verification Error:", err);
    res.status(500).send("Something went wrong during OTP verification");
  }
});





router.post('/login', async (req, res) => {
  const { username, password,email } = req.body;

  try {
    const user = await User.findOne({ email });
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







const { client } = require('../utils/paypal');

router.post('/buy', authenticateToken, authorizeRoles('user'), async (req, res) => {
  const userId = req.user._id;
  const cart = await Cart.findOne({ userId }).populate('items.bookId');

  const total = cart.items.reduce((sum, item) => {
    return sum + item.bookId.price * item.quantity;
  }, 0);

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [{
      amount: {
        currency_code: "USD",
        value: total.toFixed(2)
      }
    }],
    application_context: {
      return_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel"
    }
  });

  try {
    const order = await client().execute(request);
    res.redirect(order.result.links.find(link => link.rel === 'approve').href);
  } catch (err) {
    console.error("PayPal Order Error", err);
    res.status(500).send("Payment error");
  }
});






const paypal = require('@paypal/checkout-server-sdk');

router.get('/success', async (req, res) => {
  const { token } = req.query;

  const request = new paypal.orders.OrdersCaptureRequest(token);
  request.requestBody({});

  try {
    const capture = await client().execute(request);
    console.log(" Payment Success:", capture.result);

    // Clear cart or show success message
    res.send("Payment successful. Thank you for your purchase!");
  } catch (err) {
    console.error("Capture Error", err);
    res.status(500).send("Failed to capture order");
  }
});

router.get('/cancel', (req, res) => {
  res.send("Payment cancelled");
});








router.get('/books', authenticateToken, async (req, res) => {
  const booksData = await Book.find().sort({ createdAt: -1 });
  const books = booksData.map(book => book.toObject());
    console.log("REQ.USER in /books route:", req.user);  // Debug here

  res.render('user/books', { books, user: req.user }); });

router.get('/', (req, res) => res.redirect('/login'));


module.exports = router;
