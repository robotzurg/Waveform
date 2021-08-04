const { MessageButton, MessageActionRow } = require("discord.js");

module.exports = {
	name: 'ping',
	description: 'Ping the bot, mostly for checking if its alive.',
	options: [],
	admin: false,
	async execute(interaction) {

		let artist = 'None';
		let song = 'None';
		let rating = 'None';
		let review = 'None';

		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('artist')
					.setLabel('Artist')
					.setStyle('PRIMARY')
					.setEmoji('📝'),
				new MessageButton()
					.setCustomId('song')
					.setLabel('Song')
					.setStyle('PRIMARY')
					.setEmoji('📝'),
				new MessageButton()
					.setCustomId('rating')
					.setLabel('Rating')
					.setStyle('PRIMARY')
					.setEmoji('📝'),
				new MessageButton()
					.setCustomId('review')
					.setLabel('Review')
					.setStyle('PRIMARY')
					.setEmoji('📝'),
			);

        interaction.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });

		const filter = i => i.user.id === interaction.user.id;
		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000 });
		let a_collector;
		let s_collector;
		let ra_collector;
		let re_collector;

		collector.on('collect', async i => {
			switch (i.customId) {
				case 'artist': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the artist names (separated with &)', components: [] });
					a_collector = interaction.channel.createMessageCollector({ max: 1, time: 15000 });
					a_collector.on('collect', async m => {
						artist = m.content;
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
						m.delete();
					});
					
					a_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
					});
				} break;
				case 'song': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the song name', components: [] });

					s_collector = interaction.channel.createMessageCollector({ max: 1, time: 15000 });
					s_collector.on('collect', async m => {
						song = m.content;
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
						m.delete();
					});
					
					s_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
					});
				} break;
				case 'rating': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the rating (no /10!)', components: [] });

					ra_collector = interaction.channel.createMessageCollector({ max: 1, time: 15000 });
					ra_collector.on('collect', async m => {
						rating = m.content;
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
						m.delete();
					});
					
					ra_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
					});
				} break;
				case 'review': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the new review.', components: [] });

					re_collector = interaction.channel.createMessageCollector({ max: 1, time: 15000 });
					re_collector.on('collect', async m => {
						review = m.content;
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
						m.delete();
					});
					
					re_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [row] });
					});
				} break;
			}
		});

		collector.on('end', async collected => {
			console.log(`Collected ${collected.size} items`);
			if (a_collector != undefined) a_collector.stop();
			if (s_collector != undefined) s_collector.stop();
			if (ra_collector != undefined) ra_collector.stop();
			if (re_collector != undefined) re_collector.stop();
			await interaction.editReply({ content: `Artist: ${artist}\nSong: ${song}\nRating: ${rating}\nReview: ${review}`, components: [] });
		});
	},
};