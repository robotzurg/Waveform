/* eslint-disable no-unused-vars */
/* eslint-disable no-unreachable */
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

// SETUP CONFIG MENU FOR EACH MEMBER IN A SEPARATE COMMAND BEFORE RELEASING!

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Your personal Waveform config menu.')
        .setDMPermission(false),
    help_desc: `View and edit your personal configuration for Waveform.`,
	async execute(interaction) {

        // Configuration Select Menu
        let configMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('config')
                    .setPlaceholder('Change your Waveform configs.')
                    .addOptions(
                        {
                            label: 'Mail Filter',
                            description: 'Change your receiving song mail filter.',
                            value: 'mail_filter',
                        },
                        {
                            label: 'Mailbox Review Ping',
                            description: 'Set whether you want to be pinged if someone reviews a song you sent to them in mailbox.',
                            value: 'review_ping',
                        },
                    ),
            );

        let user_profile = db.user_stats.get(interaction.user.id);
        let config_data = user_profile.config;
        let config_desc = [`**Mail Filter:**\n${Object.entries(config_data.mail_filter).map(v => {
            switch(v[0]) {
                case 'apple': v[0] = 'Apple'; break;
                case 'sc': v[0] = 'SoundCloud'; break;
                case 'sp': v[0] = 'Spotify Singles'; break;
                case 'sp_ep': v[0] = 'Spotify EPs'; break;
                case 'sp_lp': v[0] = 'Spotify LPs'; break;
                case 'yt': v[0] = 'YouTube'; break;
            }

            if (v[1] == true) v[1] = '✅';
            if (v[1] == false) v[1] = '❌';
            v = v.join(': ');
            return v;
        }).join('\n')}\n`,
        `**Mailbox Review Ping:** \`${config_data.review_ping}\``];

        let mailFilterSel = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('mail_filter_sel')
                    .setPlaceholder('Change your mail filter settings')
                    .addOptions(
                        {
                            label: 'Apple Music',
                            description: `Toggle filter of songs from Apple Music.`,
                            value: 'apple',
                            emoji: '<:applelogo:1083272391381225542>',
                        },
                        {
                            label: 'SoundCloud',
                            description: 'Toggle filter of songs from SoundCloud.',
                            value: 'sc',
                            emoji: '<:soundcloud:1083272493072142337>',
                        },
                        {
                            label: 'Spotify Singles',
                            description: 'Toggle filter of singles/remixes from Spotify.',
                            value: 'sp',
                            emoji: '<:spotify:961509676053323806>',
                        },
                        {
                            label: 'Spotify EPs',
                            description: 'Toggle filter of EPs from Spotify.',
                            value: 'sp_ep',
                            emoji: '<:spotify:961509676053323806>',
                        },
                        {
                            label: 'Spotify LPs',
                            description: 'Toggle filter of LPs from Spotify.',
                            value: 'sp_lp',
                            emoji: '<:spotify:961509676053323806>',
                        },
                        {
                            label: 'YouTube',
                            description: 'Toggle filter of songs from YouTube.',
                            value: 'yt',
                            emoji: '<:youtube:1083272437489221783>',
                        },
                    ),
            );

        let configEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setThumbnail(interaction.user.avatarURL({ extension: "png" }))
        .setTitle('⚙️ Waveform Config Menu ⚙️')
        .setDescription(config_desc.join('\n'));
        await interaction.reply({ content: null, embeds: [configEmbed], components: [configMenu] });

        const collector = interaction.channel.createMessageComponentCollector({ time: 60000 });
        await collector.on('collect', async sel => {
            if (sel.customId == 'config') {

                if (sel.values[0] == 'mail_filter') {
                    await sel.update({ content: 'Select the filter option you\'d like to change.', embeds: [], components: [mailFilterSel] });
                } else if (sel.values[0] == 'review_ping') {
                    await db.user_stats.set(interaction.user.id, !(user_profile.config.review_ping), 'config.review_ping');
                    config_desc[1] = `**Mailbox Review Ping:** \`${db.user_stats.get(interaction.user.id, 'config.review_ping')}\``;
                    user_profile = db.user_stats.get(interaction.user.id);
                    configEmbed.setDescription(config_desc.join('\n'));
                    await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });
                }

            } else if (sel.customId == 'mail_filter_sel') {
                user_profile.config.mail_filter[sel.values[0]] = !user_profile.config.mail_filter[sel.values[0]];
                db.user_stats.set(interaction.user.id, user_profile.config.mail_filter, 'config.mail_filter');
                config_desc[0] = `**Mail Filter:**\n${Object.entries(user_profile.config.mail_filter).map(v => {
                    switch(v[0]) {
                        case 'apple': v[0] = 'Apple'; break;
                        case 'sc': v[0] = 'SoundCloud'; break;
                        case 'sp': v[0] = 'Spotify Singles'; break;
                        case 'sp_ep': v[0] = 'Spotify EPs'; break;
                        case 'sp_lp': v[0] = 'Spotify LPs'; break;
                        case 'yt': v[0] = 'YouTube'; break;
                    }

                    if (v[1] == true) v[1] = '✅';
                    if (v[1] == false) v[1] = '❌';
                    v = v.join(': ');
                    return v;
                }).join('\n')}\n`;
                configEmbed.setDescription(config_desc.join('\n'));
                await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });
            }
        });

        await collector.on('end', async () => {
            interaction.editReply({ content: null, embeds: [configEmbed], components: [] });
        });
    },
};
