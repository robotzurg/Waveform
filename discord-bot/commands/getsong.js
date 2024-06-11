const db = require("../db.js");
const { average, get_user_reviews, parse_artist_song_data, sort, handle_error, get_review_channel, getEmbedColor, convertToSetterName, lfm_api_setup, getLfmUsers } = require('../func.js');
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
                    .setRequired(false))

            .addStringOption(option =>
                option.setName('plays')
                    .setDescription('Set what play count data to view. (defaults to Reviewer Plays)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'None', value: 'none' },
                        { name: 'User Plays', value: 'user' },
                        { name: 'Reviewer Plays', value: 'reviewers' },
                        { name: 'Server Plays', value: 'server' },
                    )))

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
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('sort_mode')
                    .setDescription('The sort mode of the ratings list')
                    .setRequired(false)
                    .addChoices(
                        { name: 'By Rating Value', value: 'rating_value' },
                        { name: 'By Number of Ratings', value: 'rating_num' },
                    ))),
    help_desc: `Pulls up all data relating to a song or remix in Waveform, such as all reviews, rating averages, last.fm play counts and more.\n\n` +
    `You can view a summary view of all data relating to a song globally by using the \`global\` subcommand, or view a list of all local server reviews using the \`server\` subcommand.\n\n` +
    `The remixers argument should have the remixer specified if you are trying to pull up a remix, the remixer should be put in the song_name or artists arguments.\n\n` +
    `You can view specific play counts for the song using the \`plays\` argument, with the options being None (no play count data shown), \`User Plays\` (only your play count), \`Reviewer Plays\` (only play count of reviewers), or \`Server Plays\` (play count of everyone in the server)\n` +
    `The default play count view is \`Reviewer Plays\`. \`Server Plays\` will make the command take a little bit longer to run.\n\n` +
    `Leaving the artist, song_name, and remixers arguments blank will pull from your spotify playback to fill in the arguments (if you are logged into Waveform with Spotify)`,
	async execute(interaction, client, serverConfig, otherCmdArtists = false, otherCmdSongName = false) {
        try {
        if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
        await interaction.editReply('Loading song data...');
        let subcommand = 'server';
        let sortMode = interaction.options.getString('sort_mode');
        if (sortMode == null) sortMode = 'rating_value';
        let artists = interaction.options.getString('artist');
        let song = interaction.options.getString('song_name');
        let lfmApi = await lfm_api_setup(interaction.user.id);
        let lfmUsers = await getLfmUsers(interaction);
        let lfmScrobbleSetting = interaction.options.getString('plays');
        if (lfmScrobbleSetting == 'none') lfmApi = false;
        let lfmUserScrobbles = {};

        if (interaction.commandName != 'nowplaying' && interaction.commandName != 'randomsong' && interaction.commandName != 'whoknows') { 
            subcommand = interaction.options.getSubcommand();
            if (serverConfig.disable_global && subcommand == 'global') return interaction.editReply('Global subcommands are unavailable when external reviews are disabled. Please contact your server admins for more info.');
        } else {
            artists = otherCmdArtists.join(' & ');
            song = otherCmdSongName;
            lfmScrobbleSetting = 'reviewers';
        }
        
        let remixers = interaction.options.getString('remixers');
        let song_info = await parse_artist_song_data(interaction, artists, song, remixers);
        if (song_info.error != undefined) {
            interaction.editReply(song_info.error);
            return;
        }

        let origArtistArray = song_info.prod_artists;
        let lfmPrimArtist = origArtistArray[0];
        let songName = song_info.song_name;
        let setterSongName = convertToSetterName(songName);
        let artistArray = song_info.db_artists;
        let displaySongName = song_info.display_song_name;

        let songObj;
        let songEP = false;
        let remixArray;
        let remixes = [];
        let starCount = 0;
        const guild = client.guilds.cache.get(interaction.guild.id);
        let res = await guild.members.fetch();
        let guildUsers = [...res.keys()];

        // Check last.fm info
        if (lfmScrobbleSetting == null && subcommand == 'server') lfmScrobbleSetting = 'reviewers';
        let lfmScrobbles = false;
        let lfmServerScrobbles = false;
        if (lfmScrobbleSetting != null && lfmApi != false) {
            let lfmUsername = db.user_stats.get(interaction.user.id, 'lfm_username');
            let lfmTrackData = await lfmApi.track_getInfo({ artist: origArtistArray[0].replace('\\&', '&'), track: songName, username: lfmUsername });
            if (lfmTrackData.success == false) {
                for (let artist of origArtistArray) {
                    lfmTrackData = await lfmApi.track_getInfo({ artist: artist.replace('\\&', '&'), track: songName, username: lfmUsername });
                    if (lfmTrackData.success) {
                        lfmPrimArtist = artist;
                        break;
                    }
                }
            }

            if (lfmTrackData.success) {
                lfmScrobbles = lfmTrackData.userplaycount;
                if (lfmScrobbleSetting != null && lfmScrobbleSetting != 'user') lfmUserScrobbles[interaction.user.id] = { user_id: interaction.user.id, lfm_username: lfmUsername, scrobbles: lfmScrobbles };
            }
        }

        // See if we have any VIPs
        let artistSongs = Object.keys(db.reviewDB.get(artistArray[0]));
        artistSongs = artistSongs.map(v => v = v.replace('_((', '[').replace('))_', ']'));
        let songVIP = false;
        for (let s of artistSongs) {
            if (s.includes('VIP') && s.includes(songName) && s != songName) songVIP = s;
        }

        songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);
        if (songObj == undefined) { return interaction.editReply(`The requested song \`${origArtistArray.join(' & ')} - ${songName}\` does not exist.` + 
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
            userArray = await get_user_reviews(songObj, serverConfig.disable_global, guild, guildUsers);
        } else {
            userArray = await get_user_reviews(songObj, serverConfig.disable_global, guild);
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
                let reviewObj = songObj[userArray[i]];
                
                rating = reviewObj.rating;
                if (serverConfig.disable_ratings) rating = false;
                if (reviewObj.starred == true) {
                    starCount++;
                    starred = true;
                }

                if (rating === false) {
                    ratingDisplay = '';
                    rating = -100 - i; // To put it on the bottom of the rating list.
                } else {
                    rankNumArray.push(parseFloat(rating)); 
                    ratingDisplay = `\`${rating}/10\``;
                }

                if (starred == true) {
                    userArray[i] = [parseFloat(rating) + 1, `:star2: <@${userArray[i]}> ${ratingDisplay}`];
                    userIDList[i] = [parseFloat(rating) + 1, userIDList[i]];
                } else {
                    userArray[i] = [parseFloat(rating), `<@${userArray[i]}> ${ratingDisplay}`];
                    userIDList[i] = [parseFloat(rating), userIDList[i]];
                }
            }
        }

        // Server collection scrobbles
        if (lfmScrobbleSetting == 'reviewers' || lfmScrobbleSetting == 'server') {
            lfmServerScrobbles = 0;
            if (lfmApi == false) lfmApi = await lfm_api_setup(lfmUsers[0].user_id);

            let tempIDList = userIDList.map(v => v[1]);
            if (lfmScrobbleSetting == 'reviewers') lfmUsers = lfmUsers.filter(v => tempIDList.includes(v.user_id));
            for (let u of lfmUsers) {
                if (lfmApi == false) { 
                    lfmApi = await lfm_api_setup(u.user_id);
                    continue;
                }
                let lfmTrackData = await lfmApi.track_getInfo({ artist: lfmPrimArtist.replace('\\&', '&'), track: songName, username: u.lfm_username });
                if (!isNaN(parseInt(lfmTrackData.userplaycount))) {
                    lfmServerScrobbles += parseInt(lfmTrackData.userplaycount);
                    u.scrobbles = lfmTrackData.userplaycount;
                    lfmUserScrobbles[u.user_id] = u;
                }
            }
        }

        if (rankNumArray.length != 0) {
            if (subcommand == 'server') {
                songEmbed.setDescription(`${lfmScrobbles !== false ? `*You have* ***${lfmScrobbles}*** *plays on this song!*` : ``}` +
                `${lfmServerScrobbles !== false ? `\n${lfmScrobbleSetting == 'reviewers' ? `*Reviewers overall have*` : `*This server has*`} ***${lfmServerScrobbles}*** *plays on this song!*` : ``}` +
                `\n*The average rating of this song is* ***${Math.round(average(rankNumArray) * 10) / 10}!***` + 
                `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} favorite${starCount == 1 ? '' : 's'}!** :star2:`)}` + 
                `${songObj.spotify_uri == false || songObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/track/${songObj.spotify_uri.replace('spotify:track:', '')})`}`);
            } else {
                songEmbed.setDescription(`The average rating of this song globally is **${Math.round(average(rankNumArray) * 10) / 10}!**` + 
                `\nThis song has **${rankNumArray.length}** ratings.` +
                `${(starCount == 0 ? `` : `\n:star2: **This song has ${starCount} favorite${starCount == 1 ? '' : 's'} globally!** :star2:`)}` + 
                `${songObj.spotify_uri == false || songObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/track/${songObj.spotify_uri.replace('spotify:track:', '')})`}`);
            }        
        } else {
            if (songObj.spotify_uri != false && songObj.spotify_uri != undefined) {
                songEmbed.setDescription(`\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/track/${songObj.spotify_uri.replace('spotify:track:', '')})`);
            }
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

        if (userArray.length != 0) {
            userArray = sort(userArray);
            userIDList = sort(userIDList);
        } else {
            songEmbed.addFields([{ name: 'Reviews:', value: 'No reviews :(' }]);
        }

        if (subcommand != 'global') {
            for (let i = 0; i < userArray.length; i++) {
                userArray[i] = `**${i + 1}.** `.concat(userArray[i]);
                if ((lfmUserScrobbles[userIDList[i]]) != undefined) {
                    userArray[i] += ` \`${lfmUserScrobbles[userIDList[i]].scrobbles} plays\``;
                }
            }
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

            let rating = db.reviewDB.get(artistArray[0], `${setterSongName}.${userID}.rating`);
            if (serverConfig.disable_ratings) rating = false;
            let selDesc = rating != false && rating != -1 ? `Rating: ${rating}/10` : ``;
            if ((lfmUserScrobbles[userID]) != undefined) {
                selDesc += ` • ${lfmUserScrobbles[userID].scrobbles} plays`;
            }

            select_options.push({
                label: `${selDisplayName}`,
                description: selDesc,
                value: `${userID}`,
            });
            if (db.reviewDB.get(artistArray[0], `${setterSongName}.${userID}.starred`) == true) {
                select_options[select_options.length - 1].emoji = '🌟';
            }

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
        
        let components = subcommand == 'global' ? [] : [sel_row];
        
        if (subcommand == 'server') {
            if (userArray.length != 0) songEmbed.addFields([{ name: 'Reviews:', value: paged_user_list[0].join('\n') }]);
        } else {
            if (rankNumArray.length != 0) {
                let ratingList = rankNumArray.reduce(function(acc, curr) {
                    return acc[curr] ? ++acc[curr] : acc[curr] = 1, acc;
                }, {});

                ratingList = Object.entries(ratingList);

                if (sortMode == 'rating_num') {
                    // Get songs into groups based on number of ratings
                    const groupedArray = ratingList.reduce((groups, subarray) => {
                        const [, groupKey] = subarray; // Get the second value of the subarray
                        if (!groups[groupKey]) {
                            groups[groupKey] = []; // Initialize the group if it doesn't exist
                        }
                        groups[groupKey].push(subarray); // Push the subarray to the corresponding group
                        return groups;
                    }, {});
                    
                    ratingList = Object.values(groupedArray); // Convert the object of groups into an array of arrays
                    for (let i = 0; i < ratingList.length; i++) {
                        ratingList[i] = ratingList[i].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
                    }
                    ratingList = ratingList.flat(1);

                    ratingList = ratingList.sort((a, b) => b[1] - a[1]);
                } else if (sortMode == 'rating_value') {
                    ratingList = ratingList.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
                }
                ratingList = ratingList.map(v => `**${v[0]}:** \`${v[1]}\``);
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

        if (subcommand == 'server') {
            if (paged_user_list.length > 1) components.push(btn_row);
        }
        
        if (interaction.commandName == 'randomsong') {
            // Setup back button for random song
            let backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('random_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Danger),
            );
            components.push(backButton);
        }
        
        await interaction.editReply({ content: null, embeds: [songEmbed], components: components });
        let message = await interaction.fetchReply();
        let noIdleReset = false;

        if (subcommand == 'server') {
            const collector = message.createMessageComponentCollector({ idle: 120000 });
            collector.on('collect', async i => {
                if (i.customId == 'select') { // Select Menu

                    if (i.values[0] == 'back') { // Back Selection
                        return await i.update({ content: null, embeds: [songEmbed], components: components });
                    }

                    // Last.fm
                    lfmApi = await lfm_api_setup(i.values[0]);
                    lfmScrobbles = false;

                    if (lfmApi != false) {
                        let lfmUsername = db.user_stats.get(i.values[0], 'lfm_username');
                        let lfmTrackData = await lfmApi.track_getInfo({ artist: lfmPrimArtist.replace('\\&', '&'), track: songName, username: lfmUsername });
                        if (lfmTrackData.success) lfmScrobbles = lfmTrackData.userplaycount;
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
                    if (serverConfig.disable_ratings) rating = false;
                    let sentby = songObj[i.values[0]].sentby;
                    let sentByMember = false;
                    let url = songObj[i.values[0]].url;
                    let isMailbox = false;
                    
                    // If we don't have a single review link, we can check for an EP/LP review link
                    if (url == false && (songEP != false && songEP != undefined)) {
                        if (songEPObj[`${interaction.user.id}`] != undefined) {
                            if (songEPObj[`${interaction.user.id}`].url != false) {
                                url = songEPObj[`${interaction.user.id}`].url;
                            }
                        }
                    }

                    if (sentby != false && taggedUser != undefined) {
                        isMailbox = true;
                        sentby = await client.users.fetch(sentby);
                        sentByMember = await interaction.guild.members.cache.get(sentby.id);  
                        if (sentByMember == undefined) sentby = false;
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

                    if (isMailbox == true) {
                        if (sentby != false) {
                            reviewEmbed.setFooter({ text: `Sent by ${sentByMember.displayName}${lfmScrobbles !== false ? ` • Plays: ${lfmScrobbles}` : ``}`, iconURL: sentby.avatarURL({ extension: 'png' }) });
                        } else {
                            reviewEmbed.setFooter({ text: `📬 Sent by a user outside of this server${lfmScrobbles !== false ? ` • Plays: ${lfmScrobbles}` : ``}` });
                        }
                    } else if (songEP != undefined && songEP != false) {
                        reviewEmbed.setFooter({ text: `from ${songEP}${lfmScrobbles !== false ? ` • Plays: ${lfmScrobbles}` : ``}`, iconURL: db.reviewDB.get(artistArray[0], `${setterSongEP}.art`) });
                    } else if (lfmScrobbles !== false) {
                        reviewEmbed.setFooter({ text: `Plays: ${lfmScrobbles}` });
                    }

                    let reviewMsgID = songObj[i.values[0]][`msg_id`];
                    let timestamp = songObj[i.values[0]][`timestamp`];
                    if (reviewMsgID != false && reviewMsgID != undefined && timestamp == undefined) {
                        let channelsearch = await get_review_channel(client, songObj[i.values[0]].guild_id, songObj[i.values[0]].channel_id, reviewMsgID);
                        if (channelsearch != undefined) {
                            await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                                reviewEmbed.setTimestamp(msg.createdTimestamp);
                            });
                        }
                    } else if (timestamp != undefined) {
                        reviewEmbed.setTimestamp(timestamp);
                    }

                    if (url == undefined || url == false) {
                        await i.update({ content: null, embeds: [reviewEmbed], components: components });
                    } else {
                        await i.update({ content: `[View Review Message](${url})`, embeds: [reviewEmbed], components: components });
                    }

                } else if (i.customId == 'left' || i.customId == 'right') {
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

                    components = [sel_row, btn_row];

                    i.update({ embeds: [songEmbed], components: components });
                } else if (i.customId == 'random_back') {
                    i.update({ components: [] });
                    let command = client.commands.get('randomsong');
                    await command.execute(interaction, client);
                    noIdleReset = true;
                    await collector.stop();
                }
            });

            collector.on('end', async () => {
                if (noIdleReset == false) {
                    interaction.editReply({ content: ` `, embeds: [songEmbed], components: [] });
                }
            });
        }

        } catch (err) {
            let error = err;
            console.log(err);
            handle_error(interaction, client, error);
        }
	},
};
