/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "renderer/settings";

export const HYPRCORD_PLUGINS_STATE_KEY = "hyprcord:plugins:state:v1";
export const HYPRCORD_PLUGINS_STATE_EVENT = "hyprcord:plugins:state-change";
const SETTINGS_KEY = "hyprcordPlugins" as const;

export const HYPRCORD_PLUGIN_IDS = {
    TEMPMUTE: "tempmute"
} as const;

export type HyprcordPluginId = (typeof HYPRCORD_PLUGIN_IDS)[keyof typeof HYPRCORD_PLUGIN_IDS];

export interface HyprcordPluginDefinition {
    id: HyprcordPluginId;
    name: string;
    description: string;
    details: string[];
}

export interface HyprcordPluginState {
    installed: boolean;
    enabled: boolean;
}

export type HyprcordPluginsState = Record<HyprcordPluginId, HyprcordPluginState>;

const DEFAULT_STATE: HyprcordPluginsState = {
    [HYPRCORD_PLUGIN_IDS.TEMPMUTE]: {
        installed: false,
        enabled: false
    }
};

let runtimeState: HyprcordPluginsState = cloneDefaultState();

export const HYPRCORD_AVAILABLE_PLUGINS: readonly HyprcordPluginDefinition[] = [
    {
        id: HYPRCORD_PLUGIN_IDS.TEMPMUTE,
        name: "TempMute",
        description:
            "Allows temporarily muting a user in voice chat for a client-side duration. This does not perform a server moderation mute.",
        details: [
            "Durations: 1 min, 15 min, 30 min, 1 hour, 6 hours, 12 hours, and 24 hours.",
            "Use via right click on a user in a voice channel.",
            "Shows normal mute icon; hover text can include TempMuted with remaining time.",
            "You can unmute early at any time.",
            "Disabled by default after install; enable it in Installed Plugins."
        ]
    }
];

function toState(input: any): HyprcordPluginsState {
    const state = cloneDefaultState();

    for (const id of Object.values(HYPRCORD_PLUGIN_IDS)) {
        const raw = input?.[id];
        if (!raw || typeof raw !== "object") continue;

        const installed = Boolean(raw.installed);
        const enabled = installed && Boolean(raw.enabled);

        state[id] = { installed, enabled };
    }

    return state;
}

export function loadHyprcordPluginsState(): HyprcordPluginsState {
    const storedSettingsState = Settings.store[SETTINGS_KEY];

    if (storedSettingsState) {
        const parsed = toState(storedSettingsState);
        runtimeState = cloneState(parsed);
        return parsed;
    }

    try {
        if (typeof localStorage === "undefined") return cloneState(runtimeState);

        const raw = localStorage.getItem(HYPRCORD_PLUGINS_STATE_KEY);
        if (!raw) return cloneState(runtimeState);

        const parsed = toState(JSON.parse(raw));
        runtimeState = cloneState(parsed);

        // One-time migration path from prior localStorage-only persistence.
        Settings.store[SETTINGS_KEY] = cloneState(parsed);
        return parsed;
    } catch {
        return cloneState(runtimeState);
    }
}

function notifyChange(state: HyprcordPluginsState) {
    try {
        if (typeof CustomEvent === "function") {
            window.dispatchEvent(
                new CustomEvent(HYPRCORD_PLUGINS_STATE_EVENT, {
                    detail: state
                })
            );
            return;
        }
    } catch {
        // no-op; fallback event is sent below
    }

    window.dispatchEvent(new Event(HYPRCORD_PLUGINS_STATE_EVENT));
}

function writeHyprcordPluginsState(state: HyprcordPluginsState) {
    runtimeState = cloneState(state);
    Settings.store[SETTINGS_KEY] = cloneState(state);

    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(HYPRCORD_PLUGINS_STATE_KEY, JSON.stringify(state));
        }
    } catch {
        // Keep runtime state even when persistence fails
    }

    notifyChange(state);
}

export function setHyprcordPluginState(id: HyprcordPluginId, patch: Partial<HyprcordPluginState>) {
    const state = loadHyprcordPluginsState();
    const current = state[id];
    const installed = patch.installed ?? current.installed;
    const enabled = installed ? (patch.enabled ?? current.enabled) : false;

    state[id] = {
        installed,
        enabled
    };

    writeHyprcordPluginsState(state);
    return state;
}

export function isHyprcordPluginEnabled(id: HyprcordPluginId) {
    const state = loadHyprcordPluginsState();
    const plugin = state[id];
    return Boolean(plugin.installed && plugin.enabled);
}

export function onHyprcordPluginsStateChange(listener: (state: HyprcordPluginsState) => void) {
    const handler = (event: Event) => {
        const custom = event as CustomEvent<HyprcordPluginsState>;
        listener(custom.detail ?? loadHyprcordPluginsState());
    };

    window.addEventListener(HYPRCORD_PLUGINS_STATE_EVENT, handler);
    return () => window.removeEventListener(HYPRCORD_PLUGINS_STATE_EVENT, handler);
}

function cloneDefaultState(): HyprcordPluginsState {
    return cloneState(DEFAULT_STATE);
}

function cloneState(state: HyprcordPluginsState): HyprcordPluginsState {
    return {
        [HYPRCORD_PLUGIN_IDS.TEMPMUTE]: {
            installed: Boolean(state[HYPRCORD_PLUGIN_IDS.TEMPMUTE]?.installed),
            enabled: Boolean(state[HYPRCORD_PLUGIN_IDS.TEMPMUTE]?.enabled)
        }
    };
}
