/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SettingsRouter, Toasts } from "@equicord/types/webpack/common";
import { IpcCommands } from "shared/IpcEvents";

import { openScreenSharePicker } from "./components/ScreenSharePicker";
import { State } from "./settings";
import { localStorage } from "./utils";

type IpcCommandHandler = (data: any) => any;

const handlers = new Map<string, IpcCommandHandler>();

function respond(nonce: string, ok: boolean, data: any) {
    VesktopNative.commands.respond({ nonce, ok, data });
}

VesktopNative.commands.onCommand(async ({ message, nonce, data }) => {
    const handler = handlers.get(message);
    if (!handler) {
        return respond(nonce, false, `No handler for message: ${message}`);
    }

    try {
        const result = await handler(data);
        respond(nonce, true, result);
    } catch (err) {
        respond(nonce, false, String(err));
    }
});

export function onIpcCommand(channel: string, handler: IpcCommandHandler) {
    if (handlers.has(channel)) {
        throw new Error(`Handler for message ${channel} already exists`);
    }

    handlers.set(channel, handler);
}

export function offIpcCommand(channel: string) {
    handlers.delete(channel);
}

/* Generic Handlers */

onIpcCommand(IpcCommands.NAVIGATE_SETTINGS, () => {
    SettingsRouter.open("My Account");
});

onIpcCommand(IpcCommands.GET_LANGUAGES, () => navigator.languages);

onIpcCommand(IpcCommands.SCREEN_SHARE_PICKER, data => openScreenSharePicker(data.screens, data.skipPicker));

const LOW_MEMORY_MODE_KEY = "hyprcord:performance:low-memory-mode:v1";
const LOW_MEMORY_PREV_QUALITY_KEY = "hyprcord:performance:low-memory-prev-quality:v1";
const LOW_MEMORY_INDICATOR_ID = "hyprcord-low-memory-indicator";
const LOW_MEMORY_QUALITY = {
    resolution: "480",
    frameRate: "15"
} as const;

function removeLowMemoryIndicator() {
    document.getElementById(LOW_MEMORY_INDICATOR_ID)?.remove();
}

function mountLowMemoryIndicator() {
    const mount = () => {
        if (document.getElementById(LOW_MEMORY_INDICATOR_ID)) return;

        const indicator = document.createElement("div");
        indicator.id = LOW_MEMORY_INDICATOR_ID;
        indicator.title = "Low memory mode";

        Object.assign(indicator.style, {
            position: "fixed",
            top: "52px",
            right: "16px",
            zIndex: "999999",
            borderRadius: "8px",
            background: "rgba(0,0,0,0.55)",
            color: "#ffd34d",
            fontWeight: "700",
            fontSize: "11px",
            lineHeight: "1.25",
            padding: "8px 10px",
            pointerEvents: "none",
            webkitAppRegion: "no-drag",
            userSelect: "none"
        });

        const title = document.createElement("div");
        title.textContent = "LOW MODE";
        title.style.fontSize = "12px";
        title.style.marginBottom = "3px";

        const subtitle = document.createElement("div");
        subtitle.textContent = "if any error happens refer to the readme in the github repo";
        subtitle.style.maxWidth = "230px";
        subtitle.style.fontWeight = "600";

        indicator.append(title, subtitle);
        document.body.append(indicator);
    };

    if (document.body) {
        mount();
        return;
    }

    document.addEventListener("DOMContentLoaded", mount, { once: true });
}

onIpcCommand(
    IpcCommands.PERFORMANCE_SET_LOW_MEMORY_MODE,
    (data: { enabled: boolean; limitMb?: number; currentMb?: number }) => {
        const enabled = data?.enabled === true;
        const shouldShowIndicator =
            typeof data?.limitMb === "number" && typeof data?.currentMb === "number" && data.currentMb > data.limitMb;

        if (enabled) {
            const prev = State.store.screenshareQuality ?? {
                resolution: "720",
                frameRate: "30"
            };
            localStorage.setItem(LOW_MEMORY_PREV_QUALITY_KEY, JSON.stringify(prev));
            localStorage.setItem(LOW_MEMORY_MODE_KEY, "1");
            State.store.screenshareQuality = { ...LOW_MEMORY_QUALITY };
            if (shouldShowIndicator) {
                mountLowMemoryIndicator();
            } else {
                removeLowMemoryIndicator();
            }

            Toasts.show({
                message: `Low RAM detected (${data.currentMb ?? "?"}MB / ${data.limitMb ?? "?"}MB). Performance was reduced automatically.`,
                id: Toasts.genId(),
                type: Toasts.Type.MESSAGE
            });
            return true;
        }

        const wasLowMemoryMode = localStorage.getItem(LOW_MEMORY_MODE_KEY) === "1";
        localStorage.removeItem(LOW_MEMORY_MODE_KEY);
        removeLowMemoryIndicator();

        const previousRaw = localStorage.getItem(LOW_MEMORY_PREV_QUALITY_KEY);
        localStorage.removeItem(LOW_MEMORY_PREV_QUALITY_KEY);

        if (previousRaw) {
            try {
                const previous = JSON.parse(previousRaw);
                if (previous?.resolution && previous?.frameRate) {
                    State.store.screenshareQuality = previous;
                }
            } catch {
                // noop
            }
        }

        if (wasLowMemoryMode) {
            Toasts.show({
                message: "RAM usage stabilized. Performance settings were restored.",
                id: Toasts.genId(),
                type: Toasts.Type.MESSAGE
            });
        }

        return true;
    }
);
