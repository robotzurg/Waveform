import { SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure Waveform Discord Bot server or user settings.')
    .addSubcommand(subcommand =>
        subcommand.setName('user')
            .setDescription('Configure your Waveform Discord Bot user settings.'))
    .addSubcommand(subcommand =>
        subcommand.setName('server')
            .setDescription('Configure your Waveform Discord Bot server settings (Admin Only).'))
    data.help_desc = `TODO: Add`;
async function execute(interaction, client, apiUrl) {
    
}

export default { data, execute };