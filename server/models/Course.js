const mongoose = require('mongoose');

const curriculumItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 },
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  order: { type: Number, required: true },
  lessons: [
    {
      title: { type: String, required: true },
      type: { type: String, enum: ['video', 'text', 'document'], default: 'text' },
      content: String,
      videoUrl: String,
      duration: Number, // minutes
      order: Number,
    },
  ],
});

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, 'Course description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    content: {
      type: String,
      default: '',
      maxlength: [8000, 'Content cannot exceed 8000 characters'],
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Programming',
        'Data Science',
        'Design',
        'Business',
        'Mathematics',
        'Science',
        'Language',
        'Other',
      ],
    },
    difficulty: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner',
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative'],
    },
    banner: {
      type: String,
      default: '',
    },
    tags: [String],
    thumbnail: {
      type: String,
      default: '',
    },
    curriculum: [curriculumItemSchema],
    stages: [String],
    modules: [moduleSchema],
    objectives: [String],
    prerequisites: [String],
    duration: { type: Number, default: 0 }, // total hours
    isPublished: { type: Boolean, default: false },
    enrollmentCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug from title
courseSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80) + '-' + Date.now().toString(36);
  }
  next();
});

courseSchema.index({ title: 'text', description: 'text', content: 'text', tags: 'text' });

const Course = mongoose.model('Course', courseSchema);
module.exports = Course;
