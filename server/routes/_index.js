const express = require('express');
const router = express.Router();
const { skillRouter, marketRouter, badgeRouter, discussionRouter, userRouter, adminRouter } = require('./_combined');

// Re-export individual routers
module.exports = { skillRouter, marketRouter, badgeRouter, discussionRouter, userRouter, adminRouter };
