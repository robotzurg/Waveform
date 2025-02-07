import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Get general info about the bot as a whole!');

async function execute(interaction) {
    interaction.reply('Test');

    fetch('https://cs-4900-backend.vercel.app/api-version')
        .then(async (response) => console.log(await response.text()));
}

export default { data, execute };