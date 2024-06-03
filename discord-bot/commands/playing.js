/* eslint-disable no-unreachable */
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup, convertToSetterName, lfm_api_setup } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playing')
        .setDescription('View currently playing songs on Spotify by Waveform users.')
        .setDMPermission(false),
    help_desc: `View the currently playing songs of any Spotify users on Waveform in this Discord Server.`,
	async execute(interaction, client, serverConfig) {
        interaction.deferReply();
        const members = await interaction.guild.members.fetch();
        let memberList = members.map(v => v.user.id);
        let skip = false;
        let playList = [];

        for (let member of memberList) {
            skip = false;
            let origArtistArray, songDisplayName;
            let lfmTrackData;
            if (!db.user_stats.has(member)) continue;
            // Last.fm login
            let lfmApi = await lfm_api_setup(member);
            let lfmScrobbles = false;
            let lfmUsername = db.user_stats.get(member, 'lfm_username');
            // Spotify login
            let spotifyApi = false;
            spotifyApi = await spotify_api_setup(member).catch(() => {
                spotifyApi = false;
            });
            let songUrl = 'https://www.google.com';
            let platform = 'spotify';

            if (spotifyApi != false && spotifyApi != undefined) {
                await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                    if (data.body.item == undefined) { skip = true; return; }
                    if (data.body.currently_playing_type == 'episode') { skip = true; return; }
                    let isPlaying = data.body.is_playing;
                    if (!isPlaying) { skip = true; return; }
                    
                    origArtistArray = data.body.item.artists.map(v => v.name);
                    songDisplayName = data.body.item.name;
                    songUrl = data.body.item.external_urls.spotify;
                });
            } else if (lfmApi != false && origArtistArray == undefined) {
                let lfmRecentSongs = await lfmApi.user_getRecentTracks({ limit: 1 });
                if (lfmRecentSongs.success) {
                    if (lfmRecentSongs.track.length != 0) {
                        songUrl = lfmRecentSongs.track[0].url;
                        lfmTrackData = await lfmApi.track_getInfo({ artist: lfmRecentSongs.track[0].artist['#text'], track: lfmRecentSongs.track[0].name, username: lfmUsername });
                    }
                }

                if (lfmRecentSongs.track[0]['@attr'] != false && lfmRecentSongs.track[0]['@attr'] != undefined) {
                    if (lfmRecentSongs.track[0]['@attr'].nowplaying != 'true') {
                        skip = true;
                    }
                } else {
                    skip = true;
                }
                 
                origArtistArray = [lfmRecentSongs.track[0].artist['#text']];
                songDisplayName = lfmRecentSongs.track[0].name;
                platform = 'lastfm';
            } else {
                skip = true;
            }

            if (skip == false) {

                // Check last.fm
                if (lfmApi != false) {
                    if (lfmTrackData == undefined) lfmTrackData = await lfmApi.track_getInfo({ artist: origArtistArray[0].replace('\\&', '&'), track: songDisplayName, username: lfmUsername });
                    lfmScrobbles = lfmTrackData.userplaycount;
                    if (lfmScrobbles == undefined) lfmScrobbles = false;
                }

                let extraData = ``;
                let dbSongName = convertToSetterName(songDisplayName);
                if (db.reviewDB.has(origArtistArray[0])) {
                    let reviewData = db.reviewDB.get(origArtistArray[0], `${dbSongName}.${interaction.user.id}`);
                    if (reviewData != undefined) {
                        if (serverConfig.disable_ratings === true) reviewData.rating = false;
                        if (reviewData.rating != false) extraData = `\n**Rating:** \`${reviewData.rating}/10${reviewData.starred ? `⭐\`` : `\``}`;
                    }
                }
                if (lfmScrobbles != false) extraData += `\n**Plays:** \`${lfmScrobbles}\``;
                playList.push(`- ${platform == 'lastfm' ? `<:lastfm:1227869050084921375>` : `<:spotify:899365299814559784>`} <@${member}>: [**${origArtistArray.join(' & ')} - ${songDisplayName}**](${songUrl})${extraData != `` ? `${extraData}` : ``}\n`);
            }
        }

        if (playList.length == 0) {
            return interaction.editReply('Nobody is currently playing any music on Spotify or Last.fm in this server.');
        }

        let pagedPlayList = _.chunk(playList, 10);
        let page_num = 0;
        const row = new ActionRowBuilder()
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

        const playListEmbed = new EmbedBuilder()
            .setThumbnail(interaction.guild.iconURL({ extension: 'png' }))
            .setTitle(`🎵 Songs Playing In ${interaction.guild.name} 🎵`)
            .setDescription(pagedPlayList[page_num].join('\n'));
            if (pagedPlayList.length > 1) {
                playListEmbed.setFooter({ text: `Page 1 / ${pagedPlayList.length}` });
                await interaction.editReply({ content: ` `, embeds: [playListEmbed], components: [row] });
            } else {
                await interaction.editReply({ content: ` `, embeds: [playListEmbed] });
            }
        
        if (pagedPlayList.length > 1) {
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, pagedPlayList.length - 1);
                playListEmbed.setDescription(pagedPlayList[page_num].join('\n'));
                playListEmbed.setFooter({ text: `Page ${page_num + 1} / ${pagedPlayList.length}` });
                i.update({ embeds: [playListEmbed] });
            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [playListEmbed], components: [] });
            });
        }

    },
};
