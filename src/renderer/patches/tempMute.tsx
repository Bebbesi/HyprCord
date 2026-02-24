/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, findGroupChildrenByChildId, removeContextMenuPatch } from "@equicord/types/api/ContextMenu";
import { Menu, MediaEngineStore, Toasts, VoiceActions, VoiceStateStore } from "@equicord/types/webpack/common";
import { HYPRCORD_PLUGIN_IDS, isHyprcordPluginEnabled, onHyprcordPluginsStateChange } from "renderer/plugins/hyprcordPluginsState";

interface TempMuteRecord {
    userId: string;
    expiresAt: number;
    timeout: ReturnType<typeof setTimeout>;
}

const TEMP_MUTE_STORAGE_KEY = "hyprcord:plugins:tempmute:entries:v1";
const USER_CONTEXT_NAV_ID = "user-context";

const DURATIONS = [
    { label: "1 Minute", ms: 1 * 60 * 1000 },
    { label: "15 Minutes", ms: 15 * 60 * 1000 },
    { label: "30 Minutes", ms: 30 * 60 * 1000 },
    { label: "1 Hour", ms: 60 * 60 * 1000 },
    { label: "6 Hours", ms: 6 * 60 * 60 * 1000 },
    { label: "12 Hours", ms: 12 * 60 * 60 * 1000 },
    { label: "24 Hours", ms: 24 * 60 * 60 * 1000 }
] as const;

const tempMutes = new Map<string, TempMuteRecord>();
let isPatchRegistered = false;

function safeCall(source: any, method: string, ...args: any[]) {
    const fn = source?.[method];
    if (typeof fn !== "function") return false;

    try {
        fn(...args);
        return true;
    } catch {
        return false;
    }
}

function isLocallyMuted(userId: string): boolean | null {
    const media = MediaEngineStore as any;

    for (const fn of ["isLocalMute", "isLocalMuted", "isUserLocalMuted", "isLocallyMuted"]) {
        const method = media?.[fn];
        if (typeof method !== "function") continue;

        try {
            return Boolean(method(userId));
        } catch {
            continue;
        }
    }

    for (const fn of ["getLocalMutes", "getLocalMuteStates", "getLocalMuteUsers"]) {
        const method = media?.[fn];
        if (typeof method !== "function") continue;

        try {
            const records = method();
            if (records && typeof records === "object" && userId in records) {
                return Boolean(records[userId]);
            }
        } catch {
            continue;
        }
    }

    return null;
}

function setLocalMute(userId: string, muted: boolean) {
    const voice = VoiceActions as any;
    const media = MediaEngineStore as any;

    const setMethods = [
        [voice, "setLocalMute"],
        [voice, "setUserLocalMute"],
        [voice, "setLocalMuteState"],
        [media, "setLocalMute"],
        [media, "setUserLocalMute"],
        [media, "setLocalMuteState"]
    ] as const;

    for (const [source, method] of setMethods) {
        if (safeCall(source, method, userId, muted)) return true;
    }

    const known = isLocallyMuted(userId);
    if (known === muted) return true;

    const toggleMethods = [
        [voice, "toggleLocalMute"],
        [voice, "toggleUserLocalMute"],
        [media, "toggleLocalMute"],
        [media, "toggleUserLocalMute"]
    ] as const;

    for (const [source, method] of toggleMethods) {
        if (safeCall(source, method, userId)) return true;
    }

    try {
        const before = isLocallyMuted(userId);
        if (before === null || before !== muted) {
            (VoiceActions as any)?.toggleLocalMute?.(userId);
        }
        return true;
    } catch {
        return false;
    }
}

function formatTimeLeft(expiresAt: number) {
    const remaining = Math.max(0, expiresAt - Date.now());
    const totalMinutes = Math.ceil(remaining / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function showToast(message: string, type = Toasts.Type.MESSAGE) {
    Toasts.show({
        message,
        id: Toasts.genId(),
        type
    });
}

function persistTempMutes() {
    const serialized: Record<string, number> = {};
    for (const [userId, record] of tempMutes.entries()) {
        serialized[userId] = record.expiresAt;
    }

    localStorage.setItem(TEMP_MUTE_STORAGE_KEY, JSON.stringify(serialized));
}

function readPersistedTempMutes() {
    try {
        const raw = localStorage.getItem(TEMP_MUTE_STORAGE_KEY);
        if (!raw) return {} as Record<string, number>;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return {} as Record<string, number>;

        return parsed as Record<string, number>;
    } catch {
        return {} as Record<string, number>;
    }
}

function clearTempMute(userId: string, unmute: boolean) {
    const record = tempMutes.get(userId);
    if (!record) return;

    clearTimeout(record.timeout);
    tempMutes.delete(userId);

    if (unmute) {
        setLocalMute(userId, false);
    }

    persistTempMutes();
}

function clearAllTempMutes(unmute: boolean) {
    for (const [userId, record] of tempMutes.entries()) {
        clearTimeout(record.timeout);
        if (unmute) {
            setLocalMute(userId, false);
        }

        tempMutes.delete(userId);
    }

    persistTempMutes();
}

function queueTempMute(userId: string, expiresAt: number, notifyOnExpire: boolean) {
    clearTempMute(userId, false);
    setLocalMute(userId, true);

    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
        setLocalMute(userId, false);
        persistTempMutes();
        return;
    }

    const timeout = setTimeout(() => {
        const current = tempMutes.get(userId);
        if (!current || current.expiresAt !== expiresAt) return;

        tempMutes.delete(userId);
        setLocalMute(userId, false);
        persistTempMutes();

        if (notifyOnExpire) {
            showToast("TempMute expired and user was unmuted.", Toasts.Type.SUCCESS);
        }
    }, remainingMs);

    tempMutes.set(userId, {
        userId,
        expiresAt,
        timeout
    });

    persistTempMutes();
}

function scheduleTempMute(userId: string, durationMs: number) {
    queueTempMute(userId, Date.now() + durationMs, true);
}

function restorePersistedTempMutes() {
    const persisted = readPersistedTempMutes();
    const now = Date.now();

    for (const [userId, expiresAt] of Object.entries(persisted)) {
        if (!Number.isFinite(expiresAt)) continue;

        if (expiresAt <= now) {
            setLocalMute(userId, false);
            continue;
        }

        queueTempMute(userId, expiresAt, false);
    }
}

function getUserId(args: any[]) {
    const [props] = args;
    return props?.user?.id ?? props?.userId ?? props?.id ?? null;
}

function isVoiceUser(userId: string) {
    return Boolean(VoiceStateStore.getVoiceStateForUser(userId)?.channelId);
}

function tempMuteContextPatch(children: any[], ...args: any[]) {
    const userId = getUserId(args);
    if (!userId || !isVoiceUser(userId)) return;

    const active = tempMutes.get(userId);
    const tempMuteLabel = active ? `TempMuted ${formatTimeLeft(active.expiresAt)} left` : "TempMute";

    const tempMuteItem = (
        <Menu.MenuItem id="hyprcord-tempmute" label={tempMuteLabel}>
            {active && (
                <Menu.MenuItem
                    id="hyprcord-tempmute-unmute-now"
                    label="Unmute Now"
                    action={() => {
                        clearTempMute(userId, true);
                        showToast("Removed TempMute and unmuted user.", Toasts.Type.SUCCESS);
                    }}
                />
            )}

            {DURATIONS.map(duration => (
                <Menu.MenuItem
                    id={`hyprcord-tempmute-${duration.ms}`}
                    key={duration.ms}
                    label={duration.label}
                    action={() => {
                        scheduleTempMute(userId, duration.ms);
                        showToast(`TempMuted for ${duration.label}.`, Toasts.Type.SUCCESS);
                    }}
                />
            ))}
        </Menu.MenuItem>
    );

    const voiceGroup = findGroupChildrenByChildId(["mute", "user-mute"], children, true) as any[] | null;
    if (voiceGroup) {
        const muteIndex = voiceGroup.findIndex(item => String(item?.props?.id ?? "").toLowerCase().includes("mute"));
        voiceGroup.splice(Math.max(0, muteIndex + 1), 0, tempMuteItem);
        return;
    }

    children.push(
        <Menu.MenuGroup key="hyprcord-tempmute-group">
            {tempMuteItem}
        </Menu.MenuGroup>
    );
}

function syncPatchRegistration() {
    const enabled = isHyprcordPluginEnabled(HYPRCORD_PLUGIN_IDS.TEMPMUTE);

    if (!enabled) {
        if (isPatchRegistered) {
            removeContextMenuPatch(USER_CONTEXT_NAV_ID, tempMuteContextPatch);
            isPatchRegistered = false;
        }

        clearAllTempMutes(true);
        return;
    }

    if (!isPatchRegistered) {
        addContextMenuPatch(USER_CONTEXT_NAV_ID, tempMuteContextPatch);
        isPatchRegistered = true;
        restorePersistedTempMutes();
    }
}

syncPatchRegistration();
onHyprcordPluginsStateChange(syncPatchRegistration);
