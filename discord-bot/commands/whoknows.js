/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { lfm_api_setup, getLfmUsers, parse_artist_song_data, getEmbedColor, grab_spotify_art, grab_spotify_artist_art } = require('../func');
require('dotenv').config();
const db = require('../db.js');
// const { spotify_api_setup } = require('../func.js');
// const lastfm = require('lastfm-njs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whoknows')
        .setDescription('See who has heard a specific type of music on Last.fm.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('See who has heard a specific song on Last.fm, out of logged in Waveform users.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the main artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the song.')
                    .setAutocomplete(true)
                    .setRequired(false))
                
            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Remix artists on the song, if any.')
                    .setAutocomplete(true)
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('album')
            .setDescription('See who has heard a specific EP or album on Last.fm, out of logged in Waveform users.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the main artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('album_name')
                    .setDescription('The name of the EP/LP.')
                    .setAutocomplete(true)
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('artist')
            .setDescription('See who has heard a specific artist on Last.fm, out of logged in Waveform users.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist.')
                    .setAutocomplete(true)
                    .setRequired(false))),
    help_desc: `View who knows a song/EP/LP/artist on Last.fm, out of logged in Last.fm Waveform users in your server.`,
	async execute(interaction) {
        await interaction.deferReply();
        let lfmUserApi = await lfm_api_setup(interaction.user.id);
        let lfmUsers = await getLfmUsers(interaction);

        let subcommand = interaction.options.getSubcommand();
        let artistArg = interaction.options.getString('artist');
        let songArg = interaction.options.getString('song_name');
        let epArg = interaction.options.getString('album_name');
        let queryMusicArg = subcommand == 'song' ? songArg : epArg;
        let remixerArg = interaction.options.getString('remixers');
        let whoKnowsEmbed = new EmbedBuilder();

        let song_info = await parse_artist_song_data(interaction, artistArg, queryMusicArg, remixerArg);
        if (song_info.error != undefined) {
            await interaction.editReply(song_info.error);
            return;
        }

        console.log(song_info);

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        // let artistArray = song_info.db_artists;
        // rmxArtistArray = song_info.remix_artists;
        let displaySongName = song_info.display_song_name;
        let lfmRecentSongs = { success: false };
        let lfmArtistArray = song_info.lastfm_artists;
        let lfmSongName = song_info.lastfm_song_name;
        let artistPfp = false;
        if (lfmUserApi != false && songArg === null && epArg == null && artistArg === null) lfmRecentSongs = await lfmUserApi.user_getRecentTracks({ limit: 1 });

        for (let i = 0; i < lfmUsers.length; i++) {
            let lfmUsername = lfmUsers[i].lfm_username;
            let lfmData = { success: false };

            if (lfmRecentSongs.success) {
                if (lfmRecentSongs.track.length != 0) {
                    let lfmTestArtist = lfmRecentSongs.track[0].artist['#text'];
                    if (origArtistArray.some(v => {
                        return v.toLowerCase() == lfmRecentSongs.track[0].artist['#text'].toLowerCase();
                    })) {
                        switch (subcommand) {
                            case 'song': lfmData = await lfmUserApi.track_getInfo({ artist: lfmTestArtist, track: lfmRecentSongs.track[0].name, username: lfmUsername }); break;
                            case 'album': lfmData = await lfmUserApi.album_getInfo({ artist: lfmTestArtist, album: lfmRecentSongs.track[0].album['#text'], username: lfmUsername }); break;
                            case 'artist': lfmData = await lfmUserApi.artist_getInfo({ artist: lfmTestArtist, username: lfmUsername });
                        }
                        
                    }
                }
            }

            if (lfmData.success == false) {
                switch (subcommand) {
                    case 'song': lfmData = await lfmUserApi.track_getInfo({ artist: lfmArtistArray[0], track: lfmSongName, username: lfmUsername }); break;
                    case 'album': lfmData = await lfmUserApi.album_getInfo({ artist: lfmArtistArray[0], album: lfmSongName, username: lfmUsername }); break;
                    case 'artist': lfmData = await lfmUserApi.artist_getInfo({ artist: lfmArtistArray[0], username: lfmUsername });
                }
                if (lfmData.success == false) {
                    for (let artist of origArtistArray) {
                        switch (subcommand) {
                            case 'song': lfmData = await lfmUserApi.track_getInfo({ artist: artist.replace('\\&', '&'), track: lfmSongName, username: lfmUsername }); break;
                            case 'album': lfmData = await lfmUserApi.album_getInfo({ artist: artist.replace('\\&', '&'), album: lfmSongName, username: lfmUsername }); break;
                            case 'artist': lfmData = await lfmUserApi.artist_getInfo({ artist: artist.replace('\\&', '&'), username: lfmUsername });
                        }
                        if (lfmData.success) {
                            break;
                        }
                    }
                }
            }

            if (lfmData.success) {
                switch (subcommand) {
                    case 'song': lfmUsers[i].scrobbles = parseInt(lfmData.userplaycount); break;
                    case 'album': lfmUsers[i].scrobbles = parseInt(lfmData.userplaycount); break;
                    case 'artist': lfmUsers[i].scrobbles = parseInt(lfmData.stats.userplaycount); break;
                }
            }

            // Grab artist or song art if needed
            if (song_info.art == false && (subcommand == 'song' || subcommand == 'album')) {
                // Can't pull from last.fm because the API is weird and doesn't give art info properly for tracks. Easier just to pull from Spotify for this.
                song_info.art = await grab_spotify_art(origArtistArray, songName);
            }

            if (artistPfp == false && subcommand == 'artist') {
                // Try either pulling from database, last.fm, or spotify worst case scenario.
                if (db.reviewDB.has(origArtistArray[0])) {
                    let artistData = db.reviewDB.get(origArtistArray[0]);
                    if (artistData.pfp_image) {
                        artistPfp = artistData.pfp_image;
                    }
                }
                if (artistPfp == false) {
                    if (lfmData.image != undefined) {
                        if (lfmData.image.length != 0) artistPfp = lfmData.image[3]['#text'];
                    }
                }
                if (artistPfp == false) {
                    artistPfp = await grab_spotify_artist_art(origArtistArray)[0];
                }
            }
        }

        lfmUsers = lfmUsers.filter(v => v.scrobbles !== 0);
        lfmUsers.sort((a, b) => b.scrobbles - a.scrobbles);
        let counter = 0;
        lfmUsers = lfmUsers.map(v => {
            counter += 1;
            return `${counter}. <@${v.user_id}> - \`${v.scrobbles} plays\``;
        });

        if (lfmUsers.length == 0) return interaction.editReply(`Nobody in ${interaction.guild.name} has heard this.`);

        whoKnowsEmbed.setColor(getEmbedColor(interaction.member))
            .setDescription(lfmUsers.join('\n'))
            .setFooter({ text: `In ${interaction.guild.name}` });

        if (subcommand == 'song' || subcommand == 'album') {
            if (song_info.art != false) whoKnowsEmbed.setThumbnail(song_info.art);
            whoKnowsEmbed.setTitle(`Who knows ${origArtistArray.join(` & `)} - ${displaySongName}`);
        } else {
            if (artistPfp != false) whoKnowsEmbed.setThumbnail(artistPfp);
            whoKnowsEmbed.setTitle(`Who knows ${origArtistArray[0]}`);
        }

        interaction.editReply({ embeds: [whoKnowsEmbed], allowedMentions: { parse: ["users", "roles"] } });

        
    },
};
