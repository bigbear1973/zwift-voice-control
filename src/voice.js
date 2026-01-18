/**
 * Voice Recognition Module for Zwift Voice Control
 *
 * Uses Web Speech API (webkitSpeechRecognition) for continuous voice recognition
 * Optimized for noisy cycling environments (trainer, fan noise)
 */

const EventEmitter = require('events');

/**
 * Levenshtein distance for fuzzy matching
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Convert spoken numbers to digits
 * @param {string} text - Input text
 * @returns {string} - Text with numbers converted
 */
function convertSpokenNumbers(text) {
  const numberMap = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'ten': '10'
  };

  let result = text.toLowerCase();
  for (const [word, digit] of Object.entries(numberMap)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
  }
  return result;
}

/**
 * Voice command definitions with priority ordering
 * PRIORITY 1: Racing commands (most valuable to competitive riders)
 * PRIORITY 2: Training commands
 * PRIORITY 3: Convenience commands
 */
const VOICE_COMMANDS = [
  // PRIORITY 1 - RACING COMMANDS
  {
    phrases: ['elbow flick', 'elbow', 'signal', 'flick', 'elbow flex'],
    key: '4',
    keyCode: 21,
    description: 'Elbow flick signal',
    priority: 1
  },
  {
    phrases: ['power up', 'use power up', 'activate', 'powerup', 'power-up', 'use powerup', 'boost'],
    key: 'space',
    keyCode: 49,
    description: 'Use power-up',
    priority: 1
  },
  {
    phrases: ['turn left', 'left', 'go left', 'take left'],
    key: 'left',
    keyCode: 123,
    description: 'Turn left',
    priority: 1
  },
  {
    phrases: ['turn right', 'right', 'go right', 'take right'],
    key: 'right',
    keyCode: 124,
    description: 'Turn right',
    priority: 1
  },
  {
    phrases: ['go straight', 'straight', 'straight on', 'straight ahead'],
    key: 'up',
    keyCode: 126,
    description: 'Go straight',
    priority: 1
  },
  // Camera commands - racing essential
  {
    phrases: ['camera 1', 'camera one', 'view 1', 'view one'],
    key: '1',
    keyCode: 18,
    description: 'Camera view 1',
    priority: 1
  },
  {
    phrases: ['camera 2', 'camera two', 'view 2', 'view two'],
    key: '2',
    keyCode: 19,
    description: 'Camera view 2',
    priority: 1
  },
  {
    phrases: ['camera 3', 'camera three', 'view 3', 'view three', 'behind view'],
    key: '3',
    keyCode: 20,
    description: 'Camera view 3 (behind)',
    priority: 1
  },
  {
    phrases: ['camera 4', 'camera four', 'view 4', 'view four'],
    key: '5',
    keyCode: 23,
    description: 'Camera view 4',
    priority: 1
  },
  {
    phrases: ['camera 5', 'camera five', 'view 5', 'view five'],
    key: '6',
    keyCode: 22,
    description: 'Camera view 5',
    priority: 1
  },
  {
    phrases: ['camera 6', 'camera six', 'view 6', 'view six'],
    key: '7',
    keyCode: 26,
    description: 'Camera view 6',
    priority: 1
  },
  {
    phrases: ['camera 7', 'camera seven', 'view 7', 'view seven'],
    key: '8',
    keyCode: 28,
    description: 'Camera view 7',
    priority: 1
  },
  {
    phrases: ['camera 8', 'camera eight', 'view 8', 'view eight'],
    key: '9',
    keyCode: 25,
    description: 'Camera view 8',
    priority: 1
  },
  {
    phrases: ['camera 9', 'camera nine', 'view 9', 'view nine', 'drone view', 'drone'],
    key: '0',
    keyCode: 29,
    description: 'Camera view 9 (drone)',
    priority: 1
  },

  // PRIORITY 2 - TRAINING COMMANDS
  {
    phrases: ['u turn', 'u-turn', 'turn around', 'reverse', 'go back', 'uturn'],
    key: 'down',
    keyCode: 125,
    description: 'U-Turn',
    priority: 2
  },
  {
    phrases: ['screenshot', 'take picture', 'capture', 'photo', 'take photo', 'snap'],
    key: 'f10',
    keyCode: 109,
    description: 'Take screenshot',
    priority: 2
  },
  {
    phrases: ['wave', 'say hi', 'hello', 'hi there'],
    key: '5',
    keyCode: 23,
    description: 'Wave',
    priority: 2
  },
  {
    phrases: ['ride on', 'rideon', 'ride-on', 'thumbs up'],
    key: '6',
    keyCode: 22,
    description: 'Ride On!',
    priority: 2
  },
  {
    phrases: ['hammer', 'hammer time', 'hammertime'],
    key: '7',
    keyCode: 26,
    description: 'Hammer time',
    priority: 2
  },
  {
    phrases: ['toast', 'cheers', 'drink'],
    key: '8',
    keyCode: 28,
    description: 'Toast',
    priority: 2
  },
  {
    phrases: ['nice', 'nice one', 'good job'],
    key: '9',
    keyCode: 25,
    description: 'Nice!',
    priority: 2
  },
  {
    phrases: ['bring it', 'bring it on', 'lets go', "let's go"],
    key: '0',
    keyCode: 29,
    description: 'Bring it!',
    priority: 2
  },
  {
    phrases: ['skip', 'skip block', 'next block', 'skip workout'],
    key: 'tab',
    keyCode: 48,
    description: 'Skip workout block',
    priority: 2
  },
  {
    phrases: ['easier', 'bias down', 'reduce', 'lower'],
    key: 'pagedown',
    keyCode: 121,
    description: 'Decrease difficulty',
    priority: 2
  },
  {
    phrases: ['harder', 'bias up', 'increase', 'raise'],
    key: 'pageup',
    keyCode: 116,
    description: 'Increase difficulty',
    priority: 2
  },

  // PRIORITY 3 - CONVENIENCE
  {
    phrases: ['menu', 'show menu', 'customize', 'change gear', 'garage', 'pause'],
    key: 'escape',
    keyCode: 53,
    description: 'Open menu',
    priority: 3
  },
  {
    phrases: ['panoramic view', 'wide view', 'panoramic', 'pan view'],
    key: '0',
    keyCode: 29,
    description: 'Panoramic view',
    priority: 3
  },
  {
    phrases: ['graph', 'show graph', 'toggle graph', 'stats'],
    key: 'g',
    keyCode: 5,
    description: 'Toggle graph',
    priority: 3
  },
  {
    phrases: ['hide', 'hide ui', 'clean view', 'minimal'],
    key: 'h',
    keyCode: 4,
    description: 'Hide UI',
    priority: 3
  },
  {
    phrases: ['fan up', 'increase fan', 'more fan'],
    key: 'pageup',
    keyCode: 116,
    description: 'Fan speed up',
    priority: 3
  },
  {
    phrases: ['fan down', 'decrease fan', 'less fan'],
    key: 'pagedown',
    keyCode: 121,
    description: 'Fan speed down',
    priority: 3
  }
];

/**
 * Voice Recognition class using Web Speech API
 */
class VoiceRecognition extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      confidenceThreshold: 0.75,
      trainerMode: false,           // Higher threshold for noisy environments
      trainerModeThreshold: 0.80,
      lowConfidenceThreshold: 0.65, // Show "did you mean?" for this range
      maxAlternatives: 3,
      ...options
    };

    this._isListening = false;
    this.recognition = null;
    this.lastConfidence = 0;
    this.lastTranscript = '';
    this.commandLog = [];
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartDelay = 1000;
  }

  /**
   * Get current confidence threshold based on trainer mode
   */
  getThreshold() {
    return this.options.trainerMode
      ? this.options.trainerModeThreshold
      : this.options.confidenceThreshold;
  }

  /**
   * Set confidence threshold
   * @param {number} threshold - Value between 0.5 and 0.95
   */
  setThreshold(threshold) {
    this.options.confidenceThreshold = Math.max(0.5, Math.min(0.95, threshold));
  }

  /**
   * Toggle trainer mode (higher threshold)
   * @param {boolean} enabled
   */
  setTrainerMode(enabled) {
    this.options.trainerMode = enabled;
    console.log(`Trainer mode ${enabled ? 'enabled' : 'disabled'} (threshold: ${this.getThreshold()})`);
  }

  /**
   * Check if Web Speech API is available
   * @returns {boolean}
   */
  isSupported() {
    return typeof window !== 'undefined' &&
           ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }

  /**
   * Initialize the voice recognition engine
   * @returns {boolean} - Success status
   */
  initialize() {
    if (!this.isSupported()) {
      console.error('Web Speech API not supported in this environment');
      this.emit('error', new Error('Speech recognition not supported'));
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition
    this.recognition.continuous = this.options.continuous;
    this.recognition.interimResults = this.options.interimResults;
    this.recognition.lang = this.options.language;
    this.recognition.maxAlternatives = this.options.maxAlternatives;

    // Set up event handlers
    this.recognition.onstart = () => {
      this._isListening = true;
      this.restartAttempts = 0;
      console.log('Voice recognition started');
      this.emit('start');
    };

    this.recognition.onend = () => {
      console.log('Voice recognition ended');

      // Auto-restart if we should still be listening
      if (this._isListening) {
        this._attemptRestart();
      } else {
        this.emit('stop');
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);

      // Handle specific errors
      if (event.error === 'no-speech') {
        // No speech detected, this is normal - just restart
        if (this._isListening) {
          this._attemptRestart();
        }
        return;
      }

      if (event.error === 'audio-capture') {
        this.emit('error', new Error('No microphone found. Please check your audio settings.'));
        this._isListening = false;
        return;
      }

      if (event.error === 'not-allowed') {
        this.emit('error', new Error('Microphone access denied. Please grant permission in System Preferences.'));
        this._isListening = false;
        return;
      }

      this.emit('error', new Error(`Speech recognition error: ${event.error}`));

      // Try to restart on other errors
      if (this._isListening) {
        this._attemptRestart();
      }
    };

    this.recognition.onresult = (event) => {
      this._handleResult(event);
    };

    console.log('Voice recognition initialized');
    return true;
  }

  /**
   * Attempt to restart recognition after disconnect/error
   * @private
   */
  _attemptRestart() {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('Max restart attempts reached, stopping voice recognition');
      this._isListening = false;
      this.emit('error', new Error('Voice recognition disconnected. Please restart manually.'));
      this.emit('stop');
      return;
    }

    this.restartAttempts++;
    const delay = this.restartDelay * this.restartAttempts;

    console.log(`Restarting voice recognition (attempt ${this.restartAttempts}/${this.maxRestartAttempts}) in ${delay}ms`);

    setTimeout(() => {
      if (this._isListening && this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          console.error('Failed to restart:', e);
          this._attemptRestart();
        }
      }
    }, delay);
  }

  /**
   * Handle speech recognition result
   * @param {SpeechRecognitionEvent} event
   * @private
   */
  _handleResult(event) {
    const result = event.results[event.results.length - 1];

    if (!result.isFinal) {
      // Emit interim results for real-time feedback
      const interimTranscript = result[0].transcript;
      this.emit('interim', { transcript: interimTranscript });
      return;
    }

    // Get final result with highest confidence
    let bestTranscript = result[0].transcript;
    let bestConfidence = result[0].confidence;

    // Check alternatives for better matches
    for (let i = 1; i < result.length; i++) {
      if (result[i].confidence > bestConfidence) {
        bestTranscript = result[i].transcript;
        bestConfidence = result[i].confidence;
      }
    }

    this.lastTranscript = bestTranscript;
    this.lastConfidence = bestConfidence;

    // Log all recognized text for improvement
    const logEntry = {
      timestamp: new Date(),
      transcript: bestTranscript,
      confidence: bestConfidence,
      matched: null
    };

    // Convert spoken numbers and normalize
    const normalizedTranscript = convertSpokenNumbers(bestTranscript.toLowerCase().trim());

    console.log(`Heard: "${bestTranscript}" (confidence: ${(bestConfidence * 100).toFixed(1)}%)`);

    // Try to match a command
    const matchResult = this._matchCommand(normalizedTranscript, bestConfidence);

    if (matchResult) {
      logEntry.matched = matchResult.command.description;

      if (matchResult.isLowConfidence) {
        // Low confidence - suggest but don't execute
        this.emit('lowConfidence', {
          transcript: bestTranscript,
          normalizedTranscript,
          confidence: bestConfidence,
          suggestedCommand: matchResult.command,
          matchedPhrase: matchResult.matchedPhrase
        });
      } else {
        // Good confidence - execute command
        this.emit('command', {
          transcript: bestTranscript,
          normalizedTranscript,
          confidence: bestConfidence,
          command: matchResult.command,
          matchedPhrase: matchResult.matchedPhrase
        });
      }
    } else {
      // No match found
      this.emit('noMatch', {
        transcript: bestTranscript,
        normalizedTranscript,
        confidence: bestConfidence
      });
    }

    this.commandLog.unshift(logEntry);
    if (this.commandLog.length > 50) {
      this.commandLog.pop();
    }
  }

  /**
   * Match transcript to a voice command
   * @param {string} transcript - Normalized transcript
   * @param {number} confidence - Recognition confidence
   * @returns {object|null} - Match result or null
   * @private
   */
  _matchCommand(transcript, confidence) {
    const threshold = this.getThreshold();
    const lowThreshold = this.options.lowConfidenceThreshold;

    // Check if confidence is too low even for suggestions
    if (confidence < lowThreshold) {
      return null;
    }

    let bestMatch = null;
    let bestScore = Infinity;
    let isLowConfidence = confidence < threshold;

    // Sort commands by priority
    const sortedCommands = [...VOICE_COMMANDS].sort((a, b) => a.priority - b.priority);

    for (const command of sortedCommands) {
      for (const phrase of command.phrases) {
        // Exact match
        if (transcript === phrase) {
          return {
            command,
            matchedPhrase: phrase,
            isLowConfidence,
            score: 0
          };
        }

        // Contains match
        if (transcript.includes(phrase) || phrase.includes(transcript)) {
          const score = Math.abs(transcript.length - phrase.length);
          if (score < bestScore) {
            bestScore = score;
            bestMatch = { command, matchedPhrase: phrase, isLowConfidence, score };
          }
        }

        // Fuzzy match using Levenshtein distance
        const distance = levenshteinDistance(transcript, phrase);
        const maxDistance = Math.max(2, Math.floor(phrase.length * 0.3)); // Allow ~30% error

        if (distance <= maxDistance && distance < bestScore) {
          bestScore = distance;
          bestMatch = { command, matchedPhrase: phrase, isLowConfidence, score: distance };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Start listening for voice commands
   * @returns {boolean} - Success status
   */
  start() {
    if (this._isListening) {
      console.warn('Voice recognition already running');
      return false;
    }

    if (!this.recognition) {
      if (!this.initialize()) {
        return false;
      }
    }

    try {
      this._isListening = true;
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      this._isListening = false;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stop listening for voice commands
   * @returns {boolean} - Success status
   */
  stop() {
    if (!this._isListening) {
      console.warn('Voice recognition not running');
      return false;
    }

    this._isListening = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }

    console.log('Voice recognition stopped');
    this.emit('stop');
    return true;
  }

  /**
   * Check if voice recognition is currently active
   * @returns {boolean}
   */
  isListening() {
    return this._isListening;
  }

  /**
   * Get last recognition confidence
   * @returns {number}
   */
  getLastConfidence() {
    return this.lastConfidence;
  }

  /**
   * Get last recognized transcript
   * @returns {string}
   */
  getLastTranscript() {
    return this.lastTranscript;
  }

  /**
   * Get command log
   * @returns {Array}
   */
  getCommandLog() {
    return this.commandLog;
  }

  /**
   * Get all available voice commands
   * @returns {Array}
   */
  getCommands() {
    return VOICE_COMMANDS;
  }

  /**
   * Simulate a voice command (for testing)
   * @param {string} transcript - The text to simulate
   * @param {number} confidence - Simulated confidence (default: 0.95)
   */
  simulateCommand(transcript, confidence = 0.95) {
    console.log(`Simulating voice command: "${transcript}" (confidence: ${confidence})`);

    const normalizedTranscript = convertSpokenNumbers(transcript.toLowerCase().trim());
    const matchResult = this._matchCommand(normalizedTranscript, confidence);

    if (matchResult && !matchResult.isLowConfidence) {
      this.emit('command', {
        transcript,
        normalizedTranscript,
        confidence,
        command: matchResult.command,
        matchedPhrase: matchResult.matchedPhrase
      });
    } else if (matchResult) {
      this.emit('lowConfidence', {
        transcript,
        normalizedTranscript,
        confidence,
        suggestedCommand: matchResult.command,
        matchedPhrase: matchResult.matchedPhrase
      });
    } else {
      this.emit('noMatch', {
        transcript,
        normalizedTranscript,
        confidence
      });
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get the voice recognition instance
 * @param {object} options - Configuration options
 * @returns {VoiceRecognition}
 */
function getInstance(options = {}) {
  if (!instance) {
    instance = new VoiceRecognition(options);
  }
  return instance;
}

// Export class and convenience methods
module.exports = {
  VoiceRecognition,
  getInstance,
  VOICE_COMMANDS,
  start: () => getInstance().start(),
  stop: () => getInstance().stop(),
  isListening: () => getInstance().isListening(),
  getLastConfidence: () => getInstance().getLastConfidence(),
  getLastTranscript: () => getInstance().getLastTranscript(),
  simulateCommand: (cmd, conf) => getInstance().simulateCommand(cmd, conf),
  setThreshold: (t) => getInstance().setThreshold(t),
  setTrainerMode: (enabled) => getInstance().setTrainerMode(enabled),
  on: (event, callback) => getInstance().on(event, callback),
  off: (event, callback) => getInstance().off(event, callback),
  getCommands: () => getInstance().getCommands()
};
