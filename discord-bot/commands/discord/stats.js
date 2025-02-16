import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('stats')
    .setDescription('TODO: Add')
    .addSubcommand(subcommand =>
        subcommand.setName('user')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('server')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('bot')
            .setDescription('TODO: Add'))
    data.help_desc = `TODO: Add`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };