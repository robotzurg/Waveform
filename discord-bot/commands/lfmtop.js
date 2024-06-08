/* eslint-disable no-unused-vars */
/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { lfm_api_setup, getLfmUsers, getEmbedColor, parse_artist_song_data, convertToSetterName, spotifyUritoURL } = require('../func');
require('dotenv').config();
const db = require('../db.js');
const _ = require('lodash');
// const { spotify_api_setup } = require('../func.js');
// const lastfm = require('lastfm-njs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lfmtop')
        .setDescription('See who has heard a specific type of music on Last.fm.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('song')
            .setDescription('See a users top listened tracks on Last.fm (defaults to yourself)')
            .addStringOption(option => 
                option.setName('timeframe')
                    .setDescription('The timeframe of the top tracks.')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Week', value: '7day|Week' },
                        { name: 'Month', value: '1month|Month' },
                        { name: '3 Months', value: '3month|3 Months' },
                        { name: '6 Months', value: '6month|6 Months' },
                        { name: 'Year', value: '12month|Year' },
                        { name: 'All Time', value: 'overall|All Time' },
                    ))

            .addUserOption(option =>
                option.setName('user')
                .setDescription('The users whose top listened tracks you\'d like to see.')
                .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('album')
            .setDescription('See a users top listened albums on Last.fm (defaults to yourself)')
            .addStringOption(option => 
                option.setName('timeframe')
                    .setDescription('The timeframe of the top albums.')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Week', value: '7day|Week' },
                        { name: 'Month', value: '1month|Month' },
                        { name: '3 Months', value: '3month|3 Months' },
                        { name: '6 Months', value: '6month|6 Months' },
                        { name: 'Year', value: '12month|Year' },
                        { name: 'All Time', value: 'overall|All Time' },
                    ))

            .addUserOption(option =>
                option.setName('user')
                .setDescription('The users whose top listened albums you\'d like to see.')
                .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('artist')
            .setDescription('See a users top listened artists on Last.fm (defaults to yourself)')
            .addStringOption(option => 
                option.setName('timeframe')
                    .setDescription('The timeframe of the top artists.')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Week', value: '7day|Week' },
                        { name: 'Month', value: '1month|Month' },
                        { name: '3 Months', value: '3month|3 Months' },
                        { name: '6 Months', value: '6month|6 Months' },
                        { name: 'Year', value: '12month|Year' },
                        { name: 'All Time', value: 'overall|All Time' },
                    ))

            .addUserOption(option =>
                option.setName('user')
                .setDescription('The users whose top listened artists you\'d like to see.')
                .setRequired(false))),
    help_desc: `View who knows a song/EP/album/artist on Last.fm, out of logged in Last.fm Waveform users in your server.`,
	async execute(interaction, client, serverConfig) {
        await interaction.deferReply();
        await interaction.editReply('Loading data...');
        
        let lfmUserApi = await lfm_api_setup(interaction.user.id);
        let subcommand = interaction.options.getSubcommand();
        let timeframe = interaction.options.getString('timeframe');
        if (timeframe == null) timeframe = '7day|Week';
        timeframe = timeframe.split('|');
        let taggedUser = interaction.options.getUser('user');
        if (taggedUser == null) taggedUser = interaction.user;
        let taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        let lfmUsername = db.user_stats.get(taggedUser.id, 'lfm_username');
        if (lfmUsername == undefined || lfmUsername == false) return interaction.editReply(`The user **${taggedMember.displayName}** is not logged into Last.fm on Waveform.`);

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

        let result;
        let resultList = [];
        switch (subcommand) {
            case 'song': 
                result = await lfmUserApi.user_getTopTracks({ user: lfmUsername, period: timeframe[0] }); 
                resultList = result.track;
            break;
            case 'album': 
                result = await lfmUserApi.user_getTopAlbums({ user: lfmUsername, period: timeframe[0] }); 
                resultList = result.album;
            break;
            case 'artist': 
                result = await lfmUserApi.user_getTopArtists({ user: lfmUsername, period: timeframe[0] });
                resultList = result.artist;
            break;
        }
        let topLfm = [];
        let counter = 0;

        for (let track of resultList) {
            counter += 1;
            if (subcommand != 'artist') {
                let song_info = await parse_artist_song_data(interaction, track.artist.name, track.name);
                if (song_info.error != undefined) {
                    await interaction.editReply(song_info.error);
                    return;
                }

                let origArtistArray = song_info.prod_artists;
                let songName = song_info.song_name;
                let artistArray = song_info.db_artists;
                let displaySongName = song_info.display_song_name;
                let songObj = false;
                let reviewObj = { starred: false, rating: false };
                
                if (db.reviewDB.has(artistArray[0])) {
                    let getterSongName = convertToSetterName(songName); 
                    songObj = db.reviewDB.get(artistArray[0], getterSongName);
                    if (songObj == undefined) songObj = false;
                    else if (songObj[taggedUser.id] != undefined) reviewObj = songObj[taggedUser.id];
                }
                if (serverConfig.disable_ratings) reviewObj.rating = false;

                let songUrl = track.url;
                topLfm.push(`${counter}. [**${origArtistArray.join(' & ')} - ${displaySongName}**](${songUrl})${reviewObj.starred != false ? ` 🌟` : ``}${reviewObj.rating !== false ? ` **\`${reviewObj.rating}/10\`**` : ``} - **${track.playcount}** plays`);
            } else {
                let artistUrl = track.url;
                topLfm.push(`${counter}. [**${track.name}**](${artistUrl}) - **${track.playcount}** plays`);
            }
        }

        let componentList = [];
        let paged_top_list = _.chunk(topLfm, 10);
        let page_num = 0;
        let topEmbed = new EmbedBuilder()
            .setColor(getEmbedColor(interaction.member))
            .setTitle(`Top ${_.upperFirst(subcommand)}s on Last.fm (${timeframe[1]})`)
            .setThumbnail(taggedUser.avatarURL({ extension: "png", dynamic: true }))
            .setDescription(paged_top_list[0].join('\n'));
            if (paged_top_list.length > 1) {
                componentList.push(pageButtons);
                topEmbed.setFooter({ text: `Page 1 / ${paged_top_list.length}` });
            }
        

        await interaction.editReply({ content: null, embeds: [topEmbed], components: componentList });
        
        if (paged_top_list.length > 1) {
            let message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                page_num = _.clamp(page_num, 0, paged_top_list.length - 1);

                topEmbed.setDescription(paged_top_list[page_num].join('\n'));
                topEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_top_list.length}` });
                await i.update({ content: null, embeds: [topEmbed] });
            });

            collector.on('end', async () => {
                await interaction.editReply({ content: null, embeds: [topEmbed], components: [] });
            });
        }
    },
};
