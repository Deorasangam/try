// // Backend routes for booking management

// const express = require("express");
// const router = express.Router();
// const Booking = require("../models/Booking");
// const { authenticateToken } = require("../middleware/authMiddleware");

// // Get all bookings with populated user and property details
// router.get("/bookings", authenticateToken, async (req, res) => {
//   try {
//     const bookings = await Booking.find()
//       .populate("user", "name email") // Only get name and email from user
//       .populate("property", "name location") // Only get name and location from property
//       .sort({ createdAt: -1 }); // Sort by newest first

//     res.json(bookings);
//   } catch (error) {
//     console.error("Error fetching bookings:", error);
//     res.status(500).json({ error: "Failed to fetch bookings" });
//   }
// });

// // Create a new booking
// router.post("/bookings", authenticateToken, async (req, res) => {
//   try {
//     const { propertyId, checkIn, checkOut, message } = req.body;

//     // Create new booking
//     const booking = new Booking({
//       property: propertyId,
//       user: req.user._id, // From auth middleware
//       checkIn: new Date(checkIn),
//       checkOut: new Date(checkOut),
//       message,
//       status: "pending",
//     });

//     await booking.save();

//     // Populate the saved booking with user and property details
//     const populatedBooking = await Booking.findById(booking._id)
//       .populate("user", "name email")
//       .populate("property", "name location");

//     res.status(201).json(populatedBooking);
//   } catch (error) {
//     console.error("Error creating booking:", error);
//     res.status(500).json({ error: "Failed to create booking" });
//   }
// });

// // Update booking status
// router.put("/bookings/:id/status", authenticateToken, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     // Validate status
//     if (!["pending", "confirmed", "rejected"].includes(status)) {
//       return res.status(400).json({ error: "Invalid status" });
//     }

//     const booking = await Booking.findByIdAndUpdate(
//       id,
//       { status },
//       { new: true } // Return updated document
//     ).populate("user property");

//     if (!booking) {
//       return res.status(404).json({ error: "Booking not found" });
//     }

//     // Here you could add email notifications for status changes
//     // Example: sendStatusUpdateEmail(booking);

//     res.json(booking);
//   } catch (error) {
//     console.error("Error updating booking status:", error);
//     res.status(500).json({ error: "Failed to update booking status" });
//   }
// });

// // Get bookings for a specific user
// router.get("/bookings/user", authenticateToken, async (req, res) => {
//   try {
//     const bookings = await Booking.find({ user: req.user._id })
//       .populate("property", "name location")
//       .sort({ createdAt: -1 });

//     res.json(bookings);
//   } catch (error) {
//     console.error("Error fetching user bookings:", error);
//     res.status(500).json({ error: "Failed to fetch user bookings" });
//   }
// });

// // Get bookings for a specific property
// router.get(
//   "/bookings/property/:propertyId",
//   authenticateToken,
//   async (req, res) => {
//     try {
//       const bookings = await Booking.find({ property: req.params.propertyId })
//         .populate("user", "name email")
//         .sort({ checkIn: 1 });

//       res.json(bookings);
//     } catch (error) {
//       console.error("Error fetching property bookings:", error);
//       res.status(500).json({ error: "Failed to fetch property bookings" });
//     }
//   }
// );

// module.exports = router;
