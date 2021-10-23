const { SlashCommandBuilder } = require('@discordjs/builders');
const Canvas = require('canvas')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		interaction.editReply('Pong!');
	},
};
