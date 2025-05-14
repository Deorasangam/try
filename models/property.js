// backend/models/Property.js

const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Property name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Property type is required"],

      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price must be a positive number"],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
    },
    coordinates: {
      lat: Number,
      lng: Number,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    bedrooms: {
      type: Number,
      default: 1,
    },
    bathrooms: {
      type: Number,
      default: 1,
    },
    maxGuests: {
      type: Number,
      default: 2,
    },
    area: {
      type: Number,
      //required: [true, "Area is required"],
    },

    amenities: [
      {
        type: String,
        enum: [
          "WiFi",
          "TV",
          "Air Conditioning",
          "Heating",
          "Kitchen",
          "Washing Machine",
          "Parking",
          "Elevator",
          "Swimming Pool",
          "Gym",
          "Security",
          "Balcony",
          "Garden",
          "Furniture",
        ],
      },
    ],

    images: [
      {
        data: Buffer,
        contentType: {
          type: String,
          enum: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
        },
      },
    ],
    rules: {
      smoking: { type: Boolean, default: false },
      pets: { type: Boolean, default: false },
      events: { type: Boolean, default: false },
      cooking: { type: Boolean, default: true },
    },
    availability: {
      startDate: Date,
      endDate: Date,
      minimumStay: {
        type: Number,
        default: 30, // 30 days minimum
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },
    email: {
      type: String,
      required: [true, "Contact email is required"],
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
    },
    phone: {
      type: String,
      match: [/^\+?[\d\s-]+$/, "Please enter a valid phone number"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
    },
    status: {
      type: String,
      enum: ["available", "booked", "maintenance", "inactive"],
      default: "available",
    },
    reviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        userName: String,
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        title: String,
        comment: {
          type: String,
          required: true,
        },
        helpfulCount: {
          type: Number,
          default: 0,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware to update average rating and total reviews
propertySchema.pre("save", function (next) {
  if (this.reviews.length > 0) {
    this.averageRating =
      this.reviews.reduce((acc, review) => acc + review.rating, 0) /
      this.reviews.length;
    this.totalReviews = this.reviews.length;
  }
  next();
});

// Virtual field for booking status
propertySchema.virtual("isAvailable").get(function () {
  return this.status === "available";
});

// Method to check booking availability
propertySchema.methods.checkAvailability = function (checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);

  if (this.status !== "available") return false;

  if (this.availability.startDate && start < this.availability.startDate)
    return false;
  if (this.availability.endDate && end > this.availability.endDate)
    return false;

  const duration = (end - start) / (1000 * 60 * 60 * 24);
  return duration >= this.availability.minimumStay;
};

// Method to calculate total price including discount
propertySchema.methods.calculateTotalPrice = function (days) {
  const basePrice = this.price * days;
  const discountAmount = (basePrice * this.discount) / 100;
  return basePrice - discountAmount;
};

// Index for location-based searches
propertySchema.index({ location: "text" });
propertySchema.index({ coordinates: "2dsphere" });

// Compound index for type and status
propertySchema.index({ type: 1, status: 1 });

const Property = mongoose.model("Property", propertySchema);

module.exports = Property;
