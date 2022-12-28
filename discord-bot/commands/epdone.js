const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { handle_error } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdone')
        .setDescription('Finish an in-progress EP/LP review.')
        .setDMPermission(false),
	help_desc: `Running this command will wrap up an in-progress EP/LP review. It should be run whenever you finish reviewing a **manual** EP/LP review.`,
	async execute(interaction) {
        try {
            db.user_stats.set(interaction.user.id, false, 'current_ep_review');
            await interaction.reply({ content: `Successfully ended your EP/LP review manually.`, ephemeral: true });
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};