/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const HYPRCORD_REPO_URL = "https://github.com/Bebbesi/HyprCord";
const HYPRCORD_REPO_LABEL = "Bebbesi/HyprCord";
const HYPRCORD_ICON_URL = "equibop://static/icon.png";
const HYPRCORD_DISCORD_URL = "https://discord.gg/NtduskfeWh";

function openHyprcordRepo() {
    window.open(HYPRCORD_REPO_URL, "_blank", "noopener,noreferrer");
}

function openHyprcordDiscord() {
    window.open(HYPRCORD_DISCORD_URL, "_blank", "noopener,noreferrer");
}

interface HyprcordUpdateCheckResult {
    localVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
}

function findInstallUpdateButton(card: Element) {
    return card.querySelector<HTMLButtonElement>('[data-hyprcord-install-update-button="true"]');
}

function showInstallUpdateButton(card: Element, templateButton: HTMLButtonElement, status: HTMLElement) {
    let installButton = findInstallUpdateButton(card);
    if (!installButton) {
        installButton = templateButton.cloneNode(true) as HTMLButtonElement;
        installButton.textContent = "Fallback update";
        installButton.dataset.hyprcordInstallUpdateButton = "true";
        installButton.style.marginLeft = "8px";
        installButton.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();

            const checkButton = card.querySelector<HTMLButtonElement>('[data-hyprcord-update-bound="true"]');
            if (checkButton) checkButton.disabled = true;
            installButton!.disabled = true;
            status.textContent = "Installing update... Hyprcord will restart automatically.";

            try {
                await VesktopNative.app.installHyprcordUpdate();
            } catch (error) {
                console.error("[Hyprcord] Failed to install update.", error);
                status.textContent = "Failed to install update. Please try again later.";
                installButton!.disabled = false;
                if (checkButton) checkButton.disabled = false;
            }
        });

        templateButton.insertAdjacentElement("afterend", installButton);
    }

    installButton.disabled = false;
    installButton.hidden = false;
}

function hideInstallUpdateButton(card: Element) {
    const installButton = findInstallUpdateButton(card);
    if (!installButton) return;
    installButton.hidden = true;
}

function bindDiscordButton(button: Element) {
    if (button instanceof HTMLAnchorElement) {
        button.textContent = "Discord";
        button.setAttribute("href", HYPRCORD_DISCORD_URL);
        button.setAttribute("target", "_blank");
        button.setAttribute("rel", "noopener noreferrer");
        button.dataset.hyprcordDiscordBound = "true";
        return;
    }

    if (button instanceof HTMLButtonElement) {
        if (button.dataset.hyprcordDiscordBound === "true" && button.textContent?.trim() === "Discord") return;

        const replacement = button.cloneNode(true) as HTMLButtonElement;
        replacement.textContent = "Discord";
        replacement.dataset.hyprcordDiscordBound = "true";
        replacement.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openHyprcordDiscord();
        });
        button.replaceWith(replacement);
    }
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
        let discordButtonBound = false;
        for (const button of buttons) {
            const text = button.textContent?.trim();
            if (text !== "Donate" && text !== "Invite" && text !== "Discord") continue;

            if (!discordButtonBound) {
                bindDiscordButton(button);
                discordButtonBound = true;
                continue;
            }

            button.remove();
        }

        const icon = card.querySelector("img");
        if (icon) {
            icon.setAttribute("src", HYPRCORD_ICON_URL);
            icon.setAttribute("alt", "Hyprcord");
        }
    }
}

function patchSettingsSidebar(root: ParentNode = document) {
    const settingsRoots = Array.from(
        root.querySelectorAll?.<Element>(
            '[class*="standardSidebarView"], [class*="sidebarRegion"], [class*="contentRegion"]'
        ) ?? []
    );

    if (!settingsRoots.length) return;

    const nodesToPatch = new Set<Text>();
    for (const settingsRoot of settingsRoots) {
        const walker = document.createTreeWalker(settingsRoot, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const text = node.nodeValue?.trim();
            if (text === "Equicord" || text === "Equicord Settings") {
                nodesToPatch.add(node);
            }
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

function patchUpdateRepository(root: ParentNode = document) {
    const repositoryHeading = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(
        node => node.textContent?.trim() === "Repository"
    );
    if (!repositoryHeading) return;

    let repositoryCard: Element | null = repositoryHeading;
    while (repositoryCard && repositoryCard !== document.body) {
        const links = Array.from(repositoryCard.querySelectorAll("a")).filter(link => {
            const text = link.textContent ?? "";
            const href = link.getAttribute("href") ?? "";
            return (
                text.includes("Equicord/Equicord") ||
                href.includes("github.com/Equicord/Equicord") ||
                link.dataset.hyprcordRepoLink === "true"
            );
        });

        if (links.length) {
            for (const link of links) {
                link.textContent = HYPRCORD_REPO_LABEL;
                link.setAttribute("href", HYPRCORD_REPO_URL);
                link.setAttribute("target", "_blank");
                link.setAttribute("rel", "noopener noreferrer");
                link.dataset.hyprcordRepoLink = "true";
            }

            for (const node of repositoryCard.querySelectorAll("p")) {
                const text = node.textContent;
                if (!text || !text.includes("where Equicord fetches updates from")) continue;
                node.textContent = text.replace("Equicord", "Hyprcord");
            }
            break;
        }
        repositoryCard = repositoryCard.parentElement;
    }
}

function findUpdateStatusElement(card: Element) {
    const existingStatus = card.querySelector<HTMLElement>('[data-hyprcord-update-status="true"]');
    if (existingStatus) return existingStatus;

    const textStatus = Array.from(card.querySelectorAll<HTMLElement>("p, div, span")).find(node => {
        const text = node.textContent?.trim().toLowerCase();
        if (!text) return false;

        return (
            text.includes("running the latest version") ||
            text.includes("new version is available") ||
            text.includes("failed to check")
        );
    });

    if (textStatus) {
        textStatus.dataset.hyprcordUpdateStatus = "true";
        return textStatus;
    }

    const createdStatus = document.createElement("div");
    createdStatus.dataset.hyprcordUpdateStatus = "true";
    createdStatus.style.marginTop = "8px";
    createdStatus.style.fontSize = "14px";
    createdStatus.style.lineHeight = "20px";
    card.appendChild(createdStatus);
    return createdStatus;
}

function patchUpdateButton(root: ParentNode = document) {
    const updatesHeading = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(
        node => node.textContent?.trim() === "Updates"
    );
    if (!updatesHeading) return;

    const updatesCard = findContainerWithButtons(updatesHeading, ["Check for Updates"]);
    if (!updatesCard) return;

    const buttons = updatesCard.querySelectorAll("button");
    for (const button of buttons) {
        if (button.textContent?.trim() !== "Check for Updates") continue;
        if (button.dataset.hyprcordUpdateBound === "true") continue;

        const replacement = button.cloneNode(true) as HTMLButtonElement;
        replacement.dataset.hyprcordUpdateBound = "true";
        replacement.addEventListener("click", async event => {
            event.preventDefault();
            event.stopPropagation();

            const status = findUpdateStatusElement(updatesCard);
            replacement.disabled = true;
            status.textContent = "Checking for updates...";

            try {
                const { localVersion, latestVersion, updateAvailable } =
                    (await VesktopNative.app.checkHyprcordUpdates()) as HyprcordUpdateCheckResult;

                if (updateAvailable) {
                    status.textContent = `A new version is available: ${localVersion} -> ${latestVersion}.`;
                    showInstallUpdateButton(updatesCard, replacement, status);
                } else {
                    status.textContent = `Hyprcord is up to date (version ${localVersion}).`;
                    hideInstallUpdateButton(updatesCard);
                }
            } catch (error) {
                console.error("[Hyprcord] Failed to check for updates.", error);
                status.textContent = "Failed to check for updates. Please try again later.";
            } finally {
                replacement.disabled = false;
            }
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
        patchUpdateRepository();
        patchUpdateButton();
        patchSettingsSidebar();
    });
});

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        () => {
            patchSupportBanner();
            patchQuickActions();
            patchUpdateRepository();
            patchUpdateButton();
            patchSettingsSidebar();
            observer.observe(document.body, { childList: true, subtree: true });
        },
        { once: true }
    );
} else {
    patchSupportBanner();
    patchQuickActions();
    patchUpdateRepository();
    patchUpdateButton();
    patchSettingsSidebar();
    observer.observe(document.body, { childList: true, subtree: true });
}
