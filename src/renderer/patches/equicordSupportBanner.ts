/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const HYPRCORD_REPO_URL = "https://github.com/Bebbesi/HyprCord";
const HYPRCORD_ICON_URL = "equibop://static/icon.png";

function openHyprcordRepo() {
    window.open(HYPRCORD_REPO_URL, "_blank", "noopener,noreferrer");
}

function findContainerWithButtons(start: Element, buttonTexts: string[]) {
    let node: Element | null = start;

    while (node && node !== document.body) {
        const buttons = node.querySelectorAll("button, a");
        for (const button of buttons) {
            const text = button.textContent?.trim();
            if (text && buttonTexts.includes(text)) return node;
        }
        node = node.parentElement;
    }

    return null;
}

function patchSupportBanner(root: ParentNode = document) {
    const headings = root.querySelectorAll("h1, h2, h3, h4, h5, h6");

    for (const heading of headings) {
        if (heading.textContent?.trim() !== "Support the Project") continue;

        heading.textContent = "Hyprcord";

        const card = findContainerWithButtons(heading, ["Donate", "Invite"]);
        if (!card) continue;

        const description = card.querySelector("p");
        if (description) {
            description.textContent = "A light weight version of discord developed by Bebbesi";
        }

        const paragraphs = card.querySelectorAll("p");
        for (const paragraph of paragraphs) {
            if (!paragraph.textContent?.toLowerCase().includes("supporting the development of equicord")) continue;
            paragraph.remove();
        }

        const buttons = card.querySelectorAll("button, a");
        for (const button of buttons) {
            const text = button.textContent?.trim();
            if (text === "Donate" || text === "Invite") {
                button.remove();
            }
        }

        const icon = card.querySelector("img");
        if (icon) {
            icon.setAttribute("src", HYPRCORD_ICON_URL);
            icon.setAttribute("alt", "Hyprcord");
        }
    }
}

function patchSettingsSidebar(root: ParentNode = document) {
    const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
    const nodesToPatch: Text[] = [];

    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const text = node.nodeValue?.trim();
        if (text === "Equicord" || text === "Equicord Settings") {
            nodesToPatch.push(node);
        }
    }

    for (const node of nodesToPatch) {
        if (!node.nodeValue) continue;
        if (node.nodeValue.trim() === "Equicord Settings") {
            node.nodeValue = node.nodeValue.replace("Equicord Settings", "Hyprcord Settings");
            continue;
        }

        if (node.nodeValue.trim() === "Equicord") {
            node.nodeValue = node.nodeValue.replace("Equicord", "Hyprcord");
        }
    }
}

function patchQuickActions(root: ParentNode = document) {
    const quickActionsHeading = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(
        node => node.textContent?.trim() === "Quick Actions"
    );
    if (!quickActionsHeading) return;

    const quickActionsCard = findContainerWithButtons(quickActionsHeading, ["View Source Code"]);
    if (!quickActionsCard) return;

    const links = quickActionsCard.querySelectorAll("a");
    for (const link of links) {
        if (link.textContent?.trim() !== "View Source Code") continue;
        link.setAttribute("href", HYPRCORD_REPO_URL);
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
    }

    const buttons = quickActionsCard.querySelectorAll("button");
    for (const button of buttons) {
        if (button.textContent?.trim() !== "View Source Code") continue;
        if (button.dataset.hyprcordRepoBound === "true") continue;

        const replacement = button.cloneNode(true) as HTMLButtonElement;
        replacement.dataset.hyprcordRepoBound = "true";
        replacement.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openHyprcordRepo();
        });
        button.replaceWith(replacement);
    }
}

let pending = false;
const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
        pending = false;
        patchSupportBanner();
        patchQuickActions();
        patchSettingsSidebar();
    });
});

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            patchSupportBanner();
            patchQuickActions();
            patchSettingsSidebar();
            observer.observe(document.body, { childList: true, subtree: true });
        },
        { once: true }
    );
} else {
    patchSupportBanner();
    patchQuickActions();
    patchSettingsSidebar();
    observer.observe(document.body, { childList: true, subtree: true });
}
