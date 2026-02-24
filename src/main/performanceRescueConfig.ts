/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Emergency RAM override for recovery when the app is hard to use.
 *
 * How to use:
 * 1) Set `enabled` to true.
 * 2) Set `forcedMaxRamMb`:
 *    - `null` => Unlimited (disables RAM cap)
 *    - number => force that RAM limit in MB (minimum 100)
 * 3) Restart Hyprcord.
 */
export const PerformanceRescueConfig = {
    enabled: false,
    forcedMaxRamMb: null as number | null
} as const;
