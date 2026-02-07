const mongoose = require("mongoose");

const callDataSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    totalCalls: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCallTime: {
      type: Number,
      default: 0,
      min: 0,
      description: "Total call time in minutes",
    },
    interestedStudents: {
      type: Number,
      default: 0,
      min: 0,
    },
    visitedToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Performance score calculated as: (visited * 40) + (interested * 30) + (callTime * 20) + (calls * 10)
    performanceScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    // Track if employee has checked out for the day
    isCheckedOut: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for unique records per employee per day
callDataSchema.index(
  { employee: 1, date: 1 },
  { unique: true, sparse: true }
);

// Calculate performance score before saving
callDataSchema.pre("save", function (next) {
  // Weightage: visited (40%) > interested (30%) > callTime (20%) > calls (10%)
  this.performanceScore =
    this.visitedToday * 40 +
    this.interestedStudents * 30 +
    this.totalCallTime * 0.2 +
    this.totalCalls * 0.1;

  next();
});

module.exports = mongoose.model("CallData", callDataSchema);
