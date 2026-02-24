/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition } from "@equicord/types/api/Badges";

const HYPRCORD_DEVELOPER_USER_ID = "673167077280055326";

addProfileBadge({
    key: "hyprcord-developer",
    description: "Hyprcord Developer",
    iconSrc: "equibop://static/dev.png",
    position: BadgePosition.END,
    shouldShow: ({ userId }) => userId === HYPRCORD_DEVELOPER_USER_ID,
    props: {
        alt: "Hyprcord Developer"
    }
});
