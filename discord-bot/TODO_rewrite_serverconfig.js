const db = require('../db.js');
const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// TODO: Honestly, just re-write this whole command, it's confusing to use.

module.exports = {
	data: new SlashCommandBuilder()
		.setName('serverconfig')
		.setDescription('Configure Waveform preferences for the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('configuration')
                .setDescription('Which setting to configure.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('value')
                .setDescription('The value to put in for the configuration (REQUIRES AN ARGUMENT PLACED INTO CONFIGURATION.)')
                .setRequired(false)),
    help_desc: `TBD`,
	execute(interaction) {

        let config = interaction.options.getString('configuration');
        let value = interaction.options.getString('value');

        if (!db.server_settings.has(interaction.guild.id)) {
            db.server_settings.set(interaction.guild.id, {
                "review_channel": `<#${interaction.channel.id}>`,
                "review_filter": false,
                "star_cutoff": 3,
                "mailboxes": [],
            });
        }

        if (config == null && value == null) {
            const reviewChannel = db.server_settings.get(interaction.guild.id, 'review_channel');
            const reviewFilter = db.server_settings.get(interaction.guild.id, 'review_filter');
            const starCutoff = db.server_settings.get(interaction.guild.id, 'star_cutoff');

            const configEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle('🔧 Waveform Server Configuration Settings  🔧')
            .addFields([
                { name: 'Review Channel:', value: reviewChannel },
                { name: 'Review Chat Filter:', value: `${reviewFilter}` },
                { name: 'Star Cutoff for Hall of Fame:', value: `\`${starCutoff} ⭐\`` },
            ])
            .setFooter({ text: `Config for ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() });

            interaction.reply({ embeds: [configEmbed] });
        } else {
            if (config == 'RC') {

                if (!value.includes('#')) return interaction.reply('This config must be a channel.');
                db.server_settings.set(interaction.guild.id, value, 'review_channel');
                return interaction.reply(`Successfully changed the review channel to ${value}.`);

            } else if (config == 'RCF') {

                if (!value.includes('true') && !value.includes('false')) return interaction.reply('Parameter must be `true` or `false`.');
                db.server_settings.set(interaction.guild.id, (value == 'true'), 'review_filter');
                return interaction.reply(`Successfully set the review channel filter to \`${value}\`.`);

            } else if (config == 'SC') {

                if (isNaN(parseInt(value))) return interaction.reply('Parameter must be a number.');
                db.server_settings.set(interaction.guild.id, parseInt(value), 'star_cutoff');
                return interaction.reply(`Successfully set the hall of fame star cutoff to \`${value}\`.`);

            }
        }

	},
};