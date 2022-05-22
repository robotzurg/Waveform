const { SlashCommandBuilder } = require('@discordjs/builders');
require('dotenv').config();
const db = require('../db.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)')
        .addStringOption(option => 
            option.setName('link')
                .setDescription('Link')
                .setRequired(true)),
	async execute(interaction) {

        const access_token = db.user_stats.get(interaction.user.id, 'access_token');
        const refresh_token = db.user_stats.get(interaction.user.id, 'refresh_token');
        const spotifyApi = new SpotifyWebApi({
            redirectUri: process.env.SPOTIFY_REDIRECT_URI,
            clientId: process.env.SPOTIFY_API_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });
        let playlistId = db.user_stats.get(interaction.user.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUri;
        if (!trackLink.includes('spotify')) interaction.editReply('This is not a spotify link!');
        await getData(trackLink).then(data => {
            trackUri = data.uri; // Used to add to playlist
        }).catch(() => {
            return interaction.editReply('This track threw an error. Yikes!');
        });

        await spotifyApi.setRefreshToken(refresh_token);
        await spotifyApi.setAccessToken(access_token);
        await spotifyApi.refreshAccessToken().then(async data => {
            await db.user_stats.set(interaction.user.id, data.body["access_token"], 'access_token');
            await spotifyApi.setAccessToken(data.body["access_token"]);
        }); 

        if (playlistId == undefined) {
            // Create a private playlist
            await spotifyApi.createPlaylist('Waveform Mailbox', { 'description': 'A test mailbox playlist for Waveform', 'public': true })
            .then(data => {
                playlistId = data.body.id;
                db.user_stats.set(interaction.user.id, data.body.id, 'mailbox_playlist_id');
            }, function(err) {
                console.log('Something went wrong!', err);
            });
        }

        // Add tracks to a playlist
        await spotifyApi.addTracksToPlaylist(playlistId, [trackUri])
        .then(() => {
            interaction.editReply('Added tracks to playlist!');
        }, function(err) {
            console.log('Something went wrong!', err);
        });
    },
};
