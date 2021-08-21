const db = require("../db.js");
const { get_args } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profileset')
		.setDescription('Set aspects of your profile.')
        .addStringOption(option => 
            option.setName('setting')
                .setDescription('Which setting to set.')
                .setRequired(true)
                .addChoice('Favorite Song', 'FS')
                .addChoice('Least Favorite Song', 'LFS'))

        .addStringOption(option => 
            option.setName('value')
                .setDescription('The value to put in. (Full song name!)')
                .setRequired(true)),
	admin: false,
	async execute(interaction) {
        let args = [];
        args = get_args(interaction, args);

        if (args[0] === 'FS') {
            db.user_stats.set(interaction.user.id, args[1], 'fav_song');
            interaction.editReply(`Set favorite song to ${args[1]}`);
        } else {
            db.user_stats.set(interaction.user.id, args[1], 'least_fav_song');
            interaction.editReply(`Set least favorite song to ${args[1]}`);
        }
    },
};