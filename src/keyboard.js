/**
 * Keyboard simulation module for Zwift commands
 * Uses robotjs for cross-platform keyboard simulation with safety features
 */

let robot = null;
let robotAvailable = false;

// Try to load robotjs
try {
  robot = require('robotjs');
  robotAvailable = true;
  console.log('robotjs loaded successfully');
} catch (error) {
  console.warn('robotjs not available, falling back to AppleScript:', error.message);
  robotAvailable = false;
}

// Fallback to AppleScript if robotjs fails
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Configuration
 */
const CONFIG = {
  keyPressDelay: 50,        // ms between key down and key up
  rateLimitMs: 300,         // minimum ms between commands
  maxQueueSize: 5,          // max commands to queue
  testMode: false,          // log only, don't send keystrokes
  notificationsEnabled: true
};

/**
 * State
 */
let lastCommandTime = 0;
let commandQueue = [];
let isProcessingQueue = false;
let commandHistory = [];
const MAX_HISTORY = 50;

/**
 * Key mapping for robotjs
 * Maps our key names to robotjs key names
 */
const ROBOTJS_KEY_MAP = {
  // Navigation
  'left': 'left',
  'right': 'right',
  'down': 'down',
  'up': 'up',

  // Actions
  'space': 'space',
  'escape': 'escape',
  'tab': 'tab',
  'pageup': 'pageup',
  'pagedown': 'pagedown',

  // Function keys
  'f1': 'f1',
  'f2': 'f2',
  'f3': 'f3',
  'f4': 'f4',
  'f5': 'f5',
  'f6': 'f6',
  'f7': 'f7',
  'f8': 'f8',
  'f9': 'f9',
  'f10': 'f10',

  // Numbers
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',

  // Letters
  'a': 'a', 'b': 'b', 'c': 'c', 'd': 'd', 'e': 'e',
  'f': 'f', 'g': 'g', 'h': 'h', 'i': 'i', 'j': 'j',
  'k': 'k', 'l': 'l', 'm': 'm', 'n': 'n', 'o': 'o',
  'p': 'p', 'q': 'q', 'r': 'r', 's': 's', 't': 't',
  'u': 'u', 'v': 'v', 'w': 'w', 'x': 'x', 'y': 'y', 'z': 'z'
};

/**
 * AppleScript key codes (fallback for macOS)
 */
const APPLESCRIPT_KEY_CODES = {
  'space': 49,
  'escape': 53,
  'tab': 48,
  'left': 123,
  'right': 124,
  'down': 125,
  'up': 126,
  'pageup': 116,
  'pagedown': 121,
  'f1': 122,
  'f2': 120,
  'f3': 99,
  'f4': 118,
  'f5': 96,
  'f6': 97,
  'f7': 98,
  'f8': 100,
  'f9': 101,
  'f10': 109,
  '0': 29,
  '1': 18,
  '2': 19,
  '3': 20,
  '4': 21,
  '5': 23,
  '6': 22,
  '7': 26,
  '8': 28,
  '9': 25,
  'a': 0, 'b': 11, 'c': 8, 'd': 2, 'e': 14,
  'f': 3, 'g': 5, 'h': 4, 'i': 34, 'j': 38,
  'k': 40, 'l': 37, 'm': 46, 'n': 45, 'o': 31,
  'p': 35, 'q': 12, 'r': 15, 's': 1, 't': 17,
  'u': 32, 'v': 9, 'w': 13, 'x': 7, 'y': 16, 'z': 6
};

/**
 * Zwift command descriptions for UI display
 */
const COMMAND_DESCRIPTIONS = {
  'space': 'Use Power-up',
  'left': 'Turn Left',
  'right': 'Turn Right',
  'up': 'Go Straight',
  'down': 'U-Turn',
  'escape': 'Menu',
  'tab': 'Skip Block',
  'pageup': 'Increase Difficulty',
  'pagedown': 'Decrease Difficulty',
  'f10': 'Screenshot',
  '0': 'Bring It / Panoramic',
  '1': 'Camera 1',
  '2': 'Camera 2',
  '3': 'Camera 3',
  '4': 'Elbow Flick',
  '5': 'Wave',
  '6': 'Ride On',
  '7': 'Hammer Time',
  '8': 'Toast',
  '9': 'Nice',
  'g': 'Toggle Graph',
  'h': 'Hide UI',
  't': 'Chat'
};

/**
 * Simulate a single key press using robotjs
 * @param {string} key - The key to press
 * @returns {Promise<boolean>} - Success status
 */
async function simulateKeyRobotjs(key) {
  const robotKey = ROBOTJS_KEY_MAP[key.toLowerCase()];

  if (!robotKey) {
    console.warn(`Unknown key for robotjs: ${key}`);
    return false;
  }

  try {
    // Key down
    robot.keyToggle(robotKey, 'down');

    // Configurable delay
    await sleep(CONFIG.keyPressDelay);

    // Key up
    robot.keyToggle(robotKey, 'up');

    return true;
  } catch (error) {
    console.error(`robotjs error pressing ${key}:`, error.message);
    return false;
  }
}

/**
 * Simulate a key press using AppleScript (macOS fallback)
 * @param {string} key - The key to press
 * @returns {Promise<boolean>} - Success status
 */
async function simulateKeyAppleScript(key) {
  const keyCode = APPLESCRIPT_KEY_CODES[key.toLowerCase()];

  if (keyCode === undefined) {
    console.warn(`Unknown key for AppleScript: ${key}`);
    return false;
  }

  const script = `tell application "System Events" to key code ${keyCode}`;

  try {
    await execAsync(`osascript -e '${script}'`);
    return true;
  } catch (error) {
    console.error(`AppleScript error pressing ${key}:`, error.message);

    if (error.message.includes('not allowed') || error.message.includes('accessibility')) {
      throw new Error('ACCESSIBILITY_PERMISSION_REQUIRED');
    }

    return false;
  }
}

/**
 * Main function to simulate a key press
 * Uses robotjs if available, falls back to AppleScript
 * @param {string} key - The key to press
 * @returns {Promise<object>} - Result with success status and details
 */
async function simulateKey(key) {
  const timestamp = new Date();
  const description = COMMAND_DESCRIPTIONS[key.toLowerCase()] || key;

  // Test mode - log only
  if (CONFIG.testMode) {
    const result = {
      success: true,
      testMode: true,
      key,
      description,
      timestamp,
      message: `TEST MODE: Would press ${key} (${description})`
    };

    logCommand(result);
    console.log(result.message);
    return result;
  }

  // Rate limiting check
  const now = Date.now();
  const timeSinceLastCommand = now - lastCommandTime;

  if (timeSinceLastCommand < CONFIG.rateLimitMs) {
    // Queue the command if within rate limit
    if (commandQueue.length < CONFIG.maxQueueSize) {
      return queueCommand(key);
    } else {
      const result = {
        success: false,
        key,
        description,
        timestamp,
        error: 'Rate limit exceeded, queue full'
      };
      logCommand(result);
      return result;
    }
  }

  // Execute the key press
  let success = false;
  let method = 'unknown';

  try {
    if (robotAvailable) {
      success = await simulateKeyRobotjs(key);
      method = 'robotjs';
    } else {
      success = await simulateKeyAppleScript(key);
      method = 'applescript';
    }
  } catch (error) {
    const result = {
      success: false,
      key,
      description,
      timestamp,
      error: error.message
    };
    logCommand(result);
    return result;
  }

  lastCommandTime = Date.now();

  const result = {
    success,
    key,
    description,
    timestamp,
    method,
    message: success
      ? `Pressed ${key} (${description})`
      : `Failed to press ${key}`
  };

  logCommand(result);
  console.log(`[${timestamp.toISOString()}] ${result.message}`);

  // Process queue if there are pending commands
  processQueue();

  return result;
}

/**
 * Queue a command for later execution
 * @param {string} key - The key to queue
 * @returns {object} - Queue status
 */
function queueCommand(key) {
  const timestamp = new Date();
  const description = COMMAND_DESCRIPTIONS[key.toLowerCase()] || key;

  commandQueue.push({ key, timestamp });

  console.log(`Command queued: ${key} (queue size: ${commandQueue.length})`);

  // Start processing if not already running
  if (!isProcessingQueue) {
    setTimeout(() => processQueue(), CONFIG.rateLimitMs);
  }

  return {
    success: true,
    queued: true,
    key,
    description,
    timestamp,
    queuePosition: commandQueue.length,
    message: `Queued: ${key} (position ${commandQueue.length})`
  };
}

/**
 * Process queued commands
 */
async function processQueue() {
  if (isProcessingQueue || commandQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (commandQueue.length > 0) {
    const now = Date.now();
    const timeSinceLastCommand = now - lastCommandTime;

    if (timeSinceLastCommand >= CONFIG.rateLimitMs) {
      const { key } = commandQueue.shift();
      await simulateKey(key);
    } else {
      // Wait for rate limit
      await sleep(CONFIG.rateLimitMs - timeSinceLastCommand);
    }
  }

  isProcessingQueue = false;
}

/**
 * Log a command to history
 * @param {object} result - Command result
 */
function logCommand(result) {
  commandHistory.unshift({
    ...result,
    id: Date.now()
  });

  if (commandHistory.length > MAX_HISTORY) {
    commandHistory.pop();
  }
}

/**
 * Helper function to sleep
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Press a key (alias for simulateKey for backward compatibility)
 * @param {string} key - The key to press
 * @returns {Promise<boolean>} - Success status
 */
async function pressKey(key) {
  const result = await simulateKey(key);
  return result.success;
}

/**
 * Test a specific key press
 * @param {string} key - The key to test
 * @returns {Promise<boolean>} - Success status
 */
async function testKey(key) {
  // Temporarily disable rate limiting for tests
  const savedLastTime = lastCommandTime;
  lastCommandTime = 0;

  const result = await simulateKey(key);

  // Restore (or not, since we just pressed a key)
  if (!result.success) {
    lastCommandTime = savedLastTime;
  }

  return result.success;
}

/**
 * Set test mode
 * @param {boolean} enabled - Enable or disable test mode
 */
function setTestMode(enabled) {
  CONFIG.testMode = enabled;
  console.log(`Test mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get test mode status
 * @returns {boolean} - Test mode status
 */
function isTestMode() {
  return CONFIG.testMode;
}

/**
 * Set notifications enabled
 * @param {boolean} enabled - Enable or disable notifications
 */
function setNotificationsEnabled(enabled) {
  CONFIG.notificationsEnabled = enabled;
}

/**
 * Get notifications enabled status
 * @returns {boolean} - Notifications enabled status
 */
function areNotificationsEnabled() {
  return CONFIG.notificationsEnabled;
}

/**
 * Set rate limit
 * @param {number} ms - Milliseconds between commands
 */
function setRateLimit(ms) {
  CONFIG.rateLimitMs = Math.max(100, Math.min(2000, ms));
}

/**
 * Get rate limit
 * @returns {number} - Current rate limit in ms
 */
function getRateLimit() {
  return CONFIG.rateLimitMs;
}

/**
 * Set key press delay
 * @param {number} ms - Milliseconds between key down and up
 */
function setKeyPressDelay(ms) {
  CONFIG.keyPressDelay = Math.max(10, Math.min(200, ms));
}

/**
 * Get command history
 * @returns {Array} - Command history
 */
function getCommandHistory() {
  return commandHistory;
}

/**
 * Clear command history
 */
function clearCommandHistory() {
  commandHistory = [];
}

/**
 * Get command descriptions
 * @returns {object} - Command descriptions
 */
function getCommands() {
  return COMMAND_DESCRIPTIONS;
}

/**
 * Get all available keys
 * @returns {Array} - List of available keys
 */
function getAvailableKeys() {
  return Object.keys(ROBOTJS_KEY_MAP);
}

/**
 * Check if robotjs is available
 * @returns {boolean} - robotjs availability
 */
function isRobotjsAvailable() {
  return robotAvailable;
}

/**
 * Get current configuration
 * @returns {object} - Current config
 */
function getConfig() {
  return { ...CONFIG };
}

/**
 * Get queue status
 * @returns {object} - Queue status
 */
function getQueueStatus() {
  return {
    size: commandQueue.length,
    maxSize: CONFIG.maxQueueSize,
    isProcessing: isProcessingQueue
  };
}

module.exports = {
  // Core functions
  simulateKey,
  pressKey,
  testKey,

  // Configuration
  setTestMode,
  isTestMode,
  setNotificationsEnabled,
  areNotificationsEnabled,
  setRateLimit,
  getRateLimit,
  setKeyPressDelay,
  getConfig,

  // History and status
  getCommandHistory,
  clearCommandHistory,
  getCommands,
  getAvailableKeys,
  isRobotjsAvailable,
  getQueueStatus,

  // Constants
  COMMAND_DESCRIPTIONS,
  ROBOTJS_KEY_MAP,
  APPLESCRIPT_KEY_CODES
};
