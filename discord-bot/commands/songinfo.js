const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func');
const Spotify = require('node-spotify-api');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('songinfo')
        .setDescription('Get info from spotify about a song')
        .addStringOption(option => 
            option.setName('query')
                .setDescription('Query to search on spotify')
                .setRequired(true)),
	admin: true,
	async execute(interaction) {
        try {

            const client_id = process.env.SPOTIFY_API_ID; // Your client id
            const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
            const song = interaction.options.getString('query');

            const spotify = new Spotify({
                id: client_id,
                secret: client_secret,
            });

            spotify.search({ type: "track", query: song }, function(err, data) {
                if (err) {
                    console.log("Error occured: " + err);
                }
                
                try {
                    let artists = data.tracks.items[0].album.artists;
                    let artistArray = [];
                    artistArray = artists.map(v => v.name);

                    interaction.editReply(`Data for \`${song}\`\n` + 
                    `\nResult: **${artistArray.join(' & ')} - ${data.tracks.items[0].album.name}**` +
                    `\nReleased on: **${data.tracks.items[0].album.release_date}**` +
                    `\n<:spotify:899365299814559784> [Spotify Link](<${data.tracks.items[0].album.external_urls.spotify}>)` + 
                    `\n${data.tracks.items[0].album.images[0].url}`);
                } catch (err) {
                    interaction.editReply(`Couldn't find art for this query: \`${song}\`.`);
                }
            });

        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
    },
};