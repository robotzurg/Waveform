const Discord = require('discord.js');
const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { handle_error, review_ep, grab_spotify_art, parse_artist_song_data } = require('../func.js');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('epreview')
        .setDescription('Review an EP or LP in Waveform.')
        .addSubcommand(subcommand =>
            subcommand.setName('with_spotify')
            .setDescription('Review an EP/LP by utilizing the album of your currently playing spotify song. (requires login)')
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
                    .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand.setName('manually')
            .setDescription('Review an EP/LP by putting in the information manually.')
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
                    .setRequired(false))),
	admin: false,
	async execute(interaction) {
        try {

            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let parsed_args = await parse_artist_song_data(interaction, artists, ep);
            if (parsed_args == -1) return;

            let origArtistArray = parsed_args[0];
            let epName = parsed_args[1];
            let artistArray = parsed_args[2];
            let epType = epName.includes(' LP') ? `LP` : `EP`;

            let art = interaction.options.getString('art');
            if (art == null) art = false;
        
            let overall_rating = interaction.options.getString('overall_rating');
            if (overall_rating == null) {
                overall_rating = false;
            } else {
                if (overall_rating.includes('/10')) overall_rating = overall_rating.replace('/10', '');
                overall_rating = parseFloat(overall_rating);
                if (isNaN(overall_rating)) return interaction.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating!');
            }

            let overall_review = interaction.options.getString('overall_review');
            if (overall_review == null) overall_review = false;
            if (overall_review != false) {
                if (overall_review.includes('\\n')) {
                    overall_review = overall_review.split('\\n').join('\n');
                }
            }
            
            let user_sent_by = interaction.options.getUser('user_who_sent');
            if (user_sent_by == null) user_sent_by = false;
            let tag = interaction.options.getString('tag');
            let taggedMember = false;
            let taggedUser = false;
            let starred = false;
            let row2;


            // Check to make sure "EP" or "LP" is in the ep/lp name
            if (!epName.includes(' EP') && !epName.includes(' LP')) {
                return interaction.editReply(`You did not add EP or LP (aka album) to the name of the thing you are reviewing, make sure to do that!\n` + 
                `For example: \`${epName} EP\` or \`${epName} LP\``);
            }

            if (user_sent_by.id != null && user_sent_by.id != undefined && user_sent_by.id != false) {
                taggedMember = await interaction.guild.members.fetch(user_sent_by.id);
                taggedUser = user_sent_by;
            } else {
                taggedUser = { id: false };
            }

            // Art grabbing
            if (art == false || art == null || art == undefined) {
                art = await grab_spotify_art(origArtistArray, epName);
                if (db.reviewDB.has(artistArray[0])) {
                    if (db.reviewDB.get(artistArray[0], `["${epName}"].art`) != false && db.reviewDB.get(artistArray[0], `["${epName}"].art`) != undefined) {
                        art = await db.reviewDB.get(artistArray[0], `["${epName}"].art`);
                    }
                }
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
                        .setLabel(`Begin ${epType} Review`)
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
                        .setLabel(`Begin ${epType} Review`)
                        .setStyle('SUCCESS'),
                    new Discord.MessageButton()
                        .setCustomId('done')
                        .setLabel('Send to Database with No Song Reviews')
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
            .setTitle(`${artistArray.join(' & ')} - ${epName}`)
            .setAuthor({ name: `${interaction.member.displayName}'s ${epType} review`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` });

            if (art == false) {
                epEmbed.setThumbnail(interaction.user.avatarURL({ format: "png", dynamic: false }));
            } else {
                epEmbed.setThumbnail(art);
            }

            if (overall_rating != false && overall_review != false) {
                epEmbed.setDescription(`*${overall_review}*`);
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
            } else if (overall_rating != false) {
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
            } else if (overall_review != false) {
                epEmbed.setDescription(`*${overall_review}*`);
            }

            if (taggedUser.id != false) {
                epEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }

            interaction.editReply({ embeds: [epEmbed], components: [row, row2] });

            // Grab message id to put in user_stats and the ep object
            const msg = await interaction.fetchReply();

            db.user_stats.set(interaction.user.id, [msg.id, artistArray, epName, 'A'], 'current_ep_review');            

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
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == undefined || art == false) {
                                // If we don't have art for the edited ep info, search it on the spotify API.
                                art = await grab_spotify_art(artistArray, epName);
                                if (art == false) art = interaction.user.avatarURL({ format: "png", dynamic: false });
                            } else {
                                if (db.reviewDB.has(artistArray[0])) art = db.reviewDB.get(artistArray[0], `["${epName}"].art`);
                                if (art == undefined || art == false) art = interaction.user.avatarURL({ format: "png", dynamic: false });
                            }
                            epEmbed.setThumbnail(art);

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, [msg.id, artistArray, epName, 'A'], 'current_ep_review');      
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
                            epName = m.content;
                            if (starred == false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == undefined || art == false) {
                                // If we don't have art for the edited ep info, search it on the spotify API.
                                art = await grab_spotify_art(artistArray, epName);
                                if (art == false) art = interaction.user.avatarURL({ format: "png", dynamic: false });
                            } else {
                                if (db.reviewDB.has(artistArray[0])) art = db.reviewDB.get(artistArray[0], `["${epName}"].art`);
                                if (art == undefined || art == false) art = interaction.user.avatarURL({ format: "png", dynamic: false });
                            }
                            epEmbed.setThumbnail(art);

                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, [msg.id, artistArray, epName, 'A'], 'current_ep_review');      
                            m.delete();
                        });
                        
                        name_collector.on('end', async () => {
                            await i.editReply({ content: ' ', embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'rating': {
                        await i.deferUpdate();
                        await i.editReply({ content: `Type in the overall ${epType} rating (DO NOT ADD \`/10\`!)`, components: [] });

                        const ra_filter = m => m.author.id == interaction.user.id;
                        ra_collector = interaction.channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                        ra_collector.on('collect', async m => {
                            overall_rating = parseFloat(m.content);
                            if (overall_rating.includes('/10')) overall_rating = overall_rating.replace('/10', '');
                            if (isNaN(overall_rating)) i.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!');
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], overall_rating, `["${epName}"].["${interaction.user.id}"].rating`);
                            }

                            row2 = new Discord.MessageActionRow()
                            .addComponents(
                                new Discord.MessageButton()
                                    .setCustomId('begin')
                                    .setLabel(`Begin ${epType} Review`)
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
                        await i.editReply({ content: `Type in the new overall ${epType} review.`, components: [] });

                        const re_filter = m => m.author.id == interaction.user.id;
                        re_collector = interaction.channel.createMessageCollector({ filter: re_filter, max: 1, time: 120000 });
                        re_collector.on('collect', async m => {
                            overall_review = m.content;

                            if (overall_review.includes('\\n')) {
                                overall_review = overall_review.split('\\n').join('\n');
                            }

                            epEmbed.setDescription(`*${overall_review}*`);
                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], overall_review, `["${epName}"].["${interaction.user.id}"].review`);
                            }

                            row2 = new Discord.MessageActionRow()
                            .addComponents(
                                new Discord.MessageButton()
                                    .setCustomId('begin')
                                    .setLabel(`Begin ${epType} Review`)
                                    .setStyle('SUCCESS'),
                                new Discord.MessageButton()
                                    .setCustomId('done')
                                    .setLabel('Send to Database with No Song Reviews')
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
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} (${overall_rating}/10) 🌟`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }
                            starred = true;
                        } else {
                            if (overall_rating != false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
                            } else {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            }
                            starred = false;
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

                        review_ep(interaction, artistArray, epName, overall_rating, overall_review, taggedUser, art, starred, tag);

                        // Set message ids
                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], msg.id, `["${epName}"].["${interaction.user.id}"].msg_id`);
                            db.reviewDB.set(artistArray[j], msg.url, `["${epName}"].["${interaction.user.id}"].url`);
                        }

                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], true, `["${epName}"].["${interaction.user.id}"].no_songs`);
                        }
                        

                        if (overall_review != false) epEmbed.setDescription(`${overall_review}`);
                        if (overall_rating != false) epEmbed.addField(`Rating`, `**${overall_rating}/10**`);
                        if (starred == false) {
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                        } else {
                            epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                        }
        
                        i.editReply({ embeds: [epEmbed], components: [] });
                    } break;
                    case 'begin': {
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        review_ep(interaction, artistArray, epName, overall_rating, overall_review, taggedUser, art, starred, tag);

                        // Setup tags if necessary
                        if (tag != null) {
                            if (db.tags.has(tag)) {
                                db.tags.push(tag, `${artistArray.join(' & ')} - ${epName}`, 'song_list');
                            } else {
                                db.tags.set(tag, [`${artistArray.join(' & ')} - ${epName}`], 'song_list');
                                db.tags.set(tag, false, 'image');
                            }
                        }

                        // Set message ids
                        for (let j = 0; j < artistArray.length; j++) {
                            db.reviewDB.set(artistArray[j], msg.id, `["${epName}"].["${interaction.user.id}"].msg_id`);
                            db.reviewDB.set(artistArray[j], msg.url, `["${epName}"].["${interaction.user.id}"].url`);
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
