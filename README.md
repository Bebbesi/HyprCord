
<p align="center">
  <img src="icon.png" alt="HyprCord Logo" width="120">
</p>

<h1 align="center">HyprCord</h1>

<p align="center">
A performance-focused fork of Equibop.
</p>

---
<p align="center">
  <a href="https://aur.archlinux.org/packages/hyprcord-bin">
    <img src="https://img.shields.io/aur/version/hyprcord-bin?logo=archlinux&color=1793d1" alt="Available on AUR">
  </a>
  <a href="https://discord.gg/m4mkhvcsQe">
    <img src="https://img.shields.io/badge/Discord-Join%20Server-5865F2?logo=discord&logoColor=white" alt="Join our Discord">
  </a>
</p>

## Overview

**HyprCord** is a performance-tuned fork of **Equibop**, optimized specifically for Linux and Windows users who want Discord functionality with reduced Electron overhead and better Wayland integration.

This project builds directly on Equibop while focusing on memory efficiency, stripped background services, and a cleaner runtime profile.

---

## Why HyprCord?

The official Discord client ships with:

- Heavy Electron overhead  
- Telemetry services  
- Background updaters  
- Extra RPC layers  
- Development tooling included in production  

HyprCord removes or disables unnecessary components to reduce memory usage and improve system responsiveness.

---

## Performance Comparison

| Feature | Official Discord | HyprCord |
|----------|------------------|-----------|
| Idle RAM Usage | ~800MB+ | Reduced |
| Telemetry | Enabled | Stripped |
| Background Services | Multiple | Minimal |
| Wayland Support | Experimental | Native-first |

---

## Key Changes From Equibop

- Aggressive removal of unnecessary background services  
- arRPC bridge disabled  
- DevTools removed from production builds  
- Spellcheck disabled  
- Custom Chromium flags tuned for lower memory pressure  
- Auto-updaters stripped  
- Minimal branding adjustments  

---

## Requirements

- Bun >= 1.3  
- Node.js 18+  
- Electron 30.5.1 build dependencies  

---

## Installation

```bash
git clone https://github.com/Bebbesi/HyprCord.git
cd HyprCord
bun install
````

---

## Development

```bash
bun run start:dev
```

---

## Production Build

```bash
bun run build
bun run package
```

---

## Wayland Support

For native Wayland support:

```bash
ELECTRON_ENABLE_WAYLAND=1 ELECTRON_OZONE_PLATFORM_HINT=auto bun run start:dev
```

---

## Performance Rescue

If performance settings are misconfigured, review:

```
/src/main/performanceRescueConfig.ts
```

---

## Upstream

HyprCord is based on and depends on the work of the Equibop project.
All core functionality originates from Equibop, with additional performance-focused modifications applied here.

---

## License

GPL-3.0 (inherits upstream licensing where applicable)

---

## Disclaimer

HyprCord is a third-party modification and is not affiliated with or endorsed by Discord Inc. Even though the risk of being banned is almost zero, use it at your own risk.
