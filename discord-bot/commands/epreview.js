const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const db = require("../db.js");
const { handle_error, review_ep, grab_spotify_art, parse_artist_song_data, isValidURL } = require('../func.js');
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
    
            /*.addStringOption(option => 
                option.setName('tag')
                    .setDescription('Put a tag you want to set the song to here!')
                    .setAutocomplete(true)
                    .setRequired(false))*/
    
            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Art for the EP/LP. (Leave blank for automatic spotify searching.)')
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
    
            /*.addStringOption(option => 
                option.setName('tag')
                    .setDescription('Put a tag you want to set the song to here!')
                    .setAutocomplete(true)
                    .setRequired(false))*/
    
            .addStringOption(option => 
                option.setName('art')
                    .setDescription('Art for the EP/LP. (Leave blank for automatic spotify searching.)')
                    .setRequired(false))
    
            .addUserOption(option => 
                option.setName('user_who_sent')
                    .setDescription('User who sent you this EP/LP in Mailbox. Ignore if not a mailbox review.')
                    .setRequired(false))),
	admin: false,
	async execute(interaction) {
        try {

            let mailboxes = db.server_settings.get(interaction.guild.id, 'mailboxes');

            // Check if we are reviewing in the right chat, if not, boot out
            if (`<#${interaction.channel.id}>` != db.server_settings.get(interaction.guild.id, 'review_channel') && !mailboxes.some(v => v.includes(interaction.channel.id))) {
                return interaction.reply(`You can only send reviews in ${db.server_settings.get(interaction.guild.id, 'review_channel')} or mailboxes!`);
            }

            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let song_info = await parse_artist_song_data(interaction, artists, ep);
            if (song_info == -1) return;

            let origArtistArray = song_info.prod_artists;
            let epName = song_info.song_name;
            let artistArray = song_info.all_artists;
            let epType = epName.includes(' LP') ? `LP` : `EP`;

            let art = interaction.options.getString('art');
            if (art == null) art = false;
        
            let overall_rating = interaction.options.getString('overall_rating');
            if (overall_rating == null) {
                overall_rating = false;
            } else {
                if (overall_rating.includes('/10')) overall_rating = overall_rating.replace('/10', '');
                overall_rating = parseFloat(overall_rating);
                if (isNaN(overall_rating)) return interaction.reply('The rating you put in is not valid, please make sure you put in an integer or decimal rating!');
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
                return interaction.reply(`You did not add EP or LP (aka album) to the name of the thing you are reviewing, make sure to do that!\n` + 
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
                art = await grab_spotify_art(origArtistArray, epName, interaction);
                if (db.reviewDB.has(artistArray[0])) {
                    if (db.reviewDB.get(artistArray[0], `["${epName}"].art`) != false && db.reviewDB.get(artistArray[0], `["${epName}"].art`) != undefined) {
                        art = await db.reviewDB.get(artistArray[0], `["${epName}"].art`);
                    }
                }
            } else {
                if (!isValidURL(art)) return interaction.reply(`This ${epType} art URL is invalid.`);
            }

            // Setup buttons
            const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('artist')
                    .setLabel('Artist')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('ep')
                    .setLabel('Name')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('rating')
                    .setLabel('Rating')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('review')
                    .setLabel('Review')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('star')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🌟'),
            );

            // Setup bottom row
            if (overall_rating === false && overall_review == false) {
                row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('begin')
                        .setLabel(`Begin ${epType} Review`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger),
                );
            } else {
                row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('begin')
                        .setLabel(`Begin ${epType} Review`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('done')
                        .setLabel('Send to Database with No Song Reviews')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('delete')
                        .setLabel('Delete')
                        .setStyle(ButtonStyle.Danger),
                );
            }

            // Set up the embed
            const epEmbed = new EmbedBuilder()
            .setColor(`${interaction.member.displayHexColor}`)
            .setTitle(`${artistArray.join(' & ')} - ${epName}`)
            .setAuthor({ name: `${interaction.member.displayName}'s ${epType} review`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: false })}` });

            if (art == false) {
                epEmbed.setThumbnail(interaction.user.avatarURL({ extension: "png", dynamic: false }));
            } else {
                epEmbed.setThumbnail(art);
            }

            if (overall_rating !== false && overall_review != false) {
                epEmbed.setDescription(`*${overall_review}*`);
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
            } else if (overall_rating !== false) {
                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
            } else if (overall_review != false) {
                epEmbed.setDescription(`*${overall_review}*`);
            }

            if (taggedUser.id != false) {
                epEmbed.setFooter({ text: `Sent by ${taggedMember.displayName}`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: false })}` });
            }

            interaction.reply({ embeds: [epEmbed], components: [row, row2] });

            // Grab message id to put in user_stats and the ep object
            const msg = await interaction.fetchReply();

            db.user_stats.set(interaction.user.id, msg.id, 'current_ep_review.msg_id');            

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
                        await i.editReply({ content: 'Type in the artist name(s) (separated with & or x)', components: [] });
                        const a_filter = m => m.author.id == interaction.user.id;
                        a_collector = interaction.channel.createMessageCollector({ filter: a_filter, max: 1, time: 60000 });
                        a_collector.on('collect', async m => {
                            if (m.content.includes(' x ')) {
                                m.content = m.content.replace(' & ', ' \\& ');
                                artistArray = m.content;
                            } else {
                                artistArray = m.content.split(' & ');
                            }
                            
                            if (starred == false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }

                            // Thumbnail image handling
                            if (art == undefined || art == false) {
                                // If we don't have art for the edited ep info, search it on the spotify API.
                                art = await grab_spotify_art(artistArray, epName, interaction);
                                if (art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: false });
                            } else {
                                if (db.reviewDB.has(artistArray[0])) art = db.reviewDB.get(artistArray[0], `["${epName}"].art`);
                                if (art == undefined || art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: false });
                            }
                            epEmbed.setThumbnail(art);

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, { msg_id: msg.id, artist_array: artistArray, ep_name: epName, review_type: 'A' }, 'current_ep_review');      
                            m.delete();
                        });
                        
                        a_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
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
                                art = await grab_spotify_art(artistArray, epName, interaction);
                                if (art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: false });
                            } else {
                                if (db.reviewDB.has(artistArray[0])) art = db.reviewDB.get(artistArray[0], `["${epName}"].art`);
                                if (art == undefined || art == false) art = interaction.user.avatarURL({ extension: "png", dynamic: false });
                            }
                            epEmbed.setThumbnail(art);

                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                            db.user_stats.set(interaction.user.id, { msg_id: msg.id, artist_array: artistArray, ep_name: epName, review_type: 'A' }, 'current_ep_review');      
                            m.delete();
                        });
                        
                        name_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'rating': {
                        await i.deferUpdate();
                        await i.editReply({ content: `Type in the overall ${epType} rating (DO NOT ADD \`/10\`!)`, components: [] });

                        const ra_filter = m => m.author.id == interaction.user.id;
                        ra_collector = interaction.channel.createMessageCollector({ filter: ra_filter, max: 1, time: 60000 });
                        ra_collector.on('collect', async m => {
                            overall_rating = m.content;
                            if (overall_rating.includes('/10')) overall_rating = overall_rating.replace('/10', '');
                            overall_rating = parseFloat(overall_rating);
                            if (isNaN(overall_rating)) i.editReply('The rating you put in is not valid, please make sure you put in an integer or decimal rating for your replacement rating!');
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
                            for (let j = 0; j < artistArray.length; j++) {
                                db.reviewDB.set(artistArray[j], overall_rating, `["${epName}"].["${interaction.user.id}"].rating`);
                            }

                            row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('begin')
                                    .setLabel(`Begin ${epType} Review`)
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('done')
                                    .setLabel('Send to Database')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('delete')
                                    .setLabel('Delete')
                                    .setStyle(ButtonStyle.Danger),
                            );
                            
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        ra_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
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

                            row2 = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('begin')
                                    .setLabel(`Begin ${epType} Review`)
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('done')
                                    .setLabel('Send to Database with No Song Reviews')
                                    .setStyle(ButtonStyle.Success),
                                new ButtonBuilder()
                                    .setCustomId('delete')
                                    .setLabel('Delete')
                                    .setStyle(ButtonStyle.Danger),
                            );

                            await i.editReply({ embeds: [epEmbed], components: [row, row2] });
                            m.delete();
                        });
                        
                        re_collector.on('end', async () => {
                            await i.editReply({ content: null, embeds: [epEmbed], components: [row, row2] });
                        });
                    } break;
                    case 'star': {
                        // If we don't have a 10 rating, the button does nothing.
                        if (overall_rating < 8) return await i.update({ embeds: [epEmbed], components: [row, row2] });

                        if (starred == false) {
                            if (overall_rating !== false) {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} (${overall_rating}/10) 🌟`);
                            } else {
                                epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                            }
                            starred = true;
                        } else {
                            if (overall_rating !== false) {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName} (${overall_rating}/10)`);
                            } else {
                                epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                            }
                            starred = false;
                        }

                        await i.update({ embeds: [epEmbed], components: [row, row2] });
                    } break;
                    case 'delete': {
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
                        if (overall_rating !== false) epEmbed.addFields([{ name: `Rating`, value: `**${overall_rating}/10**` }]);
                        if (starred == false) {
                            epEmbed.setTitle(`${artistArray.join(' & ')} - ${epName}`);
                        } else {
                            epEmbed.setTitle(`🌟 ${artistArray.join(' & ')} - ${epName} 🌟`);
                        }
        
                        i.update({ embeds: [epEmbed], components: [] });
                    } break;
                    case 'begin': {
                        if (ra_collector != undefined) ra_collector.stop();
                        if (re_collector != undefined) re_collector.stop();
                        if (a_collector != undefined) a_collector.stop();
                        if (name_collector != undefined) name_collector.stop();
                        if (collector != undefined) collector.stop(); // Collector for all buttons

                        review_ep(interaction, artistArray, epName, overall_rating, overall_review, taggedUser, art, starred, tag);

                        let epSongs = await (db.user_stats.get(interaction.user.id, 'current_ep_review.track_list') != false 
                        ? db.user_stats.get(interaction.user.id, `current_ep_review.track_list`) : db.reviewDB.get(artistArray[0], `["${epName}"].songs`));
                        if (epSongs == false || epSongs == undefined) epSongs = [];

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

                        await i.update({ embeds: [epEmbed], components: [] });
                        if (epSongs.length != 0) {
                            await i.followUp({ content: `Here is the order in which you should review the songs on this ${epType}:\n\n**${epSongs.join('\n')}**`, ephemeral: true });
                        }
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
