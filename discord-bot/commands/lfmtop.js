/* eslint-disable no-unreachable */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { lfm_api_setup, getLfmUsers, getEmbedColor } = require('../func');
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
                        { name: 'All Time', value: 'overall' },
                        { name: 'Week', value: '7day' },
                        { name: 'Month', value: '1month' },
                        { name: '3 Months', value: '3month' },
                        { name: '6 Months', value: '6month' },
                        { name: 'Year', value: '12month' },
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
                        { name: 'All Time', value: 'overall' },
                        { name: 'Week', value: '7day' },
                        { name: 'Month', value: '1month' },
                        { name: '3 Months', value: '3month' },
                        { name: '6 Months', value: '6month' },
                        { name: 'Year', value: '12month' },
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
                        { name: 'All Time', value: 'overall' },
                        { name: 'Week', value: '7day' },
                        { name: 'Month', value: '1month' },
                        { name: '3 Months', value: '3month' },
                        { name: '6 Months', value: '6month' },
                        { name: 'Year', value: '12month' },
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
        let lfmUsers = await getLfmUsers(interaction);
        let timeframe = interaction.options.getString('timeframe');
        let lfmUsername = db.user_stats.get(interaction.user.id, 'lfm_username');

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

        let result = await lfmUserApi.user_getTopTracks({ user: lfmUsername, period: timeframe });
        let topLfm = result.track;
        let counter = 0;
        topLfm = topLfm.slice(0, 10).map(v => {
            counter += 1;
            return `${counter}. ${v.artist.name} - ${v.name} \`${v.playcount} plays\``;
        });

        let paged_top_list = _.chunk(topLfm, 10);
        let page_num = 0;
        let topEmbed = new EmbedBuilder();

        await interaction.editReply({ content: null, embeds: [topEmbed], components: componentList });
        
        if (paged_top_list.length > 1 || songObj != false) {
            let message = await interaction.fetchReply();
            const collector = message.createMessageComponentCollector({ idle: 120000 });

            collector.on('collect', async i => {
                if (i.customId != 'getsong') {
                    (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                    page_num = _.clamp(page_num, 0, paged_top_list.length - 1);

                    topEmbed.setDescription(paged_top_list[page_num].join('\n'));
                    topEmbed.setFooter({ text: `In ${interaction.guild.name} • Page ${page_num + 1} / ${paged_top_list.length}`, iconURL: interaction.guild.iconURL({ extension: 'png' }) });
                    await i.update({ content: null, embeds: [topEmbed] });
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
                    await interaction.editReply({ content: null, embeds: [topEmbed], components: [] });
                }
            });
        }
    
        interaction.editReply(`# Top Tracks on Last.fm (All Time)\n${topLfm.join('\n')}`);
    },
};
