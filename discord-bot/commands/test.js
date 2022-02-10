const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)'),
	async execute(interaction) {
        try {

            interaction.editReply('Test');

        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
    },
};