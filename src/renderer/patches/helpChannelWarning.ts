/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2026 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const TARGET_GUILD_ID = "1173279886065029291";
const TARGET_CHANNEL_ID = "1297590739911573585";
const HYPRCORD_HELP_URL = "https://discord.com/channels/1476515705309626430/1476627664700964987";

let shownForCurrentVisit = false;
let watcherStarted = false;

function isTargetChannelPath(pathname: string) {
    const match = pathname.match(/^\/channels\/([^/]+)\/([^/]+)/);
    if (!match) return false;

    const [, guildId, channelId] = match;
    return guildId === TARGET_GUILD_ID && channelId === TARGET_CHANNEL_ID;
}

function closeWarningModal() {
    const existing = document.querySelector<HTMLElement>('[data-hyprcord-help-warning="true"]');
    existing?.remove();
}

function showWarningModal() {
    if (document.querySelector('[data-hyprcord-help-warning="true"]')) return;

    const overlay = document.createElement("div");
    overlay.dataset.hyprcordHelpWarning = "true";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";
    overlay.style.background = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "10000";

    const modal = document.createElement("div");
    modal.style.maxWidth = "440px";
    modal.style.width = "100%";
    modal.style.borderRadius = "10px";
    modal.style.background = "var(--modal-background, #313338)";
    modal.style.color = "var(--header-primary, #ffffff)";
    modal.style.boxShadow = "0 10px 32px rgba(0, 0, 0, 0.35)";
    modal.style.padding = "20px";

    const title = document.createElement("h2");
    title.textContent = "Hold on";
    title.style.margin = "0 0 10px 0";
    title.style.fontSize = "22px";
    title.style.lineHeight = "28px";

    const message = document.createElement("p");
    message.textContent = "Before asking for help in equicord make sure the issue is not caused by Hyprcord.";
    message.style.margin = "0";
    message.style.color = "var(--text-normal, #dbdee1)";
    message.style.fontSize = "15px";
    message.style.lineHeight = "22px";

    const footer = document.createElement("div");
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "8px";
    footer.style.marginTop = "18px";

    const continueButton = document.createElement("button");
    continueButton.textContent = "Continue";
    continueButton.style.border = "none";
    continueButton.style.borderRadius = "6px";
    continueButton.style.padding = "8px 14px";
    continueButton.style.background = "var(--button-secondary-background, #4f545c)";
    continueButton.style.color = "var(--white-500, #fff)";
    continueButton.style.cursor = "pointer";
    continueButton.addEventListener("click", () => {
        closeWarningModal();
    });

    const serverButton = document.createElement("button");
    serverButton.textContent = "Hyprcord server";
    serverButton.style.border = "none";
    serverButton.style.borderRadius = "6px";
    serverButton.style.padding = "8px 14px";
    serverButton.style.background = "var(--button-filled-brand-background, #5865f2)";
    serverButton.style.color = "var(--white-500, #fff)";
    serverButton.style.cursor = "pointer";
    serverButton.addEventListener("click", () => {
        window.location.assign(HYPRCORD_HELP_URL);
    });

    footer.append(continueButton, serverButton);
    modal.append(title, message, footer);
    overlay.append(modal);
    document.body.append(overlay);
}

function checkAndShowWarning() {
    const inTargetChannel = isTargetChannelPath(window.location.pathname);
    if (!inTargetChannel) {
        shownForCurrentVisit = false;
        closeWarningModal();
        return;
    }

    if (shownForCurrentVisit) return;
    shownForCurrentVisit = true;
    showWarningModal();
}

function setupWarningWatcher() {
    if (watcherStarted) return;
    watcherStarted = true;

    let scheduled = false;
    const scheduleCheck = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            checkAndShowWarning();
        });
    };

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        const result = originalPushState.apply(history, args as Parameters<History["pushState"]>);
        scheduleCheck();
        return result;
    } as History["pushState"];

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
        const result = originalReplaceState.apply(history, args as Parameters<History["replaceState"]>);
        scheduleCheck();
        return result;
    } as History["replaceState"];

    window.addEventListener("popstate", scheduleCheck);
    window.addEventListener("hashchange", scheduleCheck);

    const observer = new MutationObserver(() => scheduleCheck());
    observer.observe(document.body, { childList: true, subtree: true });

    scheduleCheck();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupWarningWatcher, { once: true });
} else {
    setupWarningWatcher();
}
