const db = require("../db.js");
const { average, get_user_reviews, parse_artist_song_data, sort, handle_error, get_review_channel, getEmbedColor, convertToSetterName } = require('../func.js');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getsong')
        .setDescription('Get data about a song.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('server')
            .setDescription('Get data specific to the server about a song.')
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
                    .setRequired(false)))

            .addSubcommand(subcommand =>
                subcommand.setName('global')
                .setDescription('Get data specific across the whole bot about a song.')
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
                        .setRequired(false))),
    help_desc: `Pulls up all data relating to a song or remix in Waveform, such as all reviews, rating averages, and more.\n\n` +
    `You can view a summary view of all data relating to a song globally by using the \`server\` subcommand, or view a list of all local server reviews using the \`server\` subcommand.\n\n` +
    `The remixers argument should have the remixer specified if you are trying to pull up a remix, the remixer should be put in the song_name or artists arguments.\n\n` +
    `Leaving the artist, song_name, and remixers arguments blank will pull from your spotify playback to fill in the arguments (if you are logged into Waveform with Spotify)`,
	async execute(interaction, client) {
        try {

        let subcommand = interaction.options.getSubcommand();
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
        let setterSongName = convertToSetterName(songName);
        let artistArray = song_info.db_artists;
        let displaySongName = song_info.display_song_name;

        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let starCount = 0;

        // See if we have any VIPs
        let artistSongs = Object.keys(db.reviewDB.get(artistArray[0]));
        artistSongs = artistSongs.map(v => v = v.replace('_((', '[').replace('))_', ']'));
        let songVIP = false;
        for (let s of artistSongs) {
            if (s.includes('VIP') && s.includes(songName) && s != songName) songVIP = s;
        }

        songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
        if (songObj == undefined) { return interaction.reply(`The requested song \`${origArtistArray.join(' & ')} - ${songName}\` does not exist.` + 
        `\nUse \`/getArtist\` to get a full list of this artist's songs.`); }

        songEP = songObj.ep;
        let setterSongEP = songObj.ep;
        if (songEP != false && songEP != undefined && songEP != null) setterSongEP = convertToSetterName(songEP);
        remixArray = songObj.remixers;
        if (remixArray == undefined) {
            remixArray = [];
        }

        if (remixArray.length != 0) {
            for (let i = 0; i < remixArray.length; i++) {
                if (remixArray[i].includes('\\&')) {
                    remixArray[i] = remixArray[i].split(' & ');
                    remixArray[i] = remixArray[i].map(v => v.replace('\\&', '&'));
                    remixArray[i] = remixArray[i].join(' x ');
                }
                remixes.push(`\`${remixArray[i]} Remix\``);
            }
        }
        if (setterSongEP == undefined) setterSongEP = false;
        if (songEP == undefined) songEP = false;
        let songEPObj = db.reviewDB.get(artistArray[0], `${setterSongEP}`);
        let songEPArt = false;
        if (songEPObj == undefined) {
            if (songName.includes(' Remix)')) {
                songEPObj = db.reviewDB.get(songObj.collab[0], `${setterSongEP}`);
                if (songEPObj == undefined) songEPObj = { art: false };
                songEPArt = songEPObj.art;
            } else {
                songEPObj = { art: false };
            }
        } else {
            songEPArt = { art: songEPObj.art };
        }
        
        let userArray;
        // Get all users if global, otherwise get only guild specific users if server.
        if (subcommand == 'server') {
            const guild = client.guilds.cache.get(interaction.guild.id);
            userArray = await get_user_reviews(songObj, guild);
        } else {
            userArray = await get_user_reviews(songObj);
        }
        
        let userIDList = userArray.slice(0); //.slice(0) is there to create a COPY, not a REFERENCE.
        const songArt = songObj.art;

        const rankNumArray = [];
        const songEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
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
            if (subcommand == 'server') {
                songEmbed.setDescription(`*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***` + 
                `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} star${starCount == 1 ? '' : 's'}!** :star2:`)}` + 
                `${songObj.spotify_uri == false || songObj.spotify_uri == undefined ? `` : `\n<:spotify:961509676053323806> [Spotify](https://open.spotify.com/track/${songObj.spotify_uri.replace('spotify:track:', '')})`}`);
            } else {
                songEmbed.setDescription(`The average rating of this song globally is **${Math.round(average(rankNumArray) * 10) / 10}!**` + 
                `\nThis song has **${rankNumArray.length}** ratings.` +
                `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} star${starCount == 1 ? '' : 's'} globally!** :star2:`)}` + 
                `${songObj.spotify_uri == false || songObj.spotify_uri == undefined ? `` : `\n<:spotify:961509676053323806> [Spotify](https://open.spotify.com/track/${songObj.spotify_uri.replace('spotify:track:', '')})`}`);
            }        
        } else {
            songEmbed.setDescription(`${songObj.spotify_uri == false || songObj.spotify_uri == undefined ? `` : `<:spotify:961509676053323806> [Spotify](https://open.spotify.com/track/${songObj.spotify_uri.replace('spotify:track:', '')})`}`);
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

        if (userArray.length != 0 && subcommand != 'global') { // Sort it by highest to lowest rating
            userArray = sort(userArray);
            userIDList = sort(userIDList);

            for (let i = 0; i < userArray.length; i++) {
                userArray[i] = `**${i + 1}.** `.concat(userArray[i]);
            }
        } else if (subcommand != 'global') {
            songEmbed.addFields([{ name: 'Reviews:', value: 'No reviews :(' }]);
        }

        let taggedMemberSel, taggedUserSel, selDisplayName;
        let paged_user_list = _.chunk(userArray, 10);
        let paged_user_id_list = _.chunk(userIDList, 10);
        let page_num = 0;
        let select_options = [];
        let sel_row;
        // This fixes the for loop right under this if there is no reviews for the song.
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
        
        if (subcommand == 'server') {
            if (userArray.length != 0) songEmbed.addFields([{ name: 'Reviews:', value: paged_user_list[0].join('\n') }]);
        } else {
            if (rankNumArray.length != 0) {
                let ratingList = rankNumArray.reduce(function(acc, curr) {
                    return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc;
                }, {});

                ratingList = Object.entries(ratingList);
                ratingList = ratingList.map(v => {
                    let temp = v[0];
                    v[0] = v[1];
                    v[1] = temp;
                    return v;
                });

                ratingList = ratingList.sort((a, b) => b[0] - a[0]);
                ratingList = ratingList.map(v => `**${v[1]}: ${v[0]}**`);
                songEmbed.addFields([{ name: 'Ratings:', value: `${ratingList.join('\n')}` }]);
            }
        }
        
        if (remixes.length != 0) songEmbed.addFields([{ name: 'Remixes:', value: remixes.join('\n') }]);
        if (songVIP != false) songEmbed.addFields([{ name: 'VIP:', value: `\`${songVIP}\`` }]);
        if (songEP != false) {
            songEmbed.setFooter({ text: `from ${songEP}${paged_user_list > 1 && subcommand != 'global' ? ` • Page ${page_num + 1} / ${paged_user_list.length}` : ``}`, iconURL: songEPArt.art });
        } else if (paged_user_list > 1 && subcommand != 'global') {
            songEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_user_list.length}` });
        }

        let components = [];
        if (subcommand == 'server') {
            components = paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row];
        }
        
        interaction.reply({ embeds: [songEmbed], components: components });
        let message = await interaction.fetchReply();

        if (subcommand == 'server') {
            const collector = message.createMessageComponentCollector({ time: 360000 });
            collector.on('collect', async i => {
                if (i.customId == 'select') { // Select Menu

                    if (i.values[0] == 'back') { // Back Selection
                        return await i.update({ content: null, embeds: [songEmbed], components: components });
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
                    if (review == '-') review = false;
                    let rating = songObj[i.values[0]].rating;
                    let sentby = songObj[i.values[0]].sentby;
                    let sentbyIconURL = false;
                    let sentbyDisplayName = false;
                    let url = songObj[i.values[0]].url;
                    
                    // If we don't have a single review link, we can check for an EP/LP review link
                    if (url == false && (songEP != false && songEP != undefined)) {
                        if (songEPObj[`${interaction.user.id}`] != undefined) {
                            if (songEPObj[`${interaction.user.id}`].url != false) {
                                url = songEPObj[`${interaction.user.id}`].url;
                            }
                        }
                    }

                    if (sentby != false && taggedUser != undefined) {
                        sentby = await client.users.fetch(sentby);
                        console.log(`User: ` + sentby);  
                        sentbyIconURL = sentby.avatarURL({ extension: 'png' });
                        sentbyDisplayName = sentby.username;
                    }

                    const reviewEmbed = new EmbedBuilder();
                    if (taggedMember != undefined) {
                        reviewEmbed.setColor(`${getEmbedColor(taggedMember)}`);
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
                        reviewEmbed.setFooter({ text: `Sent by ${sentbyDisplayName}`, iconURL: `${sentbyIconURL}` });
                    } else if (songEP != undefined && songEP != false) {
                        reviewEmbed.setFooter({ text: `from ${songEP}`, iconURL: db.reviewDB.get(artistArray[0], `${setterSongEP}.art`) });
                    }

                    let reviewMsgID = songObj[i.values[0]][`msg_id`];
                    if (reviewMsgID != false && reviewMsgID != undefined) {
                        let channelsearch = await get_review_channel(client, songObj[i.values[0]].guild_id, songObj[i.values[0]].channel_id, reviewMsgID);
                        if (channelsearch != undefined) {
                            await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                                reviewEmbed.setTimestamp(msg.createdTimestamp);
                            });
                        }
                    }

                    if (url == undefined || url == false) {
                        await i.update({ content: null, embeds: [reviewEmbed], components: components });
                    } else {
                        await i.update({ content: `[View Review Message](${url})`, embeds: [reviewEmbed], components: components });
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

                    i.update({ embeds: [songEmbed], components: components });
                }
            });

            collector.on('end', async () => {
                interaction.editReply({ content: ` `, embeds: [songEmbed], components: [] });
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
