const db = require('../db.js');
const { SlashCommandBuilder } = require('discord.js');
const { parse_artist_song_data, spotify_api_setup } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deletemail')
        .setDescription('Manually remove a song from your mailbox without reviewing it.')
        .setDMPermission(true)
        .addSubcommand(subcommand =>
            subcommand.setName('single')
            .setDescription('Delete one thing from your mailbox')
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
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('all')
            .setDescription('Delete everything from your mailbox at once.')),
        
    help_desc: `Manually remove a song from your mailbox playlist.\nLeaving the artist/name/remixers arguments blank will pull from your spotify playback, if logged in.\n` +
    `Using the "all" subcommand will delete everything from your mailbox at once.`,
	async execute(interaction) {
        let subcommand = interaction.options.getSubcommand();
        let spotifyApi = await spotify_api_setup(interaction.user.id);
        let mailbox_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
        let artists, song, remixers, song_info, origArtistArray, displaySongName, temp_mailbox_list;

        if (subcommand == 'single') {
            artists = interaction.options.getString('artist');
            song = interaction.options.getString('name');
            remixers = interaction.options.getString('remixers');
            song_info = await parse_artist_song_data(interaction, artists, song, remixers);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                return;
            }
            
            origArtistArray = song_info.prod_artists;
            displaySongName = song_info.display_song_name;

            temp_mailbox_list = [];
            if (spotifyApi != false) {
                temp_mailbox_list = mailbox_list.filter(v => v.spotify_id == song_info.spotify_uri.replace('spotify:track:', '').replace('spotify:album:', ''));
                if (temp_mailbox_list.length == 0) {
                    temp_mailbox_list = mailbox_list.filter(v => v.display_name == `${origArtistArray.join(' & ')} - ${displaySongName}`);
                }
            } else {
                temp_mailbox_list = mailbox_list.filter(v => v.display_name == `${origArtistArray.join(' & ')} - ${displaySongName}`);
            }

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
                if (spotifyApi != false) {
                    mailbox_list = mailbox_list.filter(v => v.spotify_id != song_info.spotify_uri.replace('spotify:track:', '').replace('spotify:album:', ''));
                    mailbox_list = mailbox_list.filter(v => v.display_name != `${origArtistArray.join(' & ')} - ${displaySongName}`);
                } else {
                    mailbox_list = mailbox_list.filter(v => v.display_name != `${origArtistArray.join(' & ')} - ${displaySongName}`);
                }
        
                db.user_stats.set(interaction.user.id, mailbox_list, `mailbox_list`);

                interaction.reply(`Successfully removed **${origArtistArray.join(' & ')} - ${displaySongName}** from your mailbox.`);
            }
        } else {
            await interaction.deferReply();
            // Delete all
            for (let mail of mailbox_list) {
                let tracks = [];
                for (let track_uri of mail.track_uris) {
                    tracks.push({ uri: track_uri });
                } 

                let playlistId = db.user_stats.get(interaction.user.id, 'mailbox_playlist_id');

                // Remove from spotify playlist
                if (spotifyApi != false) {
                    await spotifyApi.removeTracksFromPlaylist(playlistId, tracks)
                    .then(() => {}, function(err) {
                        console.log('Something went wrong!', err);
                    });
                }
            }

            await db.user_stats.set(interaction.user.id, [], `mailbox_list`);
            await interaction.editReply(`Successfully removed all songs from your mailbox.`);
        }
    },
};