/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { lfm_api_setup, getLfmUsers, parse_artist_song_data, getEmbedColor } = require('../func');
require('dotenv').config();
// const db = require('../db.js');
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
        let epName = interaction.options.getString('album_name');
        let remixerArg = interaction.options.getString('remixers');
        let whoKnowsEmbed = new EmbedBuilder();

        if (subcommand == 'song') {
            let song_info = await parse_artist_song_data(interaction, artistArg, songArg, remixerArg);
            if (song_info.error != undefined) {
                await interaction.editReply(song_info.error);
                return;
            }

            console.log(song_info);

            let origArtistArray = song_info.prod_artists;
            let songName = song_info.song_name;
            let artistArray = song_info.db_artists;
            rmxArtistArray = song_info.remix_artists;
            let allArtistArray = song_info.all_artists; // This is used for grabbing the artist images of every artist involved.
            let displaySongName = song_info.display_song_name;
            let origSongName = song_info.main_song_name;
            let lfmRecentSongs = { success: false };
            if (lfmUserApi != false && songArg === null && artistArg === null) lfmRecentSongs = await lfmUserApi.user_getRecentTracks({ limit: 1 });

            for (let i = 0; i < lfmUsers.length; i++) {
                let lfmScrobbles = false;
                let lfmUsername = lfmUsers[i].lfm_username;
                let lfmTrackData = { success: false };

                if (lfmRecentSongs.success) {
                    if (lfmRecentSongs.track.length != 0) {
                        console.log(lfmRecentSongs.track[0].artist['#text']);
                        console.log(lfmRecentSongs.track[0].name);
                        if (origArtistArray.some(v => {
                            return v.toLowerCase() == lfmRecentSongs.track[0].artist['#text'].toLowerCase();
                        })) {
                            lfmTrackData = await lfmUserApi.track_getInfo({ artist: lfmRecentSongs.track[0].artist['#text'], track: lfmRecentSongs.track[0].name, username: lfmUsername });
                        }
                    }
                }
    

                if (lfmTrackData.success == false) {
                    lfmTrackData = await lfmUserApi.track_getInfo({ artist: origArtistArray[0].replace('\\&', '&'), track: songName, username: lfmUsername });
                    console.log(lfmTrackData);
                    if (lfmTrackData.success == false) {
                        for (let artist of origArtistArray) {
                            lfmTrackData = await lfmUserApi.track_getInfo({ artist: artist.replace('\\&', '&'), track: songName, username: lfmUsername });
                            if (lfmTrackData.success) {
                                break;
                            }
                        }
                    }
                }

                if (lfmTrackData.success) {
                    lfmUsers[i].scrobbles = parseInt(lfmTrackData.userplaycount);
                }
            }

            lfmUsers = lfmUsers.filter(v => v.scrobbles !== 0);
            lfmUsers.sort((a, b) => b.scrobbles - a.scrobbles);
            let counter = 0;
            lfmUsers = lfmUsers.map(v => {
                counter += 1;
                return `${counter}. <@${v.user_id}> - \`${v.scrobbles} plays\``;
            });

            whoKnowsEmbed.setColor(getEmbedColor(interaction.member))
                .setTitle(`Who knows ${origArtistArray.join(` & `)} - ${displaySongName}`)
                .setDescription(lfmUsers.join('\n'))
                .setThumbnail(song_info.art)
                .setFooter({ text: `In ${interaction.guild.name}` });

            interaction.editReply({ embeds: [whoKnowsEmbed], allowedMentions: { parse: ["users", "roles"] } });
        }

        
    },
};
