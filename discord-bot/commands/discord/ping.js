import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Get general info about the bot as a whole!');
    data.help_desc = `Ping the bot!`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };