import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getEmbedColor } from '../func.js';

const data = new SlashCommandBuilder()
    .setName('botstats')
    .setDescription('Get general info about the bot as a whole!')
    .setDMPermission(false);
    data.help_desc = `View statistics/information about Waveform as a whole, across all servers and users.`;
async function execute(interaction, client, apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/bot-stats`);
        const botStats = await response.json();

        const statsEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setThumbnail(client.user.avatarURL({ extension: "png", dynamic: true }))
        .setTitle('Waveform Statistics')
        .addFields(
            { name: 'Number of Artists', value: `${botStats.artist_num}`, inline: true },
            { name: 'Number of Songs', value: `${botStats.song_num}`, inline: true },
            { name: 'Number of EP/LPs', value: `${botStats.ep_num}`, inline: true },
            { name: 'Number of Song Reviews', value: `${botStats.review_num}`, inline: true },
            { name: 'Number of EP/LP Reviews', value: `${botStats.ep_review_num}`, inline: true },
            { name: 'Number of Favorites Given', value: `${botStats.star_num}` },
            { name: 'Number of 10s Given', value: `${botStats.ten_num}` },
            // { name: 'Number of Waveform Users', value: `${botStats.waveform_users.length}`, inline: true },
        )
        .setFooter({ text: `Waveform is currently in ${client.guilds.cache.map(guild => guild.id).length} servers!` });

        await interaction.reply({ content: null, embeds: [statsEmbed] });
        
    } catch (error) {
        console.error('Error fetching data:', error);
        await interaction.reply('An error occurred while fetching data.');
    }
}

export default { data, execute };