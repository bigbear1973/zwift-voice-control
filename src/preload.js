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

  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('listening-state-changed');
    ipcRenderer.removeAllListeners('voice-command');
    ipcRenderer.removeAllListeners('voice-interim');
    ipcRenderer.removeAllListeners('voice-low-confidence');
    ipcRenderer.removeAllListeners('voice-no-match');
    ipcRenderer.removeAllListeners('voice-error');
    ipcRenderer.removeAllListeners('permission-status');
  }
});
