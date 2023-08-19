const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearallmail')
        .setDescription('Clear out your local Waveform Mailbox list.')
        .setDMPermission(false),
    help_desc: `Clears out your LOCAL Waveform Mailbox list, deleting all song entries within it.\n\n` + 
    `Note that this does NOT delete the songs in your Spotify playlist, only your local playlist, and that this will delete **ALL** songs in it at once. Use with caution!`,
	async execute(interaction) {
        db.user_stats.set(interaction.user.id, [], 'mailbox_list');
        interaction.reply('Cleared out your local mailbox list.');
    },
};
