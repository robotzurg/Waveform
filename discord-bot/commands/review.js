const Discord = require('discord.js');
const db = require("../db.js");
const { capitalize, update_art, review_song, hall_of_fame_check } = require('../func.js');
const { mailboxes } = require('../arrays.json');
const { SlashCommandBuilder } = require('@discordjs/builders');
const wait = require('util').promisify(setTimeout);

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

        .addIntegerOption(option => 
            option.setName('ranking_pos')
                .setDescription('If this is a ranking, put the position in the ranking here (Ignore if not an EP review)')
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
        let ranking_pos = false;
        let featArtists = [];
        let rmxArtists = [];
        let starred = false;
        let collector_time = 100000000;
        let auto_merge = db.user_stats.get(interaction.user.id, 'auto_merge_to_ep');
        if (auto_merge == true && db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
            collector_time = 1000;
        }

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
            new Discord.MessageButton()
                .setCustomId('delete')
                .setLabel('Delete')
                .setStyle('DANGER'),
        );

        if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review').length != 0) {
                row2.addComponents( 
                    new Discord.MessageButton()
                    .setCustomId('ep_done')
                    .setLabel('Push to EP Review')
                    .setStyle('SUCCESS'),
                );
            }
        }
        
        if (sp_song === undefined || sp_song === null) {
            interaction.options._hoistedOptions.forEach((value) => {
                if (!Number.isInteger(value.value)) {
                    args.push(value.value.trim());
                } else {
                    args.push(value.value);
                }
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
                } else if (value.name === 'ranking_pos') {
                    ranking_pos = value.value;
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
            await interaction.editReply('Please use the Remixers argument for Remixers, do not include them in the song name!`');
            await wait(10000);
            return await interaction.deleteReply();
        }

        let rating = parseFloat(args[2]);
        let review = args[3];

        if (isNaN(rating)) {
            await interaction.editReply('Your rating is not a number! Make sure NOT to include /10, just do the number, like "8".');
            await wait(10000);
            return await interaction.deleteReply();
        }

        review = review.trim();

        if (review.includes('\\n')) {
            review = review.split('\\n').join('\n');
        }

        //Split up the artists into an array
        let artistArray;

        if (args[0] != "Ep" && args[0] != "Lp") {
            artistArray = args[0].split(' & '); // This should never be changed beyond the original song artists (no features or remix artists.)
        } else {
            artistArray = db.user_stats.get(interaction.user.id, `current_ep_review`)[2];
            console.log(`Changed: ${artistArray}`);
            if (artistArray === undefined) return interaction.editReply('You don\'t have an active EP/LP review going, so you can\'t use this syntax.');
        }

        console.log(`Final: ${artistArray}`);

        let fullArtistArray = [artistArray, rmxArtists, featArtists]; // This one is the one for every artist, original + features + remixers.
        fullArtistArray = fullArtistArray.flat(1);

        //Start formatting into variables.
        let fullSongName = (`${args[1]}` + 
        `${(featArtists.length != 0) ? ` (ft. ${featArtists.join(' & ')})` : ``}` +
        `${(rmxArtists.length != 0) ? ` (${rmxArtists.join(' & ')} Remix)` : ``}`);

        let songName = args[1];

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
        .setTitle(`${artistArray.join(' & ')} - ${fullSongName}`)
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
            const collector = int_channel.createMessageComponentCollector({ filter, time: collector_time });
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

                            // Change our "default avatar review image" to the artists image in the database, if one exists
                            if (db.reviewDB.has(fullArtistArray[0])) {
                                thumbnailImage = db.reviewDB.get(fullArtistArray[0], `["${songName}"].art`);
                                if (thumbnailImage === undefined || thumbnailImage === false) {
                                    thumbnailImage = interaction.user.avatarURL({ format: "png", dynamic: false });
                                } 
                            }

                            reviewEmbed.setThumbnail(thumbnailImage);

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

                            // Change our "default avatar review image" to the artists image in the database, if one exists
                            if (db.reviewDB.has(fullArtistArray[0])) {
                                thumbnailImage = db.reviewDB.get(fullArtistArray[0], `["${songName}"].art`);
                                if (thumbnailImage === undefined || thumbnailImage === false) {
                                    thumbnailImage = interaction.user.avatarURL({ format: "png", dynamic: false });
                                } 
                            }

                            reviewEmbed.setThumbnail(thumbnailImage);

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
                    case 'delete': {
                        if (a_collector != undefined) a_collector.stop();
                        if (s_collector != undefined) s_collector.stop();
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                        interaction.deleteReply();
                    } break;
                    case 'ep_done': { // EP review handling
                        await i.deferUpdate();

                        if (a_collector != undefined) a_collector.stop();
                        if (s_collector != undefined) s_collector.stop();
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                        interaction.deleteReply();

                        let msgtoEdit = db.user_stats.get(interaction.user.id, 'current_ep_review')[0];
                        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

                        let msgEmbed;
                        let mainArtists;
                        let ep_name;
                        let collab;
                        let field_name;

                        await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                            msgEmbed = msg.embeds[0];
                            mainArtists = [msgEmbed.title.split(' - ')[0].split(' & ')];
                            mainArtists = mainArtists.flat(1);
                            ep_name = msgEmbed.title.split(' - ');
                            ep_name.shift();
                            console.log(ep_name);
                            ep_name = ep_name.join(' - ');
                            if (ep_name.includes('/10')) {
                                ep_name = ep_name.replace('/10)', '');
                                if (ep_name.includes('.5')) {
                                    ep_name = ep_name.slice(0, -4).trim();
                                } else {
                                    ep_name = ep_name.slice(0, -3).trim();
                                }
                            }
                            if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && thumbnailImage === false) {
                                thumbnailImage = msgEmbed.thumbnail.url;
                            }
                        });

                        // Review the song
                        await review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser, ep_name);

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                        }

                        // Edit the EP embed
                        await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                            collab = artistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                            if (starred === true) {
                                field_name = `🌟 ${fullSongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10) 🌟`;
                            } else {
                                field_name = `${fullSongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10)`;
                            }
                            msgEmbed.fields.push({
                                name: field_name,
                                value: `${review}`,
                                inline: false,
                            });
                            msg.edit({ embeds: [msgEmbed] });

                            // Star reaction stuff for hall of fame
                            if (rating === '10' && starred === true) {
                                hall_of_fame_check(interaction, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
                            }
                        });

                        // Update user stats
                        db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');

                        for (let ii = 0; ii < mainArtists.length; ii++) {
                            // Update EP details
                            db.reviewDB.push(mainArtists[ii], songName, `["${ep_name}"].songs`);
                            if (ranking_pos != false) {
                                db.reviewDB.push(mainArtists[ii], [ranking_pos, `${ranking_pos}. ${songName} (${rating}/10)`], `["${ep_name}"].["${interaction.user.id}"].ranking`);
                            }
                        }

                        if (db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].ranking`).length != 0) {
                                await interaction.channel.messages.fetch(db.user_stats.get(interaction.user.id, 'current_ep_review')[1]).then(rank_msg => {
                                    let ep_ranking = db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].ranking`);
                                    if (ep_ranking.length === 0) return rank_msg.delete();

                                    ep_ranking = ep_ranking.sort(function(a, b) {
                                        return a[0] - b[0];
                                    });
                        
                                    ep_ranking = ep_ranking.flat(1);
                        
                                    for (let ii = 0; ii <= ep_ranking.length; ii++) {
                                        ep_ranking.splice(ii, 1);
                                    }

                                    ep_ranking = `\`\`\`${ep_ranking.join('\n')}\`\`\``;
                                    let rankMsgEmbed = rank_msg.embeds[0];
                                    rankMsgEmbed.fields[0].value = ep_ranking;

                                    rank_msg.edit({ embeds: [rankMsgEmbed] });
                                });
                        } else {
                            await interaction.channel.messages.fetch(db.user_stats.get(interaction.user.id, 'current_ep_review')[1]).then(rank_msg => {
                                rank_msg.delete();
                            }).catch(() => {
                                console.log('Ranking not found, working as intended.');
                            });    
                        }

                        // Set msg_id for this review to false, since its part of the EP review message
                        for (let ii = 0; ii < fullArtistArray.length; ii++) {
                            if (rmxArtists.length === 0) {
                                db.reviewDB.set(fullArtistArray[ii], false, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                            } else if (rmxArtists.includes(fullArtistArray[ii])) {
                                db.reviewDB.set(fullArtistArray[ii], false, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].msg_id`); 
                            }
                        }

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
                        review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser, false);

                        // Update user stats
                        db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');
                        
                        const msg = await interaction.fetchReply();

                        // Setting the message id and url for the message we just sent (and check for mailbox, if so put as FALSE so we don't have to look for a non-existant message)
                        for (let ii = 0; ii < fullArtistArray.length; ii++) {
                            if (rmxArtists.length === 0) {
                                db.reviewDB.set(fullArtistArray[ii], msg.id, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                                db.reviewDB.set(fullArtistArray[ii], msg.url, `["${songName}"].["${interaction.user.id}"].url`); 
                            } else if (rmxArtists.includes(fullArtistArray[ii])) {
                                db.reviewDB.set(fullArtistArray[ii], msg.url, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].url`); 
                            }
                        }

                        // Star reaction stuff for hall of fame
                        console.log(rating);
                        if (rating === 10 && starred === true) {
                            hall_of_fame_check(interaction, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
                        }

                        // Fix artwork on all reviews for this song
                        if (thumbnailImage != false && db.reviewDB.has(fullArtistArray[0])) {
                            await update_art(interaction, fullArtistArray[0], songName, thumbnailImage);
                        }
                    
                        // End the collector
                        collector.stop();
                    } break;
                }
            });

            collector.on('end', async () => {
                if (auto_merge == true && db.user_stats.get(interaction.user.id, 'current_ep_review') != false) {
                    interaction.deleteReply();

                    let msgtoEdit = db.user_stats.get(interaction.user.id, 'current_ep_review')[0];
                    let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

                    let msgEmbed;
                    let mainArtists;
                    let ep_name;
                    let collab;
                    let field_name;

                    await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                        msgEmbed = msg.embeds[0];
                        mainArtists = [msgEmbed.title.split(' - ')[0].split(' & ')];
                        mainArtists = mainArtists.flat(1);
                        ep_name = msgEmbed.title.split(' - ');
                        ep_name.shift();
                        console.log(ep_name);
                        ep_name = ep_name.join(' - ');
                        if (ep_name.includes('/10')) {
                            ep_name = ep_name.replace('/10)', '');
                            if (ep_name.includes('.5')) {
                                ep_name = ep_name.slice(0, -4).trim();
                            } else {
                                ep_name = ep_name.slice(0, -3).trim();
                            }
                        }
                        if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && thumbnailImage === false) {
                            thumbnailImage = msgEmbed.thumbnail.url;
                        }
                    });

                    // Review the song
                    await review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser, ep_name);

                    for (let j = 0; j < artistArray.length; j++) {
                        db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                    }

                    // Update user stats
                    db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');

                    for (let ii = 0; ii < mainArtists.length; ii++) {
                        // Update EP details
                        db.reviewDB.push(mainArtists[ii], songName, `["${ep_name}"].songs`);
                        if (ranking_pos != false) {
                            db.reviewDB.push(mainArtists[ii], [ranking_pos, `${ranking_pos}. ${songName} (${rating}/10)`], `["${ep_name}"].["${interaction.user.id}"].ranking`);
                        }
                    }
                    
                    // Edit the EP embed
                    await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                        collab = artistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                        if (starred === true) {
                            field_name = `🌟 ${fullSongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10) 🌟`;
                        } else {
                            field_name = `${fullSongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10)`;
                        }
                        msgEmbed.fields.push({
                            name: field_name,
                            value: `${review}`,
                            inline: false,
                        });
                        msg.edit({ embeds: [msgEmbed] });

                        // Star reaction stuff for hall of fame
                        if (rating === '10' && starred === true) {
                            hall_of_fame_check(interaction, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
                        }
                    });

                    if (db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].ranking`).length != 0) {
                        await interaction.channel.messages.fetch(db.user_stats.get(interaction.user.id, 'current_ep_review')[1]).then(rank_msg => {
                            let ep_ranking = db.reviewDB.get(artistArray[0], `["${ep_name}"].["${interaction.user.id}"].ranking`);
                            if (ep_ranking.length === 0) return rank_msg.delete();

                            ep_ranking = ep_ranking.sort(function(a, b) {
                                return a[0] - b[0];
                            });
                
                            ep_ranking = ep_ranking.flat(1);
                
                            for (let ii = 0; ii <= ep_ranking.length; ii++) {
                                ep_ranking.splice(ii, 1);
                            }

                            ep_ranking = `\`\`\`${ep_ranking.join('\n')}\`\`\``;
                            let rankMsgEmbed = rank_msg.embeds[0];
                            rankMsgEmbed.fields[0].value = ep_ranking;

                            rank_msg.edit({ embeds: [rankMsgEmbed] });
                        });
                    } else {
                        await interaction.channel.messages.fetch(db.user_stats.get(interaction.user.id, 'current_ep_review')[1]).then(rank_msg => {
                            rank_msg.delete();
                        }).catch(() => {
                            console.log('Ranking not found, working as intended.');
                        });    
                    }

                    // Set msg_id for this review to false, since its part of the EP review message
                    for (let ii = 0; ii < fullArtistArray.length; ii++) {
                        if (rmxArtists.length === 0) {
                            db.reviewDB.set(fullArtistArray[ii], false, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                        } else if (rmxArtists.includes(fullArtistArray[ii])) {
                            db.reviewDB.set(fullArtistArray[ii], false, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].msg_id`); 
                        }
                    }
                }

                if (a_collector != undefined) a_collector.stop();
                if (s_collector != undefined) s_collector.stop();
                if (ra_collector != undefined) ra_collector.stop();
                if (re_collector != undefined) re_collector.stop();
            });

        } else { // Reviewing with the Spotify Link Review Context Menu

            // Review the song
            review_song(interaction, fullArtistArray, songName, review, rating, rmxArtists, featArtists, thumbnailImage, taggedUser, false);

            // Update user stats
            db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${fullSongName}`, 'recent_review');

            await int_channel.send({ embeds: [reviewEmbed] }).then(msg => {
                // Setting the message id and url for the message we just sent (and check for mailbox, if so put as FALSE so we don't have to look for a non-existant message)
                for (let ii = 0; ii < fullArtistArray.length; ii++) {
                    if (rmxArtists.length === 0) {
                        db.reviewDB.set(fullArtistArray[ii], msg.id, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                        db.reviewDB.set(fullArtistArray[ii], msg.url, `["${songName}"].["${interaction.user.id}"].url`); 
                    } else if (rmxArtists.includes(fullArtistArray[ii])) {
                        db.reviewDB.set(fullArtistArray[ii], msg.id, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].msg_id`); 
                        db.reviewDB.set(fullArtistArray[ii], msg.url, `["${songName} (${rmxArtists.join(' & ')} Remix)"].["${interaction.user.id}"].url`); 
                    }
                }

                // Star reaction stuff for hall of fame
                if (sp_star === true) {
                    hall_of_fame_check(interaction, args, fullArtistArray, artistArray, rmxArtists, songName, thumbnailImage);
                }
            });
        }
    },
};
