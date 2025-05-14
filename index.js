const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

// Import models
const Property = require("./models/Property");
const User = require("./models/User");
const Booking = require("./models/Booking");
//const bookingRoutes = require("./routes/bookingRoutes");

// Import middleware and config
const { authenticateToken } = require("./middleware/authMiddleware");
const { jwtSecret } = require("./config/jwt");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = "mongodb://127.0.0.1:27017/rental";

// Multer setup for image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware
app.use(express.json());
app.use(cors());
const ObjectId = require("mongoose").Types.ObjectId;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));
//app.use("/api", bookingRoutes);

// -------------------------------------
// Website (Users) Routes
// -------------------------------------

// Registration
app.post("/Register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, 10),
    });
    res.json(userDoc);
  } catch (err) {
    res.status(400).json(err);
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "User not found" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid password" });
    }
    const token = jwt.sign({ email: user.email, id: user._id }, jwtSecret, {
      expiresIn: "24h",
    });
    res.status(200).json({
      status: "success",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error", message: "Server error occurred" });
  }
});

// Get profile with user properties
app.get("/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const properties = await Property.find({ email: user.email });
    res.json({
      user: { id: user._id, name: user.name, email: user.email },
      properties,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching profile" });
  }
});

// Update the NewProperty route in index.js to handle amenities

app.post("/NewProperty", upload.array("images", 5), async (req, res) => {
  const {
    name,
    type,
    price,
    location,
    discount,
    description,
    email,
    amenities,
  } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "At least one image is required." });
  }

  if (req.files.length > 5) {
    return res.status(400).json({ error: "Maximum 5 images allowed." });
  }

  try {
    // Parse amenities from JSON string if provided
    let parsedAmenities = [];
    if (amenities) {
      try {
        parsedAmenities = JSON.parse(amenities);
      } catch (err) {
        console.error("Error parsing amenities:", err);
        return res.status(400).json({ error: "Invalid amenities format" });
      }
    }

    const newProperty = new Property({
      name,
      type,
      price,
      location,
      discount,
      description,
      email,
      amenities: parsedAmenities,
      images: req.files.map((file) => ({
        data: file.buffer,
        contentType: file.mimetype,
      })),
    });

    await newProperty.save();
    res.status(201).json(newProperty);
  } catch (err) {
    console.error("Error saving property:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve property images
app.get("/images/:id/:index", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    const imageIndex = parseInt(req.params.index) || 0;
    if (!property || !property.images || !property.images[imageIndex]) {
      return res.status(404).json({ error: "Image not found" });
    }
    const image = property.images[imageIndex];
    const contentType = image.contentType;
    if (!contentType || !/^image\/(png|jpeg|jpg|webp)$/.test(contentType)) {
      throw new Error("Invalid media type");
    }
    res.set("Content-Type", contentType);
    res.send(image.data);
  } catch (err) {
    console.error("Error fetching image:", err.message);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

// Search properties by location and type
app.get("/property", async (req, res) => {
  const { location, type } = req.query;
  try {
    let filter = {};
    if (location && location.trim() !== "") {
      filter.location = { $regex: location.trim(), $options: "i" };
    }
    if (type && type.trim() !== "") {
      filter.type = { $regex: `^${type.trim()}$`, $options: "i" };
    }
    const properties = await Property.find(filter);
    res.status(200).json(properties);
  } catch (err) {
    console.error("Error fetching properties:", err.message);
    res.status(500).json({ error: "Failed to fetch properties" });
  }
});

// Rate a property
app.post("/property/:id/rate", async (req, res) => {
  const { id } = req.params;
  const { rating } = req.body;
  try {
    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    property.reviews.push({
      rating,
      comment: "User rating",
      createdAt: new Date(),
    });
    const totalRatings = property.reviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    property.rating = totalRatings / property.reviews.length;
    await property.save();
    res.json({ success: true, newRating: property.rating });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({ error: "Failed to update rating" });
  }
});

// Get details of a single property
app.get("/property/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res
        .status(404)
        .json({ status: "error", message: "Property not found" });
    }
    res.json({ status: "success", property });
  } catch (error) {
    console.error("Error fetching property:", error);
    res
      .status(500)
      .json({ status: "error", message: "Error loading property details" });
  }
});

// Book a property
app.post("/property/:id/book", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { checkIn, checkOut, message } = req.body;
    const userId = req.user.id;
    const booking = new Booking({
      property: id,
      user: userId,
      checkIn,
      checkOut,
      message,
      status: "pending",
    });
    await booking.save();
    res.status(201).json({ status: "success", booking });
  } catch (error) {
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Submit a review for a property
app.post("/property/:id/review", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ error: "Property not found" });
    }
    const existingReview = property.reviews.find(
      (review) => review.user.toString() === userId
    );
    if (existingReview) {
      return res
        .status(400)
        .json({ error: "You've already reviewed this property" });
    }
    property.reviews.push({
      user: userId,
      rating,
      comment,
      createdAt: new Date(),
    });
    await property.save();
    res.json({ status: "success", reviews: property.reviews });
  } catch (error) {
    res.status(500).json({ error: "Failed to add review" });
  }
});

// Favorite a property
app.post("/property/:id/favorite", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const user = await User.findById(userId);
    const isFavorite = user.favorites.includes(id);
    if (isFavorite) {
      user.favorites = user.favorites.filter(
        (favId) => favId.toString() !== id
      );
    } else {
      user.favorites.push(id);
    }
    await user.save();
    res.json({ status: "success", isFavorite: !isFavorite });
  } catch (error) {
    res.status(500).json({ error: "Failed to update favorites" });
  }
});

// Mark a review as helpful
app.post("/review/:id/helpful", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const property = await Property.findOne({ "reviews._id": id });
    if (!property) {
      return res.status(404).json({ error: "Review not found" });
    }
    const review = property.reviews.id(id);
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }
    review.helpfulCount = (review.helpfulCount || 0) + 1;
    await property.save();
    res.json({ status: "success", helpfulCount: review.helpfulCount });
  } catch (error) {
    console.error("Error marking review as helpful:", error);
    res.status(500).json({ error: "Failed to mark review as helpful" });
  }
});

// -------------------------------------
// Admin Panel Routes
// -------------------------------------

// Create a separate router for admin routes
const adminRouter = express.Router();

// Example admin route: Get all properties
adminRouter.get("/properties", async (req, res) => {
  try {
    // Optionally, add authentication middleware here for admin-only access
    const properties = await Property.find();
    res.status(200).json(properties);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch properties for admin" });
  }
});
//----------------------------Delete--------------------------------
app.delete("/properties/:id", async (req, res) => {
  const { id } = req.params;
  console.log("Deleting property with ID:", id); // Log the ID being deleted
  try {
    const deletedProperty = await Property.findByIdAndDelete(id);
    if (!deletedProperty) {
      return res.status(404).send("Property not found");
    }
    res.status(200).send({ message: "Property deleted successfully" });
  } catch (error) {
    console.error("Error deleting property:", error);
    res.status(500).send("Error deleting property");
  }
});
//----------------------------Delete End----------------------------

//---------------------------Date Time------------------------------
app.get("/system-date", (req, res) => {
  const currentDate = new Date(); // Get current system date
  res.status(200).json({ currentDate });
});
//--------------------------Date Time End---------------------------

// Update the property update route in index.js
app.put("/properties/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Make sure the ID is valid
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid property ID" });
    }

    // If a new image was uploaded, add it to the update data
    if (req.file) {
      updateData.images = [
        {
          data: req.file.buffer,
          contentType: req.file.mimetype,
        },
      ];
    }

    // Update the property
    const updatedProperty = await Property.findByIdAndUpdate(
      id,
      updateData,
      { new: true } // Return the updated document
    );

    if (!updatedProperty) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.status(200).json({
      status: "success",
      property: updatedProperty,
    });
  } catch (error) {
    console.error("Error updating property:", error);
    res.status(500).json({ error: "Failed to update property" });
  }
});
//-------------------------------->update end<----------------------------

//--------------------------------Count Query------------------------

// Update the property update route in index.js

app.get("/properties/count", async (req, res) => {
  try {
    const count = await Property.countDocuments(); // Count the total number of properties
    res.status(200).json({ count });
  } catch (error) {
    console.error("Error counting properties:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all bookings with populated user and property details
app.get("/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate("property", "name location")
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Update booking status
app.put("/bookings/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate("user", "name email")
      .populate("property", "name location");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// Mount admin routes under "/admin"
app.use("/admin", adminRouter);

// -------------------------------------
// Start the Server
// -------------------------------------

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
