/**
 * Analytics Module
 *
 * Tracks usage patterns to improve the app and understand user behavior.
 * Privacy-focused: No personal data collected, all data anonymized.
 *
 * TODO: Implement full analytics in future iteration
 */

const os = require('os');
const { app } = require('electron');

// Analytics configuration
const CONFIG = {
  enabled: false, // Disabled by default, user must opt-in
  endpoint: null, // TODO: Set analytics endpoint when implemented
  sessionId: null,
  userId: null // Anonymous user ID (not personally identifiable)
};

// Session data
let sessionData = {
  startTime: null,
  commandCount: 0,
  commands: {}, // Command usage frequency
  errors: 0,
  listeningDuration: 0
};

/**
 * Initialize analytics
 * @param {boolean} optIn - User opt-in status
 */
function initialize(optIn = false) {
  CONFIG.enabled = optIn;
  CONFIG.sessionId = generateSessionId();

  if (CONFIG.enabled) {
    console.log('Analytics initialized (user opted in)');
    sessionData.startTime = Date.now();
  } else {
    console.log('Analytics disabled (user opted out or default)');
  }
}

/**
 * Generate anonymous session ID
 * @returns {string}
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Track a voice command usage
 * @param {string} command - The command that was used
 * @param {boolean} success - Whether the command was successful
 */
function trackCommand(command, success = true) {
  if (!CONFIG.enabled) return;

  sessionData.commandCount++;
  sessionData.commands[command] = (sessionData.commands[command] || 0) + 1;

  if (!success) {
    sessionData.errors++;
  }

  // TODO: Send to analytics endpoint
  console.log(`[Analytics] Command tracked: ${command} (success: ${success})`);
}

/**
 * Track listening session duration
 * @param {number} durationMs - Duration in milliseconds
 */
function trackListeningSession(durationMs) {
  if (!CONFIG.enabled) return;

  sessionData.listeningDuration += durationMs;

  // TODO: Send to analytics endpoint
  console.log(`[Analytics] Listening session: ${durationMs}ms`);
}

/**
 * Track app launch
 */
function trackLaunch() {
  if (!CONFIG.enabled) return;

  const launchData = {
    event: 'app_launch',
    sessionId: CONFIG.sessionId,
    platform: process.platform,
    arch: process.arch,
    osVersion: os.release(),
    appVersion: app?.getVersion() || '1.0.0-beta',
    nodeVersion: process.version,
    electronVersion: process.versions.electron
  };

  // TODO: Send to analytics endpoint
  console.log('[Analytics] App launch tracked:', launchData);
}

/**
 * Track app quit
 */
function trackQuit() {
  if (!CONFIG.enabled) return;

  const quitData = {
    event: 'app_quit',
    sessionId: CONFIG.sessionId,
    sessionDuration: Date.now() - sessionData.startTime,
    totalCommands: sessionData.commandCount,
    uniqueCommands: Object.keys(sessionData.commands).length,
    errors: sessionData.errors,
    listeningDuration: sessionData.listeningDuration
  };

  // TODO: Send to analytics endpoint
  console.log('[Analytics] App quit tracked:', quitData);
}

/**
 * Track an error
 * @param {string} errorType - Type of error
 * @param {string} message - Error message
 */
function trackError(errorType, message) {
  if (!CONFIG.enabled) return;

  sessionData.errors++;

  const errorData = {
    event: 'error',
    sessionId: CONFIG.sessionId,
    errorType,
    message: message.substring(0, 200) // Truncate for privacy
  };

  // TODO: Send to analytics endpoint
  console.log('[Analytics] Error tracked:', errorData);
}

/**
 * Get current session stats (for settings UI)
 * @returns {object}
 */
function getSessionStats() {
  return {
    enabled: CONFIG.enabled,
    commandCount: sessionData.commandCount,
    topCommands: Object.entries(sessionData.commands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    errors: sessionData.errors,
    listeningDuration: sessionData.listeningDuration,
    sessionDuration: sessionData.startTime ? Date.now() - sessionData.startTime : 0
  };
}

/**
 * Enable analytics (user opt-in)
 */
function enable() {
  CONFIG.enabled = true;
  if (!sessionData.startTime) {
    sessionData.startTime = Date.now();
  }
  console.log('Analytics enabled');
}

/**
 * Disable analytics (user opt-out)
 */
function disable() {
  CONFIG.enabled = false;
  console.log('Analytics disabled');
}

/**
 * Check if analytics is enabled
 * @returns {boolean}
 */
function isEnabled() {
  return CONFIG.enabled;
}

module.exports = {
  initialize,
  trackCommand,
  trackListeningSession,
  trackLaunch,
  trackQuit,
  trackError,
  getSessionStats,
  enable,
  disable,
  isEnabled
};
