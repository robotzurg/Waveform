const db = require("../db.js");
const { get_args, handle_error } = require('../func.js');
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
                .addChoice('Least Favorite Song', 'LFS')
                .addChoice('Favorite Genres', 'G'))
        .addStringOption(option => 
            option.setName('value')
                .setDescription('The value to put in. (Full song name, if doing genres split with &)')
                .setRequired(true)),
	admin: false,
	async execute(interaction) {
        try {

        let args = [];
        args = get_args(interaction, args);

        if (args[0] == 'FS') {
            db.user_stats.set(interaction.user.id, args[1], 'fav_song');
            interaction.editReply(`Set favorite song to ${args[1]}!`);
        } else if (args[0] == 'LFS') {
            db.user_stats.set(interaction.user.id, args[1], 'least_fav_song');
            interaction.editReply(`Set least favorite song to ${args[1]}!`);
        } else if (args[0] == 'G') {
            let splitGenres = args[1].split(' & ');
            if (splitGenres.length > 3) return interaction.editReply('Favorite genres are limited to a max of 3 entries. Do not put more then this.');
            db.user_stats.set(interaction.user.id, splitGenres, 'fav_genres');
            interaction.editReply(`Set favorite genres to ${splitGenres.join(' & ')}!`);
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};