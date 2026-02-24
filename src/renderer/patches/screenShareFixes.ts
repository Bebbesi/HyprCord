/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2023 Vendicated and Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@equicord/types/utils";
import { currentSettings, resetCurrentStreamSettings } from "renderer/components/ScreenSharePicker";
import { State } from "renderer/settings";
import { isLinux, localStorage } from "renderer/utils";

const logger = new Logger("EquibopStreamFixes");
const MAX_STREAM_HEIGHT = 1080;
const MAX_STREAM_FPS = 30;
const LOW_MEMORY_MODE_KEY = "hyprcord:performance:low-memory-mode:v1";

function getClampedStreamQuality() {
    const lowMemoryMode = localStorage.getItem(LOW_MEMORY_MODE_KEY) === "1";

    const rawFrameRate = Number(State.store.screenshareQuality?.frameRate ?? 30);
    const rawHeight = Number(State.store.screenshareQuality?.resolution ?? 720);

    const maxFps = lowMemoryMode ? 15 : MAX_STREAM_FPS;
    const maxHeight = lowMemoryMode ? 480 : MAX_STREAM_HEIGHT;

    const frameRate = Math.max(15, Math.min(maxFps, Number.isFinite(rawFrameRate) ? rawFrameRate : 30));
    const height = Math.max(480, Math.min(maxHeight, Number.isFinite(rawHeight) ? rawHeight : 720));
    const width = Math.round(height * (16 / 9));

    return { frameRate, height, width };
}

if (isLinux) {
    const original = navigator.mediaDevices.getDisplayMedia;

    async function getVirtmic() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevice = devices.find(({ label }) => label === "vencord-screen-share");
            return audioDevice?.deviceId;
        } catch (error) {
            return null;
        }
    }

    navigator.mediaDevices.getDisplayMedia = async function (opts) {
        const stream = await original.call(this, opts);
        const id = await getVirtmic();

        const { frameRate, height, width } = getClampedStreamQuality();
        const track = stream.getVideoTracks()[0];

        track.contentHint = String(currentSettings?.contentHint);

        const constraints = {
            ...track.getConstraints(),
            frameRate: { min: frameRate, ideal: frameRate },
            width: { min: 640, ideal: width, max: width },
            height: { min: 480, ideal: height, max: height },
            advanced: [{ width: width, height: height }],
            resizeMode: "none"
        };

        track
            .applyConstraints(constraints)
            .then(() => {
                logger.info("Applied constraints successfully. New constraints: ", track.getConstraints());
            })
            .catch(e => logger.error("Failed to apply constraints.", e));

        if (id) {
            const audio = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: {
                        exact: id
                    },
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false,
                    channelCount: 2,
                    sampleRate: 48000,
                    sampleSize: 16
                }
            });

            for (const audioTrack of stream.getAudioTracks()) {
                stream.removeTrack(audioTrack);
                audioTrack.stop();
            }

            const replacementTrack = audio.getAudioTracks()[0];
            if (replacementTrack) stream.addTrack(replacementTrack);

            const stopInjectedAudio = () => {
                audio.getTracks().forEach(t => t.stop());
                resetCurrentStreamSettings();
            };

            replacementTrack?.addEventListener("ended", stopInjectedAudio, { once: true });
            track.addEventListener("ended", stopInjectedAudio, { once: true });
        } else {
            track.addEventListener("ended", resetCurrentStreamSettings, { once: true });
        }

        return stream;
    };
}
