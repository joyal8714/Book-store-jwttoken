const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Book = require('../models/Book');
const cookieParser = require('cookie-parser');
const User=require('../models/User');
let refreshTokens = [];
const Otp = require('../models/Otp');
const bcrypt = require('bcrypt');
const Order = require('../models/Order');
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
console.log(" REGISTER FORM DATA:", req.body);

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.send('User already exists');

    const otp = Math.floor(100000 + Math.random() * 900000);
console.log("From FORM →", { username, password, email, role });
    // Remove old OTP if exists
    await Otp.deleteOne({ email });

    try {
      const newOtp = await Otp.create({
        email,
        otp,
        username,
        password,
        role
      });
      console.log(" Password sent to OTP DB:", password);

const allOtps = await Otp.find({});
console.log("All OTPs in DB:", allOtps);

      console.log("OTP saved to DB:", newOtp);

      
      const count = await Otp.countDocuments({});
      console.log("Current OTP count in DB:", count);

    } catch (err) {
      console.log("Error saving OTP to DB:", err);
    }

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

  const existingUser = await User.findOne({
  $or: [{ username: record.username }, { email: email.trim().toLowerCase() }]
});

if (existingUser) {
  return res.send('User with this username or email already exists');
}

const rawPassword = record.password.toString();
const hashedPassword = await bcrypt.hash(rawPassword, 10);
    // Create the new user
    const newUser = new User({
      username: record.username,
      password: hashedPassword,
       role: record.role,
      email: email.trim().toLowerCase(),
       isVerified:true
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
  const { password, email } = req.body;
  console.log("Login form data:", req.body);

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
if (!user.isVerified) {
  return res.send("Please verify your account via OTP before logging in");
}

    if (!user) {
      console.log("No user found with email:", email);
      return res.send("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {

      return res.send("Invalid credentials");
    }

    const accessToken = jwt.sign(
      { _id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { _id: user._id, username: user.username, role: user.role },
      process.env.JWT_REFRESH_SECRET
    );

    res.cookie('accessToken', accessToken, { httpOnly: true });
    res.cookie('refreshToken', refreshToken, { httpOnly: true });

    console.log(` ${user.username} logged in successfully`);

    if (user.role === 'admin') {
      return res.redirect('/admin/add-book');
    } else {
      return res.redirect('/books');
    }

  } catch (err) {
    console.error(" Login error:", err.message);
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


router.get('/success', authenticateToken, authorizeRoles('user'), async (req, res) => {
  const { token } = req.query;
  const userId = req.user._id;

  try {
    // 1. Capture PayPal payment
    const request = new paypal.orders.OrdersCaptureRequest(token);
    request.requestBody({});
    const capture = await client().execute(request);

    // 2. Get user's cart before clearing
    const cart = await Cart.findOne({ userId }).populate('items.bookId');

    if (!cart || cart.items.length === 0) {
      return res.send("Cart is empty or not found.");
    }

    // 3. Calculate total amount
    const totalAmount = cart.items.reduce((sum, item) => {
      return sum + item.bookId.price * item.quantity;
    }, 0);

    // 4. Save order to DB
    const newOrder=await Order.create({
      userId,
      items: cart.items,
      amount: totalAmount,
      status: 'completed'
    });
    console.log("order saved successfully",newOrder)

    // 5. Clear the cart
    await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } }
    );

    // 6. Show success message
    res.send(`
      <h1 style="text-align: center; color: green;">✅ Payment successful!</h1>
      <p style="text-align: center;">Thank you for your purchase, ${req.user.username}!</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="/books" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Continue Shopping</a>
      </div>
    `);
  } catch (err) {
    console.error("❌ Payment Capture Error:", err.message);
    res.send(`
      <h1 style="text-align: center; color: red;">❌ Payment failed!</h1>
      <p style="text-align: center;">There was an issue capturing your payment.</p>
      <div style="text-align: center; margin-top: 30px;">
        <a href="/cart" style="background-color: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Back to Cart</a>
      </div>
    `);
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






router.post('/buy-all', authenticateToken, authorizeRoles('user'), async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ userId }).populate('items.bookId');
    if (!cart || cart.items.length === 0) {
      return res.send("🛒 Your cart is empty.");
    }

    // Calculate total
    const total = cart.items.reduce((sum, item) => {
      return sum + item.bookId.price * item.quantity;
    }, 0);

    //  Create PayPal order
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

    const order = await client().execute(request);
    const approvalUrl = order.result.links.find(link => link.rel === 'approve').href;

    console.log(" PayPal order created for BUY ALL:", order.result.id);

    res.redirect(approvalUrl);

  } catch (err) {
    console.error("BUY ALL ERROR:", err.message);
    res.status(500).send(" Something went wrong during BUY ALL");
  }
});





router.get('/orders', authenticateToken, authorizeRoles('user'), async (req, res) => {
  try {
  const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('items.bookId') 
      .lean(); 
          res.render('user/orders', { orders, user: req.user });
    console.log('fetched oders',orders)
  } catch (err) {
    console.log("Error while fetching the orders:", err);
    res.status(500).send("Something went wrong");
  }
});



module.exports = router;
