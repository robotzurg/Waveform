/* eslint-disable no-unreachable */
const { getPreview } = require('spotify-url-info');
const Discord = require('discord.js');

// This command is a RIGHT CLICK CONTEXT MENU COMMAND, NOT A SLASH COMMAND!
module.exports = {
	name: 'Spotify Link Review',
    type: '3',
	async execute(interaction, client) {

		const row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('star')
                .setLabel('Star')
                .setStyle('SUCCESS'),
            new Discord.MessageButton()
                .setCustomId('nostar')
                .setLabel('Don\'t Star')
                .setStyle('DANGER'),
		);

		const msg = interaction.options.getMessage('message');
        const review_cmd = client.commands.get('review');

		if (!msg.content.includes('https://open.spotify.com')) { 
			return interaction.editReply('The link you just tried to review isn\'t a Spotify link.' + 
										'\nThis feature only works with Spotify links.');
		}

		return interaction.editReply('This command is temporarily disabled.');

		let artists;
		let song;
		let art;
		let rating;
		let review;
		let vocalists;
		let starred;

		getPreview(msg.content)
			.then(async data => {
				artists = data.artist;
				song = data.title;
				vocalists = undefined;
                if (song.includes('Remix') || song.includes('remix')) return interaction.editReply('Remixes are not currently supported with this feature.\n' + 'This is due to issues with Spotify formatting on them.');
                if (song.includes('(with')) return interaction.editReply('This song is not reviewable with this command. Please use the regular method.');
                if (song.includes('(feat.')) {
					vocalists = song.split(' (feat. ')[1].slice(0, -1);
					song = song.split(' (feat. ')[0];
					if (artists.includes(vocalists)) artists = artists.replace(`& ${vocalists}`, '');
				} else if (song.includes('(ft.')) {
					vocalists = song.split(' (ft. ')[1].slice(0, -1);
					song = song.split(' (ft. ')[0];
					if (artists.includes(vocalists)) artists = artists.replace(`& ${vocalists}`, '');
				}
				art = data.image;

				console.log(vocalists);
				console.log(artists);
				console.log(song);
				await interaction.editReply({ content: `Type in your rating for **${artists} - ${song}** (DO NOT ADD /10!)`, components: [] });
				const ra_filter = m => m.author.id === interaction.user.id;

				let ra_collector = await interaction.channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
				ra_collector.on('collect', async m => {
					console.log(m.author.id);

					rating = parseFloat(m.content);
					m.delete();
					await interaction.editReply({ content: `Type in your review for **${artists} - ${song}**`, components: [] });
					// eslint-disable-next-line no-shadow
					const re_filter = m => m.author.id === interaction.user.id;

					let re_collector = interaction.channel.createMessageCollector({ filter: re_filter, max: 1, time: 10000000 });
					re_collector.on('collect', async m2 => {

                        review = m2.content;
                        m2.delete();
                        await interaction.editReply({ content: `Press Star or Don't Star if you would like to star the song.\n(Pressing Star when you don't have a 10 rating will do nothing.)`, components: [row] });

                        let star_collector = interaction.channel.createMessageComponentCollector({ max: 2, time: 120000 });
						star_collector.on('collect', async i => {
							if (i.user.id === interaction.user.id) {
								switch (i.customId) {
									case 'star': {
										starred = true;
										await interaction.editReply({ content: 'Review sent.', components: [] });
										review_cmd.execute(interaction, artists, song, rating, review, art, undefined, undefined, undefined, starred);
									} break;
									case 'nostar': {
										starred = false;
										await interaction.editReply({ content: 'Review sent.', components: [] });
										review_cmd.execute(interaction, artists, song, rating, review, art, vocalists, undefined, undefined, starred);
									} break;
								}
							}
						});
					
                        star_collector.on('end', async collected => {
                            console.log(collected.size);
                        });

					});
					
					re_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
					});
					
				});
				
				ra_collector.on('end', async collected => {
					console.log(`Collected ${collected.size} items`);
				});

			});
	
	},
};
