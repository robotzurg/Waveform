const { SlashCommandBuilder } = require('@discordjs/builders');
require('dotenv').config();
const db = require('../db.js');
const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Login to Spotify through Waveform, to gain access to spotify features!'),
	async execute(interaction) {

        const scopes = [
            'playlist-read-collaborative',
            'playlist-modify-public',
            'playlist-read-private',
            'playlist-modify-private',
            'user-read-playback-state',
            'user-read-currently-playing',
            'ugc-image-upload',
        ];

        const spotifyApi = new SpotifyWebApi({
            redirectUri: process.env.SPOTIFY_REDIRECT_URI,
            clientId: process.env.SPOTIFY_API_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });

        const app = express();

        app.get('/login', (env, res) => {
            res.redirect(spotifyApi.createAuthorizeURL(scopes));
        });

        app.get('/callback', (req, res) => {
            const error = req.query.error;
            const code = req.query.code;

            if (error) {
                console.error('Callback Error:', error);
                res.send(`Callback Error: ${error}`);
                return;
            }

            spotifyApi
                .authorizationCodeGrant(code)
                .then(data => {
                    const access_token = data.body['access_token'];
                    const refresh_token = data.body['refresh_token'];
                    const expires_in = data.body['expires_in'];

                    spotifyApi.setAccessToken(access_token);
                    spotifyApi.setRefreshToken(refresh_token);

                    db.user_stats.set(interaction.user.id, access_token, 'access_token');
                    db.user_stats.set(interaction.user.id, refresh_token, 'refresh_token');

                    console.log(`Sucessfully retreived access_token. Expires in ${expires_in} s.`);
                    res.send('Success! You can now close the window.');
                })
                .catch(err => {
                    console.error('Error getting Tokens:', err);
                    res.send(`Error getting Tokens: ${err}`);
                });
        });

        interaction.editReply('Click on [this link](http://waveformserver.hopto.org) to login and authorize Spotify for usage with Waveform!\nYou should only need to do this once.');
    },
};