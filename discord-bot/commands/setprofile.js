const db = require("../db.js");
const { handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setprofile')
		.setDescription('Setup aspects of your Waveform profile!')
        .addSubcommand((subcommand) =>
            subcommand.setName('fav_song')
            .setDescription("Set what your favorite song currently is on your Waveform Profile!")
            .addStringOption((option) =>
                option
                    .setName('song_name')
                    .setDescription('Song name to put in (Full song name!)')
                    .setRequired(true),
            ),
        ) 
        .addSubcommand((subcommand) =>
        subcommand.setName('least_fav_song')
        .setDescription("Set what your least favorite song currently is on your Waveform Profile!")
        .addStringOption((option) =>
            option
                .setName('song_name')
                .setDescription('Song name to put in (Full song name!)')
                .setRequired(true),
            ),
        ) 
        .addSubcommand((subcommand) =>
        subcommand.setName('fav_genres')
        .setDescription("Set what your favorite genres are currently is on your Waveform Profile!")
        .addStringOption((option) =>
            option
                .setName('genres')
                .setDescription('Genre names to put in (seperated by &, max of 3!)')
                .setRequired(true),
            ),
        ),

	async execute(interaction) {
        try {
            
        let split_genres;
        switch (interaction.options.getSubcommand()) {
            case 'Favorite Song': 
                db.user_stats.set(interaction.user.id, interaction.options.getString('song_name'), 'fav_song');
                interaction.editReply(`Set favorite song to ${interaction.options.getString('song_name')}!`);
            break;
            case 'Least Favorite Song': 
                db.user_stats.set(interaction.user.id, interaction.options.getString('song_name'), 'least_fav_song');
                interaction.editReply(`Set least favorite song to ${interaction.options.getString('song_name')}!`);
            break;
            case 'Favorite Genres':
                split_genres = interaction.options.getString('genres').split(' & ');
                if (split_genres.length > 3) return interaction.editReply('Favorite genres are limited to a max of 3 entries. Do not put more then this.');
                db.user_stats.set(interaction.user.id, split_genres, 'fav_genres');
                interaction.editReply(`Set favorite genres to ${split_genres.join(' & ')}!`);
            break;
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};