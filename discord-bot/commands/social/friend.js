import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('friend')
    .setDescription('TODO: Add')
    .addSubcommand(subcommand =>
        subcommand.setName('add')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('remove')
            .setDescription('TODO: Add'))
    data.help_desc = `TODO: Add`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };