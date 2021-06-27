module.exports = {
	name: 'ping',
	description: 'Ping the bot, mostly for checking if its alive.',
	options: [],
	admin: false,
	execute(interaction, client) {
		interaction.editReply(`Pong. ${client.ws.ping}ms`);
	},
};