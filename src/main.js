const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, systemPreferences, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');

// Permission status
let permissionStatus = {
  microphone: 'unknown',
  accessibility: 'unknown'
};

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// Keep references to prevent garbage collection
let tray = null;
let settingsWindow = null;
let isListening = false;

// Voice settings
let voiceSettings = {
  confidenceThreshold: 0.75,
  trainerMode: false,
  trainerModeThreshold: 0.80,
  lowConfidenceThreshold: 0.65
};

// Import modules (will be initialized after app is ready)
let keyboard = null;

/**
 * Check microphone permission status
 * @returns {Promise<string>} - 'granted', 'denied', or 'not-determined'
 */
async function checkMicrophonePermission() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    return status;
  }
  return 'granted'; // Assume granted on other platforms
}

/**
 * Request microphone permission
 * @returns {Promise<boolean>} - true if granted
 */
async function requestMicrophonePermission() {
  if (process.platform === 'darwin') {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    permissionStatus.microphone = granted ? 'granted' : 'denied';
    return granted;
  }
  return true;
}

/**
 * Check accessibility permission (needed for keyboard simulation)
 * @returns {Promise<boolean>} - true if granted
 */
async function checkAccessibilityPermission() {
  if (process.platform === 'darwin') {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false);
    permissionStatus.accessibility = trusted ? 'granted' : 'denied';
    return trusted;
  }
  return true;
}

/**
 * Prompt user to enable accessibility permission
 * Opens System Preferences to the correct pane
 */
function promptAccessibilityPermission() {
  if (process.platform === 'darwin') {
    // This will show the system prompt asking for accessibility access
    const trusted = systemPreferences.isTrustedAccessibilityClient(true);
    if (!trusted) {
      // Open System Preferences to Accessibility
      exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"');
    }
    return trusted;
  }
  return true;
}

/**
 * Check all required permissions and prompt if needed
 */
async function checkAndRequestPermissions() {
  console.log('Checking permissions...');

  // Check microphone permission
  const micStatus = await checkMicrophonePermission();
  console.log(`Microphone permission: ${micStatus}`);
  permissionStatus.microphone = micStatus;

  if (micStatus === 'not-determined') {
    // Request microphone access - this will show the system dialog
    console.log('Requesting microphone permission...');
    const granted = await requestMicrophonePermission();
    console.log(`Microphone permission ${granted ? 'granted' : 'denied'}`);
  } else if (micStatus === 'denied') {
    // Show dialog explaining how to fix
    dialog.showMessageBox({
      type: 'warning',
      title: 'Microphone Access Required',
      message: 'Zwift Voice Control needs microphone access for voice commands.',
      detail: 'Please enable microphone access in System Preferences > Security & Privacy > Privacy > Microphone',
      buttons: ['Open System Preferences', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
      }
    });
  }

  // Check accessibility permission
  const accessibilityGranted = await checkAccessibilityPermission();
  console.log(`Accessibility permission: ${accessibilityGranted ? 'granted' : 'denied'}`);

  if (!accessibilityGranted) {
    // Show dialog explaining why we need it
    dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Access Required',
      message: 'Zwift Voice Control needs Accessibility access to send keyboard commands to Zwift.',
      detail: 'Click "Open System Preferences" to grant access. You may need to click the lock icon and add this app to the list.',
      buttons: ['Open System Preferences', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        promptAccessibilityPermission();
      }
    });
  }

  // Notify renderer of permission status
  if (settingsWindow) {
    settingsWindow.webContents.send('permission-status', permissionStatus);
  }

  return {
    microphone: permissionStatus.microphone === 'granted',
    accessibility: permissionStatus.accessibility === 'granted'
  };
}

/**
 * Create the settings window (hidden by default)
 * This window also handles voice recognition via Web Speech API
 */
function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 780,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Zwift Voice Control - Settings',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'index.html'));

  // Hide window instead of closing
  settingsWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });

  // Prevent window from appearing in dock when hidden
  settingsWindow.on('hide', () => {
    if (process.platform === 'darwin') {
      app.dock.hide();
    }
  });

  settingsWindow.on('show', () => {
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });
}

/**
 * Get the appropriate tray icon based on listening state
 */
function getTrayIcon(listening = false) {
  const iconName = listening ? 'icon-listening.png' : 'icon.png';
  const iconPath = path.join(__dirname, '..', 'assets', iconName);

  let icon = nativeImage.createFromPath(iconPath);

  // Resize for macOS menu bar (16x16 or 18x18 is standard)
  if (!icon.isEmpty()) {
    icon = icon.resize({ width: 18, height: 18 });
  } else {
    // Fallback: create a simple colored icon if file doesn't exist
    icon = createFallbackIcon(listening);
  }

  // Mark as template image for macOS dark mode support
  icon.setTemplateImage(true);

  return icon;
}

/**
 * Create a simple fallback icon if assets don't exist
 */
function createFallbackIcon(listening = false) {
  // Create a simple 18x18 icon
  const size = 18;
  const canvas = Buffer.alloc(size * size * 4);

  // Fill with color based on state
  const color = listening ? [0, 200, 100, 255] : [100, 100, 100, 255]; // Green if listening, gray otherwise

  for (let i = 0; i < size * size; i++) {
    // Create a simple circle shape
    const x = i % size;
    const y = Math.floor(i / size);
    const centerX = size / 2;
    const centerY = size / 2;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

    if (distance < size / 2 - 2) {
      canvas[i * 4] = color[0];     // R
      canvas[i * 4 + 1] = color[1]; // G
      canvas[i * 4 + 2] = color[2]; // B
      canvas[i * 4 + 3] = color[3]; // A
    } else {
      canvas[i * 4 + 3] = 0; // Transparent
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

/**
 * Build the tray context menu
 */
function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Zwift Voice Control',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open Settings',
      click: () => {
        if (settingsWindow) {
          settingsWindow.show();
          settingsWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: isListening ? '● Listening...' : 'Start Listening',
      click: () => {
        if (!isListening) {
          startListening();
        }
      },
      enabled: !isListening
    },
    {
      label: 'Stop Listening',
      click: () => {
        if (isListening) {
          stopListening();
        }
      },
      enabled: isListening
    },
    { type: 'separator' },
    {
      label: voiceSettings.trainerMode ? '✓ Trainer Mode (High Noise)' : 'Trainer Mode (High Noise)',
      click: () => {
        voiceSettings.trainerMode = !voiceSettings.trainerMode;
        updateTrayState();
        if (settingsWindow) {
          settingsWindow.webContents.send('voice-settings-changed', voiceSettings);
        }
      }
    },
    {
      label: keyboard && keyboard.isTestMode() ? '✓ Test Mode (No Keystrokes)' : 'Test Mode (No Keystrokes)',
      click: () => {
        if (keyboard) {
          const newMode = !keyboard.isTestMode();
          keyboard.setTestMode(newMode);
          updateTrayState();
          if (settingsWindow) {
            settingsWindow.webContents.send('test-mode-changed', newMode);
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
}

/**
 * Create the system tray icon and menu
 */
function createTray() {
  const icon = getTrayIcon(false);
  tray = new Tray(icon);

  tray.setToolTip('Zwift Voice Control');
  tray.setContextMenu(buildTrayMenu());

  // Double-click to open settings (macOS)
  tray.on('double-click', () => {
    if (settingsWindow) {
      settingsWindow.show();
      settingsWindow.focus();
    }
  });
}

/**
 * Update tray icon and menu state
 */
function updateTrayState() {
  if (tray) {
    tray.setImage(getTrayIcon(isListening));
    tray.setContextMenu(buildTrayMenu());
    tray.setToolTip(isListening ? 'Zwift Voice Control (Listening)' : 'Zwift Voice Control');
  }
}

/**
 * Start voice recognition
 */
function startListening() {
  if (isListening) return;

  isListening = true;
  updateTrayState();

  // Notify renderer to start voice recognition
  if (settingsWindow) {
    settingsWindow.webContents.send('listening-state-changed', true);
  }

  console.log('Voice recognition started');
}

/**
 * Stop voice recognition
 */
function stopListening() {
  if (!isListening) return;

  isListening = false;
  updateTrayState();

  // Notify renderer to stop voice recognition
  if (settingsWindow) {
    settingsWindow.webContents.send('listening-state-changed', false);
  }

  console.log('Voice recognition stopped');
}

/**
 * Handle voice command - execute keyboard shortcut
 * @param {object} data - Command data from voice recognition
 */
async function handleVoiceCommand(data) {
  const { command, transcript, confidence, matchedPhrase } = data;

  console.log(`Voice command: "${matchedPhrase}" -> ${command.description} (${command.key})`);
  console.log(`  Heard: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

  // Execute keyboard command
  if (keyboard) {
    const result = await keyboard.pressKey(command.key);
    if (result) {
      console.log(`  Executed: ${command.key}`);
    } else {
      console.error(`  Failed to execute: ${command.key}`);
    }
  }

  // Notify renderer
  if (settingsWindow) {
    settingsWindow.webContents.send('voice-command', data);
  }
}

// IPC handlers for renderer communication
ipcMain.handle('get-listening-state', () => isListening);

ipcMain.on('start-listening', () => startListening());
ipcMain.on('stop-listening', () => stopListening());

ipcMain.on('toggle-listening', () => {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
});

// Keyboard testing
ipcMain.handle('test-keyboard', async (event, key) => {
  if (keyboard) {
    return keyboard.testKey(key);
  }
  return false;
});

// Execute a specific key
ipcMain.handle('execute-command', async (event, key) => {
  if (keyboard) {
    const result = await keyboard.simulateKey(key);
    // Send notification to renderer
    if (settingsWindow && result) {
      settingsWindow.webContents.send('command-executed', result);
    }
    return result;
  }
  return { success: false, error: 'Keyboard module not loaded' };
});

// Get keyboard commands
ipcMain.handle('get-commands', () => {
  if (keyboard) {
    return keyboard.getCommands();
  }
  return {};
});

// Test mode handlers
ipcMain.handle('get-test-mode', () => {
  if (keyboard) {
    return keyboard.isTestMode();
  }
  return false;
});

ipcMain.on('set-test-mode', (event, enabled) => {
  if (keyboard) {
    keyboard.setTestMode(enabled);
    console.log(`Test mode ${enabled ? 'enabled' : 'disabled'}`);
    // Update tray menu
    updateTrayState();
  }
});

// Notifications setting
ipcMain.handle('get-notifications-enabled', () => {
  if (keyboard) {
    return keyboard.areNotificationsEnabled();
  }
  return true;
});

ipcMain.on('set-notifications-enabled', (event, enabled) => {
  if (keyboard) {
    keyboard.setNotificationsEnabled(enabled);
  }
});

// Rate limit setting
ipcMain.handle('get-rate-limit', () => {
  if (keyboard) {
    return keyboard.getRateLimit();
  }
  return 300;
});

ipcMain.on('set-rate-limit', (event, ms) => {
  if (keyboard) {
    keyboard.setRateLimit(ms);
  }
});

// Get keyboard config
ipcMain.handle('get-keyboard-config', () => {
  if (keyboard) {
    return {
      config: keyboard.getConfig(),
      robotjsAvailable: keyboard.isRobotjsAvailable(),
      queueStatus: keyboard.getQueueStatus()
    };
  }
  return null;
});

// Get command history
ipcMain.handle('get-command-history', () => {
  if (keyboard) {
    return keyboard.getCommandHistory();
  }
  return [];
});

// Clear command history
ipcMain.on('clear-command-history', () => {
  if (keyboard) {
    keyboard.clearCommandHistory();
  }
});

// Get voice commands from voice.js
ipcMain.handle('get-voice-commands', () => {
  try {
    const { VOICE_COMMANDS } = require('./voice');
    return VOICE_COMMANDS;
  } catch (e) {
    console.error('Failed to load voice commands:', e);
    return [];
  }
});

// Voice settings
ipcMain.handle('get-voice-settings', () => voiceSettings);

ipcMain.on('set-confidence-threshold', (event, threshold) => {
  voiceSettings.confidenceThreshold = Math.max(0.5, Math.min(0.95, threshold));
  console.log(`Confidence threshold set to: ${voiceSettings.confidenceThreshold}`);
});

ipcMain.on('set-trainer-mode', (event, enabled) => {
  voiceSettings.trainerMode = enabled;
  updateTrayState();
  console.log(`Trainer mode: ${enabled ? 'enabled' : 'disabled'}`);
});

// Handle voice command from renderer (where Web Speech API runs)
ipcMain.on('voice-command-received', async (event, data) => {
  await handleVoiceCommand(data);
});

// Forward voice events to renderer (for UI updates)
ipcMain.on('voice-interim', (event, data) => {
  if (settingsWindow && settingsWindow !== event.sender) {
    settingsWindow.webContents.send('voice-interim', data);
  }
});

ipcMain.on('voice-low-confidence', (event, data) => {
  console.log(`Low confidence: "${data.transcript}" -> might be "${data.suggestedCommand?.description}"`);
  if (settingsWindow) {
    settingsWindow.webContents.send('voice-low-confidence', data);
  }
});

ipcMain.on('voice-no-match', (event, data) => {
  console.log(`No match: "${data.transcript}" (confidence: ${(data.confidence * 100).toFixed(1)}%)`);
  if (settingsWindow) {
    settingsWindow.webContents.send('voice-no-match', data);
  }
});

ipcMain.on('voice-error', (event, error) => {
  console.error('Voice recognition error:', error);
  if (settingsWindow) {
    settingsWindow.webContents.send('voice-error', error);
  }
});

// Simulate voice command for testing
ipcMain.on('simulate-voice-command', (event, text) => {
  console.log(`Simulating voice command: "${text}"`);
  // This will be handled by the renderer which has the voice recognition module
});

// Permission IPC handlers
ipcMain.handle('get-permission-status', () => permissionStatus);

ipcMain.handle('check-permissions', async () => {
  return checkAndRequestPermissions();
});

ipcMain.handle('request-microphone-permission', async () => {
  return requestMicrophonePermission();
});

ipcMain.on('open-accessibility-settings', () => {
  promptAccessibilityPermission();
});

ipcMain.on('open-microphone-settings', () => {
  exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"');
});

// App lifecycle
app.whenReady().then(async () => {
  // Initialize modules
  keyboard = require('./keyboard');

  // Hide dock icon on macOS (we're a menu bar app)
  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  createSettingsWindow();
  createTray();

  console.log('Zwift Voice Control started');

  // Check permissions on startup (after a short delay to let window initialize)
  setTimeout(async () => {
    await checkAndRequestPermissions();
  }, 1000);
});

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows closed (we're a tray app)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (settingsWindow === null) {
    createSettingsWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (isListening) {
    stopListening();
  }
});

// Handle second instance
app.on('second-instance', () => {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
  }
});

// Export for testing
module.exports = {
  handleVoiceCommand,
  startListening,
  stopListening
};
