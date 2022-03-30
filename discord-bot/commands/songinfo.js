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
                    let results = data.tracks.items;
                    let songData = data.tracks.items[0];
                    for (let i = 0; i < results.length; i++) {
                        if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${song.toLowerCase()}`) {
                            songData = results[i];
                            break;
                        } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${song.toLowerCase()}`) {
                            songData = results[i];
                        }
                    }
                    let artists = songData.album.artists;
                    let artistArray = [];
                    artistArray = artists.map(v => v.name);

                    interaction.editReply(`Data for \`${song}\`\n` + 
                    `\nResult: **${artistArray.join(' & ')} - ${songData.album.name}**` +
                    `\nReleased on: **${songData.album.release_date}**` +
                    `\n<:spotify:899365299814559784> [Spotify Link](<${songData.album.external_urls.spotify}>)` + 
                    `\n${songData.album.images[0].url}`);
                } catch (err) {
                    console.log(err);
                    interaction.editReply(`Couldn't find art for this query: \`${song}\`.`);
                }
            });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};