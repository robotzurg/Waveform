const { getPreview } = require('spotify-url-info');
const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, update_art, review_song, hall_of_fame_check } = require('../func.js');

        /*// Check if we are reviewing in the right chat, if not, boot out
        if (`<#${interaction.channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel') && !mailboxes.includes(interaction.channel.name)) {
            return interaction.editReply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')} or mailboxes!`);
        }

        let args = [];
        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = false;
        let featArtists = [];
        let rmxArtists = [];

        // Setup buttons
        const row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('artist')
                .setLabel('Artist')
                .setStyle('PRIMARY')
                .setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('song')
                .setLabel('Song')
                .setStyle('PRIMARY')
                .setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('rating')
                .setLabel('Rating')
                .setStyle('PRIMARY')
                .setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('review')
                .setLabel('Review')
                .setStyle('PRIMARY')
                .setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('star')
                .setLabel('')
                .setStyle('SECONDARY')
                .setEmoji('🌟'),
        );

        const row2 = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('done')
                .setLabel('Send to Database')
                .setStyle('SUCCESS'),
        );
        
        interaction.options._hoistedOptions.forEach((value) => {
            args.push(value.value.trim());
            if (value.name === 'art') {
                thumbnailImage = value.value.trim();
            } else if (value.name === 'user_who_sent') {
                taggedMember = value.value.trim();
            }
        });

        taggedMember = await interaction.guild.members.fetch(taggedMember);
        taggedUser = taggedMember.user;

        // Spotify check (checks for both "spotify" and "s" as the image link)
        if (thumbnailImage != false) {
            if (thumbnailImage.toLowerCase().includes('spotify') || thumbnailImage.toLowerCase() === 's') {
                interaction.member.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }
        }
        
        //Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);
        args[1] = capitalize(args[1]);

        args[0] = args[0].trim();
        args[1] = args[1].trim();

        // [] check, as the system requires [] to grab the remix artist with string slicing.
        if (args[1].includes('Remix)')) {
            interaction.editReply('Please use [] for remixes, not ()!\nExample: `Song [Remix Artist Remix]`');
        }

        let rating = args[2];
        let review = args[3];

		rating = rating.trim();
		review = review.trim();

        if (rating.includes('/10')) rating = parseInt(rating.slice(3));

        args[2] = rating;

        //Split up the artists into an array
        let artistArray;
        artistArray = args[0].split(' & '); // This should never be changed beyond the original song artists (no features or remix artists.)
        let fullArtistArray = [artistArray, rmxArtists, featArtists]; // This one is the one for every artist, original + features + remixers.
        fullArtistArray = fullArtistArray.flat(1);

        //Start formatting into variables.
        let fullSongName = (`${args[1]}` + 
        `${(featArtists.length != 0) ? ` (ft. ${featArtists.join(' & ')})` : ``}` +
        `${(rmxArtists.length != 0) ? ` (${rmxArtists.join(' & ')} Remix)` : ``}`);

        let songName = args[1];

        // Fix artwork on all reviews for this song
        if (thumbnailImage != false && db.reviewDB.has(fullArtistArray[0])) {
            update_art(interaction, fullArtistArray[0], songName, thumbnailImage);
        }
        
        // Change our "default avatar review image" to the artists image in the database, if one exists
        if (db.reviewDB.has(fullArtistArray[0]) && thumbnailImage === false) {
            thumbnailImage = db.reviewDB.get(fullArtistArray[0], `["${songName}"].art`);
            if (thumbnailImage === undefined || thumbnailImage === false) {
                if (db.reviewDB.get(fullArtistArray[0], 'Image') === false || db.reviewDB.get(fullArtistArray[0], 'Image') === undefined) {
                    thumbnailImage = interaction.user.avatarURL({ format: "png", dynamic: false });
                }
            }
        } else if (thumbnailImage === false || thumbnailImage === undefined) {
            // Otherwise set our review art to the users avatar.
            thumbnailImage = interaction.user.avatarURL({ format: "png", dynamic: false });
        }

        let reviewEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${args[0]} - ${fullSongName}`)
        .setAuthor(`${interaction.member.displayName}'s review`, `${interaction.user.avatarURL({ format: "png", dynamic: false })}`);
        if (review != '-') {
            reviewEmbed.setDescription(review);
        } else {
            reviewEmbed.setDescription(`Rating: **${rating}/10**`);
        }
        reviewEmbed.setThumbnail(thumbnailImage);

        // If the character "-" is used, make the review embed display in a special way.
        if (review != '-') reviewEmbed.addField('Rating: ', `**${rating}/10**`, true);

        if (taggedUser != false && taggedUser != undefined) {
            reviewEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        //Add review to database
        //Quick thumbnail image check to assure we aren't putting in an avatar
        if (thumbnailImage === undefined || thumbnailImage === false || thumbnailImage.includes('avatar') === true || thumbnailImage === 'spotify' || thumbnailImage === 's') { 
            thumbnailImage = false;
        }

        // Send the embed rate message
        interaction.editReply({ embeds: [reviewEmbed], components: [row, row2] });

		const filter = i => i.user.id === interaction.user.id;
		const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000000 });
		let a_collector;
		let s_collector;
		let ra_collector;
		let re_collector;
        let starred = false;

		collector.on('collect', async i => {
			switch (i.customId) {
				case 'artist': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the Artist Name(s) (separated with &, DO NOT PUT REMIXERS OR FEATURE VOCALISTS HERE!)', components: [] });
					a_collector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
					a_collector.on('collect', async m => {
						m.content = capitalize(m.content);
                        artistArray = m.content.split(' & '); 
                        fullArtistArray = [artistArray, rmxArtists, featArtists]; 
                        fullArtistArray = fullArtistArray.flat(1);
                        
                        if (starred === false) {
                            reviewEmbed.setTitle(`${m.content} - ${fullSongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${m.content} - ${fullSongName} 🌟`);
                        }
						await i.editReply({ embeds: [reviewEmbed], components: [row, row2] });
						m.delete();
					});
					
					a_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [row, row2] });
					});
				} break;
				case 'song': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the Song Name (NO FT. SHOULD BE INCLUDED)', components: [] });

					s_collector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
					s_collector.on('collect', async m => {
                        m.content = capitalize(m.content);
						songName = m.content;
                        fullSongName = (`${songName}` + 
                        `${(featArtists.length != 0) ? ` (ft. ${featArtists.join(' & ')})` : ``}` +
                        `${(rmxArtists.length != 0) ? ` (${rmxArtists.join(' & ')} Remix)` : ``}`);
                        reviewEmbed.setTitle(`${artistArray.join(' & ')} - ${fullSongName}`);
						await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [row, row2] });
						m.delete();
					});
					
					s_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [row, row2] });
					});
				} break;
				case 'rating': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the rating (DO NOT ADD /10!)', components: [] });

					ra_collector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
					ra_collector.on('collect', async m => {
						rating = parseFloat(m.content);
                        reviewEmbed.fields[0] = { name : 'Rating', value : `**${rating}/10**` };
						await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [row, row2] });
						m.delete();
					});
					
					ra_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [row, row2] });
					});
				} break;
				case 'review': {
					await i.deferUpdate();
					await i.editReply({ content: 'Type in the new review.', components: [] });

					re_collector = interaction.channel.createMessageCollector({ max: 1, time: 60000 });
					re_collector.on('collect', async m => {
						review = m.content;
                        reviewEmbed.setDescription(review);
						await i.editReply({ embeds: [reviewEmbed], components: [row, row2] });
						m.delete();
					});
					
					re_collector.on('end', async collected => {
						console.log(`Collected ${collected.size} items`);
						await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [row, row2] });
					});
				} break;
                case 'star': {
                    await i.deferUpdate();

                    // If we don't have a 10 rating, the button does nothing.
                    if (rating != 10) return await i.editReply({ embeds: [reviewEmbed], components: [row, row2] });

                    if (starred === false) {
                        reviewEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${fullSongName} 🌟`);
                        starred = true;
                    } else {
                        reviewEmbed.setTitle(`${artistArray.join(' & ')} - ${fullSongName}`);
                        starred = false;
                    }

                    await i.editReply({ embeds: [reviewEmbed], components: [row, row2] });
				} break;
                case 'done': { // Send the review to the database
                    await i.deferUpdate(); 

                    if (a_collector != undefined) a_collector.stop();
                    if (s_collector != undefined) s_collector.stop();
                    if (ra_collector != undefined) ra_collector.stop();
                    if (re_collector != undefined) re_collector.stop();
                    if (collector != undefined) collector.stop(); // Collector for all buttons
                    await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [] });

                    // Review the song
                    review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser);

                    // Update user stats
                    db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');
                    db.user_stats.push(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'review_list');
                    
                    const msg = await interaction.fetchReply();

                    // Setting the message id for the message we just sent (and check for mailbox, if so put as FALSE so we don't have to look for a non-existant message)
                    if (!mailboxes.includes(interaction.channel.name)) {
                        for (let ii = 0; ii < fullArtistArray.length; ii++) {
                            if (rmxArtists.length === 0) {
                                db.reviewDB.set(fullArtistArray[ii], msg.id, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                                console.log(db.reviewDB.get(fullArtistArray[ii], `["${songName}"].["${interaction.user.id}"].msg_id`));
                            } else if (rmxArtists.includes(fullArtistArray[ii])) {
                                db.reviewDB.set(fullArtistArray[ii], msg.id, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].msg_id`); 
                            }
                        }
                    } else {
                        for (let ii = 0; ii < fullArtistArray.length; ii++) {
                            if (rmxArtists.length === 0) {
                                db.reviewDB.set(fullArtistArray[ii], false, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                            } else if (rmxArtists.includes(fullArtistArray[ii])) {
                                db.reviewDB.set(fullArtistArray[ii], false, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].msg_id`); 
                            }
                        }
                    }

                    // Star reaction stuff for hall of fame
                    if (rating === '10' && starred === true) {
                        hall_of_fame_check(interaction, msg, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
                    }
                
                    // End the collector
                    collector.stop();
				} break;
			}
		});

		collector.on('end', async collected => {
			console.log(`Collected ${collected.size} items`);
			if (a_collector != undefined) a_collector.stop();
			if (s_collector != undefined) s_collector.stop();
			if (ra_collector != undefined) ra_collector.stop();
			if (re_collector != undefined) re_collector.stop();
		});

    },
};*/

// This command is a RIGHT CLICK CONTEXT MENU COMMAND, NOT A SLASH COMMAND!
module.exports = {
	name: 'Spotify Link Review',
    type: '3',
	async execute(interaction) {
		const msg = interaction.options.getMessage('message');

		return interaction.editReply('This feature is still a work in progress.\nCheck #bot-updates to see if there is any updates on the status of this feature.');

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
						await interaction.editReply(`Title: **${song}**\nMade by: **${artists}**\nRating: **${rating}/10**\nReview: **${review}**\nArt Link: <${art}>`);
						m2.delete();
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