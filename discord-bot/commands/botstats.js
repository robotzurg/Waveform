/* eslint-disable no-unreachable */
const { handle_error, getEmbedColor } = require('../func');
const db = require('../db.js');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('Get general info about the bot as a whole!')
        .setDMPermission(false),
    help_desc: `View statistics/information about Waveform as a whole, across all servers and users.`,
	async execute(interaction, client) {
        try {
            let botStats = db.global_bot.get('stats');

            const statsEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(interaction.member)}`)
            .setThumbnail(client.user.avatarURL({ extension: "png", dynamic: true }))
            .setTitle('Waveform Statistics')
            .addFields(
                { name: 'Number of Artists', value: `${botStats.artist_num}`, inline: true },
                { name: 'Number of Songs', value: `${botStats.song_num}`, inline: true },
                { name: 'Number of EP/LPs', value: `${botStats.ep_num}`, inline: true },
                { name: 'Number of Reviews', value: `${botStats.review_num}`, inline: true },
                { name: 'Number of EP/LP Reviews', value: `${botStats.ep_review_num}`, inline: true },
                { name: 'Number of Favorites Given', value: `${botStats.star_num}` },
                { name: 'Number of 10s Given', value: `${botStats.ten_num}` },
                { name: 'Number of Waveform Users', value: `${botStats.waveform_users.length}`, inline: true },
            )
            .setFooter({ text: `Waveform is currently in ${client.guilds.cache.map(guild => guild.id).length} servers!` });

            interaction.reply({ content: null, embeds: [statsEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};