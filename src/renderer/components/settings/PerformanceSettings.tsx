/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText, Button, Heading, Paragraph } from "@equicord/types/components";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@equicord/types/utils";
import { Toasts, useEffect, useMemo, useState } from "@equicord/types/webpack/common";
import type { ChangeEvent } from "react";

import { cl, SettingsComponent } from "./Settings";

const MIN_RAM_MB = 100;
const SLIDER_MAX_MB = 32700;
const SLIDER_STEP_MB = 100;
const UNLIMITED_SLIDER_VALUE = SLIDER_MAX_MB + SLIDER_STEP_MB;

function clampRamLimit(limitMb: number) {
    return Math.max(MIN_RAM_MB, Math.min(SLIDER_MAX_MB, Math.round(limitMb / SLIDER_STEP_MB) * SLIDER_STEP_MB));
}

function limitToSlider(limitMb: number | null) {
    if (limitMb == null) return UNLIMITED_SLIDER_VALUE;
    return clampRamLimit(limitMb);
}

function sliderToLimit(sliderValue: number): number | null {
    if (sliderValue >= UNLIMITED_SLIDER_VALUE) return null;
    return clampRamLimit(sliderValue);
}

function formatLimit(limitMb: number | null) {
    return limitMb == null ? "Unlimited" : `${limitMb.toLocaleString()} MB`;
}

export const PerformanceSettingsButton: SettingsComponent = () => {
    return <Button onClick={openPerformanceModal}>Performance</Button>;
};

function openPerformanceModal() {
    openModal(props => (
        <ModalRoot {...props} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <BaseText size="lg" weight="semibold" tag="h3" style={{ flexGrow: 1 }}>
                    Performance
                </BaseText>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>

            <ModalContent>
                <PerformanceSettingsEditor />
            </ModalContent>
        </ModalRoot>
    ));
}

function PerformanceSettingsEditor() {
    const [loaded, setLoaded] = useState(false);
    const [savedLimit, setSavedLimit] = useState<number | null>(null);
    const [sliderValue, setSliderValue] = useState(UNLIMITED_SLIDER_VALUE);

    useEffect(() => {
        let cancelled = false;

        VesktopNative.performance
            .getMaxRamMb()
            .then(limitMb => {
                if (cancelled) return;

                const normalized = limitMb == null ? null : clampRamLimit(limitMb);
                setSavedLimit(normalized);
                setSliderValue(limitToSlider(normalized));
                setLoaded(true);
            })
            .catch(() => {
                if (cancelled) return;

                setSavedLimit(null);
                setSliderValue(UNLIMITED_SLIDER_VALUE);
                setLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const selectedLimit = useMemo(() => sliderToLimit(sliderValue), [sliderValue]);
    const changed = selectedLimit !== savedLimit;

    const onSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSliderValue(Number(event.currentTarget.value));
    };

    const applyLimit = async () => {
        if (!loaded || !changed) return;

        try {
            await VesktopNative.performance.setMaxRamMb(selectedLimit, true);
            setSavedLimit(selectedLimit);

            Toasts.show({
                message: "Performance RAM limit saved. Restarting Hyprcord to apply it.",
                id: Toasts.genId(),
                type: Toasts.Type.SUCCESS
            });
        } catch {
            Toasts.show({
                message: "Failed to save RAM limit.",
                id: Toasts.genId(),
                type: Toasts.Type.FAILURE
            });
        }
    };

    return (
        <div className={cl("performance-panel")}>
            <Heading tag="h5">Maximum RAM</Heading>
            <Paragraph>
                Set the maximum RAM budget for Hyprcord. Minimum is {MIN_RAM_MB}MB, and the maximum is Unlimited.
                Changes only take effect after restart. do not set 100 mb it will be unstable
            </Paragraph>
            <Paragraph>
                When a RAM limit is enabled, Hyprcord will automatically reduce runtime performance if RAM usage goes
                above the configured cap.
            </Paragraph>

            <div className={cl("performance-slider-wrap")}>
                <input
                    type="range"
                    min={MIN_RAM_MB}
                    max={UNLIMITED_SLIDER_VALUE}
                    step={SLIDER_STEP_MB}
                    value={sliderValue}
                    onChange={onSliderChange}
                    className={cl("performance-slider")}
                />
                <BaseText size="md" weight="semibold" tag="p">
                    Selected: {formatLimit(selectedLimit)}
                </BaseText>
                <BaseText size="sm" color="text-muted" tag="p">
                    Saved: {formatLimit(savedLimit)}
                </BaseText>
                <BaseText size="sm" color="text-muted" tag="p">
                    Move the slider all the way right for Unlimited.
                </BaseText>
            </div>

            <div className={cl("performance-actions")}>
                <Button onClick={applyLimit} disabled={!loaded || !changed}>
                    Apply & Restart
                </Button>
            </div>
        </div>
    );
}
