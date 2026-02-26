/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
import { chmod } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { USER_AGENT } from "../constants";
import { VENCORD_DIR } from "../vencordDir";
import { downloadFile, fetchie } from "./http";

const API_BASE = "https://api.github.com";
const HYPRCORD_REPO = "/repos/Bebbesi/HyprCord";

export interface ReleaseData {
    name: string;
    tag_name: string;
    html_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

export interface ReleaseAsset {
    name: string;
    browser_download_url: string;
}

export async function githubGet(endpoint: string) {
    const opts: RequestInit = {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": USER_AGENT
        }
    };

    if (process.env.GITHUB_TOKEN) (opts.headers! as any).Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    return fetchie(API_BASE + endpoint, opts, { retryOnNetworkError: true });
}

export async function downloadVencordAsar() {
    const release = (await githubGet(`${HYPRCORD_REPO}/releases/latest`).then(res => res.json())) as ReleaseData;
    const preferredAssetNames = ["equibop.asar", "hyprcord.asar"];

    const preferredAsset = preferredAssetNames
        .map(name => release.assets.find(asset => asset.name.toLowerCase() === name))
        .find(Boolean);
    const asarAsset = release.assets.find(asset => asset.name.toLowerCase().endsWith(".asar"));
    const targetAsset = preferredAsset ?? asarAsset;

    if (!targetAsset) {
        const assetNames = release.assets.map(asset => asset.name).join(", ");
        throw new Error(
            `Latest release ${release.tag_name} does not contain an .asar asset. Found assets: ${assetNames || "none"}`
        );
    }

    await downloadFile(targetAsset.browser_download_url, VENCORD_DIR, {}, { retryOnNetworkError: true });
}

function pickInstallerAsset(assets: ReleaseAsset[]) {
    const lowerAssets = assets.map(asset => ({ asset, name: asset.name.toLowerCase() }));

    if (process.platform === "win32") {
        return (
            lowerAssets.find(({ name }) => name.includes("setup") && name.endsWith(".exe"))?.asset ??
            lowerAssets.find(({ name }) => name.endsWith(".exe"))?.asset
        );
    }

    if (process.platform === "darwin") {
        return (
            lowerAssets.find(({ name }) => name.endsWith(".dmg"))?.asset ??
            lowerAssets.find(({ name }) => name.endsWith(".zip"))?.asset
        );
    }

    return (
        lowerAssets.find(({ name }) => name.endsWith(".appimage"))?.asset ??
        lowerAssets.find(({ name }) => name.endsWith(".deb"))?.asset ??
        lowerAssets.find(({ name }) => name.endsWith(".rpm"))?.asset ??
        null
    );
}

export async function downloadLatestInstallerAsset() {
    const release = (await githubGet(`${HYPRCORD_REPO}/releases/latest`).then(res => res.json())) as ReleaseData;
    const installerAsset = pickInstallerAsset(release.assets);

    if (!installerAsset) {
        const assetNames = release.assets.map(asset => asset.name).join(", ");
        throw new Error(
            `Latest release ${release.tag_name} does not contain a supported installer for ${process.platform}. Found assets: ${assetNames || "none"}`
        );
    }

    const downloadPath = join(tmpdir(), "hyprcord-updates", installerAsset.name);
    await downloadFile(installerAsset.browser_download_url, downloadPath, {}, { retryOnNetworkError: true });

    if (process.platform !== "win32") {
        await chmod(downloadPath, 0o755).catch(() => {});
    }

    return {
        downloadPath,
        assetName: installerAsset.name,
        versionTag: release.tag_name
    };
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "equibop/main.js"));
}

export async function ensureVencordFiles() {
    if (existsSync(VENCORD_DIR)) return;

    await downloadVencordAsar();
}
