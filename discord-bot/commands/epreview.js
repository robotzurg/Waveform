const Discord = require('discord.js');
const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error, review_ep } = require('../func.js');
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
            option.setName('overall_rating')
                .setDescription('Overall Rating of the EP/LP. Out of 10, decimals allowed. Can be added later.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('overall_review')
                .setDescription('Overall Review of the EP/LP. Can be added later.')
                .setRequired(false))

        .addStringOption(option => 
            option.setName('tag')
                .setDescription('Put a tag you want to set the song to here!')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('art')
                .setDescription('Art for the EP/LP. (type "s" for status art, or leave blank for automatic spotify searching.)')
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
            if (overall_rating != null) {
                if (overall_rating.includes('/10')) overall_rating = overall_rating.replace('/10', '');
            }
            let overall_review = interaction.options.getString('overall_review');
            let user_sent_by = interaction.options.getUser('user_who_sent');
            let tag = interaction.options.getString('tag');
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
                if (isNaN(overall_rating)) return interaction.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating!');
            }

            if (overall_review == null) {
                overall_review = false;
            }

            if (overall_review != false) {
                if (overall_review.includes('\\n')) {
                    overall_review = overall_review.split('\\n').join('\n');
                }
            }

            // Check to make sure "EP" or "LP" is in the ep/lp name
            if (!ep_name.includes(' EP') && !ep_name.includes(' LP')) {
                return interaction.editReply(`You did not add EP or LP (aka album) to the name of the thing you are reviewing, make sure to do that!\n` + 
                `For example: \`${ep_name} EP\` or \`${ep_name} LP\``);
            }

            if (user_sent_by.id != null && user_sent_by.id != undefined && user_sent_by.id != false) {
                taggedMember = await interaction.guild.members.fetch(user_sent_by.id);
                taggedUser = user_sent_by;
            } else {
                taggedUser = { id: false };
            }

            // Spotify check (checks for both "spotify" and "s" as the image link)
            if (art != false && art != undefined) {
                if (art.toLowerCase().includes('spotify') || art.toLowerCase() == 's') {
                    interaction.member.presence.activities.forEach((activity) => {
                        if (activity.type == 'LISTENING' && activity.name == 'Spotify' && activity.assets !== null) {
                            art = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                        }
                    });
                }
            }

            // Checking if an image already exists
            if (art == false || art == null || art == undefined) {
                if (db.reviewDB.has(artistArray[0])) {
                    art = db.reviewDB.get(artistArray[0], `["${ep_name}"].art`);
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
                    .setCustomId('artist')
                    .setLabel('Artist')
                    .setStyle('PRIMARY')
                    .setEmoji('📝'),
                new Discord.MessageButton()
                    .setCustomId('ep')
                    .setLabel('Name')
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

            // Final passthrough check
            if (art != false && art != undefined) {
                if (art.toLowerCase() == 's') art = false; // final passthrough check
            }

            // Set up the embed
            const epEmbed = new Discord.MessageEmbed()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${artistArray.join(' & ')} - ${ep_name}`)
            .setAuthor({ name: `${ep_name.includes('LP') ? `${interaction.member.displayName}'s LP review` : `${interaction.member.displayName}'s EP review`}`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` });

            if (art == false) {
                epEmbed.setThumbnail(interaction.user.avatarURL({ format: "png", dynamic: false }));
            } else {
                epEmbed.setThumbnail(art);
            }

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

            const filter = i => i.user.id == interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 10000000 });
            let ra_collector;
            let re_collector;
            let a_collector;
            let name_collector;

            collector.on('collect', async i => {

                switch (i.customId) {
                    case 'artist': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the artist name(s) (separated with &)', components: [] });
                        const a_filter = m => m.author.id == interaction.user.id;
                        a_collector = interaction.channel.createMessageCollector({ filter: a_filter, max: 1, time: 60000 });
                        a_collector.on('collect', async m => {
                            artistArray = m.content.split(' & ');
                            
                            if (starred == false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${ep_name} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == false || art == null) {
                                if (db.reviewDB.has(m.content.split(' & ')[0])) {
                                    art = db.reviewDB.get(m.content.split(' & ')[0], `["${ep_name}"].art`);
                                    epEmbed.setThumbnail(art);
                                }
                                if (art == undefined) { // If the above line of code returns undefined, use continue with false
                                    art = false;
                                }
                            }

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, [msg.id, artistArray, ep_name, 'A'], 'current_ep_review');      
                            m.delete();
                        });
                        
                        a_collector.on('end', async () => {
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'ep': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the new EP/LP name!', components: [] });

                        const name_filter = m => m.author.id == interaction.user.id && (m.content.includes(' EP') || m.content.includes(' LP'));
                        name_collector = interaction.channel.createMessageCollector({ filter: name_filter, max: 1, time: 60000 });
                        name_collector.on('collect', async m => {
                            ep_name = m.content;
                            if (starred == false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${ep_name} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == false || art == null) {
                                if (db.reviewDB.has(artistArray[0])) {
                                    art = db.reviewDB.get(artistArray[0], `["${ep_name}"].art`);
                                    epEmbed.setThumbnail(ep_name);
                                }
                                if (art == undefined) { // If the above line of code returns undefined, use continue with false
                                    art = false;
                                }
                            }

                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, [msg.id, artistArray, ep_name, 'A'], 'current_ep_review');      
                            m.delete();
                        });
                        
                        name_collector.on('end', async () => {
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'rating': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the overall EP/LP rating (DO NOT ADD `/10`!)', components: [] });

                        const ra_filter = m => m.author.id == interaction.user.id;
                        ra_collector = interaction.channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                        ra_collector.on('collect', async m => {
                            overall_rating = parseFloat(m.content);
                            if (overall_rating.includes('/10')) overall_rating = overall_rating.replace('/10', '');
                            if (isNaN(overall_rating)) i.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!');
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${ep_name} (${overall_rating}/10)`);
                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], overall_rating, `["${ep_name}"].["${interaction.user.id}"].rating`);
                            }

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
                            
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        ra_collector.on('end', async () => {
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'review': {
                        await i.deferUpdate();
                        await i.editReply({ content: 'Type in the new overall EP/LP review.', components: [] });

                        const re_filter = m => m.author.id == interaction.user.id;
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

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        re_collector.on('end', async () => {
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'star': {
                        await i.deferUpdate();

                        // If we don't have a 10 rating, the button does nothing.
                        if (overall_rating < 8) return await i.editReply({ embeds: [epEmbed], components: [row, row2] });

                        if (starred == false) {
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
                            await interaction.deleteReply();
                        } catch (err) {
                            console.log(err);
                        }

                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons
                        db.user_stats.set(interaction.user.id, false, 'current_ep_review');
                    } break;
                    case 'done': {
                        await i.deferUpdate(); 

                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        review_ep(interaction, artistArray, ep_name, overall_rating, overall_review, taggedUser, art);

                        // Set message ids
                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], msg.id, `["${ep_name}"].["${interaction.user.id}"].msg_id`);
                            db.reviewDB.set(artistArray[j], msg.url, `["${ep_name}"].["${interaction.user.id}"].url`);
                        }

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
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        review_ep(interaction, artistArray, ep_name, overall_rating, overall_review, taggedUser, art);

                        // Setup tags if necessary
                        if (tag != null) {
                            if (db.tags.has(tag)) {
                                console.log(db.tags.get(tag));
                                db.tags.push(tag, `${artistArray.join(' & ')} - ${ep_name}`);
                                console.log(db.tags.get(tag));
                            } else {
                                db.tags.set(tag, [`${artistArray.join(' & ')} - ${ep_name}`]);
                            }
                        }

                        // Set message ids
                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], msg.id, `["${ep_name}"].["${interaction.user.id}"].msg_id`);
                            db.reviewDB.set(artistArray[j], msg.url, `["${ep_name}"].["${interaction.user.id}"].url`);
                        }

                        i.update({ embeds: [epEmbed], components: [] });
                    } break;
                }
            });

            collector.on('end', async () => {
                if (a_collector != undefined) a_collector.stop();
                if (name_collector != undefined) name_collector.stop();
                if (ra_collector != undefined) ra_collector.stop();
                if (re_collector != undefined) re_collector.stop();
            });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
    },
};
