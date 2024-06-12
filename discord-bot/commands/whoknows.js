/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const { lfm_api_setup, getLfmUsers, parse_artist_song_data, getEmbedColor, grab_spotify_art, grab_spotify_artist_art, convertToSetterName, checkForGlobalReview } = require('../func');
require('dotenv').config();
const db = require('../db.js');
const { ButtonStyle } = require('discord-api-types/v9');
const _ = require('lodash');
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
    help_desc: `View who knows a song/EP/album/artist on Last.fm, out of logged in Last.fm Waveform users in your server.`,
	async execute(interaction, client, serverConfig) {
        await interaction.deferReply();
        await interaction.editReply('Loading data...');
        
        let lfmUserApi = await lfm_api_setup(interaction.user.id);
        let lfmUsers = await getLfmUsers(interaction);

        // Setup buttons
        const pageButtons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('left')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⬅️'),
            new ButtonBuilder()
                .setCustomId('right')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('➡️'),
        );
        
        const getSongButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('getsong')
                .setLabel('See Reviews')
                .setStyle(ButtonStyle.Primary),
        );
        let componentList = [];

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

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.db_artists;
        // rmxArtistArray = song_info.remix_artists;
        let displaySongName = song_info.display_song_name;
        let lfmRecentSongs = { success: false };
        let lfmArtistArray = song_info.lastfm_artists;
        let lfmSongName = song_info.lastfm_song_name;
        let artistPfp = false;
        let songObj = false;
        if (lfmUserApi != false && songArg === null && epArg == null && artistArg === null) lfmRecentSongs = await lfmUserApi.user_getRecentTracks({ limit: 1 });

        if (db.reviewDB.has(origArtistArray[0])) {
            let getterSongName = convertToSetterName(songName); 
            songObj = db.reviewDB.get(origArtistArray[0], getterSongName);
            if (songObj == undefined) songObj = false;
        }

        for (let i = 0; i < lfmUsers.length; i++) {
            let lfmUsername = lfmUsers[i].lfm_username;
            let lfmData = { success: false };
            lfmUsers[i].rating = false;
            lfmUsers[i].starred = false;
            lfmUsers[i].scrobbles = 0;
            if (songObj != false && serverConfig.disable_ratings == false) {
                if (songObj[lfmUsers[i].user_id] != undefined) {
                    if (serverConfig.disable_global) {
                        lfmUsers[i].rating = songObj[lfmUsers[i].user_id].rating;
                        lfmUsers[i].starred = songObj[lfmUsers[i].user_id].starred;

                        if (checkForGlobalReview(songObj[lfmUsers[i].user_id], interaction.guild.id) == true) {
                            lfmUsers[i].rating = false;
                            lfmUsers[i].starred = false;
                        }
                    }
                }
            }

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
                        console.log(lfmData);
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
            } else {
                return interaction.editReply(`Could not find **${origArtistArray.join(' & ')} - ${displaySongName}** on Last.fm.`);
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
            return `${counter}. <@${v.user_id}>${v.starred != false ? ` 🌟` : ``}${subcommand != 'artist' && v.rating !== false ? ` **\`${v.rating}/10\`**` : ``} - **${v.scrobbles}** plays`;
        });

        if (lfmUsers.length == 0) return interaction.editReply(`Nobody in ${interaction.guild.name} has heard **${origArtistArray.join(' & ')} - ${displaySongName}**.`);

        let paged_user_list = _.chunk(lfmUsers, 10);
        let page_num = 0;

        whoKnowsEmbed.setColor(getEmbedColor(interaction.member))
            .setDescription(paged_user_list[0].join('\n'));
            if (paged_user_list.length > 1) {
                componentList.push(pageButtons);
                whoKnowsEmbed.setFooter({ text: `In ${interaction.guild.name} • Page 1 / ${paged_user_list.length}`, iconURL: interaction.guild.iconURL({ extension: 'png' }) });
            } else {
                whoKnowsEmbed.setFooter({ text: `In ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ extension: 'png' }) });
            }

        
        if (subcommand == 'song' || subcommand == 'album') {
            if (song_info.art != false) whoKnowsEmbed.setThumbnail(song_info.art);
            whoKnowsEmbed.setTitle(`Who knows ${origArtistArray.join(` & `)} - ${displaySongName}`);
        } else {
            if (artistPfp != false) whoKnowsEmbed.setThumbnail(artistPfp);
            whoKnowsEmbed.setTitle(`Who knows ${origArtistArray[0]}`);
        }

        if (songObj != false) componentList.push(getSongButton);
        await interaction.editReply({ content: null, embeds: [whoKnowsEmbed], components: componentList });
        
        if (paged_user_list.length > 1 || songObj != false) {
            let message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                if (i.customId != 'getsong') {
                    (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                    page_num = _.clamp(page_num, 0, paged_user_list.length - 1);

                    whoKnowsEmbed.setDescription(paged_user_list[page_num].join('\n'));
                    whoKnowsEmbed.setFooter({ text: `In ${interaction.guild.name} • Page ${page_num + 1} / ${paged_user_list.length}`, iconURL: interaction.guild.iconURL({ extension: 'png' }) });
                    await i.update({ content: null, embeds: [whoKnowsEmbed] });
                } else {
                    await i.update({ content: 'Loading song data...', embeds: [], components: [] });
                    let command = client.commands.get('getsong');
                    await command.execute(interaction, client, serverConfig, artistArray, songName);
                    await collector.stop();
                }
            });

            collector.on('end', async collected => {
                // If we are on the getsong command, don't change our interaction when timer ends.
                if (!collected.some(v => v.customId === 'getsong')) {
                    await interaction.editReply({ content: null, embeds: [whoKnowsEmbed], components: [] });
                }
            });
        }

        interaction.editReply({ embeds: [whoKnowsEmbed], allowedMentions: { parse: ["users", "roles"] } });

        
    },
};
