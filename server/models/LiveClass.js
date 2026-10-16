const mongoose = require('mongoose');

const liveClassParticipantSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    cameraApproved: {
      type: Boolean,
      default: false,
    },
    cameraApprovedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const liveClassSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    agenda: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      default: 45,
      min: 10,
      max: 300,
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    meetingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    spotlightStudent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    participants: [liveClassParticipantSchema],
  },
  { timestamps: true }
);

liveClassSchema.index({ course: 1, scheduledAt: -1 });
liveClassSchema.index({ 'participants.student': 1, status: 1 });

module.exports = mongoose.model('LiveClass', liveClassSchema);
