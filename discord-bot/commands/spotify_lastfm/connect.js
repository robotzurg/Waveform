import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('connect')
    .setDescription('TODO: Add')
    .addSubcommand(subcommand =>
        subcommand.setName('spotify')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('lastfm')
            .setDescription('TODO: Add'))
    data.help_desc = `TODO: Add`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };