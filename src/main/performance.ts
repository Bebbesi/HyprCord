/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, session } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { IpcCommands } from "shared/IpcEvents";

import { DATA_DIR } from "./constants";
import { sendRendererCommand } from "./ipcCommands";
import { PerformanceRescueConfig } from "./performanceRescueConfig";

export const MIN_RAM_LIMIT_MB = 100;

const PERFORMANCE_FILE = join(DATA_DIR, "performance.json");
const MAX_OLD_SPACE_RATIO = 0.85;
const MEMORY_ENFORCEMENT_GRACE_MB = 0;
const MEMORY_ENFORCEMENT_INTERVAL_MS = 1000;
const LOW_MEMORY_EXIT_RATIO = 0.85;
const LOW_MEMORY_STABLE_EXIT_MS = 15000;
const CLEANUP_COOLDOWN_MS = 10000;

interface PerformanceConfig {
    maxRamMb: number | null;
}

let cachedConfig: PerformanceConfig = loadConfig();
let memoryEnforcementTimer: NodeJS.Timeout | null = null;
let lowMemoryModeEnabled = false;
let lowMemoryBelowSince = 0;
let lastCleanupAt = 0;
let cleanupInFlight = false;

function normalizeRamLimit(value: unknown): number | null {
    if (value == null) return null;

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;

    return Math.max(MIN_RAM_LIMIT_MB, Math.round(parsed));
}

function loadConfig(): PerformanceConfig {
    try {
        const raw = readFileSync(PERFORMANCE_FILE, "utf8");
        const parsed = JSON.parse(raw);
        return {
            maxRamMb: normalizeRamLimit(parsed?.maxRamMb)
        };
    } catch {
        return {
            maxRamMb: null
        };
    }
}

function saveConfig(config: PerformanceConfig) {
    try {
        mkdirSync(dirname(PERFORMANCE_FILE), { recursive: true });
        writeFileSync(PERFORMANCE_FILE, JSON.stringify(config, null, 4));
    } catch (error) {
        console.error("Failed to persist performance config:", error);
    }
}

function getTotalWorkingSetMb() {
    const totalKb = app.getAppMetrics().reduce((sum, metric) => sum + (metric.memory?.workingSetSize ?? 0), 0);

    return totalKb / 1024;
}

async function setLowMemoryMode(enabled: boolean, limitMb: number, currentMb: number) {
    if (lowMemoryModeEnabled === enabled) return;

    lowMemoryModeEnabled = enabled;

    sendRendererCommand(
        IpcCommands.PERFORMANCE_SET_LOW_MEMORY_MODE,
        {
            enabled,
            limitMb,
            currentMb: Math.round(currentMb)
        },
        5000
    ).catch(() => void 0);
}

async function runEmergencyCleanup() {
    if (cleanupInFlight) return;
    cleanupInFlight = true;

    try {
        await session.defaultSession.clearCache();
    } catch (error) {
        console.error("[Performance] Failed to clear cache in low-memory mode:", error);
    } finally {
        cleanupInFlight = false;
    }
}

function applyLowMemoryMainProcessTweaks(enabled: boolean) {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
        if (!win || win.isDestroyed()) continue;
        try {
            win.webContents.setBackgroundThrottling(enabled);
        } catch {
            // noop
        }
    }
}

async function enforceMemoryLimit(limitMb: number) {
    const currentMb = getTotalWorkingSetMb();
    const now = Date.now();

    if (currentMb > limitMb + MEMORY_ENFORCEMENT_GRACE_MB) {
        lowMemoryBelowSince = 0;

        if (!lowMemoryModeEnabled) {
            console.warn(
                `[Performance] Low memory mode enabled: ${Math.round(currentMb)}MB > ${limitMb}MB. Reducing runtime performance.`
            );
            applyLowMemoryMainProcessTweaks(true);
            await setLowMemoryMode(true, limitMb, currentMb);
        }

        if (now - lastCleanupAt >= CLEANUP_COOLDOWN_MS) {
            lastCleanupAt = now;
            void runEmergencyCleanup();
        }

        return;
    }

    if (!lowMemoryModeEnabled) return;

    const exitThresholdMb = Math.max(MIN_RAM_LIMIT_MB, limitMb * LOW_MEMORY_EXIT_RATIO);
    if (currentMb <= exitThresholdMb) {
        if (lowMemoryBelowSince === 0) {
            lowMemoryBelowSince = now;
            return;
        }

        if (now - lowMemoryBelowSince >= LOW_MEMORY_STABLE_EXIT_MS) {
            applyLowMemoryMainProcessTweaks(false);
            await setLowMemoryMode(false, limitMb, currentMb);
            lowMemoryBelowSince = 0;
        }
        return;
    }

    lowMemoryBelowSince = 0;
}

function mergeJsFlagsWithHeapLimit(limitMb: number) {
    const heapLimitMb = Math.max(64, Math.floor(limitMb * MAX_OLD_SPACE_RATIO));

    const existing = app.commandLine.getSwitchValue("js-flags");
    const parts = existing
        .split(/\s+/)
        .map(part => part.trim())
        .filter(Boolean)
        .filter(part => !part.startsWith("--max-old-space-size="));

    parts.push(`--max-old-space-size=${heapLimitMb}`);
    app.commandLine.appendSwitch("js-flags", parts.join(" "));
}

function getEffectiveLimit(config: PerformanceConfig) {
    if (PerformanceRescueConfig.enabled) {
        return normalizeRamLimit(PerformanceRescueConfig.forcedMaxRamMb);
    }

    return config.maxRamMb;
}

export function getConfiguredMaxRamMb() {
    cachedConfig = loadConfig();
    return getEffectiveLimit(cachedConfig);
}

export function setConfiguredMaxRamMb(limitMb: number | null) {
    cachedConfig = {
        maxRamMb: normalizeRamLimit(limitMb)
    };
    saveConfig(cachedConfig);
    return cachedConfig.maxRamMb;
}

export function applyConfiguredMemoryLimit() {
    cachedConfig = loadConfig();

    const limitMb = getEffectiveLimit(cachedConfig);
    if (limitMb != null) {
        mergeJsFlagsWithHeapLimit(limitMb);
    }

    saveConfig(cachedConfig);
    return limitMb;
}

export function startMemoryLimitEnforcement() {
    stopMemoryLimitEnforcement();

    const limitMb = getConfiguredMaxRamMb();
    if (limitMb == null) return;

    memoryEnforcementTimer = setInterval(() => {
        void enforceMemoryLimit(limitMb);
    }, MEMORY_ENFORCEMENT_INTERVAL_MS);
    memoryEnforcementTimer.unref?.();
}

export function stopMemoryLimitEnforcement() {
    if (!memoryEnforcementTimer) return;

    clearInterval(memoryEnforcementTimer);
    memoryEnforcementTimer = null;

    if (lowMemoryModeEnabled) {
        lowMemoryModeEnabled = false;
        lowMemoryBelowSince = 0;
        applyLowMemoryMainProcessTweaks(false);
        sendRendererCommand(
            IpcCommands.PERFORMANCE_SET_LOW_MEMORY_MODE,
            {
                enabled: false,
                limitMb: getConfiguredMaxRamMb(),
                currentMb: Math.round(getTotalWorkingSetMb())
            },
            3000
        ).catch(() => void 0);
    }
}
