const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Holiday name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Holiday date is required"],
    },
    type: {
      type: String,
      enum: ["National", "Religious", "Company", "Regional"],
      default: "Company",
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Active", "Cancelled"],
      default: "Active",
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    // For notifications
    notifyEmployees: {
      type: Boolean,
      default: true,
    },
    // For office closure
    isOfficeClose: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient date queries
holidaySchema.index({ date: 1 });
holidaySchema.index({ status: 1, date: 1 });

// Static method to get upcoming holidays
holidaySchema.statics.getUpcomingHolidays = function (limit = 10) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.find({
    date: { $gte: today },
    status: "Active",
  })
    .sort({ date: 1 })
    .limit(limit)
    .populate("addedBy", "name email");
};

// Static method to get holidays for a specific month/year
holidaySchema.statics.getHolidaysForMonth = function (year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate,
    },
    status: "Active",
  })
    .sort({ date: 1 })
    .populate("addedBy", "name email");
};

// Instance method to check if holiday is today
holidaySchema.methods.isToday = function () {
  const today = new Date();
  const holidayDate = new Date(this.date);

  return (
    today.getFullYear() === holidayDate.getFullYear() &&
    today.getMonth() === holidayDate.getMonth() &&
    today.getDate() === holidayDate.getDate()
  );
};

// Instance method to check if holiday is upcoming (within next 30 days)
holidaySchema.methods.isUpcoming = function () {
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  const holidayDate = new Date(this.date);

  return holidayDate >= today && holidayDate <= thirtyDaysFromNow;
};

// Virtual for formatted date
holidaySchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString();
});

// Ensure virtual fields are serialized
holidaySchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Holiday", holidaySchema);
