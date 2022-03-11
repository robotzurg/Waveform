const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func');
const Spotify = require('node-spotify-api');
require('dotenv').config();


module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)'),
	async execute(interaction) {
        try {
            interaction.editReply('Test');
            const client_id = process.env.SPOTIFY_API_ID; // Your client id
            const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
            const song = `Tsu Nami Dream About You`;

            const spotify = new Spotify({
                id: client_id,
                secret: client_secret,
            });

            await spotify.search({ type: "track", query: song }).then(function(data) {  
                console.log(data.tracks.items[0].external_urls.spotify);
            });
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};