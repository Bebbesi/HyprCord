/*
 * Vesktop, a desktop app aiming to give you a snappier Discord Experience
 * Copyright (c) 2025 Vendicated and Vesktop contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText, Button, FormSwitch, HeadingTertiary, Paragraph } from "@equicord/types/components";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@equicord/types/utils";
import { Toasts, useEffect, useState } from "@equicord/types/webpack/common";
import {
    HYPRCORD_AVAILABLE_PLUGINS,
    HyprcordPluginDefinition,
    HyprcordPluginsState,
    loadHyprcordPluginsState,
    onHyprcordPluginsStateChange,
    setHyprcordPluginState
} from "renderer/plugins/hyprcordPluginsState";

import { cl } from "./Settings";

export default function HyprcordPlugins() {
    const [pluginsState, setPluginsState] = useState<HyprcordPluginsState>(loadHyprcordPluginsState());
    const pluginSuggestionUrl = "https://discord.gg/m4mkhvcsQe";

    useEffect(() => onHyprcordPluginsStateChange(setPluginsState), []);

    const isInstalled = (pluginId: HyprcordPluginDefinition["id"]) => Boolean(pluginsState[pluginId]?.installed);

    const showToast = (message: string, type = Toasts.Type.MESSAGE) =>
        Toasts.show({
            message,
            id: Toasts.genId(),
            type
        });

    const installPlugin = (plugin: HyprcordPluginDefinition) => {
        try {
            const nextState = setHyprcordPluginState(plugin.id, { installed: true, enabled: false });
            setPluginsState(nextState);
            showToast(`${plugin.name} installed. It is disabled by default.`, Toasts.Type.SUCCESS);
        } catch {
            showToast(`Failed to install ${plugin.name}.`, Toasts.Type.FAILURE);
        }
    };

    const uninstallPlugin = (pluginId: HyprcordPluginDefinition["id"]) => {
        const nextState = setHyprcordPluginState(pluginId, { installed: false, enabled: false });
        setPluginsState(nextState);
    };

    const togglePlugin = (pluginId: HyprcordPluginDefinition["id"], enabled: boolean) => {
        const nextState = setHyprcordPluginState(pluginId, { enabled });
        setPluginsState(nextState);
    };

    const openPluginBrowser = () => {
        setPluginsState(loadHyprcordPluginsState());

        openModal(modalProps => (
            <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
                <ModalHeader>
                    <BaseText size="lg" weight="semibold" tag="h3" style={{ flexGrow: 1 }}>
                        Browse Hyprcord Plugins
                    </BaseText>
                    <ModalCloseButton onClick={modalProps.onClose} />
                </ModalHeader>

                <ModalContent>
                    <div className={cl("plugins-browser-list")}>
                        {HYPRCORD_AVAILABLE_PLUGINS.map(plugin => (
                            <article className={cl("plugins-browser-card")} key={plugin.id}>
                                <BaseText size="lg" weight="semibold" tag="h4">
                                    {plugin.name}
                                </BaseText>
                                <Paragraph>{plugin.description}</Paragraph>

                                <ul className={cl("plugins-browser-details")}>
                                    {plugin.details.map(detail => (
                                        <li key={detail}>{detail}</li>
                                    ))}
                                </ul>

                                <Button
                                    onClick={() => {
                                        installPlugin(plugin);
                                        modalProps.onClose();
                                    }}
                                    disabled={isInstalled(plugin.id)}
                                >
                                    {isInstalled(plugin.id) ? "Installed" : "Install"}
                                </Button>
                            </article>
                        ))}
                    </div>
                </ModalContent>
            </ModalRoot>
        ));
    };

    const installedPlugins = HYPRCORD_AVAILABLE_PLUGINS.filter(plugin => pluginsState[plugin.id].installed);
    const openSuggestionServer = () => window.open(pluginSuggestionUrl, "_blank", "noopener,noreferrer");

    return (
        <section className={cl("plugins-placeholder")}>
            <HeadingTertiary>Hyprcord Plugins</HeadingTertiary>

            <Paragraph>Plugin controls with persistence across restarts.</Paragraph>

            <div className={cl("plugins-placeholder-grid")}>
                <div className={cl("plugins-placeholder-card")}>
                    <HeadingTertiary>Plugin Browser</HeadingTertiary>
                    <Paragraph>Search and install community plugins from here.</Paragraph>
                    <Button variant="secondary" onClick={openPluginBrowser}>
                        Browse Plugins
                    </Button>
                </div>

                <div className={cl("plugins-placeholder-card")}>
                    <HeadingTertiary>Installed Plugins</HeadingTertiary>
                    <Paragraph>Manage plugin status and uninstall items from your list.</Paragraph>
                    <Paragraph>New installs are disabled by default to keep runtime overhead low.</Paragraph>
                    {installedPlugins.length === 0 ? (
                        <Paragraph>No plugins installed yet.</Paragraph>
                    ) : (
                        <div className={cl("plugins-installed-list")}>
                            {installedPlugins.map(plugin => (
                                <article className={cl("plugins-installed-row")} key={plugin.id}>
                                    <div className={cl("plugins-installed-copy")}>
                                        <BaseText size="md" weight="semibold" tag="h4">
                                            {plugin.name}
                                        </BaseText>
                                    </div>
                                    <div className={cl("plugins-installed-actions")}>
                                        <FormSwitch
                                            title="Enabled"
                                            value={pluginsState[plugin.id].enabled}
                                            onChange={enabled => togglePlugin(plugin.id, enabled)}
                                            hideBorder
                                        />
                                        <Button
                                            variant="dangerPrimary"
                                            size="small"
                                            onClick={() => uninstallPlugin(plugin.id)}
                                        >
                                            Uninstall
                                        </Button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className={cl("plugins-suggest")}>
                <Paragraph>Want to suggest a plugin?</Paragraph>
                <Button variant="secondary" onClick={openSuggestionServer}>
                    Join the Discord server
                </Button>
            </div>
        </section>
    );
}
