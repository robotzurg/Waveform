const db = require("../db.js");
const { average, get_user_reviews, handle_error, create_ep_review, find_review_channel, parse_artist_song_data, sort } = require('../func.js');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder, Embed, ButtonBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getep')
        .setDescription('Get data about an EP/LP.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('ep_name')
                .setDescription('The name of the EP.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction, client) {
        try {

            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let song_info = await parse_artist_song_data(interaction, artists, ep);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                return;
            }

            let origArtistArray = song_info.prod_artists;
            let epName = song_info.song_name;
            let artistArray = song_info.db_artists;
            let epType = epName.includes(' LP') ? `LP` : `EP`;

            let epObj = db.reviewDB.get(artistArray[0])[epName];
            if (epObj == undefined) {
                return interaction.reply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` was not found in the database.`);
            }

            let ep_art = epObj.art;
            if (ep_art == undefined || ep_art == false) {
                ep_art = interaction.user.avatarURL({ extension: "png", dynamic: false });
            }

            let rankNumArray = [];
            let epRankArray = [];
            let songRankArray = [];
            let rating;
            let epSongArray = epObj.songs == undefined ? [] : epObj.songs;

            await create_ep_review(interaction, client, origArtistArray, epSongArray, epName, ep_art);

            const epEmbed = new EmbedBuilder()
                .setColor(`${interaction.member.displayHexColor}`)
                .setTitle(`${origArtistArray} - ${epName}`)
                .setThumbnail(ep_art);

            let reviewNum = Object.keys(db.reviewDB.get(artistArray[0])[epName]);
            reviewNum = reviewNum.filter(e => e !== 'art');
            reviewNum = reviewNum.filter(e => e !== 'songs');
            reviewNum = reviewNum.filter(e => e !== 'collab');
            reviewNum = reviewNum.filter(e => e !== 'review_num');
            reviewNum = reviewNum.filter(e => e !== 'tags');
            let userArray = reviewNum.slice(0);
            let userIDList = userArray.slice(0);
            let epnum = 0;

            for (let i = 0; i < reviewNum.length; i++) {
                let userObj = db.reviewDB.get(artistArray[0])[epName][reviewNum[i]];
                let ratingDisplay = `${(userObj.rating !== false) ? ` \`${userObj.rating}/10\`` : ` \`No Rating\``}`;

                if (userObj.rating !== false && userObj.rating != undefined && !isNaN(userObj.rating)) {
                    epRankArray.push(userObj.rating);
                } else {
                    userObj.rating = -1;
                }

                if (userObj.starred == true) {
                    userArray[i] = [parseFloat(userObj.rating) + 1, `:star2: <@${userArray[i]}> ${ratingDisplay}`];
                    userIDList[i] = [parseFloat(userObj.rating) + 1, userIDList[i]];
                } else {
                    userArray[i] = [parseFloat(userObj.rating), `<@${userArray[i]}> ${ratingDisplay}`];
                    userIDList[i] = [parseFloat(userObj.rating), userIDList[i]];
                }
            }
            
            for (let i = 0; i < epSongArray.length; i++) {
                let songArtist = artistArray[0];
                let songObj = db.reviewDB.get(songArtist)[epSongArray[i]];
                epnum++;

                reviewNum = get_user_reviews(songObj);
                rankNumArray = [];
                let star_num = 0;

                for (let ii = 0; ii < reviewNum.length; ii++) {
                    rating = songObj[reviewNum[ii]].rating;
                    if (songObj[reviewNum[ii]].starred == true) {
                        star_num++;
                    }
                    if (rating !== false) {
                        rankNumArray.push(parseFloat(rating));
                    }
                }

                reviewNum = reviewNum.length;
                epEmbed.addFields([{ name: `${epnum}. ${epSongArray[i]} (Avg: ${(rankNumArray.length != 0) ? `${Math.round(average(rankNumArray) * 10) / 10}` : `N/A`})`,
                    value: `\`${reviewNum} review${reviewNum > 1 ? 's' : ''}\` ${star_num > 0 ? `\`${star_num} 🌟\`` : ''}` }]);

                if (rankNumArray.length != 0) songRankArray.push(Math.round(average(rankNumArray) * 10) / 10);
            }

            // Button/Select Menu setup
            const btn_row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('left')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⬅️'),
                new ButtonBuilder()
                    .setCustomId('right')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('➡️'),
            );

            if (userArray.length != 0) { // Sort it by highest to lowest rating
                userArray = sort(userArray);
                userIDList = sort(userIDList);

                for (let i = 0; i < userArray.length; i++) {
                    userArray[i] = `**${i + 1}.** `.concat(userArray[i]);
                }
            }

            let taggedMemberSel, taggedUserSel, selDisplayName;
            let paged_user_list = _.chunk(userArray, 10);
            let paged_user_id_list = _.chunk(userIDList, 10);
            let page_num = 0;
            let select_options = [];
            if (paged_user_id_list.length == 0) paged_user_id_list = [[]];

            for (let userID of paged_user_id_list[0]) {
                taggedMemberSel = await interaction.guild.members.fetch(userID).catch(() => {
                    taggedMemberSel = undefined;
                });

                if (taggedMemberSel == undefined) {
                    taggedUserSel = await client.users.fetch(userID);
                    selDisplayName = taggedUserSel.username;
                } else {
                    selDisplayName = taggedMemberSel.displayName;
                }

                select_options.push({
                    label: `${selDisplayName}`,
                    description: `${selDisplayName}'s review of the ${epType}.`,
                    value: `${userID}`,
                });
            }

            select_options.push({
                label: `Back`,
                description: `Go back to the main ${epType} data menu.`,
                value: `back`,
            });

            // Setup select row for first set of 10
            let sel_row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('See other reviews by clicking on me!')
                    .addOptions(select_options),
            );

            if (epRankArray.length != 0) {
                if (songRankArray.length != 0) {
                    epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***` + 
                    `\n*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                    `\n${paged_user_list[0].join('\n')}`);
                } else {
                    epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***`);
                }
            } else {
                if (songRankArray.length != 0) {
                    epEmbed.setDescription(`*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                    `\n${paged_user_list[0].join('\n')}`);
                } else {
                    epEmbed.setDescription(`This ${epType} has no songs in the database and has not been reviewed overall.`);
                }
            }

            if (paged_user_list > 1) {
                epEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_user_list.length}` });
            }
            
            interaction.reply({ embeds: [epEmbed], components: paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row] });
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ time: 360000 });
            collector.on('collect', async i => {
                if (i.customId == 'select') {
                    if (i.values[0] == 'back') { // Back Selection
                        return await i.update({ content: null, embeds: [epEmbed], components: paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row] });
                    }

                    let taggedUser, taggedMember, displayName;
                    taggedMember = await interaction.guild.members.fetch(i.values[0]).catch(() => {
                        taggedMember = undefined;
                    });
                    taggedUser = await client.users.fetch(i.values[0]);

                    if (taggedMember == undefined) {
                        displayName = taggedUser.username;
                    } else {
                        displayName = taggedMember.displayName;
                    }

                    let epReviewObj = epObj[taggedUser.id];

                    let ep_url = epReviewObj.url;
                    let ep_overall_rating = epReviewObj.rating;
                    let ep_overall_review = epReviewObj.review;
                    let no_songs_review = epReviewObj.no_songs;
                    let ep_sent_by = epReviewObj.sentby;
                    if (no_songs_review == undefined) no_songs_review = false; // Undefined handling for EP/LP reviews without this
                    let ep_starred = epReviewObj.starred;
                    let rreview;
                    let rscore;
                    let rstarred;

                    if (ep_sent_by != undefined && ep_sent_by != false && taggedMember != undefined) {
                        ep_sent_by = await interaction.guild.members.fetch(ep_sent_by);
                    }

                    const epReviewEmbed = new EmbedBuilder();
                    if (epSongArray.length != 0) {
                        for (let epSong of epSongArray) {
                            let songName = epSong;
                            let artistsEmbed = [];
                            let vocalistsEmbed = [];
                            let songObj = db.reviewDB.get(artistArray[0])[songName];
                            let songReviewObj = songObj[taggedUser.id];
            
                            rreview = songReviewObj.review;
                            if (rreview.length > 1000) rreview = '*Review hidden to save space*';
                            rscore = songReviewObj.rating;
                            rstarred = songReviewObj.starred;
            
                            // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
                            if (songObj.collab != undefined) {
                                if (songObj.collab.length != 0) {
                                    artistsEmbed = [];
                                    artistsEmbed.push(songObj.collab);
                                    artistsEmbed = artistsEmbed.flat(1);
                                    artistsEmbed = artistsEmbed.join(' & ');
                                }
                            }
                    
                            if (songObj.vocals != undefined) {
                                if (songObj.vocals.length != 0) {
                                    vocalistsEmbed = [];
                                    vocalistsEmbed.push(songObj.vocals);
                                    vocalistsEmbed = vocalistsEmbed.flat(1);
                                    vocalistsEmbed = vocalistsEmbed.join(' & ');
                                }
                            }

                            if (no_songs_review == false) {
                                if (new Embed(epReviewEmbed.toJSON()).length < 5250) {
                                    epReviewEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                                    `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                                    `${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}` +
                                    `${rscore != false ? `(${rscore}/10)` : ``}`, 
                                    value: `${rreview == false ? `*No review written*` : `${rreview}`}` }]);
                                } else {
                                    epReviewEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                                    `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                                    `${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}` +
                                    `${rscore != false ? `(${rscore}/10)` : ``}`, 
                                    value: `${rreview == false ? `*No review written*` : `*Review hidden to save space*`}` }]);
                                }
                            }
                            
                        }
                    }
                    
                    if (taggedMember != undefined) {
                        epReviewEmbed.setColor(`${taggedMember.displayHexColor}`);
                    }

                    epReviewEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName}` : `🌟 ${origArtistArray.join(' & ')} - ${epName} 🌟`);
            
                    if (ep_overall_rating !== false && ep_overall_review != false) {
                        if (no_songs_review == false) {
                            epReviewEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                        } else {
                            epReviewEmbed.addFields([{ name: `Rating`, value: `**${ep_overall_rating}/10**` }]);
                        }
                        epReviewEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
                    } else if (ep_overall_rating !== false) {
                        if (no_songs_review == false) {
                            epReviewEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                        } else {
                            epEmbed.addFields([{ name: `Rating`, value: `**${ep_overall_rating}/10**` }]);
                        }
                    } else if (ep_overall_review != false) {
                        epReviewEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
                    }

                    epReviewEmbed.setAuthor({ name: `${displayName}'s ${epType} review`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: false })}` });

                    epReviewEmbed.setThumbnail(ep_art);
                    if (ep_sent_by != false && ep_sent_by != undefined) {
                        epReviewEmbed.setFooter({ text: `Sent by ${ep_sent_by.displayName}`, iconURL: `${ep_sent_by.user.avatarURL({ extension: "png" })}` });
                    }

                    let reviewMsgID = epReviewObj.msg_id;
                    if (reviewMsgID != false && reviewMsgID != undefined) {
                        let channelsearch = await find_review_channel(interaction, taggedUser.id, reviewMsgID);
                        if (channelsearch != undefined) {
                            await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                                epReviewEmbed.setTimestamp(msg.createdTimestamp);
                            });
                        }
                    }

                    if (new Embed(epReviewEmbed.toJSON()).length > 5250) {
                        for (let j = 0; j < epReviewEmbed.data.fields.length; j++) {
                            epReviewEmbed.data.fields[j].value = `*Review hidden to save space*`;
                        }
                    }

                    if (ep_url) {
                        i.update({ content: `[View ${epType} Review Message](${ep_url})`, embeds: [epReviewEmbed], components: [sel_row] });
                    } else {
                        i.update({ embeds: [epReviewEmbed], components: [sel_row] });
                    }
                } else {
                    (i.customId == 'left') ? page_num -= 1 : page_num += 1;
                    page_num = _.clamp(page_num, 0, paged_user_list.length - 1);
    
                    // Update select menu
                    select_options = [];
                    for (let userID of paged_user_id_list[page_num]) {
                        taggedMemberSel = await interaction.guild.members.fetch(userID).catch(() => {
                            taggedMemberSel = undefined;
                        });

                        if (taggedMemberSel == undefined) {
                            taggedUserSel = await client.users.fetch(userID);
                            selDisplayName = taggedUserSel.username;
                        } else {
                            selDisplayName = taggedMemberSel.displayName;
                        }

                        select_options.push({
                            label: `${selDisplayName}`,
                            description: `${selDisplayName}'s review of the ${epType}.`,
                            value: `${userID}`,
                        });
                    }

                    select_options.push({
                        label: `Back`,
                        description: `Go back to the main song data menu.`,
                        value: `back`,
                    });
    
                    sel_row = new ActionRowBuilder()
                    .addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('select')
                            .setPlaceholder('See other reviews by clicking on me!')
                            .addOptions(select_options),
                    );

                    if (epRankArray.length != 0) {
                        if (songRankArray.length != 0) {
                            epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***` + 
                            `\n*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                            `\n${paged_user_list[page_num].join('\n')}`);
                        } else {
                            epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***`);
                        }
                    } else {
                        if (songRankArray.length != 0) {
                            epEmbed.setDescription(`*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                            `\n${paged_user_list[page_num].join('\n')}`);
                        } else {
                            epEmbed.setDescription(`This ${epType} has no songs in the database and has not been reviewed overall.`);
                        }
                    }
    
                    i.update({ embeds: [epEmbed], components: [sel_row, btn_row] });
                }
            });

            collector.on('end', async () => {
                try {
                    await interaction.editReply({ embeds: [epEmbed], components: [] });
                } catch (err) {
                    console.log(err);
                }
            });
        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
	},
};