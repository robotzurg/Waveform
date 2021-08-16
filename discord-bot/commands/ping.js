module.exports = {
	name: 'ping',
	description: 'Ping the bot, mostly for checking if its alive.',
	options: [],
	admin: false,
	async execute(interaction) {
		interaction.editReply('Pong!');
	},
};