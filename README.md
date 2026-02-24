# HyprCord

HyprCord is a lightweight fork of Equibop focused on performance, simplicity, and Linux friendliness.

The goal is simple:
Make Discord feel less bloated.

---

## Why?

The official Discord client is heavy.
Multiple background processes, auto-updaters, telemetry layers, DevTools, RPC bridges — it adds up fast.

HyprCord strips things down to what actually matters:

* Discord
* A clean wrapper
* Minimal background overhead

Nothing extra.

---

## What’s Different?

HyprCord removes or disables:

* DevTools in production
* Auto updater
* arRPC bridge
* Spellcheck
* Several Chromium background features
* Extra background services

Chromium flags are tuned for lower memory pressure.

Idle RAM usage is significantly lower than stock Discord.

---

## Current Focus

* Reduce idle memory
* Reduce background processes
* Improve startup time
* Keep the UI clean
* Remove unnecessary branding

HyprCord is intentionally minimal.

---

## Building

Requirements:

* Bun (>= 1.3)
* Node 18+
* Electron build deps

Clone:

```bash
git clone https://github.com/Bebbesi/HyprCord.git
cd HyprCord
```

Install:

```bash
bun install
```

Run:

```bash
bun run start:dev
```

Build:

```bash
bun run build
```

Package:

```bash
bun run package
```

---

## Linux / Wayland

If you're on Wayland:

```bash
ELECTRON_ENABLE_WAYLAND=1 ELECTRON_OZONE_PLATFORM_HINT=auto bun run start:dev
```

HyprCord works especially well on Hyprland setups.

---

## License

GPL-3.0

This project inherits licensing from its upstream components.

---

## Disclaimer

HyprCord is not affiliated with Discord.

Use at your own risk.

---

