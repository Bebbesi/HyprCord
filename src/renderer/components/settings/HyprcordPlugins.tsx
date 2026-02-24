/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, HeadingTertiary, Paragraph } from "@equicord/types/components";

import { cl } from "./Settings";

export default function HyprcordPlugins() {
    return (
        <section className={cl("plugins-placeholder")}>
            <HeadingTertiary>Hyprcord Plugins</HeadingTertiary>

            <Paragraph>Placeholder UI for upcoming Hyprcord plugin controls.</Paragraph>

            <div className={cl("plugins-placeholder-grid")}>
                <div className={cl("plugins-placeholder-card")}>
                    <HeadingTertiary>Plugin Browser</HeadingTertiary>
                    <Paragraph>Search and install community plugins from here.</Paragraph>
                    <Button variant="secondary" disabled>
                        Coming Soon
                    </Button>
                </div>

                <div className={cl("plugins-placeholder-card")}>
                    <HeadingTertiary>Installed Plugins</HeadingTertiary>
                    <Paragraph>Manage updates, permissions, and defaults.</Paragraph>
                    <Button variant="secondary" disabled>
                        Placeholder
                    </Button>
                </div>
            </div>
        </section>
    );
}
