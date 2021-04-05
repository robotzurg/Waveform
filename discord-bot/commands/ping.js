module.exports = {
	name: 'ping',
	type: 'Bot',
	description: 'Ping the bot, mostly for checking if its alive. You don\'t need to use this.',
	execute(message) {
		message.channel.send(`Pong. ${message.client.ws.ping}ms`);
	},
};