/* eslint-disable no-unreachable */
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');
const db = require('../db.js');
const wait = require('wait');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('login')
        .setDescription('Login to Spotify through Waveform, to gain access to spotify features!'),
    cooldown: 30,
	async execute(interaction, client, app) {

        return interaction.reply({ content: 'This command is temporarily unavailable. If you need to login to spotify to use spotify features on Waveform, ask Jeff and he can help you out.', ephemeral: true });

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

        await app.get(`/login`, async (req, res) => {
            await res.redirect(spotifyApi.createAuthorizeURL(scopes));
        });
        
        await app.get(`/callback`, async (req, res) => {
            const error = req.query.error;
            const code = req.query.code;
            
            if (error) {
                console.error('Callback Error:', error);
                res.send(`Callback Error: ${error}`);
                return;
            }
        
            await spotifyApi
                .authorizationCodeGrant(code)
                .then(async data => {
                    const access_token = data.body['access_token'];
                    const refresh_token = data.body['refresh_token'];
                    const expires_in = data.body['expires_in'];
        
                    spotifyApi.setAccessToken(access_token);
                    spotifyApi.setRefreshToken(refresh_token);
        
                    await db.user_stats.set(interaction.user.id, access_token, 'access_token');
                    await db.user_stats.set(interaction.user.id, refresh_token, 'refresh_token');
        
                    console.log(`Sucessfully retreived access_token. Expires in ${expires_in} s.`);
                    interaction.editReply('Authentication successful! You can now use the Spotify API with Waveform.\n' + 
                    'Make sure to use `/setupmailbox` to setup your Waveform Mailbox, now that you have logged in!');
                    res.send('Authentication success! You can now close the window, and return to discord.');
                })
                .catch(err => {
                    console.error('Error getting Tokens:', err);
                });

        });

        interaction.reply(`Click on [this link](http://waveformserver.hopto.org/login) to login and authorize Spotify for usage with Waveform!\nYou should only need to do this once.`);
        await wait(30000);
        await interaction.fetchReply().then(msg => {
            if (!msg.content.includes('successful!')) {
                msg.edit('Spotify Login authentication link expired. Please resend `/login` if you would like to run this again.');
            }
        });

    },
};
