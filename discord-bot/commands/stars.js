const Discord = require('discord.js');
const db = require('../db.js');
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
        let user = interaction.options.getUser('user');

        if (user == null) user = interaction.user.id;

        let taggedMember;

        if (user == null) {
            taggedMember = await interaction.guild.members.fetch(user);
        } else {
            taggedMember = interaction.member;
        }

        const starCommandEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setThumbnail(taggedMember.user.avatarURL({ format: "png" }))
            .setTitle(`🌟 ${taggedMember.displayName}'s Stars 🌟`)
            .setDescription(`${db.user_stats.get(user, `star_list`).join('\n')}`);

        console.log(starCommandEmbed.thumbnail.url);

        interaction.editReply({ embeds: [starCommandEmbed] });
	},
};