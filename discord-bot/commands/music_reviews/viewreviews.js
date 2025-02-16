import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('stats')
    .setDescription('TODO: Add')
    .addSubcommand(subcommand =>
        subcommand.setName('song')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('ep')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('album')
            .setDescription('TODO: Add'))
    data.help_desc = `TODO: Add`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };