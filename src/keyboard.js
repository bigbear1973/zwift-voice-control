/**
 * Keyboard simulation module for Zwift commands
 * Uses macOS native AppleScript for keyboard simulation (no external dependencies)
 */

const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Zwift keyboard command mappings
 * Maps voice commands to Zwift keyboard shortcuts
 */
const ZWIFT_COMMANDS = {
  // Power-ups
  'power up': { key: 'space', keyCode: 49, description: 'Use power-up' },
  'use power up': { key: 'space', keyCode: 49, description: 'Use power-up' },
  'boost': { key: 'space', keyCode: 49, description: 'Use power-up' },

  // Camera views
  'camera': { key: '1', keyCode: 18, description: 'Cycle camera view' },
  'first person': { key: '1', keyCode: 18, description: 'First person view' },
  'third person': { key: '1', keyCode: 18, description: 'Third person view' },
  'drone': { key: '2', keyCode: 19, description: 'Drone camera' },
  'helicopter': { key: '3', keyCode: 20, description: 'Helicopter view' },
  'bird': { key: '3', keyCode: 20, description: 'Bird\'s eye view' },

  // Rider actions
  'elbow': { key: '4', keyCode: 21, description: 'Elbow flick' },
  'wave': { key: '5', keyCode: 23, description: 'Wave' },
  'ride on': { key: '6', keyCode: 22, description: 'Ride On!' },
  'hammer': { key: '7', keyCode: 26, description: 'Hammer time' },
  'toast': { key: '8', keyCode: 28, description: 'Toast' },
  'nice': { key: '9', keyCode: 25, description: 'Nice!' },
  'bring it': { key: '0', keyCode: 29, description: 'Bring it!' },

  // Navigation
  'u turn': { key: 'down', keyCode: 125, description: 'U-Turn' },
  'turn around': { key: 'down', keyCode: 125, description: 'U-Turn' },
  'go back': { key: 'down', keyCode: 125, description: 'U-Turn' },

  // Direction at intersections
  'go left': { key: 'left', keyCode: 123, description: 'Turn left at intersection' },
  'turn left': { key: 'left', keyCode: 123, description: 'Turn left at intersection' },
  'left': { key: 'left', keyCode: 123, description: 'Turn left at intersection' },
  'go right': { key: 'right', keyCode: 124, description: 'Turn right at intersection' },
  'turn right': { key: 'right', keyCode: 124, description: 'Turn right at intersection' },
  'right': { key: 'right', keyCode: 124, description: 'Turn right at intersection' },
  'go straight': { key: 'up', keyCode: 126, description: 'Go straight at intersection' },
  'straight': { key: 'up', keyCode: 126, description: 'Go straight at intersection' },
  'straight on': { key: 'up', keyCode: 126, description: 'Go straight at intersection' },

  // Menu/UI
  'menu': { key: 'escape', keyCode: 53, description: 'Open menu' },
  'escape': { key: 'escape', keyCode: 53, description: 'Open menu' },
  'pause': { key: 'escape', keyCode: 53, description: 'Pause/Menu' },
  'graph': { key: 'g', keyCode: 5, description: 'Toggle graph display' },
  'hide': { key: 'h', keyCode: 4, description: 'Hide UI' },
  'show': { key: 'h', keyCode: 4, description: 'Toggle UI visibility' },

  // Screenshots
  'screenshot': { key: 'F10', keyCode: 109, description: 'Take screenshot' },
  'photo': { key: 'F10', keyCode: 109, description: 'Take screenshot' },
  'picture': { key: 'F10', keyCode: 109, description: 'Take screenshot' },

  // Fan/Trainer control
  'fan up': { key: 'pageup', keyCode: 116, description: 'Increase fan speed' },
  'fan down': { key: 'pagedown', keyCode: 121, description: 'Decrease fan speed' },

  // Workout mode
  'skip': { key: 'tab', keyCode: 48, description: 'Skip workout block' },
  'skip block': { key: 'tab', keyCode: 48, description: 'Skip workout block' },
  'next block': { key: 'tab', keyCode: 48, description: 'Skip to next workout block' },
  'bias up': { key: 'pageup', keyCode: 116, description: 'Increase FTP bias' },
  'bias down': { key: 'pagedown', keyCode: 121, description: 'Decrease FTP bias' },
  'easier': { key: 'pagedown', keyCode: 121, description: 'Decrease difficulty' },
  'harder': { key: 'pageup', keyCode: 116, description: 'Increase difficulty' }
};

/**
 * Map key names to AppleScript key codes
 */
const KEY_CODES = {
  'space': 49,
  'escape': 53,
  'tab': 48,
  'left': 123,
  'right': 124,
  'down': 125,
  'up': 126,
  'pageup': 116,
  'pagedown': 121,
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
  'g': 5,
  'h': 4
};

/**
 * Simulate a key press using AppleScript
 * @param {string} key - The key to press
 * @returns {Promise<boolean>} - Success status
 */
async function pressKey(key) {
  const keyCode = KEY_CODES[key.toLowerCase()];

  if (keyCode === undefined) {
    console.warn(`Unknown key: ${key}`);
    return false;
  }

  // AppleScript to send key event to the system
  const script = `tell application "System Events" to key code ${keyCode}`;

  try {
    await execAsync(`osascript -e '${script}'`);
    console.log(`Pressed key: ${key} (code: ${keyCode})`);
    return true;
  } catch (error) {
    console.error(`Error pressing key ${key}:`, error.message);
    // Check if it's a permissions error
    if (error.message.includes('not allowed') || error.message.includes('accessibility')) {
      console.error('Accessibility permission required. Grant in System Preferences → Security & Privacy → Accessibility');
    }
    return false;
  }
}

/**
 * Find and execute a command from voice input
 * @param {string} voiceInput - The recognized voice command
 * @returns {Promise<object>} - Result with success status and details
 */
async function executeCommand(voiceInput) {
  const normalizedInput = voiceInput.toLowerCase().trim();

  // Try exact match first
  if (ZWIFT_COMMANDS[normalizedInput]) {
    const command = ZWIFT_COMMANDS[normalizedInput];
    const success = await pressKey(command.key);
    return {
      success,
      command: normalizedInput,
      key: command.key,
      description: command.description
    };
  }

  // Try partial/fuzzy match
  for (const [phrase, command] of Object.entries(ZWIFT_COMMANDS)) {
    if (normalizedInput.includes(phrase) || phrase.includes(normalizedInput)) {
      const success = await pressKey(command.key);
      return {
        success,
        command: phrase,
        key: command.key,
        description: command.description,
        fuzzyMatch: true
      };
    }
  }

  console.log(`No command found for: "${voiceInput}"`);
  return {
    success: false,
    command: null,
    error: 'Command not recognized'
  };
}

/**
 * Test a specific key press (for settings UI)
 * @param {string} key - The key to test
 * @returns {Promise<boolean>} - Success status
 */
async function testKey(key) {
  return pressKey(key);
}

/**
 * Get all available commands
 * @returns {object} - All command mappings
 */
function getCommands() {
  return ZWIFT_COMMANDS;
}

/**
 * Add a custom command mapping
 * @param {string} phrase - Voice phrase
 * @param {string} key - Key to press
 * @param {string} description - Description
 */
function addCommand(phrase, key, description) {
  const keyCode = KEY_CODES[key.toLowerCase()];
  ZWIFT_COMMANDS[phrase.toLowerCase()] = { key, keyCode, description };
}

/**
 * Remove a command mapping
 * @param {string} phrase - Voice phrase to remove
 */
function removeCommand(phrase) {
  delete ZWIFT_COMMANDS[phrase.toLowerCase()];
}

module.exports = {
  executeCommand,
  testKey,
  getCommands,
  addCommand,
  removeCommand,
  pressKey,
  ZWIFT_COMMANDS,
  KEY_CODES
};
