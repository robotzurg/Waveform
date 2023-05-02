const db = require('../db.js');
const { SlashCommandBuilder } = require('discord.js');
const { parse_artist_song_data, spotify_api_setup } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletemail')
        .setDescription('Manually remove a song from your mailbox without reviewing it.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('name')
                .setDescription('The name of the song/EP/LP.')
                .setAutocomplete(true)
                .setRequired(false))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {
        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }
        
        let origArtistArray = song_info.prod_artists;
        let displaySongName = song_info.display_song_name;

        let spotifyApi = await spotify_api_setup(interaction.user.id);

        let mailbox_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
        let temp_mailbox_list = mailbox_list.filter(v => v.display_name == `${origArtistArray.join(' & ')} - ${displaySongName}`);

        if (temp_mailbox_list.length == 0) {
            interaction.reply(`**${origArtistArray.join(' & ')} - ${displaySongName}** is not in your mailbox.`);
        } else {
            let tracks = [];
            for (let track_uri of temp_mailbox_list[0].track_uris) {
                tracks.push({ uri: track_uri });
            } 

            let playlistId = db.user_stats.get(interaction.user.id, 'mailbox_playlist_id');

            // Remove from spotify playlist
            if (spotifyApi != false) {
                spotifyApi.removeTracksFromPlaylist(playlistId, tracks)
                .then(() => {}, function(err) {
                    console.log('Something went wrong!', err);
                });
            }

            // Remove from local playlist
            mailbox_list = mailbox_list.filter(v => v.display_name != `${origArtistArray.join(' & ')} - ${displaySongName}`);
            db.user_stats.set(interaction.user.id, mailbox_list, `mailbox_list`);

            interaction.reply(`Successfully removed **${origArtistArray.join(' & ')} - ${displaySongName}** from your mailbox.`);
        }
        
    },
};