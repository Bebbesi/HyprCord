/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

if (process.platform === "linux") import("./venmic");

import { execFile } from "node:child_process";
import { type FSWatcher, mkdirSync, readFileSync, watch } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { release } from "node:os";
import { join } from "node:path";

import {
    app,
    BrowserWindow,
    clipboard,
    dialog,
    type IpcMainInvokeEvent,
    nativeImage,
    type RelaunchOptions,
    session,
    shell
} from "electron";
import { STATIC_DIR } from "shared/paths";
import { debounce } from "shared/utils/debounce";

import { IpcEvents } from "../shared/IpcEvents";
import { setBadgeCount } from "./appBadge";
import { createArRPCWindow } from "./arrpcWindow";
import { autoStart } from "./autoStart";
import { VENCORD_QUICKCSS_FILE, VENCORD_THEMES_DIR } from "./constants";
import { AppEvents } from "./events";
import { getPlatformSpoofInfo } from "./gnuSpoofing";
import { mainWin } from "./mainWindow";
import { getConfiguredMaxRamMb, setConfiguredMaxRamMb } from "./performance";
import { Settings, State } from "./settings";
import { enableHardwareAcceleration } from "./startup";
import { handle, handleSync } from "./utils/ipcWrappers";
import { PopoutWindows } from "./utils/popout";
import { isDeckGameMode, showGamePage } from "./utils/steamOS";
import { downloadLatestInstallerAsset, downloadVencordAsar, isValidVencordInstall } from "./utils/vencordLoader";
import { VENCORD_DIR } from "./vencordDir";

handleSync(IpcEvents.DEPRECATED_GET_VENCORD_PRELOAD_SCRIPT_PATH, () => join(VENCORD_DIR, "preload.js"));
handleSync(IpcEvents.GET_VENCORD_PRELOAD_SCRIPT, () => readFileSync(join(VENCORD_DIR, "preload.js"), "utf-8"));
handleSync(IpcEvents.GET_VENCORD_RENDERER_SCRIPT, () => readFileSync(join(VENCORD_DIR, "renderer.js"), "utf-8"));

const VESKTOP_RENDERER_JS_PATH = join(__dirname, "renderer.js");
const VESKTOP_RENDERER_CSS_PATH = join(__dirname, "renderer.css");
const HYPRCORD_RELEASES_LATEST_API = "https://api.github.com/repos/Bebbesi/HyprCord/releases/latest";

interface SemverParts {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[] | null;
}

function normalizeVersion(version: string) {
    return version.trim().replace(/^v/, "");
}

function parseSemver(version: string): SemverParts | null {
    const normalized = normalizeVersion(version);
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(normalized);
    if (!match) return null;

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] ? match[4].split(".") : null
    };
}

function comparePrerelease(a: string[] | null, b: string[] | null) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;

    const maxLength = Math.max(a.length, b.length);
    for (let i = 0; i < maxLength; i++) {
        const ai = a[i];
        const bi = b[i];
        if (ai === undefined) return -1;
        if (bi === undefined) return 1;
        if (ai === bi) continue;

        const aIsNumeric = /^\d+$/.test(ai);
        const bIsNumeric = /^\d+$/.test(bi);
        if (aIsNumeric && bIsNumeric) {
            return Number(ai) - Number(bi);
        }
        if (aIsNumeric) return -1;
        if (bIsNumeric) return 1;
        return ai < bi ? -1 : 1;
    }

    return 0;
}

function compareSemver(left: string, right: string) {
    const a = parseSemver(left);
    const b = parseSemver(right);
    if (!a || !b) {
        return normalizeVersion(left).localeCompare(normalizeVersion(right), undefined, { numeric: true });
    }

    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;

    return comparePrerelease(a.prerelease, b.prerelease);
}

async function getLocalPackageVersion() {
    const packageJsonPath = join(app.getAppPath(), "package.json");
    const packageJsonRaw = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonRaw) as { version?: unknown };

    if (typeof packageJson.version !== "string") {
        throw new Error("Invalid package.json: missing version");
    }

    return normalizeVersion(packageJson.version);
}

interface GithubLatestReleaseResponse {
    tag_name?: unknown;
}
handleSync(IpcEvents.GET_VESKTOP_RENDERER_SCRIPT, () => readFileSync(VESKTOP_RENDERER_JS_PATH, "utf-8"));
handle(IpcEvents.GET_VESKTOP_RENDERER_CSS, () => readFile(VESKTOP_RENDERER_CSS_PATH, "utf-8"));

if (IS_DEV) {
    watch(VESKTOP_RENDERER_CSS_PATH, { persistent: false }, async () => {
        mainWin?.webContents.postMessage(
            IpcEvents.VESKTOP_RENDERER_CSS_UPDATE,
            await readFile(VESKTOP_RENDERER_CSS_PATH, "utf-8")
        );
    });
}

handleSync(IpcEvents.GET_SETTINGS, () => Settings.plain);
handleSync(IpcEvents.GET_VERSION, () => app.getVersion());
handleSync(IpcEvents.GET_GIT_HASH, () => EQUIBOP_GIT_HASH);
handleSync(IpcEvents.GET_ENABLE_HARDWARE_ACCELERATION, () => enableHardwareAcceleration);
handle(IpcEvents.HYPRCORD_CHECK_UPDATES, async () => {
    const localVersion = await getLocalPackageVersion();
    const response = await fetch(HYPRCORD_RELEASES_LATEST_API, {
        headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });
    if (!response.ok) {
        throw new Error(`GitHub latest release request failed (${response.status})`);
    }

    const release = (await response.json()) as GithubLatestReleaseResponse;
    if (typeof release.tag_name !== "string") {
        throw new Error("GitHub latest release response is missing tag_name");
    }

    const latestVersion = normalizeVersion(release.tag_name);
    const updateAvailable = compareSemver(localVersion, latestVersion) < 0;

    return {
        localVersion,
        latestVersion,
        updateAvailable
    };
});
handle(IpcEvents.HYPRCORD_INSTALL_UPDATE, async () => {
    try {
        await downloadVencordAsar();

        setBadgeCount(0);

        const options: RelaunchOptions = {
            args: process.argv.slice(1).concat(["--relaunch"])
        };
        if (isDeckGameMode) {
            await showGamePage();
        } else if (app.isPackaged && process.env.APPIMAGE) {
            execFile(process.env.APPIMAGE, options.args);
        } else {
            app.relaunch(options);
        }
        app.exit();
        return;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("does not contain an .asar asset")) throw error;
    }

    const { downloadPath, assetName, versionTag } = await downloadLatestInstallerAsset();
    const openError = await shell.openPath(downloadPath);
    if (openError) {
        throw new Error(
            `Downloaded installer ${assetName} for release ${versionTag} but failed to open it: ${openError}`
        );
    }

    app.quit();
});

handleSync(
    IpcEvents.SUPPORTS_WINDOWS_TRANSPARENCY,
    () => process.platform === "win32" && Number(release().split(".").pop()) >= 22621
);

handleSync(IpcEvents.AUTOSTART_ENABLED, () => autoStart.isEnabled());
handle(IpcEvents.ENABLE_AUTOSTART, autoStart.enable);
handle(IpcEvents.DISABLE_AUTOSTART, autoStart.disable);

handle(IpcEvents.ARRPC_OPEN_SETTINGS, () => {
    createArRPCWindow();
});

handleSync(IpcEvents.GET_PLATFORM_SPOOF_INFO, () => getPlatformSpoofInfo());
handle(IpcEvents.GET_PERFORMANCE_RAM_LIMIT, () => getConfiguredMaxRamMb());
handle(IpcEvents.SET_PERFORMANCE_RAM_LIMIT, async (_e, limitMb: number | null, restart = false) => {
    const savedLimit = setConfiguredMaxRamMb(limitMb);
    if (!restart) return savedLimit;

    setBadgeCount(0);

    const options: RelaunchOptions = {
        args: process.argv.slice(1).concat(["--relaunch"])
    };
    if (isDeckGameMode) {
        await showGamePage();
    } else if (app.isPackaged && process.env.APPIMAGE) {
        execFile(process.env.APPIMAGE, options.args);
    } else {
        app.relaunch(options);
    }
    app.exit();

    return savedLimit;
});

handle(IpcEvents.SET_SETTINGS, (_, settings: typeof Settings.store, path?: string) => {
    Settings.setData(settings, path);
});

handle(IpcEvents.RELAUNCH, async () => {
    setBadgeCount(0);

    const options: RelaunchOptions = {
        args: process.argv.slice(1).concat(["--relaunch"])
    };
    if (isDeckGameMode) {
        // We can't properly relaunch when running under gamescope, but we can at least navigate to our page in Steam.
        await showGamePage();
    } else if (app.isPackaged && process.env.APPIMAGE) {
        execFile(process.env.APPIMAGE, options.args);
    } else {
        app.relaunch(options);
    }
    app.exit();
});

handleSync(IpcEvents.IS_USING_CUSTOM_VENCORD_DIR, () => !!State.store.equicordDir);
handle(IpcEvents.SHOW_CUSTOM_VENCORD_DIR, async () => {
    const { equicordDir } = State.store;
    if (!equicordDir) return;

    const stats = await stat(equicordDir);
    if (!stats.isDirectory()) return;

    shell.openPath(equicordDir);
});

function getWindow(e: IpcMainInvokeEvent, key?: string) {
    return key ? PopoutWindows.get(key)! : (BrowserWindow.fromWebContents(e.sender) ?? mainWin);
}

handle(IpcEvents.FOCUS, () => {
    mainWin.show();
    mainWin.setSkipTaskbar(false);
});

handle(IpcEvents.CLOSE, (e, key?: string) => {
    getWindow(e, key).close();
});

handle(IpcEvents.MINIMIZE, (e, key?: string) => {
    getWindow(e, key).minimize();
});

handle(IpcEvents.MAXIMIZE, (e, key?: string) => {
    const win = getWindow(e, key);
    if (win.isMaximized()) {
        win.unmaximize();
    } else {
        win.maximize();
    }
});

handleSync(IpcEvents.SPELLCHECK_GET_AVAILABLE_LANGUAGES, e => {
    e.returnValue = session.defaultSession.availableSpellCheckerLanguages;
});

handle(IpcEvents.SPELLCHECK_REPLACE_MISSPELLING, (e, word: string) => {
    e.sender.replaceMisspelling(word);
});

handle(IpcEvents.SPELLCHECK_ADD_TO_DICTIONARY, (e, word: string) => {
    e.sender.session.addWordToSpellCheckerDictionary(word);
});

handle(IpcEvents.SELECT_VENCORD_DIR, async (_e, value?: null) => {
    if (value === null) {
        delete State.store.equicordDir;
        return "ok";
    }

    const res = await dialog.showOpenDialog(mainWin!, {
        properties: ["openDirectory"]
    });
    if (!res.filePaths.length) return "cancelled";

    const dir = res.filePaths[0];
    if (!isValidVencordInstall(dir)) return "invalid";

    State.store.equicordDir = dir;

    return "ok";
});

handle(IpcEvents.SET_BADGE_COUNT, (_, count: number) => setBadgeCount(count));

handle(IpcEvents.FLASH_FRAME, (_, flag: boolean) => {
    if (!mainWin || mainWin.isDestroyed() || (flag && mainWin.isFocused())) return;
    mainWin.flashFrame(flag);
});

handle(IpcEvents.CLIPBOARD_COPY_IMAGE, async (_, buf: ArrayBuffer, src: string) => {
    clipboard.write({
        html: `<img src="${src.replaceAll('"', '\\"')}">`,
        image: nativeImage.createFromBuffer(Buffer.from(buf))
    });
});

function openDebugPage(page: string) {
    const win = new BrowserWindow({
        autoHideMenuBar: true,
        ...(process.platform === "win32"
            ? { icon: join(STATIC_DIR, "icon.ico") }
            : process.platform === "linux"
              ? { icon: join(STATIC_DIR, "icon.png") }
              : {})
    });

    win.loadURL(page);
}

handle(IpcEvents.DEBUG_LAUNCH_GPU, () => openDebugPage("chrome://gpu"));
handle(IpcEvents.DEBUG_LAUNCH_WEBRTC_INTERNALS, () => openDebugPage("chrome://webrtc-internals"));

function readCss() {
    return readFile(VENCORD_QUICKCSS_FILE, "utf-8").catch(() => "");
}

let quickCssWatcher: FSWatcher | null = null;
let themesWatcher: FSWatcher | null = null;

open(VENCORD_QUICKCSS_FILE, "a+")
    .then(fd => {
        fd.close();
        quickCssWatcher = watch(
            VENCORD_QUICKCSS_FILE,
            { persistent: false },
            debounce(async () => {
                mainWin?.webContents.postMessage("VencordQuickCssUpdate", await readCss());
            }, 50)
        );
    })
    .catch(err => {
        console.error("Failed to setup quickCss file watcher:", err);
    });

mkdirSync(VENCORD_THEMES_DIR, { recursive: true });
themesWatcher = watch(
    VENCORD_THEMES_DIR,
    { persistent: false },
    debounce(() => {
        mainWin?.webContents.postMessage("VencordThemeUpdate", void 0);
    })
);

export function cleanupFileWatchers() {
    if (quickCssWatcher) {
        quickCssWatcher.close();
        quickCssWatcher = null;
    }
    if (themesWatcher) {
        themesWatcher.close();
        themesWatcher = null;
    }
}

app.on("quit", cleanupFileWatchers);

handle(IpcEvents.VOICE_STATE_CHANGED, (_, variant: string) => {
    AppEvents.emit("setTrayVariant", variant as any);
});

handle(IpcEvents.VOICE_CALL_STATE_CHANGED, (_, inCall: boolean) => {
    AppEvents.emit("voiceCallStateChanged", inCall);
});
