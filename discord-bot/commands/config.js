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
                            label: 'Review Ping',
                            description: 'Set whether you want to be pinged if someone reviews a song you sent to them.',
                            value: 'review_ping',
                        },
                    ),
            );

        let mailFilter = new ActionRowBuilder()
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
                            label: 'Review Ping',
                            description: 'Set whether you want to be pinged if someone reviews a song you sent to them.',
                            value: 'review_ping',
                        },
                    ),
            );
        
        let user_profile = db.user_stats.get(interaction.user.id);
        let config_data = user_profile.config;
        let config_desc = [`**Mail Filter:**\n\`\`\`\n${Object.entries(config_data.mail_filter).map(v => v.join(': ')).join('\n')}\`\`\``,
        `**Review Ping:** \`${config_data.review_ping}\``];

        let configEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setThumbnail(interaction.user.avatarURL({ extension: "png" }))
        .setTitle('⚙️ Waveform Config Menu ⚙️')
        .setDescription(config_desc.join('\n'));
        await interaction.reply({ content: null, embeds: [configEmbed], components: [configMenu] });
    },
};
