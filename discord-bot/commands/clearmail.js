const { SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearmail')
        .setDescription('Clear your local mailbox list'),
	async execute(interaction) {
        db.user_stats.set(interaction.user.id, [], 'mailbox_list');
        interaction.reply('Cleared out your local mailbox list.');
    },
};
