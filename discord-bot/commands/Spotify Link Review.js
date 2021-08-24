const { getPreview } = require('spotify-url-info');
const { capitalize } = require('../func.js');

// This command is a RIGHT CLICK CONTEXT MENU COMMAND, NOT A SLASH COMMAND!
module.exports = {
	name: 'Spotify Link Review',
    type: '3',
	async execute(interaction, client) {

        interaction.editReply('This feature is not currently available.');

		/*const msg = interaction.options.getMessage('message');
        const review_cmd = client.commands.get('review');

		if (!msg.content.includes('https://open.spotify.com')) { 
			return interaction.editReply('The link you just tried to review isn\'t a Spotify link.' + 
										'\nThis feature only works with Spotify links.');
		}

		let artists;
		let song;
		let art;
		let rating;
		let review;

		getPreview(msg.content)
			.then(async data => {
				artists = capitalize(data.artist);
				song = capitalize(data.title);
                if (song.includes('Remix') || song.includes('remix')) return interaction.editReply('Remixes are not currently supported with this feature.\n' +
                                                                                                   'This is due to issues with Spotify formatting on them.');
				art = data.image;

				interaction.editReply('Type in your rating /10 for this song. (Decimals are fine, don\'t include "/10" in the message.)');

				await interaction.editReply({ content: `Type in your rating for **${artists} - ${song}** (DO NOT ADD /10!)`, components: [] });

				let ra_collector = await interaction.channel.createMessageCollector({ max: 1, time: 60000 });
				ra_collector.on('collect', async m => {

					rating = parseFloat(m.content);
					m.delete();
					await interaction.editReply({ content: `Type in your review for **${artists} - ${song}**`, components: [] });

					let re_collector = interaction.channel.createMessageCollector({ max: 1, time: 120000 });
					re_collector.on('collect', async m2 => {

                        review = m2.content;
                        m2.delete();
                        await interaction.editReply({ content: ``});

                        let re_collector = interaction.channel.createMessageCollector({ max: 1, time: 120000 });
                            re_collector.on('collect', async m2 => {
                            review = m2.content;
                            await review_cmd.execute(interaction, artists, song, `${rating}`, review, art, undefined, undefined, undefined, false);
                            await interaction.editReply('Review posted.');
                            m2.delete();
					    });
					
                        re_collector.on('end', async collected => {
                            console.log(`Collected ${collected.size} items`);
                        });

					});
					
					re_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
					});
					
				});
				
				ra_collector.on('end', async collected => {
					console.log(`Collected ${collected.size} items`);
				});

			});*/
	
	},
};