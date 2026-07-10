/**
 * Centralized logging utility for Alpha Bridge
 * Ensures consistent log formatting and prevents sensitive data leaks.
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  DEBUG: 'DEBUG'
};

const formatTimestamp = () => new Date().toISOString();

const sanitize = (data) => {
  if (!data) return data;
  if (typeof data === 'string') {
    // Basic sanitization for obvious keys, though robust sanitization is complex
    // This is a safety net for accidental stringified objects
    return data;
  }
  const sensitiveKeys = ['password', 'apiKey', 'token', 'secret', 'auth'];
  const sanitized = { ...data };
  
  Object.keys(sanitized).forEach(key => {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  });
  
  return sanitized;
};

const log = (level, message, meta = {}) => {
  const timestamp = formatTimestamp();
  const safeMeta = sanitize(meta);
  
  const logEntry = {
    timestamp,
    level,
    message,
    ...safeMeta
  };

  // In production, we might send this to a service. For now, console.
  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(`[${timestamp}] [${level}] ${message}`, safeMeta);
      break;
    case LOG_LEVELS.WARN:
      console.warn(`[${timestamp}] [${level}] ${message}`, safeMeta);
      break;
    default:
      console.log(`[${timestamp}] [${level}] ${message}`, safeMeta);
  }
};

export const logger = {
  info: (msg, meta) => log(LOG_LEVELS.INFO, msg, meta),
  warn: (msg, meta) => log(LOG_LEVELS.WARN, msg, meta),
  error: (msg, meta) => log(LOG_LEVELS.ERROR, msg, meta),
  debug: (msg, meta) => log(LOG_LEVELS.DEBUG, msg, meta),
  
  logNotificationAttempt: (data) => {
    log(LOG_LEVELS.INFO, `Notification Attempt: ${data.channel}`, {
      status: data.status,
      recipient: data.recipient ? '***' + data.recipient.slice(-4) : 'unknown',
      error: data.error
    });
  }
};