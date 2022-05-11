const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('./func');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Test :)'),
	async execute(interaction) {
        try {
            interaction.editReply('This command is currently under construction!');
        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};