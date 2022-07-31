const Discord = require('discord.js');
const db = require("../db.js");
const { update_art, review_song, hall_of_fame_check, handle_error, find_review_channel, grab_spotify_art, parse_artist_song_data } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Review a song using Waveform.')
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Review a song by utilizing your currently playing spotify song (requires login).')

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Rating for the song (1-10, decimals allowed.)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('review')
                    .setDescription('Your review of the song')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('tag')
                    .setDescription('Put a tag you want to set the song to here!')
                    .setAutocomplete(true)
                    .setRequired(false))

            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Image link of the song art (put \'s\' here if you want to use your spotify playback.)')
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Review a song by manually entering information.')

            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s). (DO NOT PUT ANY REMIXERS HERE)')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('song_name')
                    .setDescription('The name of the song. (Do not include any features or remixers in here!)')
                    .setAutocomplete(true)
                    .setRequired(true))

            .addStringOption(option => 
                option.setName('rating')
                    .setDescription('Rating for the song (1-10, decimals allowed.)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('review')
                    .setDescription('Your review of the song')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('remixers')
                    .setDescription('Put remixers here, if you reviewing a remix of the original song. (NOT IN ARTISTS ARGUMENT)')
                    .setAutocomplete(true)
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('tag')
                    .setDescription('Put a tag you want to set the song to here!')
                    .setAutocomplete(true)
                    .setRequired(false))

            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Image link of the song art (put \'s\' here if you want to use your spotify playback.)')
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('vocalist')
                    .setDescription('If you want the song name to have a (ft.) in it for artists, use this argument.')
                    .setAutocomplete(true))),
	async execute(interaction) {
        try {

        // These variables are here so that we can start a review from anywhere else
        let int_channel = interaction.channel;
        let mailboxes = db.server_settings.get(interaction.guild.id, 'mailboxes');

        // Check if we are reviewing in the right chat, if not, boot out
        if (`<#${int_channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel') && !mailboxes.includes(int_channel.name)) {
            return interaction.editReply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')} or mailboxes!`);
        }

        let vocalistArray = interaction.options.getString('vocalist');
        let rmxArtistArray = interaction.options.getString('remixers');

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        
        // Songname check to avoid not using the arguments properly.
        if (song != null) {
            if (song.includes('Remix)') || song.includes('ft.') || song.includes('feat.')) {
                await interaction.editReply('Please make sure that no artist names are placed in the song name argument.\n' + 
                'For example, do not put `Song (Dude Remix)`, just put `Song`, and put the remixer in the Remixers argument.');
                return;
            }
        }

        let parsed_args = await parse_artist_song_data(interaction, artists, song, rmxArtistArray, vocalistArray);
        if (parsed_args == -1) return;
        console.log(parsed_args);

        let origArtistArray = parsed_args[0];
        let songName = parsed_args[1];
        let artistArray = parsed_args[2];
        rmxArtistArray = parsed_args[3];
        vocalistArray = parsed_args[4];
        let displaySongName = parsed_args[5];
        let origSongName = parsed_args[6];

        let rating = interaction.options.getString('rating');
        if (rating == null) rating = false;
        let review = interaction.options.getString('review');
        if (review == null) review = false;
        let tag = interaction.options.getString('tag');
        let songArt = interaction.options.getString('art');
        let user_who_sent = interaction.options.getUser('user_who_sent');
        let starred = false;
        let taggedUser = false;
        let taggedMember = false;

        // EP/LP check to see if "og" is listed as the artist name, so replace it with EP/LP artist
        if (db.user_stats.get(interaction.user.id, 'current_ep_review')[2] != undefined) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review')[2].includes(' EP') || db.user_stats.get(interaction.user.id, 'current_ep_review')[2].includes(' LP')) {
                for (let i = 0; i < origArtistArray.length; i++) {
                    if (origArtistArray[i].toLowerCase() == 'og') {
                        origArtistArray[i] = db.user_stats.get(interaction.user.id, `current_ep_review`)[1];
                        origArtistArray = origArtistArray.flat(1);
                    }   
                }
            }
        }

        if (user_who_sent != null) {
            taggedUser = user_who_sent;
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        }

        // Setup review editing buttons
        const editButtons = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('artist').setLabel('Artist')
                .setStyle('PRIMARY').setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('song').setLabel('Song')
                .setStyle('PRIMARY').setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('rating').setLabel('Rating')
                .setStyle('PRIMARY').setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('review').setLabel('Review')
                .setStyle('PRIMARY').setEmoji('📝'),
            new Discord.MessageButton()
                .setCustomId('star').setLabel('')
                .setStyle('SECONDARY').setEmoji('🌟'),
        );

        // Setup review submit button row
        const reviewButtons = new Discord.MessageActionRow();

        // If we're in an EP/LP review, stick in a button to push to EP review instead of a send to database button.
        if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false && origArtistArray.includes(db.user_stats.get(interaction.user.id, 'current_ep_review')[1][0])) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review').length != 0) {
                reviewButtons.addComponents( 
                    new Discord.MessageButton()
                    .setCustomId('ep_done').setLabel('Push to EP Review')
                    .setStyle('SUCCESS'),
                );
            }
        } else {
            reviewButtons.addComponents( 
                new Discord.MessageButton()
                .setCustomId('done').setLabel('Send to Database')
                .setStyle('SUCCESS'),
            );
        }

        // Add the delete button
        reviewButtons.addComponents(
            new Discord.MessageButton()
                .setCustomId('delete').setLabel('Delete')
                .setStyle('DANGER'),
        );

        // Grab song art if we don't directly specify one
        if (songArt == false || songArt == null || songArt == undefined) {
            songArt = await grab_spotify_art(origArtistArray, songName);
            if (db.reviewDB.has(artistArray[0])) {
                if (db.reviewDB.get(artistArray[0], `["${songName}"].art`) != false && db.reviewDB.get(artistArray[0], `["${songName}"].art`) != undefined) {
                    songArt = await db.reviewDB.get(artistArray[0], `["${songName}"].art`);
                }
            }
        }

        // Start creation of embed
        let reviewEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s review`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` });

        // Check rating input to ensure we have a valid number.
        if (rating !== false) {
            if (rating.includes('/10')) rating = rating.replace('/10', '');
            rating = parseFloat(rating);
            if (isNaN(rating)) return interaction.editReply(`The rating \`${rating}\` is not valid, please make sure you put in an integer or decimal rating!`);
            if (rating < 0 || rating > 10) return interaction.editReply(`The rating \`${rating}\` is not a number in between 0 and 10. It must be between those 2 numbers.`);
        }

        // \n parse handling, to allow for line breaks in reviews on Discord PC
        // I wish I knew why Discord wouldn't just let you do this on the client, but whatever
        if (review != false) {
            if (review.includes('\\n')) {
                review = review.split('\\n').join('\n');
            }
        }

        if (review == false && rating === false) {
            return interaction.editReply('Your song review must either have a rating or review, it cannot be missing both.');
        } else {
            if (rating !== false) reviewEmbed.addField('Rating: ', `**${rating}/10**`, true);
            if (review != false) reviewEmbed.setDescription(review);
        }
        
        if (songArt == false || songArt == undefined) {
            await reviewEmbed.setThumbnail(interaction.user.avatarURL({ format: "png", dynamic: false }));
        } else {
            await reviewEmbed.setThumbnail(songArt);
        }
        
        if (taggedUser != false && taggedUser != undefined) {
            reviewEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, avatarURL: taggedUser.avatarURL({ format: "png", dynamic: false }) });
        }
        // End of Embed Code

        //Quick thumbnail image check to assure we aren't putting in an avatar, songArt should be set to what we put in the database.
        if (songArt == undefined || songArt == false || songArt.includes('avatar') || songArt == 'spotify' || songArt == 's') { 
            songArt = false;
        }

        // Send the review embed
        interaction.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });

        const filter = i => i.user.id == interaction.user.id;
        const collector = int_channel.createMessageComponentCollector({ filter, time: 100000000 });
        let a_collector;
        let s_collector;
        let ra_collector;
        let re_collector;

        collector.on('collect', async i => {
            switch (i.customId) {
                // Artist edit button
                case 'artist': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the artist name(s) (separated with &, DO NOT PUT REMIXERS HERE!)', components: [] });
                    const a_filter = m => m.author.id == interaction.user.id;
                    a_collector = int_channel.createMessageCollector({ filter: a_filter, max: 1, time: 60000 });
                    await a_collector.on('collect', async m => {
                        origArtistArray = m.content.split(' & ');
                        songArt = false;
                        if (rmxArtistArray.length == 0) {
                            artistArray = [origArtistArray, vocalistArray];
                            artistArray = artistArray.flat(1);
                        }
                        
                        if (starred == false) {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        }

                        // Check if we have art for the edited song info in the database
                        if (songArt == undefined || songArt == false) {
                            // If we don't have art for the edited song info, search it on the spotify API.
                            songArt = await grab_spotify_art(artistArray, songName);
                            if (songArt == false) songArt = interaction.user.avatarURL({ format: "png", dynamic: false });
                        } else {
                            if (db.reviewDB.has(artistArray[0])) songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
                            if (songArt == undefined || songArt == false) songArt = interaction.user.avatarURL({ format: "png", dynamic: false });
                        }
                        reviewEmbed.setThumbnail(songArt);

                        await i.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete();
                    });
                    
                    a_collector.on('end', async () => {
                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'song': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the song name (NO FT. OR REMIXERS SHOULD BE INCLUDED)', components: [] });

                    const s_filter = m => m.author.id == interaction.user.id;
                    s_collector = int_channel.createMessageCollector({ filter: s_filter, max: 1, time: 60000 });
                    await s_collector.on('collect', async m => {
                        songName = m.content;
                        songArt = false;
                        displaySongName = (`${songName}` + 
                        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
                        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

                        if (starred == false) {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        } else {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        }

                        // Check if we have art for the edited song info in the database
                        if (songArt == undefined || songArt == false) {
                            // If we don't have art for the edited song info, search it on the spotify API.
                            songArt = await grab_spotify_art(artistArray, songName);
                            if (songArt == false) songArt = interaction.user.avatarURL({ format: "png", dynamic: false });
                        } else {
                            if (db.reviewDB.has(artistArray[0])) songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
                            if (songArt == undefined || songArt == false) songArt = interaction.user.avatarURL({ format: "png", dynamic: false });
                        }
                        reviewEmbed.setThumbnail(songArt);

                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete(); 
                    });
                    
                    s_collector.on('end', async () => {
                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'rating': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the rating (DO NOT WRITE /10!)', components: [] });

                    const ra_filter = m => m.author.id == interaction.user.id;
                    ra_collector = int_channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                    ra_collector.on('collect', async m => {
                        rating = parseFloat(m.content);
                        if (m.content.includes('/10')) rating = parseFloat(m.content.replace('/10', ''));
                        if (isNaN(rating)) {
                            i.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!'); return;
                        }
                        reviewEmbed.fields[0] = { name : 'Rating', value : `**${rating}/10**` };
                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete();
                    });
                    
                    ra_collector.on('end', async () => {
                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'review': {
                    await i.deferUpdate();
                    await i.editReply({ content: 'Type in the new review.', components: [] });

                    const re_filter = m => m.author.id == interaction.user.id;
                    re_collector = int_channel.createMessageCollector({ filter: re_filter, max: 1, time: 120000 });
                    re_collector.on('collect', async m => {
                        review = m.content;

                        if (review.includes('\\n')) {
                            review = review.split('\\n').join('\n');
                        }

                        reviewEmbed.setDescription(review);
                        await i.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                        m.delete();
                    });
                    
                    re_collector.on('end', async () => {
                        await i.editReply({ content: ' ', embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                    });
                } break;
                case 'star': {
                    await i.deferUpdate();

                    // If we don't have a 10 rating, the button does nothing.
                    if (rating < 8) return await i.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });

                    if (starred == false) {
                        reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                        starred = true;
                    } else {
                        reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                        starred = false;
                    }

                    await i.editReply({ embeds: [reviewEmbed], components: [editButtons, reviewButtons] });
                } break;
                case 'delete': {
                    await i.deferUpdate();

                    try {
                        await interaction.deleteReply();
                    } catch (err) {
                        console.log(err);
                    }

                    if (a_collector != undefined) a_collector.stop();
                    if (s_collector != undefined) s_collector.stop();
                    if (ra_collector != undefined) ra_collector.stop();
                    if (re_collector != undefined) re_collector.stop();
                    if (collector != undefined) collector.stop(); // Collector for all buttons
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
                    let channelsearch = await find_review_channel(interaction, interaction.user.id, msgtoEdit);

                    let msgEmbed;
                    let mainArtists;
                    let ep_name;
                    let collab;
                    let field_name;
                    let type = db.user_stats.get(interaction.user.id, 'current_ep_review')[3]; // Type A is when embed length is under 2000 characters, type B is when its over 2000
                    let ep_songs;
                    let ep_last_song_button = new Discord.MessageActionRow()
                    .addComponents( 
                        new Discord.MessageButton()
                        .setCustomId('finish_ep_review')
                        .setLabel('Finalize the EP/LP Review')
                        .setStyle('SUCCESS'),
                    );

                    // Review the song
                    await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, ep_name, tag);

                    // Edit the EP embed
                    await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {

                        msgEmbed = msg.embeds[0];
                        mainArtists = [msgEmbed.title.replace('🌟 ', '').trim().split(' - ')[0].split(' & ')];
                        mainArtists = mainArtists.flat(1);
                        ep_name = db.user_stats.get(interaction.user.id, 'current_ep_review')[2];
                        ep_songs = db.reviewDB.get(mainArtists[0], `["${ep_name}"].songs`);

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                        }

                        if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && songArt == false) {
                            songArt = msgEmbed.thumbnail.url;
                        }

                        collab = origArtistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                        if (starred == true) {
                            field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''}${rating !== false ? ` (${rating}/10)` : ``} 🌟`;
                        } else {
                            field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''}${rating !== false ? ` (${rating}/10)` : ``}`;
                        }

                        // If the entire EP/LP review is over 3250 characters, set EP/LP review type to "B" (aka hide any more reviews from that point)
                        if (msgEmbed.length > 3250 && type == 'A') {
                            db.user_stats.set(interaction.user.id, 'B', 'current_ep_review[3]');
                            type = 'B';
                        }

                        // Check what review type we are and add in reviews to the EP/LP review message accordingly
                        if (type == 'A') {
                            if (review.length <= 1000) {
                                msgEmbed.fields.push({
                                    name: field_name,
                                    value: `${review}`,
                                    inline: false,
                                });
                            } else {
                                msgEmbed.fields.push({
                                    name: field_name,
                                    value: (review != false) ? `*Review hidden to save space*` : `*No review written*`,
                                    inline: false,
                                });
                            }
                        } else {
                            msgEmbed.fields.push({
                                name: field_name,
                                value: (review != false) ? `*Review hidden to save space*` : `*No review written*`,
                                inline: false,
                            });
                        }

                        if (ep_songs[ep_songs.length - 1] == songName) {
                            msg.edit({ embeds: [msgEmbed], components: [ep_last_song_button] });

                            const ep_final_filter = int => int.user.id == interaction.user.id;
                            let ep_final_collector = int_channel.createMessageComponentCollector({ filter: ep_final_filter, max: 1, time: 60000 });

                            ep_final_collector.on('collect', async () => {
                                db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                                msg.edit({ components: [] });
                            });

                            ep_final_collector.on('end', async () => {
                                msg.edit({ components: [] });
                            });

                        } else {
                            msg.edit({ embeds: [msgEmbed], components: [] });
                        }

                        // Star reaction stuff for hall of fame
                        if (rating >= 8 && starred == true) {
                            for (let x = 0; x < artistArray.length; x++) {
                                db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                            }

                            db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                            hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                        }
                    }).catch((err) => {
                        handle_error(interaction, err);
                    });

                    // Update user stats
                    db.user_stats.set(interaction.user.id, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'recent_review');

                    for (let ii = 0; ii < mainArtists.length; ii++) {
                        // Update EP details
                        if (!ep_songs.includes(ep_name)) {
                            await db.reviewDB.push(mainArtists[ii], songName, `["${ep_name}"].songs`);
                        }
                    }

                    // Set msg_id for this review to false, since its part of the EP review message
                    for (let ii = 0; ii < artistArray.length; ii++) {
                        db.reviewDB.set(artistArray[ii], false, `["${songName}"].["${interaction.user.id}"].msg_id`);
                    }

                } break;
                case 'done': { // Send the review to the database
                    await i.update({ content: ' ', embeds: [reviewEmbed], components: [] });

                    // Review the song
                    review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, false, tag);

                    // Update user stats
                    db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${displaySongName}`, 'recent_review');
                    
                    const msg = await interaction.fetchReply();

                    // Setup tags if necessary
                    if (tag != null) {
                        if (db.tags.has(tag)) {
                            db.tags.push(tag, displaySongName, 'song_list');
                        } else {
                            db.tags.set(tag, [displaySongName], 'song_list');
                            db.tags.set(tag, false, 'image');
                        }
                    }

                    // Setting the message id and url for the message we just sent
                    for (let ii = 0; ii < artistArray.length; ii++) {
                        db.reviewDB.set(artistArray[ii], msg.id, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                        db.reviewDB.set(artistArray[ii], msg.url, `["${songName}"].["${interaction.user.id}"].url`); 
                    }

                    // Star reaction stuff for hall of fame
                    if (rating >= 8 && starred == true) {
                        for (let x = 0; x < artistArray.length; x++) {
                            db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                        }

                        db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray.join(' & ')})` : '' }`, 'star_list');
                        hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                    }

                    // Fix artwork on all reviews for this song
                    if (songArt != false && db.reviewDB.has(artistArray[0])) {
                        update_art(interaction, artistArray[0], songName, songArt);
                    }
                
                    // End the collector
                    collector.stop();
                } break;
            }
        });

        collector.on('end', async () => {
            if (a_collector != undefined) a_collector.stop();
            if (s_collector != undefined) s_collector.stop();
            if (ra_collector != undefined) ra_collector.stop();
            if (re_collector != undefined) re_collector.stop();
        });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};
