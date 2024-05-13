/* eslint-disable no-unreachable */
const { SlashCommandBuilder } = require('discord.js');
const { getUserDataAoty, getDataAoty } = require('../func');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aotydata')
        .setDescription('See songs rated 100/100 on AOTY from a user.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('aoty_user')
                .setDescription('AOTY username.')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('url_route')
                .setDescription('URL route.')
                .setRequired(false))
        .addIntegerOption(option => 
            option.setName('rating')
                .setDescription('Rating to filter by. (AOTY uses 100 scale, not 10 scale)')
                .setRequired(false)),
    help_desc: ``,
	async execute(interaction) {
        await interaction.deferReply();
        let aotyUser = interaction.options.getString('aoty_user');
        if (aotyUser == null) aotyUser = 'jeffdev';
        let route = interaction.options.getString('url_route');
        if (route == null) route = '/ratings/';
        let ratingFilter = interaction.options.getInteger('rating');
        if (ratingFilter == null) ratingFilter = 100;
        if (ratingFilter > 100) ratingFilter = 100;

        await getDataAoty(route);
        interaction.editReply('Done.');
        return;
        let aotyInfo = await getUserDataAoty(aotyUser, route);

        aotyInfo = aotyInfo.filter(v => v.album_rating == ratingFilter);
        aotyInfo = aotyInfo.map(v => v = `- ${v.artist_name} - ${v.album_name} \`${v.album_rating}/100\``);

        await interaction.editReply(`### AOTY Data with route \`${route}\` from user \`${aotyUser}\` (${ratingFilter})\n${aotyInfo.join('\n')}`);
    },
};
