const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { handle_error } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdone')
        .setDescription('Finish an in-progress EP/LP review.')
        .setDMPermission(false),
	help_desc: `Manually finishes an in-progress EP/LP review. For use in non-spotify EP/LP reviews when you have reviewed each song, or any other times you may run into an issue with the normal button.`,
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