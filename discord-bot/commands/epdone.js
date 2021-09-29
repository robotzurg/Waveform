const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdone')
        .setDescription('Finish an EP/LP review'),
	admin: false,
	async execute(interaction) {
        db.user_stats.set(interaction.user.id, false, 'current_ep_review');
        interaction.deleteReply();
    },
};