const { handle_error, getEmbedColor } = require('../func');
const db = require('../db.js');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View general Waveform stats about the server.')
        .setDMPermission(false),
    help_desc: `TBD`,
	async execute(interaction, client) {
        try {
            let serverStats = db.server_settings.get(interaction.guild.id, 'stats');
            const guild = await client.guilds.fetch(interaction.guild.id);
            const statsEmbed = new EmbedBuilder()
            .setColor(`${getEmbedColor(interaction.member)}`)
            .setThumbnail(guild.iconURL({ extension: 'png' }))
            .setTitle(`${guild.name} Waveform Stats`)
            .addFields(
                { name: 'Number of Reviews', value: `${serverStats.review_num}` },
                { name: 'Number of EP/LP Reviews', value: `${serverStats.ep_review_num}` },
                { name: 'Number of Stars', value: `${serverStats.star_num}` },
                { name: 'Number of 10s Given', value: `${serverStats.ten_num}` },
            )
            .setFooter({ text: 'Check out /topserversongs to see the most starred songs in the server!' });

            interaction.reply({ content: null, embeds: [statsEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};