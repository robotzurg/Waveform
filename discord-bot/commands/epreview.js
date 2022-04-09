const Discord = require('discord.js');
const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error } = require('../func.js');
const Spotify = require('node-spotify-api');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epreview')
        .setDescription('Review an EP or LP in Waveform.')
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the MAIN EP/LP artist(s). (separate with &, Do not put any one-off collaborators here.)')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP/LP. (INCLUDE EP OR LP IN THE TITLE!)')
                .setAutocomplete(true)
                .setRequired(true))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art for the EP/LP. (type "s" or "spotify" for status art.)')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_rating')
                .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can be added later.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_review')
                .setDescription('Overall Review of the EP/LP. Can be added later.')
                .setRequired(false))
    
        .addUserOption(option => 
            option.setName('user_who_sent')
                .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {
        try {

            let origArtistArray = interaction.options.getString('artist').split(' & ');
            let artistArray = origArtistArray.slice(0);
            let ep_name = interaction.options.getString('ep_name');
            let art = interaction.options.getString('art');
            let overall_rating = interaction.options.getString('overall_rating');
            let overall_review = interaction.options.getString('overall_review');
            let user_sent_by = interaction.options.getUser('user_who_sent');
            let taggedMember = false;
            let taggedUser = false;
            let starred = false;
            let row2;

            if (user_sent_by == null) {
                user_sent_by = false;
            }

            if (art == null) {
                art = false;
            }

            if (overall_rating == null) {
                overall_rating = false;
            } else {
                overall_rating = parseFloat(overall_rating);
            }

            if (overall_review == null) {
                overall_review = false;
            }

            if (overall_review != false) {
                if (overall_review.includes('\\n')) {
                    overall_review = overall_review.split('\\n').join('\n');
                }
            }

            // Place EP by default if EP or LP is not included in the title.
            if (!ep_name.includes(' EP') && !ep_name.includes(' LP')) {
                ep_name = `${ep_name} EP`;
            }

            if (user_sent_by.id != null && user_sent_by.id != undefined && user_sent_by.id != false) {
                taggedMember = await interaction.guild.members.fetch(user_sent_by.id);
                taggedUser = user_sent_by;
            } else {
                taggedUser = { id: false };
            }

            // Spotify check (checks for both "spotify" and "s" as the image link)
            if (art != false && art != undefined) {
                if (art.toLowerCase().includes('spotify') || art.toLowerCase() === 's') {
                    interaction.member.presence.activities.forEach((activity) => {
                        if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                            art = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                        }
                    });
                }
            }

            // Grab art from server spotify
            if (art == false || art == undefined || art == null) {
                const client_id = process.env.SPOTIFY_API_ID; // Your client id
                const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
                let search = ep_name.replace(' EP', '');
                search = search.replace(' LP', '');
                const song = `${origArtistArray[0]} ${search}`;

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
                        art = false;
                    } else {
                        art = songData.album.images[0].url;
                    }
                });
            }

            // Setup buttons
            const row = new Discord.MessageActionRow()
            .addComponents(
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
            if (overall_rating == false && overall_review == false) {
                row2 = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setCustomId('begin')
                        .setLabel('Begin EP/LP Review')
                        .setStyle('SUCCESS'),
                    new Discord.MessageButton()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle('DANGER'),
                );
            } else {
                row2 = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageButton()
                        .setCustomId('begin')
                        .setLabel('Begin EP/LP Review')
                        .setStyle('SUCCESS'),
                    new Discord.MessageButton()
                        .setCustomId('done')
                        .setLabel('Send to Database')
                        .setStyle('SUCCESS'),
                    new Discord.MessageButton()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle('DANGER'),
                );
            }

            // Make sure we DON'T get any slip ups, where the bot lets spotify run through (if it can't find a status)
            if (art != undefined && art != false) {
                if (art.toLowerCase() === 's') art = false;
            }

            // Add in the EP object/review
            for (let i = 0; i < artistArray.length; i++) {

                let epObject = {
                    [ep_name]: {
                        [interaction.user.id]: {
                            url: false,
                            msg_id: false,
                            starred: false,
                            name: interaction.member.displayName,
                            rating: overall_rating,
                            review: overall_review,
                            sentby: taggedUser.id,
                            no_songs: false,
                            ranking: [],
                        },
                        art: art,
                        collab: artistArray.filter(word => artistArray[i] != word),
                        songs: [],
                        tags: [],
                    },
                }; 

                let reviewObject = {
                    url: false,
                    msg_id: false,
                    starred: false,
                    name: interaction.member.displayName,
                    rating: overall_rating,
                    review: overall_review,
                    sentby: taggedUser.id,
                    no_songs: false,
                    ranking: [],
                };

                if (!db.reviewDB.has(artistArray[i])) {

                    db.reviewDB.set(artistArray[i], epObject);

                } else if (db.reviewDB.get(artistArray[i], `["${ep_name}"]`) === undefined) {

                    let db_artist_obj = db.reviewDB.get(artistArray[i]);
                    Object.assign(db_artist_obj, epObject);
                    db.reviewDB.set(artistArray[i], db_artist_obj);

                } else {

                    const db_song_obj = db.reviewDB.get(artistArray[i], `["${ep_name}"]`);

                    let new_user_obj = {
                        [`${interaction.user.id}`]: reviewObject,
                    };

                    Object.assign(db_song_obj, new_user_obj);
                    db.reviewDB.set(artistArray[i], db_song_obj, `["${ep_name}"]`);
                    if (art != undefined && art != false && art != null && !art.includes('avatar')) {
                        db.reviewDB.set(artistArray[i], art, `["${ep_name}"].art`);
                    }

                }

            }

            if (db.reviewDB.has(artistArray[0]) && art == false) {
                art = db.reviewDB.get(artistArray[0], `["${ep_name}"].art`);
                if (art === undefined || art === false) {
                    art = interaction.user.avatarURL({ format: "png", dynamic: false });
                }
            } else if (art === false || art === undefined) {
                // Otherwise set our review art to the users avatar.
                art = interaction.user.avatarURL({ format: "png", dynamic: false });
            }

            // Set up the embed
            const epEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${artistArray.join(' & ')} - ${ep_name}`)
            .setAuthor({ name: `${ep_name.includes('LP') ? `${interaction.member.displayName}'s LP review` : `${interaction.member.displayName}'s EP review`}`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` });

            epEmbed.setThumbnail(art);

            if (overall_rating != false && overall_review != false) {
                epEmbed.setDescription(`*${overall_review}*`);
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
            } else if (overall_rating != false) {
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
            } else if (overall_review != false) {
                epEmbed.setDescription(`*${overall_review}*`);
            }

            if (taggedUser.id != false) {
                epEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }

            interaction.editReply({ embeds: [epEmbed], components: [row, row2] });

            // Grab message id to put in user_stats and the ep object
            const msg = await interaction.fetchReply();

            db.user_stats.set(interaction.user.id, [msg.id, artistArray, ep_name, 'A'], 'current_ep_review');            

            // Set message ids
            for (let i = 0; i < artistArray.length; i++) {
                db.reviewDB.set(artistArray[i], msg.id, `["${ep_name}"].["${interaction.user.id}"].msg_id`);
                db.reviewDB.set(artistArray[i], msg.url, `["${ep_name}"].["${interaction.user.id}"].url`);
            }

            const filter = i => i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000000 });
            let ra_collector;
            let re_collector;

            collector.on('collect', async i => {

                switch (i.customId) {
                    case 'rating': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the overall EP/LP rating (DO NOT ADD `/10`!)', components: [] });

                        const ra_filter = m => m.author.id === interaction.user.id;
                        ra_collector = interaction.channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                        ra_collector.on('collect', async m => {
                            overall_rating = parseFloat(m.content);
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], overall_rating, `["${ep_name}"].["${interaction.user.id}"].rating`);
                            }
                            
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        ra_collector.on('end', async collected => {
                            console.log(`Collected ${collected.size} items`);
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'review': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the new overall EP/LP review.', components: [] });

                        const re_filter = m => m.author.id === interaction.user.id;
                        re_collector = interaction.channel.createMessageCollector({ filter: re_filter, max: 1, time: 120000 });
                        re_collector.on('collect', async m => {
                            overall_review = m.content;

                            if (overall_review.includes('\\n')) {
                                overall_review = overall_review.split('\\n').join('\n');
                            }

                            epEmbed.setDescription(`*${overall_review}*`);
                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], overall_review, `["${ep_name}"].["${interaction.user.id}"].review`);
                            }

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        re_collector.on('end', async collected => {
                            console.log(`Collected ${collected.size} items`);
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'star': {
                        await i.deferUpdate();

                        // If we don't have a 10 rating, the button does nothing.
                        if (overall_rating < 8) return await i.editReply({ embeds: [epEmbed], components: [row, row2] });

                        if (starred === false) {
                            if (overall_rating != false) {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10) 🌟`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${ep_name} 🌟`);
                            }
                            starred = true;
                        } else {
                            if (overall_rating != false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
                            } else {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name}`);
                            }
                            starred = false;
                        }

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], starred, `["${ep_name}"].["${interaction.user.id}"].starred`);
                        }
                        await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                    } break;
                    case 'delete': {
                        await i.deferUpdate();

                        try {
                            for (let j = 0; j < artistArray.length; j++) {
                                let songObj = db.reviewDB.get(artistArray[j], `["${ep_name}"]`);
                                delete songObj[interaction.user.id];
                                db.reviewDB.set(artistArray[j], songObj, `["${ep_name}"]`);

                                if (Object.keys(db.reviewDB.get(artistArray[j], `["${ep_name}"]`)).length <= 3) {
                                    let artistObj = db.reviewDB.get(artistArray[j]);
                                    delete artistObj[ep_name];
                                    db.reviewDB.set(artistArray[j], artistObj);
                                }

                                if (Object.keys(db.reviewDB.get(artistArray[j])).length == 0) {
                                    db.reviewDB.delete(artistArray[j]);
                                }
                            }

                            await interaction.deleteReply();
                        } catch (err) {
                            console.log(err);
                        }

                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                        db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                    } break;
                    case 'done': {
                        await i.deferUpdate(); 

                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], true, `["${ep_name}"].["${interaction.user.id}"].no_songs`);
                        }

                        if (overall_review != false) epEmbed.setDescription(`${overall_review}`);
                        if (overall_rating != false) epEmbed.addField(`Rating`, `**${overall_rating}/10**`);
                        if (starred == false) {
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name}`);
                        } else {
                            epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${ep_name} 🌟`);
                        }
        
                        i.editReply({ embeds: [epEmbed], components: [] });
                    } break;
                    case 'begin': {
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        i.update({ embeds: [epEmbed], components: [] });
                    } break;
                }
            });

            collector.on('end', async () => {
                if (ra_collector != undefined) ra_collector.stop();
                if (re_collector != undefined) re_collector.stop();
            });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};
