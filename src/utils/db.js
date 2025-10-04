const mongoose = require('mongoose');
require('dotenv').config();
const logger = require('../../logger');

const connectDB = async () => {
  try {
    logger.info(`Connecting to MongoDB - ${process.env.MONGODB_URI}`);
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info('MongoDB connected successfully - ');
  } catch (error) {
    logger.critical('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB; 