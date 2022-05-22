const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearmail')
        .setDescription('Clear your local mailbox list'),
	async execute(interaction) {
        db.user_stats.set(interaction.user.id, [], 'mailbox_list');
        interaction.editReply('Cleared out your local mailbox list.');
    },
};
