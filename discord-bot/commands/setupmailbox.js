const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require("../func.js");
const SpotifyWebApi = require('spotify-web-api-node');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setupmailbox')
        .setDescription('Setup a mailbox in Waveform through Spotify itself!')
        .addChannelOption(option => 
            option.setName('mailbox_channel')
                .setDescription('The channel for mailbox reviews. (Just put in the channel that has your name)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('playlist_name')
                .setDescription('The name of the mailbox playlist on Spotify (defaults to Waveform Mailbox)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('playlist_desc')
                .setDescription('The description for your mailbox playlist on Spotify.')
                .setRequired(false)),
	admin: true,
	async execute(interaction) {
        try {

        // Setup spotify web api stuff
        const access_token = db.user_stats.get(interaction.user.id, 'access_token');
        if (access_token == undefined) interaction.editReply(`You have not logged into Spotify through Waveform! You can do so through \`/login\`.`);
        const refresh_token = db.user_stats.get(interaction.user.id, 'refresh_token');
        const spotifyApi = new SpotifyWebApi({
            redirectUri: process.env.SPOTIFY_REDIRECT_URI,
            clientId: process.env.SPOTIFY_API_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });

        // Refresh access token just to make sure we still have a proper one
        await spotifyApi.setRefreshToken(refresh_token);
        await spotifyApi.setAccessToken(access_token);
        await spotifyApi.refreshAccessToken().then(async data => {
            await db.user_stats.set(interaction.user.id, data.body["access_token"], 'access_token');
            await spotifyApi.setAccessToken(data.body["access_token"]);
        }); 
            
        const mailbox_channel = interaction.options.getChannel('mailbox_channel');
        let playlist_name = interaction.options.getString('playlist_name');
        if (playlist_name == null) playlist_name = 'Waveform Mailbox';
        let playlist_desc = interaction.options.getString('playlist_desc');
        if (playlist_desc == null) playlist_desc = 'Your own personal Waveform Mailbox for people to send you music! Will be updated with music that people send you!';

        spotifyApi.createPlaylist(playlist_name, { 'description': playlist_desc, 'public': true })
        .then(function(data) {
            db.user_stats.set(interaction.user.id, data.body.id, 'mailbox_playlist_id');
            db.user_stats.set(interaction.user.id, mailbox_channel.id, 'mailbox');
            db.server_settings.push(interaction.guild.id, mailbox_channel.name, 'mailboxes');
            interaction.editReply(`Your mailbox has now been setup on Spotify, and \`/sendmail\` can now be used with it!\n` +
            `**NOTE: DO NOT DELETE THIS PLAYLIST, OR ELSE YOUR MAILBOX WILL NOT WORK PROPERLY!**\n` + 
            `If you need to delete the playlist for whatever reason, make sure you run this command again to setup a new one!`);
        }, function(err) {
            interaction.editReply(`Something went wrong with your mailbox creation, you should probably let Jeff know!`);
            console.log('Something went wrong!', err);
        });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};