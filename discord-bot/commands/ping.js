const { SlashCommandBuilder } = require('@discordjs/builders');
const Canvas = require('canvas');
const { MessageAttachment } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		interaction.editReply('Pong!');
		// Create a 700x250 pixel canvas and get its context
		// The context will be used to modify the canvas
		const canvas = Canvas.createCanvas(700, 250);
		const context = canvas.getContext('2d');

		const background = await Canvas.loadImage('../images/wallpaper.jpg');

		// This uses the canvas dimensions to stretch the image onto the entire canvas
		context.drawImage(background, 0, 0, canvas.width, canvas.height);

		// Use the helpful Attachment class structure to process the file for you
		const attachment = new MessageAttachment(canvas.toBuffer(), 'profile-image.png');

		interaction.reply({ files: [attachment] });
	},
};