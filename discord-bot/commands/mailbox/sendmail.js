import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('sendmail')
    .setDescription('TODO: Add')
    .addSubcommand(subcommand =>
        subcommand.setName('song_link')
            .setDescription('TODO: Add'))
    .addSubcommand(subcommand =>
        subcommand.setName('playing')
            .setDescription('TODO: Add'))
    data.help_desc = `TODO: Add`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };