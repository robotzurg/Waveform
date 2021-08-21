const Discord = require('discord.js');
const db = require('../db.js');
const { get_args } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stars')
        .setDescription('See a full list of all the stars a user has on songs in the database.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User to see stars from. (Optional, Defaults to yourself)')
                .setRequired(false)),
    admin: false,
	async execute(interaction) {
        let args = [];
        args = get_args(interaction, args);

        if (args.length === 0) args[0] = interaction.user.id;

        let taggedMember;

        if (args.length != 0) {
            taggedMember = await interaction.guild.members.fetch(args[0]);
        } else {
            taggedMember = interaction.member;
        }

        const starCommandEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(taggedMember.user.avatarURL({ format: "png" }))
            .setTitle(`🌟 ${taggedMember.displayName}'s Stars 🌟`)
            .setDescription(`${db.user_stats.get(args[0], `star_list`).join('\n')}`);

        interaction.editReply({ embeds: [starCommandEmbed] });
	},
};