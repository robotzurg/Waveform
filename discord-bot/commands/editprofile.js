const db = require("../db.js");
const { handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editprofile')
		.setDescription('Edit your Waveform profile.')
        .setDMPermission(false)
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
        subcommand.setName('fav_artist')
        .setDescription("Set what your favorite artist currently is on your Waveform Profile!")
        .addStringOption((option) =>
            option
                .setName('artist')
                .setDescription('Artist name to put in')
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
    help_desc: `Allows you to edit entries on your Waveform profile, such as your favorite artist, favorite song, and favorite genres.\n\n`
    + `The favorite genres can have up to 3 genres put in, separated by \`&\``,
	async execute(interaction) {
        try {
            
        let split_genres;
        switch (interaction.options.getSubcommand()) {
            case 'fav_song': 
                db.user_stats.set(interaction.user.id, interaction.options.getString('song_name'), 'fav_song');
                interaction.reply(`Set favorite song to ${interaction.options.getString('song_name')}!`);
            break;
            case 'fav_artist': 
                db.user_stats.set(interaction.user.id, interaction.options.getString('artist'), 'fav_artist');
                interaction.reply(`Set favorite artist to ${interaction.options.getString('artist')}!`);
            break;
            case 'fav_genres':
                split_genres = interaction.options.getString('genres').split(' & ');
                if (split_genres.length > 3) return interaction.reply('Favorite genres are limited to a max of 3 entries. Do not put more then this.');
                db.user_stats.set(interaction.user.id, split_genres, 'fav_genres');
                interaction.reply(`Set favorite genres to ${split_genres.join(' & ')}!`);
            break;
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};