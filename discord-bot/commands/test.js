const { SlashCommandBuilder } = require('@discordjs/builders');
require('dotenv').config();
const db = require('../db.js');
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)'),
	async execute(interaction) {

        const access_token = db.user_stats.get(interaction.user.id, 'access_token');
        const refresh_token = db.user_stats.get(interaction.user.id, 'refresh_token');
        const spotifyApi = new SpotifyWebApi();
        spotifyApi.setAccessToken(access_token);   
        spotifyApi.setRefreshToken(refresh_token);
        let playlistId;

        spotifyApi.refreshAccessToken();

        // Create a private playlist
        await spotifyApi.createPlaylist('Test Playlist Made from Waveform', { 'public': true })
        .then(function(data) {
            playlistId = data.body.id;
        }, function(err) {
        return console.log('Something went wrong!', err);
        });

        await console.log(playlistId);

        await spotifyApi.addTracksToPlaylist(playlistId, ["spotify:track:2dQRlI5w6NiTu3ESGjMYOs"])
        .then(function() {
            console.log('Added tracks to playlist!');
        }, function(err) {
            console.log('Something went wrong!', err);
        });

        await interaction.editReply('Created playlist!');


    },
};