/**
 * Renderer process - UI logic for settings window
 * Includes voice recognition using Web Speech API
 */

// Import voice recognition module (runs in renderer for Web Speech API access)
const { VoiceRecognition } = require('./voice');

// Voice recognition instance
let voiceRecognition = null;

// DOM Elements
const statusIndicator = document.getElementById('status-indicator');
const toggleBtn = document.getElementById('toggle-btn');
const commandsList = document.getElementById('commands-list');
const commandLog = document.getElementById('command-log');
const testResult = document.getElementById('test-result');
const audioLevel = document.getElementById('audio-level');

// Voice feedback elements
const voiceHeard = document.getElementById('voice-heard');
const voiceMatched = document.getElementById('voice-matched');
const voiceInterim = document.getElementById('voice-interim');
const confidenceBadge = document.getElementById('confidence-badge');
const lowConfidenceWarning = document.getElementById('low-confidence-warning');
const suggestedCommand = document.getElementById('suggested-command');

// Permission elements
const micPermissionIcon = document.getElementById('mic-permission-icon');
const micPermissionBtn = document.getElementById('mic-permission-btn');
const accessibilityPermissionIcon = document.getElementById('accessibility-permission-icon');
const accessibilityPermissionBtn = document.getElementById('accessibility-permission-btn');
const recheckPermissionsBtn = document.getElementById('recheck-permissions-btn');

// Settings elements
const launchStartup = document.getElementById('launch-startup');
const showNotifications = document.getElementById('show-notifications');
const trainerMode = document.getElementById('trainer-mode');
const confidenceSlider = document.getElementById('confidence-slider');
const thresholdValue = document.getElementById('threshold-value');
const testVoiceInput = document.getElementById('test-voice-input');
const testVoiceBtn = document.getElementById('test-voice-btn');

// Command filter buttons
const filterBtns = document.querySelectorAll('.filter-btn');

// State
let isListening = false;
let voiceCommands = [];
const commandHistory = [];
const MAX_LOG_ENTRIES = 15;
let currentFilter = 'all';

/**
 * Initialize the UI
 */
async function initialize() {
  // Initialize voice recognition
  initializeVoiceRecognition();

  // Get initial listening state
  isListening = await window.electronAPI.getListeningState();
  updateStatusUI();

  // Load voice commands
  await loadVoiceCommands();

  // Set up event listeners
  setupEventListeners();

  // Listen for state changes from main process
  window.electronAPI.onListeningStateChanged((state) => {
    if (state && !isListening) {
      startVoiceRecognition();
    } else if (!state && isListening) {
      stopVoiceRecognition();
    }
  });

  // Listen for permission status updates
  window.electronAPI.onPermissionStatus((status) => {
    updatePermissionUI(status);
  });

  // Check initial permission status
  const permissionStatus = await window.electronAPI.getPermissionStatus();
  updatePermissionUI(permissionStatus);

  // Load saved settings
  loadSettings();

  console.log('Zwift Voice Control UI initialized');
}

/**
 * Update permission UI based on status
 */
function updatePermissionUI(status) {
  // Microphone permission
  if (status.microphone === 'granted') {
    micPermissionIcon.textContent = '✅';
    micPermissionBtn.textContent = 'Granted';
    micPermissionBtn.disabled = true;
    micPermissionBtn.classList.add('granted');
  } else if (status.microphone === 'denied') {
    micPermissionIcon.textContent = '❌';
    micPermissionBtn.textContent = 'Open Settings';
    micPermissionBtn.disabled = false;
    micPermissionBtn.classList.remove('granted');
  } else {
    micPermissionIcon.textContent = '⏳';
    micPermissionBtn.textContent = 'Grant Access';
    micPermissionBtn.disabled = false;
    micPermissionBtn.classList.remove('granted');
  }

  // Accessibility permission
  if (status.accessibility === 'granted') {
    accessibilityPermissionIcon.textContent = '✅';
    accessibilityPermissionBtn.textContent = 'Granted';
    accessibilityPermissionBtn.disabled = true;
    accessibilityPermissionBtn.classList.add('granted');
  } else {
    accessibilityPermissionIcon.textContent = '❌';
    accessibilityPermissionBtn.textContent = 'Open Settings';
    accessibilityPermissionBtn.disabled = false;
    accessibilityPermissionBtn.classList.remove('granted');
  }
}

/**
 * Initialize Web Speech API voice recognition
 */
function initializeVoiceRecognition() {
  voiceRecognition = new VoiceRecognition({
    language: 'en-US',
    continuous: true,
    interimResults: true,
    confidenceThreshold: 0.75
  });

  // Handle recognized commands
  voiceRecognition.on('command', async (data) => {
    console.log('Voice command:', data);

    // Update UI
    updateVoiceFeedback(data.transcript, data.command.description, data.confidence);
    highlightCommand(data.command);
    addLogEntry(data, true);

    // Hide low confidence warning
    lowConfidenceWarning.classList.remove('visible');

    // Execute the command via main process
    const success = await window.electronAPI.executeCommand(data.command.key);
    console.log(`Command executed: ${success}`);
  });

  // Handle interim results
  voiceRecognition.on('interim', (data) => {
    voiceInterim.textContent = `"${data.transcript}"...`;
  });

  // Handle low confidence results
  voiceRecognition.on('lowConfidence', (data) => {
    console.log('Low confidence:', data);

    updateVoiceFeedback(data.transcript, null, data.confidence);

    // Show suggestion
    suggestedCommand.textContent = data.suggestedCommand.description;
    lowConfidenceWarning.classList.add('visible');

    addLogEntry({
      transcript: data.transcript,
      command: data.suggestedCommand,
      confidence: data.confidence,
      isLowConfidence: true
    }, false);
  });

  // Handle no match
  voiceRecognition.on('noMatch', (data) => {
    console.log('No match:', data);

    updateVoiceFeedback(data.transcript, 'No match', data.confidence);
    lowConfidenceWarning.classList.remove('visible');
  });

  // Handle errors
  voiceRecognition.on('error', (error) => {
    console.error('Voice recognition error:', error);
    testResult.textContent = error.message;
    testResult.className = 'test-note error';
  });

  // Handle start/stop
  voiceRecognition.on('start', () => {
    audioLevel.classList.add('active');
  });

  voiceRecognition.on('stop', () => {
    audioLevel.classList.remove('active');
    voiceInterim.textContent = '';
  });
}

/**
 * Start voice recognition
 */
function startVoiceRecognition() {
  if (!voiceRecognition) {
    initializeVoiceRecognition();
  }

  isListening = true;
  updateStatusUI();

  // Apply current settings
  const threshold = confidenceSlider.value / 100;
  voiceRecognition.setThreshold(threshold);
  voiceRecognition.setTrainerMode(trainerMode.checked);

  voiceRecognition.start();
}

/**
 * Stop voice recognition
 */
function stopVoiceRecognition() {
  isListening = false;
  updateStatusUI();

  if (voiceRecognition) {
    voiceRecognition.stop();
  }

  // Clear interim display
  voiceInterim.textContent = '';
}

/**
 * Update voice feedback display
 */
function updateVoiceFeedback(heard, matched, confidence) {
  voiceHeard.textContent = `"${heard}"`;
  voiceMatched.textContent = matched || '--';
  voiceInterim.textContent = '';

  // Update confidence badge
  const confPercent = Math.round(confidence * 100);
  confidenceBadge.textContent = `${confPercent}%`;

  // Set badge color based on confidence
  confidenceBadge.classList.remove('high', 'medium', 'low');
  if (confidence >= 0.75) {
    confidenceBadge.classList.add('high');
  } else if (confidence >= 0.65) {
    confidenceBadge.classList.add('medium');
  } else {
    confidenceBadge.classList.add('low');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Toggle listening button
  toggleBtn.addEventListener('click', () => {
    if (isListening) {
      stopVoiceRecognition();
      window.electronAPI.stopListening();
    } else {
      startVoiceRecognition();
      window.electronAPI.startListening();
    }
  });

  // Test keyboard buttons
  document.querySelectorAll('.test-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      testResult.textContent = `Sending ${key}...`;
      testResult.className = 'test-note';

      const success = await window.electronAPI.testKeyboard(key);

      if (success) {
        testResult.textContent = `Sent ${key} successfully!`;
        testResult.className = 'test-note success';
      } else {
        testResult.textContent = `Failed to send ${key}. Check Accessibility permissions.`;
        testResult.className = 'test-note error';
      }

      setTimeout(() => {
        testResult.textContent = '';
        testResult.className = 'test-note';
      }, 3000);
    });
  });

  // Test voice input
  testVoiceBtn.addEventListener('click', () => {
    const text = testVoiceInput.value.trim();
    if (text && voiceRecognition) {
      voiceRecognition.simulateCommand(text, 0.95);
      testVoiceInput.value = '';
    }
  });

  testVoiceInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      testVoiceBtn.click();
    }
  });

  // Command filter buttons
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.priority;
      filterCommands(currentFilter);
    });
  });

  // Trainer mode toggle
  trainerMode.addEventListener('change', () => {
    const enabled = trainerMode.checked;
    if (voiceRecognition) {
      voiceRecognition.setTrainerMode(enabled);
    }
    window.electronAPI.setTrainerMode(enabled);

    // Update slider to show trainer mode threshold
    if (enabled) {
      confidenceSlider.value = 80;
      thresholdValue.textContent = '80%';
    }

    saveSettings();
  });

  // Confidence threshold slider
  confidenceSlider.addEventListener('input', () => {
    const value = confidenceSlider.value;
    thresholdValue.textContent = `${value}%`;

    if (voiceRecognition) {
      voiceRecognition.setThreshold(value / 100);
    }
    window.electronAPI.setConfidenceThreshold(value / 100);
  });

  confidenceSlider.addEventListener('change', () => {
    saveSettings();
  });

  // General settings
  launchStartup.addEventListener('change', saveSettings);
  showNotifications.addEventListener('change', saveSettings);

  // Permission buttons
  micPermissionBtn.addEventListener('click', async () => {
    const status = await window.electronAPI.getPermissionStatus();
    if (status.microphone === 'denied') {
      window.electronAPI.openMicrophoneSettings();
    } else {
      await window.electronAPI.requestMicrophonePermission();
      // Recheck after a short delay
      setTimeout(async () => {
        const newStatus = await window.electronAPI.checkPermissions();
        updatePermissionUI(newStatus);
      }, 500);
    }
  });

  accessibilityPermissionBtn.addEventListener('click', () => {
    window.electronAPI.openAccessibilitySettings();
  });

  recheckPermissionsBtn.addEventListener('click', async () => {
    recheckPermissionsBtn.textContent = 'Checking...';
    recheckPermissionsBtn.disabled = true;
    const status = await window.electronAPI.checkPermissions();
    updatePermissionUI(status);
    recheckPermissionsBtn.textContent = 'Re-check Permissions';
    recheckPermissionsBtn.disabled = false;
  });
}

/**
 * Update the status indicator and button
 */
function updateStatusUI() {
  if (isListening) {
    statusIndicator.classList.add('listening');
    statusIndicator.querySelector('.status-text').textContent = 'Listening...';
    toggleBtn.innerHTML = '<span class="btn-icon">🎤</span> Stop Listening';
    toggleBtn.classList.add('listening');
    audioLevel.classList.add('active');
  } else {
    statusIndicator.classList.remove('listening');
    statusIndicator.querySelector('.status-text').textContent = 'Not Listening';
    toggleBtn.innerHTML = '<span class="btn-icon">🎤</span> Start Listening';
    toggleBtn.classList.remove('listening');
    audioLevel.classList.remove('active');
  }
}

/**
 * Load and display voice commands
 */
async function loadVoiceCommands() {
  try {
    voiceCommands = await window.electronAPI.getVoiceCommands();
  } catch (e) {
    console.error('Failed to load voice commands:', e);
    voiceCommands = [];
  }

  renderCommands();
}

/**
 * Render commands list
 */
function renderCommands() {
  if (!voiceCommands || voiceCommands.length === 0) {
    commandsList.innerHTML = '<div class="log-empty">No commands available</div>';
    return;
  }

  // Sort by priority then description
  const sortedCommands = [...voiceCommands].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.description.localeCompare(b.description);
  });

  commandsList.innerHTML = sortedCommands
    .map((cmd) => {
      const mainPhrase = cmd.phrases[0];
      const priorityLabel = cmd.priority === 1 ? 'Racing' : cmd.priority === 2 ? 'Training' : 'Other';

      return `
        <div class="command-item" data-phrase="${mainPhrase}" data-key="${cmd.key}" data-priority="${cmd.priority}">
          <span class="command-phrase">"${mainPhrase}"<span class="command-priority p${cmd.priority}">${priorityLabel}</span></span>
          <span class="command-key">${formatKey(cmd.key)}</span>
        </div>
      `;
    })
    .join('');

  filterCommands(currentFilter);
}

/**
 * Filter commands by priority
 */
function filterCommands(priority) {
  const items = document.querySelectorAll('.command-item');
  items.forEach((item) => {
    if (priority === 'all' || item.dataset.priority === priority) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}

/**
 * Format key name for display
 */
function formatKey(key) {
  const keyMap = {
    space: 'Space',
    escape: 'Esc',
    tab: 'Tab',
    left: '←',
    right: '→',
    down: '↓',
    up: '↑',
    pageup: 'PgUp',
    pagedown: 'PgDn',
    f10: 'F10'
  };
  return keyMap[key.toLowerCase()] || key.toUpperCase();
}

/**
 * Highlight a command in the commands list when recognized
 */
function highlightCommand(command) {
  const commandItems = document.querySelectorAll('.command-item');
  let matchedItem = null;

  // Find by key match
  commandItems.forEach((item) => {
    if (item.dataset.key === command.key) {
      matchedItem = item;
    }
  });

  if (matchedItem) {
    // Remove any existing highlights
    commandItems.forEach((item) => {
      item.classList.remove('highlighted', 'flash');
    });

    // Scroll the item into view
    matchedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add highlight class
    matchedItem.classList.add('highlighted');

    // After a short delay, switch to flash animation
    setTimeout(() => {
      matchedItem.classList.remove('highlighted');
      matchedItem.classList.add('flash');

      setTimeout(() => {
        matchedItem.classList.remove('flash');
      }, 1500);
    }, 500);
  }
}

/**
 * Add an entry to the command log
 */
function addLogEntry(data, success = true) {
  const entry = {
    command: data.command?.description || 'Unknown',
    transcript: data.transcript,
    confidence: data.confidence,
    success,
    isLowConfidence: data.isLowConfidence || false,
    time: new Date()
  };

  commandHistory.unshift(entry);

  // Keep only last N entries
  if (commandHistory.length > MAX_LOG_ENTRIES) {
    commandHistory.pop();
  }

  updateLogUI();
}

/**
 * Update the command log display
 */
function updateLogUI() {
  if (commandHistory.length === 0) {
    commandLog.innerHTML = '<div class="log-empty">No commands received yet</div>';
    return;
  }

  commandLog.innerHTML = commandHistory
    .map((entry) => {
      const confPercent = Math.round(entry.confidence * 100);
      const confClass = entry.confidence >= 0.75 ? 'high' : 'medium';
      const entryClass = entry.isLowConfidence ? 'low-conf' : entry.success ? 'success' : 'error';

      return `
        <div class="log-entry ${entryClass}">
          <div class="log-entry-left">
            <span class="log-command">${entry.command}</span>
            <span class="log-heard">"${entry.transcript}"</span>
          </div>
          <div class="log-entry-right">
            <span class="log-time">${formatTime(entry.time)}</span>
            <span class="log-confidence ${confClass}">${confPercent}%</span>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Load saved settings from localStorage
 */
function loadSettings() {
  try {
    const settings = JSON.parse(localStorage.getItem('zwiftVoiceSettings') || '{}');

    launchStartup.checked = settings.launchStartup || false;
    showNotifications.checked = settings.showNotifications !== false;
    trainerMode.checked = settings.trainerMode || false;

    const threshold = settings.confidenceThreshold || 75;
    confidenceSlider.value = threshold;
    thresholdValue.textContent = `${threshold}%`;

    // Apply to voice recognition
    if (voiceRecognition) {
      voiceRecognition.setThreshold(threshold / 100);
      voiceRecognition.setTrainerMode(settings.trainerMode || false);
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  const settings = {
    launchStartup: launchStartup.checked,
    showNotifications: showNotifications.checked,
    trainerMode: trainerMode.checked,
    confidenceThreshold: parseInt(confidenceSlider.value, 10)
  };

  try {
    localStorage.setItem('zwiftVoiceSettings', JSON.stringify(settings));
    console.log('Settings saved:', settings);
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);

// Cleanup on unload
window.addEventListener('unload', () => {
  if (voiceRecognition && isListening) {
    voiceRecognition.stop();
  }
  window.electronAPI.removeAllListeners();
});
