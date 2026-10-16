const Notification = require('../models/Notification');

const emitNotification = (io, notification) => {
  if (!io || !notification) return;
  io.to(`user:${String(notification.user)}`).emit('notification:new', notification);
};

const createNotifications = async ({ io, entries = [] } = {}) => {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const notifications = await Notification.insertMany(entries);
  notifications.forEach((notification) => emitNotification(io, notification));

  return notifications;
};

const createNotification = async ({ io, entry } = {}) => {
  if (!entry) return null;

  const notification = await Notification.create(entry);
  emitNotification(io, notification);

  return notification;
};

module.exports = {
  emitNotification,
  createNotification,
  createNotifications,
};
