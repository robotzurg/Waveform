const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, update_art, review_song, hall_of_fame_check } = require('../func.js');

module.exports = {
    name: 'review',
    description: 'Create a song review embed message!',
    options: [
        {
            name: 'artists',
            type: 'STRING',
            description: 'The name of the artist. (DO NOT PUT ANY REMIXERS OR VOCALISTS HERE, ONLY PRODUCTION ARTISTS)',
            required: true,
        }, {
            name: 'song',
            type: 'STRING',
            description: 'The name of the song. (Do not include any features or remixers in here!)',
            required: true,
        }, {
            name: 'score',
            type: 'STRING',
            description: 'Score for the song (1-10, decimals allowed.)',
            required: true,
        }, {
            name: 'review',
            type: 'STRING',
            description: 'Review of the song (Set this to - if you wish to do a rating and no review.)',
            required: true,
        }, {
            name: 'art',
            type: 'STRING',
            description: 'Art of the song',
            required: false,
        }, {
            name: 'vocalists',
            type: 'STRING',
            description: 'Vocalists who feature on the song (use & to separate multiple)',
            required: false,
        }, {
            name: 'remixers',
            type: 'STRING',
            description: 'Remixers who remixed the song (use & to separate multiple)',
            required: false,
        }, {
            name: 'user_who_sent',
            type: 'USER',
            description: 'User who sent a song',
            required: false,
        },
    ],
	admin: false,
	async execute(interaction) {
        // Check if we are reviewing in the right chat, if not, boot out
        if (`<#${interaction.channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel')) {
            return interaction.editReply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')}!`);
        }

        let args = [];
        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = false;
        let featArtists = [];
        let rmxArtists = [];
        
        interaction.options.forEach((value) => {
            args.push(value.value);
            if (value.name === 'art') {
                thumbnailImage = value.value;
            } else if (value.name === 'user_who_sent') {
                taggedMember = value.value;
            } else if (value.name === 'vocalists') {
                featArtists.push(value.value.split(' & '));
                featArtists = featArtists.flat(1);
            } else if (value.name === 'remixers') {
                rmxArtists.push(value.value.split(' & '));
                rmxArtists = rmxArtists.flat(1);
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

        // [] check, as the system requires [] to grab the remix artist with string slicing.
        if (args[1].includes('Remix)')) {
            interaction.editReply('Please use [] for remixes, not ()!\nExample: `Song [Remix Artist Remix]`');
        }

        let rating = args[2];
        let review = args[3];

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

        const reviewEmbed = new Discord.MessageEmbed()
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
        if (thumbnailImage === undefined || thumbnailImage === false || thumbnailImage.includes('avatar') === true) { 
            thumbnailImage = false;
        }

        // Review the song
        review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser);

        // Update user stats
        db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');
        db.user_stats.push(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'review_list');

        // Send the embed rate message
        interaction.editReply({ embeds: [reviewEmbed] });
        const msg = await interaction.fetchReply();

        // Setting the message id for the message we just sent
        for (let i = 0; i < fullArtistArray.length; i++) {
            if (rmxArtists.length === 0) {
                db.reviewDB.set(fullArtistArray[i], msg.id, `["${songName}"].["${interaction.user.id}"].msg_id`); 
            } else if (rmxArtists.includes(fullArtistArray[i])) {
                db.reviewDB.set(fullArtistArray[i], msg.id, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].msg_id`); 
            }
        }

        /*const filter = (reaction, user) => {
            return (reaction.emoji.name === '🌟') && user.id === interaction.user.id;
        };

        msg.react('🌟');
        msg.awaitReactions({ filter, max: 1, time: 10000, errors: ['time'] })
        .then(collected => {
            console.log(collected);
            const reaction = collected.first();
            if (reaction.emoji.name === '🌟') {
                
            }
        })
        .catch(collected => {
            console.log(collected);
            msg.reactions.removeAll();
        });*/
        
        // Star reaction stuff for hall of fame
        if (rating === '10') {
            hall_of_fame_check(interaction, msg, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
        }
    },
};