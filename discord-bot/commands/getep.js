const db = require("../db.js");
const { average, get_user_reviews, handle_error, get_review_channel, parse_artist_song_data, sort, getEmbedColor, convertToSetterName, lfm_api_setup, getLfmUsers } = require('../func.js');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder, Embed, ButtonBuilder, ButtonStyle } = require('discord.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getep')
        .setDescription('Get data about an EP/LP.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('server')
            .setDescription('Get data specific to the server about an EP/LP')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))

            .addStringOption(option => 
                option.setName('ep_name')
                    .setDescription('The name of the EP.')
                    .setAutocomplete(true)
                    .setRequired(false))

            .addStringOption(option =>
                option.setName('scrobbles')
                    .setDescription('Set what scrobble data to view. (defaults to Reviewer Scrobbles)')
                    .setRequired(false)
                    .addChoices(
                        { name: 'None', value: 'none' },
                        { name: 'User Scrobbles', value: 'user' },
                        { name: 'Reviewer Scrobbles', value: 'reviewers' },
                        { name: 'Server Scrobbles', value: 'server' },
                    )))

        .addSubcommand(subcommand =>
            subcommand.setName('global')
            .setDescription('Get data specific across the whole bot about an EP/LP.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s).')
                    .setAutocomplete(true)
                    .setRequired(false))
    
            .addStringOption(option => 
                option.setName('ep_name')
                    .setDescription('The name of the EP.')
                    .setAutocomplete(true)
                    .setRequired(false))),
    help_desc: `Pulls up all data relating to an EP/LP in Waveform, such as all reviews, rating averages, and more.\n\n` +
    `You can view a summary view of all data relating to an EP/LP globally by using the \`server\` subcommand, or view a list of all local server reviews using the \`server\` subcommand.\n\n` +
    `You can also view individual server users EP/LP review with the drop down menu.\n\n` +
    `Leaving the artist and ep_name arguments blank will pull from your spotify playback to fill in the arguments (if you are logged into Waveform with Spotify)`,
	async execute(interaction, client, serverConfig) {
        try {

            let subcommand = interaction.options.getSubcommand();
            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('ep_name');
            let song_info = await parse_artist_song_data(interaction, artists, ep);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                return;
            }

            let origArtistArray = song_info.prod_artists;
            let epName = song_info.song_name;
            let setterEpName = convertToSetterName(epName);
            let artistArray = song_info.db_artists;
            let epType = epName.includes(' LP') ? `LP` : `EP`;
            let lfmApi = await lfm_api_setup(interaction.user.id);
            let lfmUsers = getLfmUsers();
            let lfmScrobbleSetting = interaction.options.getString('scrobbles');
            if (lfmScrobbleSetting == 'none') lfmApi = false;
            let lfmUserScrobbles = {};
            let lfmPrimArtist = origArtistArray[0];

            let epObj = db.reviewDB.get(artistArray[0], `${setterEpName}`);
            if (epObj == undefined) {
                return interaction.reply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` was not found in the database.`);
            }

            let ep_art = epObj.art;
            if (ep_art == undefined || ep_art == false) {
                ep_art = interaction.user.avatarURL({ extension: "png", dynamic: true });
            }

            let rankNumArray = [];
            let epRankArray = [];
            let songRankArray = [];
            let rating;
            let epSongArray = epObj.songs == undefined ? [] : epObj.songs;
            const guild = client.guilds.cache.get(interaction.guild.id);
            let res = await guild.members.fetch();
            let guildUsers = [...res.keys()];

            const epEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setTitle(`${origArtistArray} - ${epName}`)
                .setThumbnail(ep_art);

            let reviewNum;
            // Get all users if global, otherwise get only guild specific users if server.
            if (subcommand == 'server') {
                reviewNum = await get_user_reviews(epObj, guildUsers);
            } else {
                reviewNum = await get_user_reviews(epObj);
            }
            let userArray = reviewNum.slice(0);
            let userIDList = userArray.slice(0);
            let epnum = 0;
            let starCount = 0;

            for (let i = 0; i < reviewNum.length; i++) {
                let userObj = epObj[reviewNum[i]];
                if (userObj.rating == -1) userObj.rating = false;

                if (serverConfig.disable_ratings === true) {
                    userObj.rating = false;
                }

                let ratingDisplay = `${(userObj.rating !== false) ? ` \`${userObj.rating}/10\`` : ``}`;

                if (userObj.rating !== false && userObj.rating !== undefined && !isNaN(userObj.rating)) {
                    epRankArray.push(userObj.rating);
                } else {
                    userObj.rating = -1;
                }

                if (userObj.starred == true) {
                    starCount++;
                    userArray[i] = [parseFloat(userObj.rating) + 1, `:star2: <@${userArray[i]}> ${ratingDisplay}`];
                    userIDList[i] = [parseFloat(userObj.rating) + 1, userIDList[i]];
                } else {
                    userArray[i] = [parseFloat(userObj.rating), `<@${userArray[i]}> ${ratingDisplay}`];
                    userIDList[i] = [parseFloat(userObj.rating), userIDList[i]];
                }
            }

             // Check last.fm info
            if (lfmScrobbleSetting == null && subcommand == 'server') lfmScrobbleSetting = 'reviewers';
            let lfmScrobbles = false;
            let lfmServerScrobbles = false;
            if (lfmScrobbleSetting != null && lfmApi != false) {
                let lfmUsername = db.user_stats.get(interaction.user.id, 'lfm_username');
                let lfmTrackData = await lfmApi.album_getInfo({ artist: origArtistArray[0], album: epName.replace(' EP', '').replace(' LP', ''), username: lfmUsername });
                if (lfmTrackData.success == false) {
                    for (let artist of origArtistArray) {
                        lfmTrackData = await lfmApi.album_getInfo({ artist: artist, album: epName.replace(' EP', '').replace(' LP', ''), username: lfmUsername });
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
            
            for (let i = 0; i < epSongArray.length; i++) {
                let songArtist = artistArray[0];
                if (epSongArray[i].includes(' Remix)')) songArtist = epSongArray[i].split(' Remix)')[0].split('(').splice(1);
                let songObj = db.reviewDB.get(songArtist)[epSongArray[i]];
                epnum++;

                // Get all users if global, otherwise get only guild specific users if server.
                if (subcommand == 'server') {
                    reviewNum = await get_user_reviews(songObj, guildUsers);
                } else {
                    reviewNum = await get_user_reviews(songObj);
                }

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

                if (serverConfig.disable_ratings === true) {
                    rankNumArray = [];
                }

                reviewNum = reviewNum.length;
                await epEmbed.addFields([{ name: `${epnum}. ${epSongArray[i]}${(rankNumArray.length != 0) ? ` (Avg: ${Math.round(average(rankNumArray) * 10) / 10})` : ``}`,
                    value: `\`${reviewNum} review${reviewNum > 1 ? 's' : ''}\` ${star_num > 0 ? `\`${star_num} 🌟\`` : ''}` }]);

                if (rankNumArray.length != 0) songRankArray.push(Math.round(average(rankNumArray) * 10) / 10);
            }

            // Server collection scrobbles
            if (lfmScrobbleSetting == 'reviewers' || lfmScrobbleSetting == 'server') {
                lfmServerScrobbles = lfmScrobbles === false ? 0 : parseInt(lfmScrobbles);
                if (lfmApi == false) lfmApi = await lfm_api_setup(lfmUsers[0].user_id);

                let tempIDList = userIDList.map(v => v[1]);
                if (lfmScrobbleSetting == 'reviewers') lfmUsers = lfmUsers.filter(v => tempIDList.includes(v.user_id) && v.user_id != interaction.user.id);
                for (let u of lfmUsers) {
                    if (lfmApi == false) { 
                        lfmApi = await lfm_api_setup(u.user_id);
                        continue;
                    }
                    let lfmTrackData = await lfmApi.album_getInfo({ artist: lfmPrimArtist, album: epName.replace(' EP', '').replace(' LP', ''), username: u.lfm_username });
                    lfmServerScrobbles += parseInt(lfmTrackData.userplaycount);
                    u.scrobbles = lfmTrackData.userplaycount;
                    lfmUserScrobbles[u.user_id] = u;
                }
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

            if (subcommand != 'global') {
                for (let i = 0; i < userArray.length; i++) {
                    if ((lfmUserScrobbles[userIDList[i]]) != undefined) {
                        userArray[i] += ` \`${lfmUserScrobbles[userIDList[i]].scrobbles} scrobbles\``;
                    }
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

                let selRating = db.reviewDB.get(artistArray[0], `${setterEpName}.${userID}.rating`);
                
                if (serverConfig.disable_ratings === true) {
                    selRating = false;
                }

                select_options.push({
                    label: `${selDisplayName}`,
                    description: selRating != false && selRating != -1 ? `Overall Rating: ${selRating}/10` : `No Overall Rating`,
                    value: `${userID}`,
                });

                if (db.reviewDB.get(artistArray[0], `${setterEpName}.${userID}.starred`) == true) {
                    select_options[select_options.length - 1].emoji = '🌟';
                }
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

            if (serverConfig.disable_ratings === true) {
                epRankArray = [];
                songRankArray = [];
            }

            // If there are ratings of the entire EP/LP overall
            if (epRankArray.length != 0) {
                // If there are songs attached to the EP/LP
                if (songRankArray.length != 0) {
                    if (subcommand == 'server') {
                        epEmbed.setDescription(`${lfmScrobbles !== false ? `*You have* ***${lfmScrobbles}*** *scrobbles on this ${epType}!*` : ``}` +
                        `${lfmServerScrobbles !== false ? `\n${lfmScrobbleSetting == 'reviewers' ? `*Reviewers overall have*` : `*This server has*`} ***${lfmServerScrobbles}*** *scrobbles on this ${epType}!*` : ``}` +
                        `\n*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***` + 
                        `\n*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` +
                        `${(starCount == 0 ? `` : `\n:star2: **This ${epType} has ${starCount} favorite${starCount == 1 ? '' : 's'}!** :star2:`)}` +
                        `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                        `\n${paged_user_list[0].join('\n')}`);
                    } else {
                        epEmbed.setDescription(`The average overall user rating of this ${epType} is **${Math.round(average(epRankArray) * 10) / 10}!**` + 
                        `\nThe total average rating of all songs on this ${epType} is **${Math.round(average(songRankArray) * 10) / 10}!**` +
                        `\nThis ${epType} has **${epRankArray.length}** ratings.` +
                        `${(starCount == 0 ? `` : `\n:star2: **This ${epType} has ${starCount} favorite${starCount == 1 ? '' : 's'} globally!** :star2:`)}` +
                        `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}`);
                    }
                } else {
                    epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***` +
                    `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                    `\n${paged_user_list[0].join('\n')}`);
                }
            // If there are no ratings of the entire EP/LP overall
            } else {
                // If there are songs attached to the EP/LP
                if (songRankArray.length != 0) {
                    if (subcommand == 'server') {
                        epEmbed.setDescription(`*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                        `${(starCount == 0 ? `` : `\n:star2: **This ${epType} has ${starCount} favorite${starCount == 1 ? '' : 's'}!** :star2:`)}` +
                        `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                        `\n${paged_user_list[0].join('\n')}`);
                    } else {
                        epEmbed.setDescription(`The total average rating of all songs on this ${epType} is **${Math.round(average(songRankArray) * 10) / 10}!**` +
                        `\nThis ${epType} has **${epRankArray.length}** ratings.` +
                        `${(starCount == 0 ? `` : `\n:star2: **This ${epType} has ${starCount} favorite${starCount == 1 ? '' : 's'} globally!** :star2:`)}` +
                        `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}`);
                    }
                } else {
                    epEmbed.setDescription(`${lfmScrobbles !== false ? `*You have* ***${lfmScrobbles}*** *scrobbles on this ${epType}!*` : ``}` +
                    `${lfmServerScrobbles !== false ? `\n${lfmScrobbleSetting == 'reviewers' ? `*Reviewers overall have*` : `*This server has*`} ***${lfmServerScrobbles}*** *scrobbles on this ${epType}!*` : ``}` +
                    `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                    `\n${paged_user_list[page_num].join('\n')}`);
                }
            }

            if (paged_user_list > 1) {
                epEmbed.setFooter({ text: `Page ${page_num + 1} / ${paged_user_list.length}` });
            }

            let components = [];
            if (subcommand == 'server') {
                components = paged_user_list.length > 1 ? [sel_row, btn_row] : [sel_row];
            }
            
            interaction.reply({ embeds: [epEmbed], components: components });
            let message = await interaction.fetchReply();
        
            if (subcommand == 'server') {
                const collector = message.createMessageComponentCollector({ idle: 120000 });
                collector.on('collect', async i => {
                    if (i.customId == 'select') {
                        if (i.values[0] == 'back') { // Back Selection
                            return await i.update({ content: null, embeds: [epEmbed], components: components });
                        }

                        let taggedUser, taggedMember, displayName;
                        taggedMember = await interaction.guild.members.fetch(i.values[0]).catch(() => {
                            taggedMember = undefined;
                        });
                        taggedUser = await client.users.fetch(i.values[0]);

                        // Last.fm
                        lfmApi = await lfm_api_setup(taggedUser.id);
                        lfmScrobbles = false;

                        if (taggedMember == undefined) {
                            displayName = taggedUser.username;
                        } else {
                            displayName = taggedMember.displayName;
                        }

                        let epReviewObj = epObj[taggedUser.id];

                        let ep_url = epReviewObj.url;
                        let ep_overall_rating = epReviewObj.rating;
                        if (ep_overall_rating == -1) ep_overall_rating = false;
                        let ep_overall_review = epReviewObj.review;
                        let no_songs_review = epReviewObj.no_songs;
                        let incomplete_review = false;
                        let ep_sent_by = epReviewObj.sentby;
                        if (no_songs_review == undefined) no_songs_review = false; // Undefined handling for EP/LP reviews without this
                        let ep_starred = epReviewObj.starred;
                        if (ep_starred == undefined) ep_starred = false;
                        let rreview;
                        let rscore;
                        let rstarred;

                        if (ep_sent_by != undefined && ep_sent_by != false && taggedMember != undefined) {
                            ep_sent_by = await client.users.fetch(ep_sent_by);
                        }

                        // Check last.fm
                        if (lfmApi != false) {
                            let lfmUsername = db.user_stats.get(taggedUser.id, 'lfm_username');
                            let lfmAlbumData = await lfmApi.album_getInfo({ artist: origArtistArray[0], album: epName.replace(' LP', '').replace(' EP', ''), username: lfmUsername });
                            if (lfmAlbumData.success == false) {
                                lfmAlbumData = await lfmApi.album_getInfo({ artist: origArtistArray[0], album: epName, username: lfmUsername });
                                lfmScrobbles = lfmAlbumData.userplaycount;
                            } else {
                                lfmScrobbles = lfmAlbumData.userplaycount;
                            }
                            if (lfmScrobbles == undefined) lfmScrobbles = false;
                        }

                        const epReviewEmbed = new EmbedBuilder();
                        if (epSongArray.length != 0) {
                            for (let epSong of epSongArray) {
                                let songArtist = artistArray[0];
                                if (epSong.includes(' Remix)')) songArtist = epSong.split(' Remix)')[0].split('(').splice(1);
                                let songName = epSong;
                                let setterSongName = convertToSetterName(songName);
                                let artistsEmbed = [];
                                let songObj = db.reviewDB.get(songArtist, `${setterSongName}`);
                                let songReviewObj = songObj[taggedUser.id];
                                if (songReviewObj == undefined) {
                                    no_songs_review = true;
                                    incomplete_review = true;
                                }

                                if (no_songs_review == false) {
                                    rreview = songReviewObj.review;
                                    if (rreview.length > 1000) rreview = '*Review hidden to save space*';
                                    rscore = songReviewObj.rating;
                                    rstarred = songReviewObj.starred;
                                }

                                if (serverConfig.disable_ratings === true) {
                                    rscore = false;
                                }
                
                                // This is for adding in collaborators into the name inputted into the embed title, NOT for getting data out.
                                if (songObj.collab != undefined && !epSong.includes(' Remix)')) {
                                    if (songObj.collab.length != 0) {
                                        artistsEmbed = [];
                                        artistsEmbed.push(songObj.collab);
                                        artistsEmbed = artistsEmbed.flat(1);
                                        artistsEmbed = artistsEmbed.join(' & ');
                                    }
                                }

                                if (no_songs_review == false) {
                                    if (new Embed(epReviewEmbed.toJSON()).length < 5250) {
                                        epReviewEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                                        `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                                        `${rscore !== false ? `(${rscore}/10)` : ``}`, 
                                        value: `${rreview == false ? `*No review written*` : `${rreview}`}` }]);
                                    } else {
                                        epReviewEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                                        `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                                        `${rscore !== false ? `(${rscore}/10)` : ``}`, 
                                        value: `${rreview == false ? `*No review written*` : `*Review hidden to save space*`}` }]);
                                    }
                                }
                                
                            }
                        }
                        
                        if (taggedMember != undefined) {
                            epReviewEmbed.setColor(`${getEmbedColor(taggedMember)}`);
                        }

                        if (no_songs_review == true) {
                            epReviewEmbed.setFields([]);
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

                        if (incomplete_review == true) {
                            epReviewEmbed.setDescription(`This ${epType} review was manually finished before all songs were reviewed, so there is no review.`);
                        }

                        epReviewEmbed.setAuthor({ name: `${displayName}'s ${epType} review`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: true })}` });

                        epReviewEmbed.setThumbnail(ep_art);
                        let sentbyDisplayName;
                        if (ep_sent_by != false && ep_sent_by != undefined) {
                            let sentByMember;
                            sentByMember = await interaction.guild.members.fetch(epReviewObj.sentby).catch(sentByMember = undefined);
                            if (sentByMember == undefined) {
                                sentbyDisplayName = ep_sent_by.username;
                            } else {
                                sentbyDisplayName = sentByMember.displayName;
                            }
                            epReviewEmbed.setFooter({ text: `Sent by ${sentbyDisplayName}${lfmScrobbles !== false ? ` • Scrobbles: ${lfmScrobbles}` : ``}`, iconURL: `${ep_sent_by.avatarURL({ extension: "png" })}` });
                        } else if (lfmScrobbles !== false) {
                            epReviewEmbed.setFooter({ text: `Scrobbles: ${lfmScrobbles}` });
                        }

                        let reviewMsgID = epReviewObj.msg_id;
                        let timestamp = epReviewObj.timestamp;
                        if (reviewMsgID != false && reviewMsgID != undefined && timestamp == undefined) {
                            let channelsearch = await get_review_channel(client, epReviewObj.guild_id, epReviewObj.channel_id, reviewMsgID);
                            if (channelsearch != undefined) {
                                await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                                    epReviewEmbed.setTimestamp(msg.createdTimestamp);
                                });
                            }
                        } else if (timestamp != undefined) {
                            epReviewEmbed.setTimestamp(timestamp);
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
                                `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                                `\n${paged_user_list[page_num].join('\n')}`);
                            } else {
                                epEmbed.setDescription(`*The average overall user rating of this ${epType} is* ***${Math.round(average(epRankArray) * 10) / 10}!***` +
                                `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}`);
                            }
                        } else {
                            if (songRankArray.length != 0) {
                                epEmbed.setDescription(`*The total average rating of all songs on this ${epType} is* ***${Math.round(average(songRankArray) * 10) / 10}!***` + 
                                `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                                `\n${paged_user_list[page_num].join('\n')}`);
                            } else {
                                epEmbed.setDescription(`This ${epType} has no songs in the database.` +
                                `${epObj.spotify_uri == false || epObj.spotify_uri == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](https://open.spotify.com/album/${epObj.spotify_uri.replace('spotify:album:', '')})`}` +
                                `\n${paged_user_list[page_num].join('\n')}`);
                            }
                        }

                        components = [sel_row, btn_row];
        
                        i.update({ embeds: [epEmbed], components: components });
                    }
                });

                collector.on('end', async () => {
                    try {
                        await interaction.editReply({ embeds: [epEmbed], components: [] });
                    } catch (err) {
                        console.log(err);
                    }
                });
            }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};