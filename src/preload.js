const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Listening state
  getListeningState: () => ipcRenderer.invoke('get-listening-state'),
  startListening: () => ipcRenderer.send('start-listening'),
  stopListening: () => ipcRenderer.send('stop-listening'),
  toggleListening: () => ipcRenderer.send('toggle-listening'),

  // Commands
  getCommands: () => ipcRenderer.invoke('get-commands'),
  getVoiceCommands: () => ipcRenderer.invoke('get-voice-commands'),
  testKeyboard: (key) => ipcRenderer.invoke('test-keyboard', key),
  executeCommand: (key) => ipcRenderer.invoke('execute-command', key),

  // Voice settings
  setConfidenceThreshold: (threshold) => ipcRenderer.send('set-confidence-threshold', threshold),
  setTrainerMode: (enabled) => ipcRenderer.send('set-trainer-mode', enabled),
  getVoiceSettings: () => ipcRenderer.invoke('get-voice-settings'),
  simulateVoiceCommand: (text) => ipcRenderer.send('simulate-voice-command', text),

  // Event listeners
  onListeningStateChanged: (callback) => {
    ipcRenderer.on('listening-state-changed', (event, state) => callback(state));
  },
  onVoiceCommand: (callback) => {
    ipcRenderer.on('voice-command', (event, data) => callback(data));
  },
  onVoiceInterim: (callback) => {
    ipcRenderer.on('voice-interim', (event, data) => callback(data));
  },
  onVoiceLowConfidence: (callback) => {
    ipcRenderer.on('voice-low-confidence', (event, data) => callback(data));
  },
  onVoiceNoMatch: (callback) => {
    ipcRenderer.on('voice-no-match', (event, data) => callback(data));
  },
  onVoiceError: (callback) => {
    ipcRenderer.on('voice-error', (event, error) => callback(error));
  },

  // Permissions
  getPermissionStatus: () => ipcRenderer.invoke('get-permission-status'),
  checkPermissions: () => ipcRenderer.invoke('check-permissions'),
  requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),
  openAccessibilitySettings: () => ipcRenderer.send('open-accessibility-settings'),
  openMicrophoneSettings: () => ipcRenderer.send('open-microphone-settings'),
  onPermissionStatus: (callback) => {
    ipcRenderer.on('permission-status', (event, status) => callback(status));
  },

  // Test mode and keyboard settings
  getTestMode: () => ipcRenderer.invoke('get-test-mode'),
  setTestMode: (enabled) => ipcRenderer.send('set-test-mode', enabled),
  getNotificationsEnabled: () => ipcRenderer.invoke('get-notifications-enabled'),
  setNotificationsEnabled: (enabled) => ipcRenderer.send('set-notifications-enabled', enabled),
  getRateLimit: () => ipcRenderer.invoke('get-rate-limit'),
  setRateLimit: (ms) => ipcRenderer.send('set-rate-limit', ms),
  getKeyboardConfig: () => ipcRenderer.invoke('get-keyboard-config'),
  getCommandHistory: () => ipcRenderer.invoke('get-command-history'),
  clearCommandHistory: () => ipcRenderer.send('clear-command-history'),

  // Test mode and command execution events
  onTestModeChanged: (callback) => {
    ipcRenderer.on('test-mode-changed', (event, enabled) => callback(enabled));
  },
  onCommandExecuted: (callback) => {
    ipcRenderer.on('command-executed', (event, result) => callback(result));
  },

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('listening-state-changed');
    ipcRenderer.removeAllListeners('voice-command');
    ipcRenderer.removeAllListeners('voice-interim');
    ipcRenderer.removeAllListeners('voice-low-confidence');
    ipcRenderer.removeAllListeners('voice-no-match');
    ipcRenderer.removeAllListeners('voice-error');
    ipcRenderer.removeAllListeners('permission-status');
    ipcRenderer.removeAllListeners('test-mode-changed');
    ipcRenderer.removeAllListeners('command-executed');
  }
});
