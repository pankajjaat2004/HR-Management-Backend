const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "Vacation",
        "Sick Leave",
        "Personal Leave",
        "Emergency Leave",
        "Maternity/Paternity",
        "Bereavement",
      ],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Cancelled"],
      default: "Pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    approvedDate: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    handoverNotes: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String,
    },
    attachments: [
      {
        filename: String,
        originalName: String,
        mimetype: String,
        path: String,
        uploadDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    halfDayPeriod: {
      type: String,
      enum: ["Morning", "Afternoon"],
    },
  },
  {
    timestamps: true,
  },
);

// Calculate total days before saving
leaveSchema.pre("save", function (next) {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    // Calculate difference in days
    const timeDiff = end.getTime() - start.getTime();
    let daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    // Adjust for half day
    if (this.isHalfDay) {
      daysDiff = 0.5;
    }

    // Exclude weekends (optional - depends on company policy)
    // For now, we'll include weekends in the calculation

    this.totalDays = daysDiff;
  }
  next();
});

// Validate that end date is not before start date
leaveSchema.pre("save", function (next) {
  if (this.endDate < this.startDate) {
    next(new Error("End date cannot be before start date"));
  } else {
    next();
  }
});

// Update approved date when status changes to approved
leaveSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "Approved") {
    this.approvedDate = new Date();
  }
  next();
});

// Static method to get leave balance for an employee
leaveSchema.statics.getLeaveBalance = async function (employeeId, year) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);

  const leaveUsage = await this.aggregate([
    {
      $match: {
        employee: mongoose.Types.ObjectId(employeeId),
        status: "Approved",
        startDate: {
          $gte: startOfYear,
          $lte: endOfYear,
        },
      },
    },
    {
      $group: {
        _id: "$type",
        totalDays: { $sum: "$totalDays" },
      },
    },
  ]);

  return leaveUsage;
};

// Static method to check for overlapping leaves
leaveSchema.statics.checkOverlappingLeaves = function (
  employeeId,
  startDate,
  endDate,
  excludeLeaveId = null,
) {
  const query = {
    employee: employeeId,
    status: { $in: ["Pending", "Approved"] },
    $or: [
      {
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
      },
    ],
  };

  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  return this.findOne(query);
};

// Instance method to approve leave
leaveSchema.methods.approve = function (approverId, notes = "") {
  this.status = "Approved";
  this.approvedBy = approverId;
  this.approvedDate = new Date();
  if (notes) {
    this.handoverNotes = notes;
  }
  return this.save();
};

// Instance method to reject leave
leaveSchema.methods.reject = function (approverId, reason) {
  this.status = "Rejected";
  this.approvedBy = approverId;
  this.rejectionReason = reason;
  return this.save();
};

module.exports = mongoose.model("Leave", leaveSchema);
