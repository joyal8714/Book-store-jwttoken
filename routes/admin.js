const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const multer = require("multer");
const path = require("path");

const fs = require("fs");
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true }); // Added recursive option
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
router.post("/add-book", upload.single("cover"), async (req, res) => {
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

router.get("/edit-book/:id", async (req, res) => {
  try {
    const bookDoc = await Book.findById(req.params.id);
    const book = bookDoc.toObject(); //  convert to plain object
    res.render("admin/edit-book", { book });
  } catch (err) {
    res.status(500).send("Failed to load edit page");
  }
});

router.post("/edit-book/:id", upload.single("cover"), async (req, res) => {
  try {
    const updateData = {
      title: req.body.title,
      author: req.body.author,
      price: req.body.price,
    };

    // Only update image if a new one is uploaded
    if (req.file) {
      updateData.cover = req.file.filename;
    }

    await Book.findByIdAndUpdate(req.params.id, updateData);
    res.redirect("/admin/add-book");
  } catch (err) {
    console.error("Error updating book:", err);
    res.status(500).send("Failed to update book");
  }
});

// DELETE BOOK ROUTE
router.post("/delete-book/:id", async (req, res) => {
  try {
    const bookId = req.params.id;
    const result = await Book.findByIdAndDelete(bookId);
    // if (result) {
    //   return res.status(200).json({
    //     success: true,
    //     message: "deleted succesfuly",
    //     deletedBookId: bookId,
    //   });
    // }
    //return res.status(400).json({error:"data not available"})
    res.redirect('/admin/add-book'); // or your correct redirect path
  } catch (err) {
    console.error("Error deleting book:", err);
    return res.status(500).json({
      success: false,
      message: "not deted that produt",
      error: err.message,
    });
  }
});

module.exports = router;
