const Discord = require('discord.js');
const db = require("../db.js");
const { update_art, review_song, hall_of_fame_check, handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const wait = require('util').promisify(setTimeout);
const Spotify = require('node-spotify-api');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('review')
        .setDescription('Review a song using Waveform.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s). (DO NOT PUT ANY REMIXERS OR VOCALISTS HERE, ONLY PRODUCTION ARTISTS)')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('song')
                .setDescription('The name of the song. (Do not include any features or remixers in here!)')
                .setAutocomplete(true)
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
            option.setName('vocalist')
                .setDescription('Vocalists who feature on the song (use & to separate multiple)')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Put remixers here, if you reviewing a remix of the original song. (NOT IN ARTISTS ARGUMENT)')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art of the song (put spotify or s here if you want to use your spotify status.)')
                .setRequired(false))

        .addUserOption(option => 
            option.setName('user_who_sent')
                .setDescription('User who sent you this song in Mailbox. Ignore if not a mailbox review.')
                .setRequired(false)),
        
	admin: false,
	async execute(interaction, sp_artist, sp_song, sp_rating, sp_review, sp_art, sp_vocalists, sp_remixers, sp_user_who_sent, sp_star) {

        try {

        // This variable is here so that we can start a review from anywhere else (for Spotify Link Review)
        let int_channel = interaction.channel;
        let mailboxes = db.server_settings.get(interaction.guild.id, 'mailboxes');

        // If we do a Spotify Link Review, we have to change the channel focus to #reviews.
        if (sp_song != undefined) {
            int_channel = await interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
        }

        // Check if we are reviewing in the right chat, if not, boot out
        if (`<#${int_channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel') && !mailboxes.includes(int_channel.name)) {
            if (sp_song == undefined || sp_song == null) {
                return interaction.editReply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')} or mailboxes!`);
            }
        }

        // Init variables
        let origArtistArray = interaction.options.getString('artist').split(' & ');
        let origSongName = interaction.options.getString('song'); // for remixes later on
        let songName = interaction.options.getString('song');
        let rating = interaction.options.getString('rating');
        if (rating.includes('/10')) rating = rating.replace('/10', '');
        rating = parseFloat(rating);
        let review = interaction.options.getString('review');
        let songArt = interaction.options.getString('art');
        let vocalistArray = interaction.options.getString('vocalist');
        let rmxArtistArray = interaction.options.getString('remixers');
        let user_who_sent = interaction.options.getUser('user_who_sent');
        let ranking_pos = null;
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

        if (vocalistArray == null) {
            vocalistArray = [];
        } else {
            vocalistArray = vocalistArray.split(' & ');
        }

        if (rmxArtistArray == null) {
            rmxArtistArray = [];
        } else {
            rmxArtistArray = rmxArtistArray.split(' & ');
        }

        if (songName.includes('- VIP') || songName.includes('(VIP)')) {
            if (songName.includes('- VIP')) {
                origSongName = origSongName.replace('- VIP', 'VIP');
                songName = songName.replace('- VIP', 'VIP');
            } else {
                songName = songName.replace('(VIP)', 'VIP');
                origSongName = origSongName.replace('(VIP)', 'VIP');
            }
        }

        // Init variables for spotify link review
        if (sp_song != undefined && sp_song != null) {
            origArtistArray = sp_artist.split(' & ');
            songName = sp_song;
            rating = parseFloat(sp_rating);
            review = sp_review;
            songArt = sp_art;
            vocalistArray = sp_vocalists.split(' & ');
            rmxArtistArray = sp_remixers.split(' & ');
            user_who_sent = sp_user_who_sent;
            ranking_pos = false;
            starred = sp_star;
        }

        let artistArray = [origArtistArray, vocalistArray];
        artistArray = artistArray.flat(1);

        if (rmxArtistArray.length != 0) {
            artistArray = rmxArtistArray;
        }

        if (user_who_sent != null) {
            taggedUser = user_who_sent;
            taggedMember = await interaction.guild.members.fetch(taggedUser.id);
        }

        if (ranking_pos == null) {
            ranking_pos = false;
        } else {
            ranking_pos = parseInt(ranking_pos);
        }

        // [] check, as the system requires [] to grab the remix artist with string slicing.
        if (songName.includes('Remix)')) {
            await interaction.editReply('Please use the Remixers argument for Remixers, do not include them in the song name!`');
            await wait(10000);
            try {
                await interaction.deleteReply();
                return;
            } catch (err) {
                console.log(err);
            }
        } else if (songName.includes('ft.') || songName.includes('feat.')) {
            await interaction.editReply('Please use the Vocalists argument for Vocalists, do not include them in the song name!`');
            await wait(10000);
            try {
                await interaction.deleteReply();
                return;
            } catch (err) {
                console.log(err);
            }
        }

        // Handle remixes
        if (rmxArtistArray.length != 0) {
            songName = `${songName} (${rmxArtistArray.join(' & ')} Remix)`;
        }

        // Auto merge EP review related variables (see automerge.js for more info)
        let collector_time = 100000000;

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

        // Setup bottom row
        const row2 = new Discord.MessageActionRow();

        // If we're in an EP/LP review, stick in a button to push to EP review.
        if (db.user_stats.get(interaction.user.id, 'current_ep_review') != false && origArtistArray.includes(db.user_stats.get(interaction.user.id, 'current_ep_review')[1][0])) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review').length != 0) {
                row2.addComponents( 
                    new Discord.MessageButton()
                    .setCustomId('ep_done')
                    .setLabel('Push to EP Review')
                    .setStyle('SUCCESS'),
                );
            }
        } else {
            row2.addComponents( 
                new Discord.MessageButton()
                .setCustomId('done')
                .setLabel('Send to Database')
                .setStyle('SUCCESS'),
            );
        }

        // Add the delete button
        row2.addComponents(
            new Discord.MessageButton()
                .setCustomId('delete')
                .setLabel('Delete')
                .setStyle('DANGER'),
        );


        // Thumbnail image handling
        if (songArt == false || songArt == null || songArt == undefined) {
            if (db.reviewDB.has(artistArray[0])) {
                songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
            }
        }

        // Grab art from server spotify
        if (songArt == false || songArt == undefined || songArt == null) {
            const client_id = process.env.SPOTIFY_API_ID; // Your client id
            const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
            const song = `${origArtistArray[0]} ${songName}`;

            const spotify = new Spotify({
                id: client_id,
                secret: client_secret,
            });

            await spotify.search({ type: "track", query: song }).then(function(data) {  

                let results = data.tracks.items;
                let songData = data.tracks.items[0];
                for (let i = 0; i < results.length; i++) {
                    if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${song.toLowerCase()}`) {
                        songData = results[i];
                        break;
                    } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${song.toLowerCase()}`) {
                        songData = results[i];
                    }
                }

                if (results.length == 0) {
                    songArt = false;
                } else {
                    songArt = songData.album.images[0].url;
                }
            });
        }
        
        // Discord Profile Spotify check (checks for both "spotify" and "s" as the image link)
        if (songArt != false && songArt != undefined) {
            if (songArt.toLowerCase().includes('spotify') || songArt.toLowerCase() == 's') {
                interaction.member.presence.activities.forEach((activity) => {
                    if (activity.type == 'LISTENING' && activity.name == 'Spotify' && activity.assets !== null) {
                        songArt = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
                if (songArt.toLowerCase().includes('spotify') || songArt.toLowerCase() == 's') songArt = false; // final passthrough check
            }
        }

        if (isNaN(rating)) {
            await interaction.editReply('Your rating is not a number! Make sure NOT to include /10, just do the number, like "8".');
            await wait(10000);
            try {
                await interaction.deleteReply();
                return;
            } catch (err) {
                console.log(err);
            }
        }

        // \n parse handling
        if (review.includes('\\n')) {
            review = review.split('\\n').join('\n');
        }

        // Create display song name variable
        let displaySongName = (`${origSongName}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
        `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

        // Start creation of embed
        let reviewEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s review`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` });

        // Using - for the review changes how the embed is created.
        if (review != '-') {
            reviewEmbed.setDescription(review);
            reviewEmbed.addField('Rating: ', `**${rating}/10**`, true);
        } else {
            reviewEmbed.setDescription(`Rating: **${rating}/10**`);
        }
        
        if (songArt == false) {
            reviewEmbed.setThumbnail(interaction.user.avatarURL({ format: "png", dynamic: false }));
        } else {
            reviewEmbed.setThumbnail(songArt);
        }
        

        if (taggedUser != false && taggedUser != undefined) {
            reviewEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        //Add review to database
        //Quick thumbnail image check to assure we aren't putting in an avatar, songArt should be set to what we put in the database.
        if (songArt == undefined || songArt == false || songArt.includes('avatar') || songArt == 'spotify' || songArt == 's') { 
            songArt = false;
        }

        // Send the embed rate message (normal command review)
        if (sp_song == undefined || sp_song == null) {
            // Send the review embed
            interaction.editReply({ embeds: [reviewEmbed], components: [row, row2] });

            const filter = i => i.user.id == interaction.user.id;
            const collector = int_channel.createMessageComponentCollector({ filter, time: collector_time });
            let a_collector;
            let s_collector;
            let ra_collector;
            let re_collector;

            collector.on('collect', async i => {
                switch (i.customId) {
                    // Artist edit button
                    case 'artist': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the Artist Name(s) (separated with &, DO NOT PUT REMIXERS OR FEATURE VOCALISTS HERE!)', components: [] });
                        const a_filter = m => m.author.id == interaction.user.id;
                        a_collector = int_channel.createMessageCollector({ filter: a_filter, max: 1, time: 60000 });
                        a_collector.on('collect', async m => {
                            origArtistArray = m.content.split(' & ');
                            if (rmxArtistArray.length != 0) {
                                artistArray = [origArtistArray, vocalistArray];
                                artistArray = artistArray.flat(1);
                            }
                            
                            if (starred == false) {
                                reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                            } else {
                                reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (songArt == false || songArt == null) {
                                if (db.reviewDB.has(m.content.split(' & ')[0])) {
                                    songArt = db.reviewDB.get(m.content.split(' & ')[0], `["${songName}"].art`);
                                    reviewEmbed.setThumbnail(songArt);
                                }
                                if (songArt == undefined) { // If the above line of code returns undefined, use continue with false
                                    songArt = false;
                                }
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
                        await i.editReply({ content: 'Type in the Song Name (NO FT. OR REMIXERS SHOULD BE INCLUDED)', components: [] });

                        const s_filter = m => m.author.id == interaction.user.id;
                        s_collector = int_channel.createMessageCollector({ filter: s_filter, max: 1, time: 60000 });
                        s_collector.on('collect', async m => {
                            songName = m.content;
                            displaySongName = (`${songName}` + 
                            `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}` +
                            `${(rmxArtistArray.length != 0) ? ` (${rmxArtistArray.join(' & ')} Remix)` : ``}`);

                            if (starred == false) {
                                reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                            } else {
                                reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (songArt == false || songArt == null) {
                                if (db.reviewDB.has(artistArray[0])) {
                                    songArt = db.reviewDB.get(artistArray[0], `["${songName}"].art`);
                                    reviewEmbed.setThumbnail(songArt);
                                }
                                if (songArt == undefined) { // If the above line of code returns undefined, use continue with false
                                    songArt = false;
                                }
                            }

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

                        const ra_filter = m => m.author.id == interaction.user.id;
                        ra_collector = int_channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
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

                        const re_filter = m => m.author.id == interaction.user.id;
                        re_collector = int_channel.createMessageCollector({ filter: re_filter, max: 1, time: 120000 });
                        re_collector.on('collect', async m => {
                            review = m.content;

                            if (review.includes('\\n')) {
                                review = review.split('\\n').join('\n');
                            }

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
                        if (rating < 8) return await i.editReply({ embeds: [reviewEmbed], components: [row, row2] });

                        if (starred == false) {
                            reviewEmbed.setTitle(`🌟 ${origArtistArray.join(' & ')} - ${displaySongName} 🌟`);
                            starred = true;
                        } else {
                            reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                            starred = false;
                        }

                        await i.editReply({ embeds: [reviewEmbed], components: [row, row2] });
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
                        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));

                        let msgEmbed;
                        let mainArtists;
                        let ep_name;
                        let collab;
                        let field_name;
                        let type = db.user_stats.get(interaction.user.id, 'current_ep_review')[3]; // Type A is when embed length is under 2000 characters, type B is when its over 2000

                        // Review the song
                        await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, ep_name);

                        // Edit the EP embed
                        await channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {

                            msgEmbed = msg.embeds[0];
                            mainArtists = [msgEmbed.title.split(' - ')[0].split(' & ')];
                            mainArtists = mainArtists.flat(1);
                            ep_name = db.user_stats.get(interaction.user.id, 'current_ep_review')[2];

                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                            }

                            if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && songArt == false) {
                                songArt = msgEmbed.thumbnail.url;
                            }

                            collab = origArtistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                            if (starred == true) {
                                field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10) 🌟`;
                            } else {
                                field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10)`;
                            }

                            if (msgEmbed.length > 3250 && type == 'A') {
                                db.user_stats.set(interaction.user.id, 'B', 'current_ep_review[3]');
                                type = 'B';
                            }

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
                                        value: `*Review hidden to save space*`,
                                        inline: false,
                                    });
                                }
                            } else {
                                msgEmbed.fields.push({
                                    name: field_name,
                                    value: `*Review hidden to save space*`,
                                    inline: false,
                                });
                            }

                            msg.edit({ embeds: [msgEmbed], components: [] });

                            // Star reaction stuff for hall of fame
                            if (rating >= 8 && starred == true) {
                                for (let x = 0; x < artistArray.length; x++) {
                                    db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                                }

                                db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                                hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                            }
                        }).catch(() => {
                            channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(interaction.user.id, 'mailbox'));
                            channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {

                                msgEmbed = msg.embeds[0];
                                mainArtists = [msgEmbed.title.split(' - ')[0].split(' & ')];
                                mainArtists = mainArtists.flat(1);
                                ep_name = db.user_stats.get(interaction.user.id, 'current_ep_review')[2];

                                for (let j = 0; j < artistArray.length; j++) {
                                    db.reviewDB.set(artistArray[j], ep_name, `["${songName}"].ep`);
                                }

                                if (msgEmbed.thumbnail != undefined && msgEmbed.thumbnail != null && msgEmbed.thumbnail != false && songArt == false) {
                                    songArt = msgEmbed.thumbnail.url;
                                }

                                collab = artistArray.filter(x => !mainArtists.includes(x)); // Filter out the specific artist in question
                                if (starred == true) {
                                    field_name = `🌟 ${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10) 🌟`;
                                } else {
                                    field_name = `${displaySongName}${collab.length != 0 ? ` (with ${collab.join(' & ')})` : ''} (${rating}/10)`;
                                }
                                
                                if (msgEmbed.length > 3250 && type == 'A') {
                                    db.user_stats.set(interaction.user.id, 'B', 'current_ep_review[3]');
                                    type = 'B';
                                }
    
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
                                            value: `*Review hidden to save space*`,
                                            inline: false,
                                        });
                                    }
                                } else {
                                    msgEmbed.fields.push({
                                        name: field_name,
                                        value: `*Review hidden to save space*`,
                                        inline: false,
                                    });
                                }

                                msg.edit({ embeds: [msgEmbed], components: [] });

                                // Star reaction stuff for hall of fame
                                if (rating >= 8 && starred == true) {
                                    for (let x = 0; x < artistArray.length; x++) {
                                        db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                                    }

                                    db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                                    hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                                }
                            });
                        }).catch((err) => {
                            handle_error(interaction, err);
                        });

                        // Update user stats
                        db.user_stats.set(interaction.user.id, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'recent_review');

                        for (let ii = 0; ii < mainArtists.length; ii++) {
                            // Update EP details
                            db.reviewDB.push(mainArtists[ii], songName, `["${ep_name}"].songs`);
                            if (ranking_pos != false) {
                                db.reviewDB.push(mainArtists[ii], [ranking_pos, `${ranking_pos}. ${songName} (${rating}/10)`], `["${ep_name}"].["${interaction.user.id}"].ranking`);
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
                        review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, false);

                        // Update user stats
                        db.user_stats.set(interaction.user.id, `${artistArray.join(' & ')} - ${displaySongName}`, 'recent_review');
                        
                        const msg = await interaction.fetchReply();

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

        } else { // Reviewing with the Spotify Link Review Context Menu

            // Review the song
            await review_song(interaction, artistArray, origArtistArray, songName, origSongName, review, rating, rmxArtistArray, vocalistArray, songArt, taggedUser.id, false);

            // Update user stats
            db.user_stats.set(interaction.user.id, `${origArtistArray.join(' & ')} - ${displaySongName}`, 'recent_review');

            await int_channel.send({ embeds: [reviewEmbed] }).then(msg => {
                // Setting the message id and url for the message we just sent (and check for mailbox, if so put as FALSE so we don't have to look for a non-existant message)
                for (let ii = 0; ii < artistArray.length; ii++) {
                    db.reviewDB.set(artistArray[ii], msg.id, `["${songName}"].["${interaction.user.id}"].msg_id`); 
                    db.reviewDB.set(artistArray[ii], msg.url, `["${songName}"].["${interaction.user.id}"].url`); 
                }

                // Star reaction stuff for hall of fame
                if (sp_star == true) {
                    for (let x = 0; x < artistArray.length; x++) {
                        db.reviewDB.set(artistArray[x], true, `["${songName}"].["${interaction.user.id}"].starred`);
                    }
                    
                    db.user_stats.push(interaction.user.id, `${origArtistArray.join(' & ')} - ${songName}${vocalistArray.length != 0 ? ` (ft. ${vocalistArray})` : '' }`, 'star_list');
                    hall_of_fame_check(interaction, artistArray, origArtistArray, songName, displaySongName, songArt);
                }
            }).catch((err) => {
                handle_error(interaction, err);
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};
