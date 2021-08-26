const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, update_art, review_song, hall_of_fame_check } = require('../func.js');
const { mailboxes } = require('../arrays.json');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Review a song using Waveform.')
        .addStringOption(option => 
            option.setName('artists')
                .setDescription('The name of the artist(s). (DO NOT PUT ANY REMIXERS OR VOCALISTS HERE, ONLY PRODUCTION ARTISTS)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song. (Do not include any features or remixers in here!)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('rating')
                .setDescription('Rating for the song (1-10, decimals allowed.)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('review')
                .setDescription('Review of the song (Set this to - if you wish to do a rating and no review.)')
                .setRequired(true))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art of the song (put spotify or s here if you want to use your spotify status.)')
                .setRequired(false))
            
        .addStringOption(option => 
            option.setName('vocalists')
                .setDescription('Vocalists who feature on the song (use & to separate multiple)')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Put remixers here, if you reviewing a remix of the original song. (NOT IN ARTISTS ARGUMENT)')
                .setRequired(false))
    
        .addUserOption(option => 
            option.setName('user_who_sent')
                .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
                .setRequired(false)),
	admin: false,
	async execute(interaction, sp_artist, sp_song, sp_rating, sp_review, sp_art, sp_vocalists, sp_remixers, sp_user_who_sent, sp_star) {

        let int_channel = interaction.channel;

        // If we do a context menu review, we have to change the channel focus to #reviews.
        if (sp_song != undefined) {
            int_channel = await interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
        }

        // Check if we are reviewing in the right chat, if not, boot out
        if (`<#${int_channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel') && !mailboxes.includes(int_channel.name)) {
            if (sp_song === undefined || sp_song === null) {
                return interaction.editReply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')} or mailboxes!`);
            }
        }

        let args = [];
        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = false;
        let featArtists = [];
        let rmxArtists = [];
        let starred = false;

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

        if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
            row2.addComponents( 
                new Discord.MessageButton()
                .setCustomId('ep_done')
                .setLabel('Push to EP Review')
                .setStyle('SUCCESS'),
            );
        }
        
        if (sp_song === undefined || sp_song === null) {
            interaction.options._hoistedOptions.forEach((value) => {
                args.push(value.value.trim());
                if (value.name === 'art') {
                    thumbnailImage = value.value.trim();
                } else if (value.name === 'user_who_sent') {
                    taggedMember = value.value.trim();
                } else if (value.name === 'vocalists') {
                    featArtists.push(capitalize(value.value.trim()).split(' & '));
                    featArtists = featArtists.flat(1);
                } else if (value.name === 'remixers') {
                    rmxArtists.push(capitalize(value.value.trim()).split(' & '));
                    rmxArtists = rmxArtists.flat(1);
                }
            });
        } else { // Context Menu Command
            args = [sp_artist, sp_song, sp_rating, sp_review, sp_art, sp_vocalists, sp_remixers, sp_user_who_sent, sp_star];
            thumbnailImage = sp_art;
            if (sp_vocalists != undefined) {
                featArtists.push(capitalize(sp_vocalists).split(' & '));
                featArtists = featArtists.flat(1);
            }

            starred = sp_star;
        }
        
        taggedMember = await interaction.guild.members.fetch(taggedMember);
        taggedUser = taggedMember.user;

        // Spotify check (checks for both "spotify" and "s" as the image link)
        if (thumbnailImage != false && thumbnailImage != undefined) {
            if (thumbnailImage.toLowerCase().includes('spotify') || thumbnailImage.toLowerCase() === 's') {
                interaction.member.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }
        }

        // Make sure we DON'T get any slip ups, where the bot lets spotify run through (if it can't find a status)
        if (thumbnailImage != undefined && thumbnailImage != false) {
            if (thumbnailImage.toLowerCase().includes('spotify') || thumbnailImage.toLowerCase() === 's') thumbnailImage = false;
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

        console.log(rating);

        if (!Number.isInteger(rating)) {
            rating = rating.trim();
            if (rating.includes('/10')) rating = parseInt(rating.slice(3));
        }
        review = review.trim();

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
        if (sp_song === undefined || sp_song === null) {
            interaction.editReply({ embeds: [reviewEmbed], components: [row, row2] });

            const filter = i => i.user.id === interaction.user.id;
            const collector = int_channel.createMessageComponentCollector({ filter, time: 10000000 });
            let a_collector;
            let s_collector;
            let ra_collector;
            let re_collector;

            collector.on('collect', async i => {
                switch (i.customId) {
                    case 'artist': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the Artist Name(s) (separated with &, DO NOT PUT REMIXERS OR FEATURE VOCALISTS HERE!)', components: [] });
                        const a_filter = m => m.author.id === interaction.user.id;
                        a_collector = int_channel.createMessageCollector({ a_filter, max: 1, time: 60000 });
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

                        const s_filter = m => m.author.id === interaction.user.id;
                        s_collector = int_channel.createMessageCollector({ s_filter, max: 1, time: 60000 });
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

                        const ra_filter = m => m.author.id === interaction.user.id;
                        ra_collector = int_channel.createMessageCollector({ ra_filter, max: 1, time: 60000 });
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

                        const re_filter = m => m.author.id === interaction.user.id;
                        re_collector = int_channel.createMessageCollector({ re_filter, max: 1, time: 60000 });
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
                    case 'ep_done': {
                        await i.deferUpdate();

                        if (a_collector != undefined) a_collector.stop();
                        if (s_collector != undefined) s_collector.stop();
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                        interaction.deleteReply();

                        let msgtoEdit = db.user_stats.get(interaction.user.id, 'current_ep_review');
                        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

                        let msgEmbed;
                        let embed_data;

                        channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                            console.log(msg);
                            embed_data = msg.embeds;
                            msgEmbed = embed_data[0];
                            console.log(msgEmbed);
                            msgEmbed.thumbnail.url = thumbnailImage;
                            msg.edit({ embeds: [msgEmbed] });
                        });

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
                        if (!mailboxes.includes(int_channel.name)) {
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

        } else { // Reviewing with the Spotify Link Review Context Menu

            // Review the song
            review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser);

            // Update user stats
            db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');
            db.user_stats.push(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'review_list');

            await int_channel.send({ embeds: [reviewEmbed] }).then(msg => {
                // Setting the message id for the message we just sent (and check for mailbox, if so put as FALSE so we don't have to look for a non-existant message)
                if (!mailboxes.includes(int_channel.name)) {
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
                if (sp_star === true) {
                    hall_of_fame_check(interaction, msg, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
                }
            });
        }
    },
};