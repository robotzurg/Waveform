/* eslint-disable no-unreachable */
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const db = require('../db.js');
const { spotify_api_setup, convertToSetterName } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playing')
        .setDescription('View currently playing songs on Spotify by Waveform users.')
        .setDMPermission(false),
    help_desc: `View the currently playing songs of any Spotify users on Waveform in this Discord Server.`,
	async execute(interaction) {
        interaction.deferReply();
        const members = await interaction.guild.members.fetch();
        let memberList = members.map(v => v.user.id);
        let skip = false;
        let playList = [];

        for (let member of memberList) {
            skip = false;
            let origArtistArray, songDisplayName;
            if (!db.user_stats.has(member)) continue;
            let spotifyApi = false;
            spotifyApi = await spotify_api_setup(member).catch(() => {
                spotifyApi = false;
            });
            if (spotifyApi == false) continue;

            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.item == undefined) { skip = true; return; }
                if (data.body.currently_playing_type == 'episode') { skip = true; return; }
                let isPlaying = data.body.is_playing;
                if (!isPlaying) { skip = true; return; }

                origArtistArray = data.body.item.artists.map(v => v.name);
                songDisplayName = data.body.item.name;
            });

            if (skip == false) {
                let ratingData = ``;
                let dbSongName = convertToSetterName(songDisplayName);
                if (db.reviewDB.has(origArtistArray[0])) {
                    let reviewData = db.reviewDB.get(origArtistArray[0], `${dbSongName}.${interaction.user.id}`);
                    if (reviewData != undefined) {
                        if (reviewData.rating != false) ratingData = `**Rating:** \`${reviewData.rating}/10${reviewData.starred ? `⭐\`` : `\``}`;
                    }
                }
                playList.push(`- <@${member}>: **${origArtistArray.join(' & ')} - ${songDisplayName}**\n${ratingData}`);
            }
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
        
            const collector = message.createMessageComponentCollector({ time: 360000 });

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
