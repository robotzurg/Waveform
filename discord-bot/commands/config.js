const Discord = require("discord.js");
const db = require('../db.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('config')
		.setDescription('Configure settings for Waveform. Using no arguments shows the config list.')
        .addStringOption(option => 
            option.setName('configuration')
                .setDescription('Which setting to configure.')
                .setRequired(false)
                .addChoice('Review Channel', 'RC')
                .addChoice('Review Chat Filter', 'RCF')
                .addChoice('Hall of Fame Channel', 'HFC')
                .addChoice('Star Cutoff for HoF', 'SC'))

        .addStringOption(option => 
            option.setName('value')
                .setDescription('The value to put in for the configuration (REQUIRES AN ARGUMENT PLACED INTO CONFIGURATION.)')
                .setRequired(false)),
    admin: true,
	execute(interaction) {

        let args = [];     
        interaction.options._hoistedOptions.forEach((value) => {
            args.push(value.value);
        });

        if (!db.server_settings.has(interaction.guild.id)) {
            db.server_settings.set(interaction.guild.id, {
                "hall_of_fame_channel": `<#${interaction.channel.id}>`,
                "review_channel": `<#${interaction.channel.id}>`,
                "review_filter": false,
                "star_cutoff": 3,
                "mailboxes": [],
            });
        }

        if (!args.length) {
            const reviewChannel = db.server_settings.get(interaction.guild.id, 'review_channel');
            const hofChannel = db.server_settings.get(interaction.guild.id, 'hall_of_fame_channel');
            const reviewFilter = db.server_settings.get(interaction.guild.id, 'review_filter');
            const starCutoff = db.server_settings.get(interaction.guild.id, 'star_cutoff');

            const configEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle('🔧 Waveform Configuration Settings  🔧')
            .addField('Review Channel:', reviewChannel)
            .addField('Review Chat Filter:', `\`${reviewFilter}\``)
            .addField('Hall of Fame Channel:', hofChannel)
            .addField('Star Cutoff for Hall of Fame:', `\`${starCutoff} ⭐\``)
            .setFooter(`Config for ${interaction.guild.name}`, interaction.guild.iconURL());

            interaction.editReply({ embeds: [configEmbed] });
        } else {
            if (args[0] === 'RC') {

                if (!args[1].includes('#')) return interaction.editReply('This config must be a channel.');
                db.server_settings.set(interaction.guild.id, args[1], 'review_channel');
                return interaction.editReply(`Successfully changed the review channel to ${args[1]}.`);

            } else if (args[0] === 'HFC') {

                if (!args[1].includes('#')) return interaction.editReply('This config must be a channel.');
                db.server_settings.set(interaction.guild.id, args[1], 'hall_of_fame_channel');
                return interaction.editReply(`Successfully changed the hall of fame channel to ${args[1]}.`);

            } else if (args[0] === 'RCF') {

                if (!args[1].includes('true') && !args[1].includes('false')) return interaction.editReply('Parameter must be `true` or `false`.');
                db.server_settings.set(interaction.guild.id, (args[1] === 'true'), 'review_filter');
                return interaction.editReply(`Successfully set the review channel filter to \`${args[1]}\`.`);

            } else if (args[0] === 'SC') {

                if (isNaN(parseInt(args[1]))) return interaction.editReply('Parameter must be a number.');
                db.server_settings.set(interaction.guild.id, parseInt(args[1]), 'star_cutoff');
                return interaction.editReply(`Successfully set the hall of fame star cutoff to \`${args[1]}\`.`);

            }
        }

	},
};