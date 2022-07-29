const Discord = require('discord.js');
const db = require("../db.js");
const { average, get_user_reviews, handle_error, create_ep_review, find_review_channel, parse_artist_song_data } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getep')
        .setDescription('Get all the songs from a specific EP and display them in an embed message.')
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
    admin: false,
	async execute(interaction, client) {
        try {

            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let parsed_args = await parse_artist_song_data(interaction, artists, ep);
            if (parsed_args == -1) return;

            let origArtistArray = parsed_args[0];
            let epName = parsed_args[1];
            let artistArray = parsed_args[2];
            let epType = epName.includes(' LP') ? `LP` : `EP`;

            let epObj = db.reviewDB.get(artistArray[0], `["${epName}"]`);
            if (epObj == undefined) {
                return interaction.editReply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` was not found in the database.`);
            }

            let ep_art = db.reviewDB.get(artistArray[0], `["${epName}"].art`);
            if (ep_art == undefined || ep_art == false) {
                ep_art = interaction.user.avatarURL({ format: "png", dynamic: false });
            }

            let tags = db.reviewDB.get(artistArray[0], `["${epName}"].tags`);
            if (tags == undefined) tags = [];

            let rankNumArray = [];
            let epRankArray = [];
            let songRankArray = [];
            let rating;
            let epSongArray = db.reviewDB.get(artistArray[0], `["${epName}"].songs`);

            await create_ep_review(interaction, client, origArtistArray, epSongArray, epName, ep_art);

            const epEmbed = new Discord.MessageEmbed()
                .setColor(`${interaction.member.displayHexColor}`)
                .setTitle(`${origArtistArray} - ${epName} tracks`)
                .setThumbnail(ep_art);

                let reviewNum = Object.keys(db.reviewDB.get(artistArray[0], `["${epName}"]`));
                reviewNum = reviewNum.filter(e => e !== 'art');
                reviewNum = reviewNum.filter(e => e !== 'songs');
                reviewNum = reviewNum.filter(e => e !== 'collab');
                reviewNum = reviewNum.filter(e => e !== 'review_num');
                reviewNum = reviewNum.filter(e => e !== 'tags');
                let userArray = reviewNum.slice(0);
                let userIDList = userArray.slice(0);

                for (let i = 0; i < reviewNum.length; i++) {
                    let userObj = db.reviewDB.get(artistArray[0], `["${epName}"].["${reviewNum[i]}"]`);
                    userArray[i] = `<@${reviewNum[i]}>${(userObj.rating != false) ? ` \`${userObj.rating}/10\`` : ` \`No Rating\``}`;
                    rating = db.reviewDB.get(artistArray[0], `["${epName}"].["${reviewNum[i]}"].rating`);
                    if (rating != false && rating != undefined && !isNaN(rating)) {
                        epRankArray.push(parseFloat(rating));
                    }
                }
                
                let epnum = 0;
                for (let i = 0; i < epSongArray.length; i++) {

                    let songArtist = artistArray[0];

                    let songObj = db.reviewDB.get(songArtist, `["${epSongArray[i]}"]`);

                    epnum++;

                    reviewNum = get_user_reviews(songObj);
                    rankNumArray = [];
                    let star_num = 0;

                    for (let ii = 0; ii < reviewNum.length; ii++) {
                        rating = db.reviewDB.get(songArtist, `["${epSongArray[i]}"].["${reviewNum[ii]}"].rating`);
                        if (db.reviewDB.get(songArtist, `["${epSongArray[i]}"].["${reviewNum[ii]}"].starred`) == true) {
                            star_num++;
                        }
                        if (rating != false) {
                            rankNumArray.push(parseFloat(rating));
                        }
                    }

                    reviewNum = reviewNum.length;

                    epEmbed.addField(`${epnum}. ${epSongArray[i]} (Avg: ${(rankNumArray.length != 0) ? `${Math.round(average(rankNumArray) * 10) / 10}` : `N/A`})`, 
                    `\`${reviewNum} review${reviewNum > 1 ? 's' : ''}\` ${star_num > 0 ? `\`${star_num} 🌟\`` : ''}`);

                    if (rankNumArray.length != 0) songRankArray.push(Math.round(average(rankNumArray) * 10) / 10);
                }

                if (epRankArray.length != 0) {
                    if (songRankArray.length != 0) {
                        epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***` + 
                        `\n*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                        `\n${userArray.join('\n')}`);
                    } else {
                        epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***`);
                    }
                } else {
                    if (songRankArray.length != 0) {
                        epEmbed.setDescription(`*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                        `\n${userArray.join('\n')}`);
                    } else {
                        epEmbed.setDescription(`This ${epType} has no songs in the database and has not been reviewed overall.`);
                    }
                }

                if (tags.length != 0) epEmbed.setFooter({ text: `Tags: ${tags.join(', ')}` });

                // Button/Select Menu setup
            let select_options = [];
            let taggedMemberSel;
            let taggedUserSel;

            for (let i = 0; i < userIDList.length; i++) {
                taggedMemberSel = await interaction.guild.members.fetch(userIDList[i])
                .catch(() => taggedMemberSel = 'Invalid Member (They have left the server)');
                if (taggedMemberSel != 'Invalid Member (They have left the server)') {
                    taggedUserSel = taggedMemberSel.user;
                }

                if (taggedMemberSel != 'Invalid Member (They have left the server)') {
                    select_options.push({
                        label: `${taggedMemberSel.displayName}`,
                        description: `${taggedMemberSel.displayName}'s review of the EP/LP.`,
                        value: `${taggedUserSel.id}`,
                    });
                }
            }

            select_options.push({
                label: `Back`,
                description: `Go back to the main song data menu.`,
                value: `back`,
            });

            const row = new Discord.MessageActionRow()
                .addComponents(
                    new Discord.MessageSelectMenu()
                        .setCustomId('select')
                        .setPlaceholder('See other reviews by clicking on me!')
                        .addOptions(select_options),
                );

            interaction.editReply({ embeds: [epEmbed], components: [row] });
            let message = await interaction.fetchReply();
        
            const collector = message.createMessageComponentCollector({ componentType: 'SELECT_MENU', time: 120000 });

            collector.on('collect', async select => {

                if (select.values[0] == 'back') { // Back Selection
                    return await select.update({ content: ' ', embeds: [epEmbed], components: [row] });
                }

                const taggedMember = await interaction.guild.members.fetch(select.values[0]);
                const taggedUser = taggedMember.user;

                let ep_url = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].url`);
                let ep_overall_rating = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].rating`);
                let ep_overall_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].review`);
                let no_songs_review = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].no_songs`);
                let ep_sent_by = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].sentby`);
                if (no_songs_review == undefined) no_songs_review = false; // Undefined handling for EP/LP reviews without this
                let ep_starred = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].starred`);
                let rreview;
                let rscore;
                let rsentby;
                let rstarred;

                if (ep_sent_by != undefined && ep_sent_by != false) {
                    ep_sent_by = await interaction.guild.members.fetch(ep_sent_by);
                }

                const epReviewEmbed = new Discord.MessageEmbed();
                if (epSongArray.length != 0) {
                    for (let i = 0; i < epSongArray.length; i++) {
                        let songName = epSongArray[i];
                        let artistsEmbed = [];
                        let vocalistsEmbed = [];
        
                        rreview = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].review`);
                        if (rreview.length > 1000) rreview = '*Review hidden to save space*';
                        rscore = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].rating`);
                        rsentby = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].sentby`);
                        rstarred = db.reviewDB.get(artistArray[0], `["${songName}"].["${taggedUser.id}"].starred`);
        
                        // This is for adding in collaborators/vocalists into the name inputted into the embed title, NOT for getting data out.
                        if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`) != undefined) {
                            if (db.reviewDB.get(artistArray[0], `["${songName}"].collab`).length != 0) {
                                artistsEmbed = [];
                                artistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].collab`));
                                artistsEmbed = artistsEmbed.flat(1);
                                artistsEmbed = artistsEmbed.join(' & ');
                            }
                        }
                
                        if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`) != undefined) {
                            if (db.reviewDB.get(artistArray[0], `["${songName}"].vocals`).length != 0) {
                                vocalistsEmbed = [];
                                vocalistsEmbed.push(db.reviewDB.get(artistArray[0], `["${songName}"].vocals`));
                                vocalistsEmbed = vocalistsEmbed.flat(1);
                                vocalistsEmbed = vocalistsEmbed.join(' & ');
                            }
                        }

                        if (no_songs_review == false) {
                            if (epReviewEmbed.length < 3250) {
                                epReviewEmbed.addField(`${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                                `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                                `${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}` +
                                `${rscore != false ? `(${rscore}/10)` : ``}`, 
                                `${rreview == false ? `*No review written*` : `${rreview}`}`);
                            } else {
                                epReviewEmbed.addField(`${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                                `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                                `${vocalistsEmbed.length != 0 ? `(ft. ${vocalistsEmbed}) ` : ''}` +
                                `${rscore != false ? `(${rscore}/10)` : ``}`, 
                                `${rreview == false ? `*No review written*` : `*Review hidden to save space*`}`);
                            }
                        }
                         
                    }
                }
                
                epReviewEmbed.setColor(`${taggedMember.displayHexColor}`);
                epReviewEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName}` : `🌟 ${origArtistArray.join(' & ')} - ${epName} 🌟`);
        
                if (ep_overall_rating != false && ep_overall_review != false) {
                    if (no_songs_review == false) {
                        epReviewEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                    } else {
                        epReviewEmbed.addField(`Rating`, `**${ep_overall_rating}/10**`);
                    }
                    epReviewEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
                } else if (ep_overall_rating != false) {
                    if (no_songs_review == false) {
                        epReviewEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                    } else {
                        epEmbed.addField(`Rating`, `**${ep_overall_rating}/10**`);
                    }
                } else if (ep_overall_review != false) {
                    epReviewEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
                }

                epReviewEmbed.setAuthor({ name: rsentby != false && rsentby != undefined && epSongArray.length != 0 ? `${taggedMember.displayName}'s mailbox ${epType} review` : `${taggedMember.displayName}'s ${epType} review`, iconURL: `${taggedUser.avatarURL({ format: "png", dynamic: false })}` });

                epReviewEmbed.setThumbnail(ep_art);
                if (ep_sent_by != false && ep_sent_by != undefined) {
                    epReviewEmbed.setFooter({ text: `Sent by ${ep_sent_by.displayName}`, iconURL: `${ep_sent_by.user.avatarURL({ format: "png" })}` });
                }

                let reviewMsgID = db.reviewDB.get(artistArray[0], `["${epName}"].["${taggedUser.id}"].msg_id`);
                if (reviewMsgID != false && reviewMsgID != undefined) {
                    let channelsearch = await find_review_channel(interaction, taggedUser.id, reviewMsgID);
                    if (channelsearch != undefined) {
                        await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                            epReviewEmbed.setTimestamp(msg.createdTimestamp);
                        });
                    }
                }

                if (epReviewEmbed.length > 3250) {
                    for (let i = 0; i < epReviewEmbed.fields.length; i++) {
                        epReviewEmbed.fields[i].value = `*Review hidden to save space*`;
                    }
                }

                if (ep_url) {
                    select.update({ content: `[View ${epType} Review Message](${ep_url})`, embeds: [epReviewEmbed] });
                } else {
                    select.update({ embeds: [epReviewEmbed] });
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