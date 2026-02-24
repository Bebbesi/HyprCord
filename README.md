

# 🚀 HyprCord

**HyprCord** is a performance-tuned, lightweight fork of [Equibop](https://www.google.com/search?q=https://github.com/equibop/equibop). It is designed specifically for Linux users who want Discord functionality without the massive Electron overhead.

---

## ⚖️ The "Why"

The official Discord client is essentially a web browser running a chat app, cluttered with telemetry, background updaters, and unused services. HyprCord strips the bloat to return those system resources to your games and workflow.

### Performance Comparison

| Feature | Official Discord | HyprCord |
| --- | --- | --- |
| **Idle RAM Usage** | ~800MB+ | **Significantly Lower** |
| **Telemetry** | Enabled | **Stripped** |
| **Background Services** | Multiple (RPC, Updaters) | **Minimal** |
| **Wayland Support** | Experimental/Tweak-heavy | **Native-first** |

---

## 🛠️ Key Optimizations

HyprCord doesn't just hide things; it removes them.

* **Disabled Bloat:** No `arRPC` bridge, no spellcheck, and no DevTools in production.
* **Chromium Tuning:** Custom flags specifically set to reduce memory pressure.
* **Aggressive Cleanup:** All unnecessary background layers and auto-updaters are removed.
* **Minimal Branding:** A clean, distraction-free UI.

---

## 🚀 Getting Started

### Prerequisites

* **Bun** (>= 1.3) — *Required for lightning-fast dependency management.*
* **Node.js** 18+
* **Electron Build Dependencies** 30.5.1

### Installation & Build

```bash
# Clone the repository
git clone https://github.com/Bebbesi/HyprCord.git
cd HyprCord

# Install dependencies with Bun
bun install

# Run in development mode
bun run start:dev

# Build & Package for production
bun run build
bun run package

```

---

## 🐧 Linux & Wayland

HyprCord is built to feel at home on tiling window managers like **Hyprland** or **Sway**.

To run with native Wayland support and smooth fractional scaling, use:

```bash
ELECTRON_ENABLE_WAYLAND=1 ELECTRON_OZONE_PLATFORM_HINT=auto bun run start:dev

```

> [!TIP]
> You can alias this command in your `.bashrc` or `.zshrc` for a faster launch experience.

---
## in case you fuck up with the ram settings go to this file to fix it 
```bash
/src/main/performanceRescueConfig.ts
```

## 📜 License & Disclaimer

* **License:** Distributed under the **GPL-3.0 License**.
* **Disclaimer:** HyprCord is a third-party modification. It is not affiliated with or endorsed by Discord Inc. **Use at your own risk.**

