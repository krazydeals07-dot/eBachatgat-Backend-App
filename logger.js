const { createLogger, format, transports, config, addColors } = require('winston');
const fs = require('fs');
const path = require('path');

const customLevels = {
  levels: {
    critical: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4
  },
  colors: {
    critical: 'red',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
  }
};

// Register custom colors
addColors(customLevels.colors);

// Ensure logs directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = createLogger({
  levels: customLevels.levels,
  level: 'info', // Set the default log level
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.printf((info) => {
      let message = info.message;
      
      // Handle additional arguments (splat)
      if (info[Symbol.for('splat')]) {
        const splatArgs = info[Symbol.for('splat')];
        const additionalArgs = splatArgs.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        if (additionalArgs) {
          message += ' ' + additionalArgs;
        }
      }
      
      return `${info.timestamp} ${info.level}: ${message}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.timestamp(),
        format.printf((info) => {
          let message = info.message;
          
          // Handle additional arguments (splat)
          if (info[Symbol.for('splat')]) {
            const splatArgs = info[Symbol.for('splat')];
            const additionalArgs = splatArgs.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            if (additionalArgs) {
              message += ' ' + additionalArgs;
            }
          }
          
          return `${info.timestamp} ${info.level}: ${message}`;
        })
      )
    }),
    new transports.File({ 
      filename: path.join(logDir, 'app.log'),
      format: format.combine(
        format.timestamp(),
        format.printf((info) => {
          let message = info.message;
          
          // Handle additional arguments (splat)
          if (info[Symbol.for('splat')]) {
            const splatArgs = info[Symbol.for('splat')];
            const additionalArgs = splatArgs.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            if (additionalArgs) {
              message += ' ' + additionalArgs;
            }
          }
          
          return `${info.timestamp} ${info.level}: ${message}`;
        })
      )
    }),
    new transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      format: format.combine(
        format.timestamp(),
        format.printf((info) => {
          let message = info.message;
          
          // Handle additional arguments (splat)
          if (info[Symbol.for('splat')]) {
            const splatArgs = info[Symbol.for('splat')];
            const additionalArgs = splatArgs.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            if (additionalArgs) {
              message += ' ' + additionalArgs;
            }
          }
          
          return `${info.timestamp} ${info.level}: ${message}`;
        })
      )
    })
  ]
});

module.exports = logger;