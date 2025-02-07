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
                    .setDescription('Song name to put in.')
                    .setRequired(true),
            ),
        ) 
        .addSubcommand((subcommand) =>
        subcommand.setName('fav_artist')
        .setDescription("Set what your favorite artist currently is on your Waveform Profile!")
        .addStringOption((option) =>
            option
                .setName('artist')
                .setDescription('Artist name to put in.')
                .setRequired(true),
            ),
        ) 
        .addSubcommand((subcommand) =>
        subcommand.setName('fav_genres')
        .setDescription("Set what your favorite genres are currently is on your Waveform Profile!")
        .addStringOption((option) =>
            option
                .setName('genre_1')
                .setDescription('1st genre to put in your profile (required).')
                .setRequired(true),
            )
        .addStringOption((option) =>
            option
                .setName('genre_2')
                .setDescription('2nd genre to put in your profile.')
                .setRequired(false),
            )
        .addStringOption((option) =>
            option
                .setName('genre_3')
                .setDescription('3rd genre to put in your profile.')
                .setRequired(false),
            ),
        ),
    help_desc: `Allows you to edit entries on your Waveform profile, such as your favorite artist, favorite song, and favorite genres.\n\n`
    + `The favorite genres can have up to 3 genres put in, separated by \`&\``,
	async execute(interaction, client) {
        try {
        let genre1, genre2, genre3, genreList;
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
                genre1 = interaction.options.getString('genre_1');
                genre2 = interaction.options.getString('genre_2');
                genre3 = interaction.options.getString('genre_3');
                genreList = [genre1];
                if (genre2 != null) genreList.push(genre2);
                if (genre3 != null) genreList.push(genre3);
                db.user_stats.set(interaction.user.id, genreList, 'fav_genres');
                interaction.reply(`Set favorite genres to ${genreList.join(' & ')}!`);
            break;
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};