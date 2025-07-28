const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const multer = require("multer");
const path = require("path");
const User = require('../models/User'); 
const order=require('../models/Order')
const fs = require("fs");
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true }); 
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = Date.now() + "-" + sanitizedName;
    cb(null, uniqueName);
  },
});   

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get("/add-book", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const booksData = await Book.find().sort({ createdAt: -1 });
    const books = booksData.map((book) => book.toObject()); // Convert to plain objects
  
    // return res.status(200).json({books})
    res.render("admin/add-book", {
      books,
      success: req.query.success,
      error: req.query.error,
    });
  } catch (err) {
    console.error("Error fetching books:", err);
    res.render("admin/add-book", {
      books: [],
      error: "Failed to load books",
    });
  }
});

//  POST Route: Add Book with Image Upload
router.post("/add-book", authenticateToken, authorizeRoles("admin"), upload.single("cover"), async (req, res) => {
  try {
    // Validate required fields
    const { title, author, price } = req.body;

    if (!title || !author || !price) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.redirect("/admin/add-book?error=All fields are required");
    }

    if (!req.file) {
      return res.redirect("/admin/add-book?error=Image file is required");
    }

    // Validate price is a positive number
    const bookPrice = parseFloat(price);
    if (isNaN(bookPrice) || bookPrice <= 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.redirect(
        "/admin/add-book?error=Price must be a valid positive number"
      );
    }

    const newBook = new Book({
      title: title.trim(),
      author: author.trim(),
      price: bookPrice,
      cover: req.file.filename,
    });

    await newBook.save();
    console.log("Book added successfully:", newBook.title);
    res.redirect("/admin/add-book?success=Book added successfully");
  } catch (err) {
    console.error("Error adding book:", err);

    // Clean up uploaded file if database save fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Handle specific validation errors
    if (err.name === "ValidationError") {
      const errorMessage = Object.values(err.errors)[0].message;
      return res.redirect(
        `/admin/add-book?error=${encodeURIComponent(errorMessage)}`
      );
    }

    res.redirect("/admin/add-book?error=Failed to add book");
  }
});

router.get("/edit-book/:id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const bookDoc = await Book.findById(req.params.id);
    const book = bookDoc.toObject(); //  convert to plain object
    res.render("admin/edit-book", { book });
  } catch (err) {
    res.status(500).send("Failed to load edit page");
  }
});

router.post(
  "/edit-book/:id",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res, next) => {
    upload.single("cover")(req, res, function (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).send("File too large. Max size allowed is 5MB.");
      } else if (err) {
        return res.status(400).send("Upload failed: " + err.message);
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const updateData = {
        title: req.body.title,
        author: req.body.author,
        price: req.body.price,
      };

      if (req.file) {
        updateData.cover = req.file.filename;
      }

      await Book.findByIdAndUpdate(req.params.id, updateData);
      res.redirect("/admin/add-book");
    } catch (err) {
      console.error("Error updating book:", err);
      res.status(500).send("Failed to update book");
    }
  }
);

// DELETE BOOK ROUTE
router.post("/delete-book/:id", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const bookId = req.params.id;
        const redirectPath = req.body.returnTo || '/admin/add-book';

    const result = await Book.findByIdAndDelete(bookId);
    // if (result) {
    //   return res.status(200).json({
    //     success: true,
    //     message: "deleted succesfuly",
    //     deletedBookId: bookId,
    //   });
    // }
    //return res.status(400).json({error:"data not available"})
 res.redirect(redirectPath);
  } catch (err) {
    console.error("Error deleting book:", err);
    return res.status(500).json({
      success: false,
      message: "not deted that produt",
      error: err.message,
    });
  }
});




//usersssss

router.get("/users", authenticateToken, authorizeRoles("admin"), async (req, res) => {
  try {
    const searchQuery = req.query.search || ''; // Get search query from URL

    const usersFromDb = await User.find({
      username: { $regex: searchQuery, $options: 'i' } // Case-insensitive search
    });

    const users = usersFromDb.map(user => user.toObject());

    res.render('admin/users', { users, searchQuery }); // Pass searchQuery to keep input value
  } catch (err) {
    console.log("Error while fetching users:", err);
    res.status(500).send("Error while fetching users");
  }
});



//blockkk




router.post('/toggle-block/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.send('User not found');

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.redirect('/admin/users');
  } catch (err) {
    console.error('Block/Unblock Error:', err);
    res.send('Error blocking/unblocking user');
  }
});




//orders

router.get('/orders',authenticateToken,authorizeRoles("admin"),async(req,res)=>{

  try{
  const orders=await order.find()
      .sort({ createdAt: -1 })
    .populate('items.bookId')
    .populate('userId')
    .lean()
res.render('admin/orders',{orders})
console.log("oders fetched succes",orders)
}catch(err){
console.error("error while fetching the oders",err)
res.status(500).send("ERROR WHILE FETCHING ODER")
}

})


module.exports = router;
