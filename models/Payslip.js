const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2020,
    },
    fileName: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    downloadedAt: {
      type: Date,
      default: null,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Create compound index to ensure one payslip per employee per month/year
payslipSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

// Virtual for formatted month-year
payslipSchema.virtual("monthYear").get(function () {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[this.month - 1]} ${this.year}`;
});

// Method to check if employee can download this payslip
payslipSchema.methods.canEmployeeDownload = function (employeeId) {
  return this.employee.toString() === employeeId.toString();
};

// Static method to find payslips for an employee
payslipSchema.statics.findByEmployee = function (employeeId) {
  return this.find({ employee: employeeId })
    .populate("employee", "name email employeeId")
    .populate("uploadedBy", "name email")
    .sort({ year: -1, month: -1 });
};

// Static method to find payslip by employee and month/year
payslipSchema.statics.findByEmployeeAndPeriod = function (
  employeeId,
  month,
  year,
) {
  return this.findOne({ employee: employeeId, month, year })
    .populate("employee", "name email employeeId")
    .populate("uploadedBy", "name email");
};

module.exports = mongoose.model("Payslip", payslipSchema);
