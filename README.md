# Zwift Voice Control

> Voice Attack for Mac - Voice control your Zwift rides

**Version:** 1.0.0-beta
**Platform:** macOS 10.13+ (Windows coming in v2.0)

## Overview

Zwift Voice Control is a lightweight menu bar app that lets you control Zwift using voice commands. Say "power up" to use your power-up, "ride on" to send encouragement, or "turn left" at intersections - all hands-free while you ride.

## Features

- 🎤 Voice-activated Zwift commands
- ⌨️ Simulates native keyboard shortcuts
- 🖥️ Runs quietly in the menu bar
- ⚡ Lightweight and fast
- 🔒 Privacy-focused - voice processing happens locally

## Requirements

- macOS 10.13 (High Sierra) or later
- Node.js 18 or later
- Zwift installed and running

## Installation

### From Source

1. Clone or download this repository:
   ```bash
   git clone https://github.com/yourusername/zwift-voice-control.git
   cd zwift-voice-control
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Generate icon assets (optional, fallback icons are built-in):
   ```bash
   # See assets/README.md for icon generation instructions
   ```

4. Run the app:
   ```bash
   npm start
   ```

### For Development

```bash
npm run dev
```

### Building for Distribution

```bash
npm run build
```

This creates a distributable `.dmg` file in the `dist/` folder.

## Permissions

The app requires the following macOS permissions:

### Microphone Access
Required for voice recognition. Grant in:
**System Preferences → Security & Privacy → Privacy → Microphone**

### Accessibility Access
Required for keyboard simulation to send commands to Zwift. Grant in:
**System Preferences → Security & Privacy → Privacy → Accessibility**

> **Note:** You may need to add the app manually and restart it after granting permissions.

## Usage

1. Launch Zwift Voice Control - it will appear in your menu bar
2. Click the microphone icon and select "Start Listening"
3. Open Zwift and start your ride
4. Speak commands naturally!

### Voice Commands

| Say This | Zwift Action | Key |
|----------|-------------|-----|
| "power up" / "boost" | Use power-up | Space |
| "ride on" | Send Ride On! | 6 |
| "wave" | Wave | 5 |
| "elbow" | Elbow flick | 4 |
| "u turn" / "turn around" | U-Turn | ↓ |
| "turn left" / "left" | Turn left | ← |
| "turn right" / "right" | Turn right | → |
| "go straight" | Go straight | ↑ |
| "camera" | Cycle camera | 1 |
| "screenshot" / "photo" | Take screenshot | F10 |
| "menu" / "pause" | Open menu | Esc |
| "skip" / "skip block" | Skip workout block | Tab |
| "easier" / "bias down" | Decrease difficulty | PgDn |
| "harder" / "bias up" | Increase difficulty | PgUp |

See the Settings window for a complete list of commands.

## Project Structure

```
zwift-voice-control/
├── src/
│   ├── main.js          # Electron main process
│   ├── preload.js       # Secure bridge to renderer
│   ├── renderer.js      # Settings UI logic
│   ├── keyboard.js      # Keyboard simulation
│   ├── voice.js         # Voice recognition (stub)
│   ├── analytics.js     # Usage analytics (stub)
│   ├── index.html       # Settings window
│   └── styles.css       # UI styles
├── assets/
│   ├── icon.svg         # Tray icon (inactive)
│   └── icon-listening.svg # Tray icon (active)
├── package.json
└── README.md
```

## Troubleshooting

### "Keyboard commands not working"
1. Ensure Accessibility permissions are granted
2. Make sure Zwift is the active/focused window
3. Try the "Test Keyboard" buttons in Settings

### "Voice not recognized"
1. Ensure Microphone permissions are granted
2. Speak clearly and at normal volume
3. Reduce background noise

### "App won't start"
1. Check Node.js version: `node --version` (needs 18+)
2. Reinstall dependencies: `rm -rf node_modules && npm install`

## Known Limitations

- **macOS only** - Windows support planned for v2.0
- **Voice recognition** - Currently a stub, implementation coming soon
- **Custom commands** - UI for custom voice commands planned

## Development Roadmap

### v1.0 (Current)
- [x] Electron app structure
- [x] Menu bar integration
- [x] Settings window
- [x] Keyboard simulation
- [ ] Voice recognition integration

### v1.1 (Planned)
- [ ] macOS native speech recognition
- [ ] Command confirmation audio feedback
- [ ] Custom voice command mappings

### v2.0 (Future)
- [ ] Windows support
- [ ] Offline voice recognition (Whisper)
- [ ] Training mode for custom wake words

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - see LICENSE file

## Disclaimer

This is an unofficial third-party tool. Zwift is a trademark of Zwift, Inc. This project is not affiliated with or endorsed by Zwift, Inc.

---

**Note:** This is a beta release. Please report issues on GitHub.
