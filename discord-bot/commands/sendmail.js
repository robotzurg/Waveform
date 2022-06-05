const { SlashCommandBuilder } = require('@discordjs/builders');
require('dotenv').config();
const db = require('../db.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sendmail')
        .setDescription('Send a song to a users mailbox playlist! (THIS REQUIRES SPOTIFY AUTHENTICATION WITH /LOGIN)')
        .addStringOption(option => 
            option.setName('link')
                .setDescription('Link to the spotify song you would like to send to the mailbox')
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User whose mailbox you would like to send a song to (MUST BE CONNECTED TO SPOTIFY)')
                .setRequired(true)),
	async execute(interaction) {

        let taggedUser = interaction.options.getUser('user');
        let taggedMember = await interaction.guild.members.fetch(taggedUser.id);    

        const access_token = db.user_stats.get(taggedUser.id, 'access_token');
        if (access_token == undefined || access_token == false) return interaction.editReply(`The user ${taggedMember.displayName} has not logged into Spotify through Waveform. Tell them to login using \`/login\`!`);
        const refresh_token = db.user_stats.get(taggedUser.id, 'refresh_token');
        const spotifyApi = new SpotifyWebApi({
            redirectUri: process.env.SPOTIFY_REDIRECT_URI,
            clientId: process.env.SPOTIFY_API_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        });

        let playlistId = db.user_stats.get(taggedUser.id, 'mailbox_playlist_id');
        let trackLink = interaction.options.getString('link');
        let trackUris = [];
        let name;
        let artists;

        if (!trackLink.includes('spotify')) return interaction.editReply('The link you put in is not a valid spotify link!');
        await getData(trackLink).then(data => {
            name = data.name;
            artists = data.artists.map(artist => artist.name);
            if (data.type == 'single') {
                trackUris.push(data.uri); // Used to add to playlist
            } else if (data.type == 'album') {
                for (let i = 0; i < data.tracks.items.length; i++) {
                    trackUris.push(data.tracks.items[i].uri);
                }
            }
        }).catch((err) => {
            console.log(err);
            return interaction.editReply('This track threw an error. Yikes!');
        });

        await spotifyApi.setRefreshToken(refresh_token);
        await spotifyApi.setAccessToken(access_token);
        await spotifyApi.refreshAccessToken().then(async data => {
            await db.user_stats.set(taggedUser.id, data.body["access_token"], 'access_token');
            await spotifyApi.setAccessToken(data.body["access_token"]);
        }); 

        // Add tracks to the mailbox playlist
        await spotifyApi.addTracksToPlaylist(playlistId, trackUris)
        .then(() => {
            interaction.editReply(`Sent the track **${artists.join(' & ')} - ${name}** to ${taggedMember.displayName}'s Spotify Mailbox!`);
            if (db.user_stats.get(taggedUser.id, 'mailbox_list') == undefined) {
                db.user_stats.set(taggedUser.id, [[`**${artists.join(' & ')} - ${name}**`, `${interaction.user.id}`]], 'mailbox_list');
            } else {
                db.user_stats.push(taggedUser.id, [`**${artists.join(' & ')} - ${name}**`, `${interaction.user.id}`], 'mailbox_list');
            }
        }, async () => {
            interaction.editReply(`The user ${taggedMember.displayName} does not have a valid mailbox setup. Make sure they have set one up using \`/setupmailbox\`!`);
        });
    },
};
