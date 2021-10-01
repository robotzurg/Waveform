const Discord = require('discord.js');
const db = require("../db.js");
const { get_args } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Display your (or others) user profile!')

        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose profile you\'d like to see.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        let args = [];
        args = get_args(interaction, args);

        let taggedUser;
        let taggedMember;
        
        if (args.length != 0) {
            taggedMember = await interaction.guild.members.fetch(args[0]);
            taggedUser = taggedMember.user;
        } else {
            taggedMember = interaction.member;
            taggedUser = interaction.user;
        }

        const profileEmbed = new Discord.MessageEmbed()       
        .setColor(`${taggedMember.displayHexColor}`)
        .setTitle(`${taggedMember.displayName}'s Profile`)
        .setDescription(`Favorite Song: **${db.user_stats.get(taggedUser.id, 'fav_song')}**\n` +
        `Least Favorite Song: **${db.user_stats.get(taggedUser.id, 'least_fav_song')}**\n` +
        `Most Recent Review: **${db.user_stats.get(taggedUser.id, 'recent_review')}**\n` +
        `Number of Stars Given: \`${db.user_stats.get(taggedUser.id, 'star_list').length} ⭐\``)
        .setThumbnail(taggedUser.avatarURL({ format: "png", dynamic: false }));

        interaction.editReply({ embeds: [profileEmbed] });
    },
};