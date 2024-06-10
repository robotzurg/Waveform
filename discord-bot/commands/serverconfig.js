const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db.js');
const { getEmbedColor } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverconfig')
        .setDescription('Server config menu for Waveform.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    help_desc: `Configure Waveform server preferences.\n\n` + 
    `For configuring your specific Waveform preferences, use \`/config\`.`,
	async execute(interaction) {

        let serverProfile = db.server_settings.get(interaction.guild.id);
        let config_data = serverProfile.config;
        if (config_data === undefined) {
            serverProfile.config = {
                disable_ratings: false,
                disable_global: false,
            },
            config_data = serverProfile.config;
            db.server_settings.set(interaction.guild.id, serverProfile);
        }
        if (config_data.disable_ratings === undefined) config_data.disable_ratings = false;
        if (config_data.disable_global === undefined) config_data.disable_global = false;

        // Main Configuration Select Menu
        let configMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('config')
                    .setPlaceholder('Change your server Waveform configs.')
                    .addOptions(
                        {
                            label: 'Disable Music Ratings',
                            description: 'Disable music ratings server wide. Will block people from rating when reviewing.',
                            emoji: '💯',
                            value: 'disable_ratings',
                        },
                        {
                            label: 'Disable Global Reviews',
                            description: 'Disable reviews from other servers. This will only show reviews made in this server on Waveform. Disables global commands.',
                            emoji: ':globe_with_meridians:',
                            value: 'disable_global',
                        },
                    ),
            );

        db.user_stats.set(interaction.user.id, config_data, `config`);

        let config_desc = [`**Disable Ratings Server-Wide:** ${config_data.disable_ratings ? '✅' : '❌'}`,
            `**Disable Global Reviews:** ${config_data.disable_global ? '✅' : '❌'}`,
        ];

        let configEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(interaction.user.avatarURL({ extension: "png" }))
        .setTitle('⚙️ Waveform Server Config Menu ⚙️')
        .setDescription(config_desc.join('\n'));
        await interaction.reply({ content: null, embeds: [configEmbed], components: [configMenu] });

        let int_filter = i => i.user.id == interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter: int_filter, idle: 120000 });
        await collector.on('collect', async sel => {
            if (sel.customId == 'config') {
                if (sel.values[0] == 'disable_ratings') {
                    await db.server_settings.set(interaction.guild.id, !(serverProfile.config.disable_ratings), 'config.disable_ratings');
                    config_desc[0] = `**Disable Ratings Servier-Wide:** ${db.server_settings.get(interaction.guild.id, 'config.disable_ratings') ? '✅' : `❌`}`;
                    serverProfile = db.server_settings.get(interaction.guild.id);
                    configEmbed.setDescription(config_desc.join('\n'));
                    await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });
                } 
                else if (sel.values[0] == 'disable_global') {
                    await db.server_settings.set(interaction.guild.id, !(serverProfile.config.disable_global), 'config.disable_global');
                    config_desc[1] = `**Disable Global Reviews:** ${db.server_settings.get(interaction.guild.id, 'config.disable_global') ? '✅' : `❌`}`;
                    serverProfile = db.server_settings.get(interaction.guild.id);
                    configEmbed.setDescription(config_desc.join('\n'));
                    await sel.update({ content: null, embeds: [configEmbed], components: [configMenu] });
                }
            }
        });

        await collector.on('end', async () => {
            interaction.editReply({ embeds: [configEmbed], components: [] });
        });
    },
};
