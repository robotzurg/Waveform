const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require("../func.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epdone')
        .setDescription('Finish an EP/LP review'),
	admin: false,
	async execute(interaction) {
        try {
            db.user_stats.set(interaction.user.id, false, 'current_ep_review');
            try {
                await interaction.deleteReply();
            } catch (err) {
                console.log(err);
            }
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};