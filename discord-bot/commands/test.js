const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test :)')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP.')
                .setRequired(true)),
	async execute(interaction) {
        try {

            interaction.editReply('Test');

        } catch (err) {
            let error = new Error(err).stack;
            handle_error(interaction, error);
        }
    },
};