const db = require("../db.js");
const { average, get_user_reviews, parse_artist_song_data, sort, handle_error, find_review_channel } = require('../func.js');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsong')
        .setDescription('Get data about a song.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('song_name')
                .setDescription('The name of the song.')
                .setAutocomplete(true)
                .setRequired(false))
            
        .addStringOption(option => 
            option.setName('remixers')
                .setDescription('Remix artists on the song, if any.')
                .setAutocomplete(true)
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction, client) {
        try {

        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info.error != undefined) {
            await interaction.reply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let songName = song_info.song_name;
        let artistArray = song_info.db_artists;
        let displaySongName = song_info.display_song_name;

        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let starCount = 0;

        songObj = db.reviewDB.get(artistArray[0])[songName];
        if (songObj == undefined) { return interaction.reply(`The requested song \`${origArtistArray.join(' & ')} - ${songName}\` does not exist.` + 
        `\nUse \`/getArtist\` to get a full list of this artist's songs.`); }

        // See if we have any VIPs
        let artistSongs = Object.keys(db.reviewDB.get(artistArray[0]));
        let songVIP = false;
        for (let s of artistSongs) {
            if (s.includes('VIP') && s.includes(songName) && s != songName) songVIP = s;
        }

        songEP = songObj.ep;
        remixArray = songObj.remixers;
        if (remixArray == undefined) {
            remixArray = [];
        }

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (songEP == undefined || songEP == false) songEP = false;
        
        let userArray = get_user_reviews(songObj);
        let userIDList = userArray.slice(0); //.slice(0) is there to create a COPY, not a REFERENCE.
        const songArt = songObj.art;

        const rankNumArray = [];
        const songEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);

        for (let i = 0; i < userArray.length; i++) {
            if (userArray[i] != 'EP') {
                let rating;
                let ratingDisplay;
                let starred = false;
                rating = songObj[userArray[i]].rating;
                if (songObj[userArray[i]].starred == true) {
                    starCount++;
                    starred = true;
                }

                if (rating === false) {
                    ratingDisplay = 'No Rating';
                    rating = -100 - i; // To put it on the bottom of the rating list.
                } else {
                    rankNumArray.push(parseFloat(rating)); 
                    ratingDisplay = `${rating}/10`;
                }

                if (starred == true) {
                    userArray[i] = [parseFloat(rating) + 1, `:star2: <@${userArray[i]}> \`${ratingDisplay}\``];
                    userIDList[i] = [parseFloat(rating) + 1, userIDList[i]];
                } else {
                    userArray[i] = [parseFloat(rating), `<@${userArray[i]}> \`${ratingDisplay}\``];
                    userIDList[i] = [parseFloat(rating), userIDList[i]];
                }
            }
        }
        
        if (rankNumArray.length != 0) {
            songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***` + 
            `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} star${starCount == 1 ? '' : 's'}!** :star2:`)}`);
        } else {
            songEmbed.setDescription(`*The average rating of this song is N/A*`);
        }

        if (songArt == false) {
            songEmbed.setThumbnail(interaction.user.avatarURL({ extension: "png" }));
        } else {
            songEmbed.setThumbnail(songArt);
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
        } else {
            songEmbed.addFields([{ name: 'Reviews:', value: 'No reviews :(' }]);
        }

        let taggedMemberSel, taggedUserSel, selDisplayName;
        let paged_user_list = _.chunk(userArray, 10);
        let paged_user_id_list = _.chunk(userIDList, 10);
        let page_num = 0;
        let select_options = [];
        let sel_row;

        if (paged_user_list.length != 0) {
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
                    description: `${selDisplayName}'s review of the song.`,
                    value: `${userID}`,
                });
            }

            select_options.push({
                label: `Back`,
                description: `Go back to the main song data menu.`,
                value: `back`,
            });

            // Setup select row for first set of 10
            sel_row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select')
                    .setPlaceholder('See other reviews by clicking on me!')
                    .addOptions(select_options),
            );
        }

        if (userArray.length != 0) songEmbed.addFields([{ name: 'Reviews:', value: paged_user_list[0].join('\n') }]);
        if (remixes.length != 0) songEmbed.addFields([{ name: 'Remixes:', value: remixes.join('\n') }]);
        if (songVIP != false) songEmbed.addFields([{ name: 'VIP:', value: `\`${songVIP}\`` }]);
        if (songEP != false) {
            songEmbed.setFooter({ text: `from ${songEP}${paged_user_list > 1 ? ` • Page ${page_num + 1} / ${paged_user_list.length}` : ``}`, iconURL: db.reviewDB.get(artistArray[0])[songEP].art });
        } else if (paged_user_list > 1) {
            songEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_user_list.length}` });
        }
        
        interaction.reply({ embeds: [songEmbed], components: paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row] });
        let message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({ time: 360000 });
        collector.on('collect', async i => {
            if (i.customId == 'select') { // Select Menu

                if (i.values[0] == 'back') { // Back Selection
                    return await i.update({ content: null, embeds: [songEmbed], components: paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row] });
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

                let starred = songObj[i.values[0]].starred;
                let review = songObj[i.values[0]].review;
                let rating = songObj[i.values[0]].rating;
                let sentby = songObj[i.values[0]].sentby;
                let url = songObj[i.values[0]].url;
                
                // If we don't have a single review link, we can check for an EP/LP review link
                if (url == false && (songEP != false && songEP != undefined)) {
                    let songEPObj = db.reviewDB.get(artistArray[0])[songEP];
                    if (songEPObj[`${interaction.user.id}`] != undefined) {
                        if (songEPObj[`${interaction.user.id}`].url != false) {
                            url = songEPObj[`${interaction.user.id}`].url;
                        }
                    }
                }

                if (sentby != false && taggedMember != undefined) {
                    sentby = await interaction.guild.members.cache.get(sentby);              
                }

                const reviewEmbed = new EmbedBuilder();
                if (taggedMember != undefined) {
                    reviewEmbed.setColor(`${taggedMember.displayHexColor}`);
                }
    
                if (starred == false) {
                    reviewEmbed.setTitle(`${origArtistArray.join(' & ')} - ${displaySongName}`);
                } else {
                    reviewEmbed.setTitle(`:star2: ${origArtistArray.join(' & ')} - ${displaySongName} :star2:`);
                }
    
                reviewEmbed.setAuthor({ name: `${displayName}'s review`, iconURL: `${taggedUser.avatarURL({ extension: "png" })}` });
    
                if (rating !== false) reviewEmbed.addFields([{ name: 'Rating: ', value: `**${rating}/10**`, inline: true }]);
                if (review != false) reviewEmbed.setDescription(review);
    
                reviewEmbed.setThumbnail((songArt == false) ? interaction.user.avatarURL({ extension: "png" }) : songArt);

                if (sentby != false) {
                    reviewEmbed.setFooter({ text: `Sent by ${sentby.displayName}`, iconURL: `${sentby.user.avatarURL({ extension: "png" })}` });
                } else if (songEP != undefined && songEP != false) {
                    reviewEmbed.setFooter({ text: `from ${songEP}`, iconURL: db.reviewDB.get(artistArray[0])[songEP].art });
                }

                let reviewMsgID = songObj[i.values[0]][`msg_id`];
                if (reviewMsgID != false && reviewMsgID != undefined) {
                    let channelsearch = await find_review_channel(interaction, i.values[0], reviewMsgID);
                    if (channelsearch != undefined) {
                        await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                            reviewEmbed.setTimestamp(msg.createdTimestamp);
                        });
                    }
                }

                if (url == undefined || url == false) {
                    await i.update({ content: null, embeds: [reviewEmbed], components: paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row] });
                } else {
                    await i.update({ content: `[View Review Message](${url})`, embeds: [reviewEmbed], components: paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row] });
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
                        description: `${selDisplayName}'s review of the song.`,
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
                
                songEmbed.data.fields[0].value = paged_user_list[page_num].join('\n');

                i.update({ embeds: [songEmbed], components: [sel_row, btn_row] });
            }
        });

        collector.on('end', async () => {
            interaction.editReply({ content: ` `, embeds: [songEmbed], components: [] });
        });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
