const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, SlashCommandBuilder, ButtonStyle } = require('discord.js');
const db = require("../db.js");
const { average, get_user_reviews, sort, removeItemOnce, handle_error, spotify_api_setup, getEmbedColor, convertToSetterName } = require('../func.js');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getartist')
        .setDescription('Get all the songs/EPs/LPs/remixes from an artist.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand.setName('server')
            .setDescription('Get data specific to the server about an artist.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s). (Leave empty to use spotify playback)')
                    .setAutocomplete(true)
                    .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('global')
            .setDescription('Get data specific across the whole bot about an artist.')
            .addStringOption(option => 
                option.setName('artist')
                    .setDescription('The name of the artist(s). (Leave empty to use spotify playback)')
                    .setAutocomplete(true)
                    .setRequired(false))),
    help_desc: `Displays all songs, EPs/LPs, Remixes, and other information regarding an artist in Waveform.\n\n` +
    `You can view a summary view of all data relating to an artist globally by using the \`global\` subcommand, or view data locally using the \`server\` subcommand.\n\n` +
    `Leaving the artist argument blank will pull from your spotify playback to fill in the argument (if logged in to Waveform with Spotify)`,
	async execute(interaction, client) {
        try {
            let spotifyCheck;
            let subcommand = interaction.options.getSubcommand();
            let artist = interaction.options.getString('artist');
            
            // Spotify Check
            if (artist == null) {
                const spotifyApi = await spotify_api_setup(interaction.user.id);
                if (spotifyApi == false) return interaction.reply(`This subcommand requires you to use \`/login\` `);

                await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                    if (data.body.currently_playing_type == 'episode') { spotifyCheck = false; return; }
                    artist = data.body.item.artists.map(a => a.name.replace(' & ', ' \\& '))[0];
                    spotifyCheck = true;
                });
            }

            if (spotifyCheck == false) {
                return interaction.reply('Spotify playback not detected, please type in the artist name manually or play a song!');
            }

            const artistObj = db.reviewDB.get(artist);
            if (artistObj == undefined) return interaction.reply(`\`${artist}\` not found in the database.`);
            let artistImage = artistObj.pfp_image;
            let songArray = Object.keys(artistObj);
            songArray = songArray.map(v => v = v.replace('_((', '[').replace('))_', ']'));
            songArray = songArray.filter(item => item !== 'pfp_image');
            songArray = songArray.filter(item => item !== 'Image');
            let epKeyArray = songArray.filter(item => item.includes(' LP') || item.includes(' EP'));
            songArray = songArray.filter(item => !item.includes(' LP') && !item.includes(' EP'));

            const guild = client.guilds.cache.get(interaction.guild.id);
            let res = await guild.members.fetch();
            let guildUsers = [...res.keys()];

            let localReviewNum;
            let globalReviewNum;
            let singleArray = [];
            let pagedSingleArray = [];
            let remixArray = [];
            let pagedRemixArray = [];
            let epArray = [];
            let pagedEpArray = [];

            let localRankNumArray = [];
            let globalRankNumArray = [];
            let starNum = 0; // Total number of individual song stars for each song
            let fullStarNum = 0; // Total number of stars
            let star_check = [];
            let focusedArray = pagedSingleArray;
            let page_num = 0;
            let pages_active = [false, false, false]; // 0: Singles, 1: EP/LPs, 2: Remixes
            let focusedName = "Singles";

            // Setup buttons
            const type_buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('singles')
                    .setLabel('View Singles')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ep')
                    .setLabel('View EP/LPs')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('remixes')
                    .setLabel('View Remixes')
                    .setStyle(ButtonStyle.Secondary),
            );

            // Setup bottom row
            const page_arrows = new ActionRowBuilder()
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

            const artistEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setTitle(`${artist}'s reviewed tracks`);
                if (artistImage != false && artistImage != undefined) {
                    artistEmbed.setThumbnail(artistImage);
                }

                // Handle EP/LP songs
                for (let i = 0; i < epKeyArray.length; i++) {
                    let setterEpSong = epKeyArray[i].replace('[', '_((').replace(']', '))_');
                    let epCollabArray = artistObj[setterEpSong].collab;
                    if (epCollabArray == undefined || epCollabArray == false) epCollabArray = [];
                    let epStarNum = 0;
                    let epReviewNum = Object.keys(artistObj[setterEpSong]);

                    epReviewNum = epReviewNum.filter(x => x != 'art');
                    epReviewNum = epReviewNum.filter(x => x != 'collab');
                    epReviewNum = epReviewNum.filter(x => x != 'songs');
                    epReviewNum = epReviewNum.filter(x => x != 'tags');

                    for (let s = 0; s < epReviewNum.length; s++) {
                        if (artistObj[setterEpSong][epReviewNum[s]].starred == true) epStarNum += 1;
                    }

                    epReviewNum = epReviewNum.length;
                    let epDetails = `\`${epReviewNum} reviews\`${epStarNum > 0 ? ` \`${epStarNum} ⭐\`` : ``}`;

                    let epData = [`**${epKeyArray[i]}` + 
                    `${(epCollabArray.length != 0) ? ` (with ${epCollabArray.join(' & ')})` : ``} ${epDetails}**`];
                    let epSongs = artistObj[setterEpSong].songs;
                    if (epSongs == undefined) epSongs = [];

                    for (let ii = 0; ii < epSongs.length; ii++) {
                        let setterEpSongsII = convertToSetterName(epSongs[ii]);
                        starNum = 0;
                        let songObj = artistObj[epSongs[ii].replace('[', '_((').replace(']', '))_')];
                        if (epSongs[ii].includes(' Remix)')) songObj = db.reviewDB.get(epSongs[ii].split(' Remix)')[0].split('(').splice(1)[0], `${setterEpSongsII}`);
                        let localReviews, globalReviews;
                        // Get all users if global, otherwise get only guild specific users if server.
                        if (subcommand == 'server') {
                            localReviews = await get_user_reviews(songObj, guildUsers);
                            globalReviews = [];
                        } else {
                            globalReviews = await get_user_reviews(songObj);
                            localReviews = [];
                        }

                        localReviewNum = localReviews.length;
                        globalReviewNum = globalReviews.length;
                        
                        if (subcommand == 'global') {
                            for (let x = 0; x < globalReviews.length; x++) {
                                let rating = songObj[globalReviews[x]].rating;
                                let starred = songObj[globalReviews[x]].starred;
                                globalRankNumArray.push(parseFloat(rating));
                                if (starred == true) { 
                                    starNum++; 
                                    fullStarNum++;
                                    star_check.push(epSongs[ii]);
                                }
                            }
                        } else if (subcommand == 'local') {
                            for (let x = 0; x < localReviews.length; x++) {
                                let rating = songObj[localReviews[x]].rating;
                                let starred = songObj[localReviews[x]].starred;
                                localRankNumArray.push(parseFloat(rating));
                                if (starred == true) { 
                                    starNum++; 
                                    fullStarNum++;
                                    star_check.push(epSongs[ii]);
                                }
                            }
                        }

                        let songDetails;
                        let remixerKeys = songObj.remixers;
                        let collabArray = songObj.collab; // This also doubles as remixer original artists
                        if (epSongs[ii].includes(' Remix)')) collabArray = [];

                        let reviewNum, rankNumArray;
                        reviewNum = subcommand == 'global' ? globalReviewNum : localReviewNum;
                        rankNumArray = subcommand == 'global' ? globalRankNumArray : localRankNumArray;
                        console.log(reviewNum, rankNumArray);

                        if (remixerKeys.length > 0 && reviewNum != 0) {
                            songDetails = [`\`${rankNumArray.length != 0 ? `\`${Math.round(average(rankNumArray) * 10) / 10} avg\` ` : ``}`, `\`${reviewNum} review${reviewNum > 1 || reviewNum == 0 ? 's' : ''}\``, `\`${remixerKeys.length} remix${remixerKeys.length > 1 ? 'es' : ''}\``,
                            `${starNum != 0 ? `\`${starNum} ⭐\`` : ''}`];
                            songDetails = songDetails.join(' ');
                        } else if (reviewNum != 0) {
                            songDetails = `${rankNumArray.length != 0 ? `\`${Math.round(average(rankNumArray) * 10) / 10} avg\` ` : ``}\`${reviewNum} review${reviewNum > 1 || reviewNum == 0 ? 's' : ''}\`${starNum != 0 ? ` \`${starNum} ⭐\`` : ''}`;
                        } else {
                            songDetails = ``;
                        }

                        epData.push([`• ${epSongs[ii]}` + 
                        `${(collabArray.length != 0) ? ` (with ${collabArray.join(' & ')})` : ``}` + 
                        ` ${songDetails}`]);

                        removeItemOnce(songArray, epSongs[ii].replace('[', '_((').replace(']', '))_'));
                        epData[epData.length - 1][0] = epData[epData.length - 1][0].replace('*', '\\*');
                    }

                    epArray.push(epData.join('\n'));
                }

                for (let i = 0; i < songArray.length; i++) {
                    starNum = 0;
                    songArray[i] = songArray[i].replace('_((', '[').replace('))_', ']');
                    let setterSongName = convertToSetterName(songArray[i]);
                    const songObj = db.reviewDB.get(artist, `${setterSongName}`);
                    let localReviews, globalReviews;
                    // Get all users if global, otherwise get only guild specific users if server.
                    if (subcommand == 'server') {
                        localReviews = await get_user_reviews(songObj, guildUsers);
                        globalReviews = [];
                    } else {
                        globalReviews = await get_user_reviews(songObj);
                        localReviews = [];
                    }

                    localReviewNum = localReviews.length;
                    globalReviewNum = globalReviews.length;

                    if (subcommand == 'global') {
                        for (let ii = 0; ii < globalReviews.length; ii++) {
                            let rating = songObj[globalReviews[ii]].rating;
                            let starred = songObj[globalReviews[ii]].starred;
                            globalRankNumArray.push(parseFloat(rating));
                            if (starred == true) { 
                                starNum++; 
                                fullStarNum++;
                                star_check.push(songArray[i]);
                            }
                        }
                    } else {
                        for (let ii = 0; ii < localReviews.length; ii++) {
                            let rating = songObj[localReviews[ii]].rating;
                            let starred = songObj[localReviews[ii]].starred;
                            localRankNumArray.push(parseFloat(rating));
                            if (starred == true) { 
                                starNum++; 
                                fullStarNum++;
                                star_check.push(songArray[i]);
                            }
                        }
                    }

                    let songDetails;
                    let remixerKeys = songObj.remixers;
                    let collabArray = songObj.collab; // This also doubles as remixer original artists
                    let rmxOgArtistArray = [];
                    if (songArray[i].includes(' Remix)')) rmxOgArtistArray = songObj.collab;

                    let reviewNum, rankNumArray;
                    reviewNum = subcommand == 'global' ? globalReviewNum : localReviewNum;
                    rankNumArray = subcommand == 'global' ? globalRankNumArray : localRankNumArray;

                    if (remixerKeys.length > 0 && reviewNum != 0) {
                        songDetails = [`\`${rankNumArray.length != 0 ? `\`${Math.round(average(rankNumArray) * 10) / 10} avg\` ` : ``}`, `\`${reviewNum} review${reviewNum > 1 || reviewNum == 0 ? 's' : ''}\``, `\`${remixerKeys.length} remix${remixerKeys.length > 1 ? 'es' : ''}\``,
                        `${starNum != 0 ? `\`${starNum} ⭐\`` : ''}`];
                        songDetails = songDetails.join(' ');
                    } else if (reviewNum != 0) {
                        songDetails = `${rankNumArray.length != 0 ? `\`${Math.round(average(rankNumArray) * 10) / 10} avg\` ` : ``}\`${reviewNum} review${reviewNum > 1 || reviewNum == 0 ? 's' : ''}\`${starNum != 0 ? ` \`${starNum} ⭐\`` : ''}`;
                    } else {
                        songDetails = ``;
                    }

                    if (songArray[i].includes('Remix')) { // Remixes
                        remixArray.push([(star_check.includes(songArray[i])) ? (99999 + starNum) : reviewNum, `• ${rmxOgArtistArray.join(' & ')} - ${songArray[i]} ${songDetails}`]);
                        // Escape character the stars so that they don't italicize the texts
                        remixArray[remixArray.length - 1][1] = remixArray[remixArray.length - 1][1].replace('*', '\\*');
                    } else { // Singles
                        singleArray.push([(star_check.includes(songArray[i])) ? (99999 + starNum) : reviewNum, `• ${songArray[i]}` + 
                        `${(collabArray.length != 0) ? ` (with ${collabArray.join(' & ')})` : ``}` + 
                        ` ${songDetails}`]);
                        // Escape character the stars so that they don't italicize the text
                        singleArray[singleArray.length - 1][1] = singleArray[singleArray.length - 1][1].replace('*', '\\*');
                    }
                }

                if (singleArray.length != 0) {
                    singleArray = sort(singleArray);
                    pagedSingleArray = _.chunk(singleArray, 10);
                    if (pagedSingleArray.length > 1) {
                        pages_active[0] = true;
                    }

                } else {
                    type_buttons.components[0].setDisabled(true);
                }

                if (epArray.length != 0) {
                    pagedEpArray = _.chunk(epArray, 1);
                    if (pagedEpArray.length > 1) {
                        pages_active[1] = true;
                    }
                } else {
                    type_buttons.components[1].setDisabled(true);
                }
                
                if (remixArray.length != 0) {
                    remixArray = sort(remixArray);
                    pagedRemixArray = _.chunk(remixArray, 10);
                    if (pagedRemixArray.length > 1) {
                        pages_active[2] = true;
                    }
                } else {
                    type_buttons.components[2].setDisabled(true);
                }

                // These if loops are an easy way to determine which to show upon startup, if the singles are first it'll end the if else stuff early, vice versa with the others.
                if (singleArray.length != 0) {
                    focusedName = 'Singles';
                    focusedArray = pagedSingleArray;
                    type_buttons.components[0].data.style = ButtonStyle.Success;
                } else if (epArray.length != 0) {
                    focusedName = 'EP/LPs';
                    focusedArray = pagedEpArray;
                    type_buttons.components[1].data.style = ButtonStyle.Success;
                } else if (remixArray.length != 0) {
                    focusedName = 'Remixes';
                    focusedArray = pagedRemixArray;
                    type_buttons.components[2].data.style = ButtonStyle.Success;
                }

                let rankNumArray = interaction.options.getSubcommand() == 'global' ? globalRankNumArray : localRankNumArray;

                if (rankNumArray.length != 0) { 
                    if (singleArray.length != 0 || remixArray.length != 0 || epArray.length != 0) {
                        if (fullStarNum != 0) { // If the artist has stars on any of their songs
                            artistEmbed.setDescription(`*The average ${subcommand == 'global' ? 'global' : 'local'} rating of this artist is* ***${Math.round(average(rankNumArray) * 10) / 10}!***\n:star2: **This artist has ${fullStarNum} total stars!** :star2:`);
                        } else {
                            artistEmbed.setDescription(`*The average ${subcommand == 'global' ? 'global' : 'local'} rating of this artist is* ***${Math.round(average(rankNumArray) * 10) / 10}!***`);
                        }

                        artistEmbed.addFields([{ name: focusedName, value: focusedArray[0].join('\n') }]);
                        artistEmbed.setFooter({ text: `Page ${page_num + 1} / ${focusedArray.length}` });
                    } else {
                        artistEmbed.setDescription(`No reviewed songs. :(`);
                    }
                } else {
                    artistEmbed.setDescription(`No reviewed songs. :(`);
                }

            console.log(artistEmbed);

            if (pages_active[0] == true) {
                await interaction.reply({ embeds: [artistEmbed], components: [type_buttons, page_arrows] });
            } else {
                await interaction.reply({ embeds: [artistEmbed], components: [type_buttons] });
            }

            let message = await interaction.fetchReply();
            let do_arrows = false;
            
            const collector = message.createMessageComponentCollector({ time: 360000 });

            collector.on('collect', async i => {
                do_arrows = false;

                switch (i.customId) {
                    case 'left': page_num -= 1; do_arrows = true; break;
                    case 'right': page_num += 1; do_arrows = true; break;
                    case 'singles':
                        focusedArray = pagedSingleArray;
                        focusedName = "Singles";
                        type_buttons.components[0].data.style = ButtonStyle.Success;
                        type_buttons.components[1].data.style = ButtonStyle.Secondary;
                        type_buttons.components[2].data.style = ButtonStyle.Secondary;
                        if (pages_active[0] == true) do_arrows = true;
                        page_num = 0; break;
                    case 'ep':
                        focusedArray = pagedEpArray;
                        focusedName = "EPs/LPs";
                        type_buttons.components[0].data.style = ButtonStyle.Secondary;
                        type_buttons.components[1].data.style = ButtonStyle.Success;
                        type_buttons.components[2].data.style = ButtonStyle.Secondary;
                        if (pages_active[1] == true) do_arrows = true;
                        page_num = 0; break;
                    case 'remixes':
                        focusedArray = pagedRemixArray;
                        focusedName = "Remixes";
                        type_buttons.components[0].data.style = ButtonStyle.Secondary;
                        type_buttons.components[1].data.style = ButtonStyle.Secondary;
                        type_buttons.components[2].data.style = ButtonStyle.Success;
                        if (pages_active[2] == true) do_arrows = true;
                        page_num = 0; break;
                }

                page_num = _.clamp(page_num, 0, focusedArray.length - 1);
                artistEmbed.data.fields[0].name = focusedName;
                artistEmbed.data.fields[0].value = focusedArray[page_num].join('\n');
                artistEmbed.setFooter({ text: `Page ${page_num + 1} / ${focusedArray.length}` });

                if (do_arrows == false) { 
                    artistEmbed.footer = null;
                    i.update({ embeds: [artistEmbed], components: [type_buttons] });
                } else {
                    i.update({ embeds: [artistEmbed], components: [type_buttons, page_arrows] });
                }

            });

            collector.on('end', async () => {
                interaction.editReply({ embeds: [artistEmbed], components: [] });
            });
        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};
