import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Get general info about the bot as a whole!');
    data.help_desc = `Ping the bot!`;
async function execute(interaction, client, apiUrl) {
    const response = await fetch(`${apiUrl}/api-version`);

    await interaction.reply(`The API is running on **${await response.text()}**. The bot is running ok!`)
}

export default { data, execute };