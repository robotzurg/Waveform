const db = require("../db.js");
const { EmbedBuilder, SlashCommandBuilder, Embed } = require('discord.js');
const { handle_error, get_review_channel, parse_artist_song_data, getEmbedColor, convertToSetterName, lfm_api_setup, checkForGlobalReview } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getalbumreview')
        .setDescription('Get an album or EP review from a user.')
        .setDMPermission(false)
        .addStringOption(option => 
            option.setName('artist')
                .setDescription('The name of the artist(s).')
                .setAutocomplete(true)
                .setRequired(false))

        .addStringOption(option => 
            option.setName('album_name')
                .setDescription('The name of the album or EP.')
                .setAutocomplete(true)
                .setRequired(false))
            
        .addUserOption(option => 
            option.setName('user')
                .setDescription('User who made the review. Defaults to yourself.')
                .setRequired(false))

        .addBooleanOption(option => 
            option.setName('show_songs')
                .setDescription('Show the individual song reviews on the EP/LP review. Defaults to false on LPs, and true on EPs.')
                .setRequired(false)),
    help_desc: `Pulls up an individual server users EP/LP review.\n\n` +
    `Leaving the artist and album_name arguments blank will pull from your spotify playback to fill in the arguments (if you are logged into Waveform with Spotify)\n\n` +
    `Putting in a user into the user argument will allow you to view another users ratings of the specified artist, otherwise leaving it blank will default to yourself.`,
	async execute(interaction, client, serverConfig) {

        try {
            let artists = interaction.options.getString('artist');
            let ep = interaction.options.getString('album_name');
            let song_info = await parse_artist_song_data(interaction, artists, ep);
            if (song_info.error != undefined) {
                await interaction.reply(song_info.error);
                return;
            }

            let origArtistArray = song_info.prod_artists;
            let epName = song_info.song_name;
            if (!epName.includes(' EP') && !epName.includes(' LP')) epName += ' LP';
            let setterEpName = convertToSetterName(epName);
            let artistArray = song_info.db_artists;
            let epType = epName.includes(' LP') ? `LP` : `EP`;

            let taggedUser = interaction.options.getUser('user');
            let taggedMember = interaction.member;

            if (taggedUser != null) {
                taggedMember = await interaction.guild.members.fetch(taggedUser.id);
            } else {
                taggedUser = interaction.user;
                taggedMember = interaction.member;
            }

            // Last.fm
            let lfmApi = await lfm_api_setup(taggedUser.id);
            let lfmScrobbles = false;

            if (!epName.includes(' EP') && !epName.includes(' LP')) epName = `${epName} EP`;

            let artistsEmbed;
            let rreview;
            let rscore;
            let rstarred;

            let epObj = db.reviewDB.get(artistArray[0], `${setterEpName}`);
            if (epObj == undefined) return interaction.reply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` was not found in the database.`);

            let epReviewObj = epObj[taggedUser.id];
            if (serverConfig.disable_global) {
                if (checkForGlobalReview(epReviewObj, interaction.guild.id) == true) {
                    return interaction.reply('This review was made in another server, and cannot be viewed here due to this server blocking external reviews from other servers.');
                }
            }

            if (epReviewObj == undefined) return interaction.reply(`The ${epType} \`${origArtistArray.join(' & ')} - ${epName}\` has not been reviewed by the user ${taggedMember.displayName}.`);

            let ep_overall_rating = epReviewObj.rating;
            if (ep_overall_rating == -1) ep_overall_rating = false;
            let ep_overall_review = epReviewObj.review;
            let no_songs_review = epReviewObj.no_songs;
            let incomplete_review = false;
            let ep_sent_by = epReviewObj.sentby;
            let ep_fav_songs = epReviewObj.fav_songs;
            let ep_least_fav_songs = epReviewObj.least_fav_songs;
            if (no_songs_review == undefined) no_songs_review = false; // Undefined handling for EP/LP reviews without this
            let ep_url = epReviewObj.url;
            let ep_starred = epReviewObj.starred;
            if (ep_starred == undefined) ep_starred = false;

            let ep_art = epObj.art;
            let ep_songs = epObj.songs;
            if (ep_songs == false || ep_songs == undefined) ep_songs = [];

            if (ep_art == false) {
                ep_art = taggedUser.avatarURL({ extension: "png" });
            }

            if (ep_sent_by != undefined && ep_sent_by != false) {
                ep_sent_by = await client.users.fetch(ep_sent_by);
            }

            if (serverConfig.disable_ratings === true) {
                ep_overall_rating = false;
            }

            // Check if we want to show song reviews, if it has song reviews.
            let songReviewCheck = interaction.options.getBoolean('show_songs');
            if (no_songs_review == false) {
                // If show_songs is not specified, do the defaults.
                // Otherwise, set it to whatever the user set it to.
                songReviewCheck == null ? no_songs_review = (epType == 'LP') : no_songs_review = !songReviewCheck;
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

            const epEmbed = new EmbedBuilder();
            
            epEmbed.setColor(`${getEmbedColor(interaction.member)}`);
            epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName}` : `🌟 ${origArtistArray.join(' & ')} - ${epName} 🌟`);

            let epEmbedFields = [];

            console.log(ep_overall_rating, ep_overall_review);

            if (ep_overall_rating !== false && ep_overall_review != false) {
                if (no_songs_review == false) {
                    epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                } else {
                    epEmbedFields.push({ name: `Rating`, value: `**${ep_overall_rating}/10**` });
                }
                epEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
            } else if (ep_overall_rating !== false) {
                if (no_songs_review == false) {
                    epEmbed.setTitle(ep_starred == false ? `${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10)` : `🌟 ${origArtistArray.join(' & ')} - ${epName} (${ep_overall_rating}/10) 🌟`);
                } else {
                    epEmbedFields.push({ name: `Rating`, value: `**${ep_overall_rating}/10**` });
                }
            } else if (ep_overall_review !== false) {
                epEmbed.setDescription(no_songs_review == false ? `*${ep_overall_review}*` : `${ep_overall_review}`);
            }

            if (ep_fav_songs) epEmbedFields.push({ name: 'Favorite Songs:', value: `${ep_fav_songs}`, inline: true });
            if (ep_least_fav_songs) epEmbedFields.push({ name: 'Least Favorite Songs', value: `${ep_least_fav_songs}`, inline: true });

            epEmbed.setAuthor({ name: `${taggedMember.displayName}'s ${epType} review`, iconURL: `${taggedUser.avatarURL({ extension: "png", dynamic: true })}` });
            epEmbed.setThumbnail(ep_art);

            if (ep_sent_by != false && ep_sent_by != undefined) {
                let sentByMember;
                sentByMember = await interaction.guild.members.fetch(epReviewObj.sentby).catch(() => sentByMember = undefined);
                if (sentByMember == undefined) {
                    epEmbed.setFooter({ text: `📬 Sent by a user not in this server${lfmScrobbles !== false ? ` • Plays: ${lfmScrobbles}` : ``}` });
                } else {
                    epEmbed.setFooter({ text: `Sent by ${sentByMember.displayName}${lfmScrobbles !== false ? ` • Plays: ${lfmScrobbles}` : ``}`, iconURL: `${ep_sent_by.avatarURL({ extension: "png" })}` });
                }

            } else if (lfmScrobbles !== false) {
                epEmbed.setFooter({ text: `Plays: ${lfmScrobbles}` });
            }

            let reviewMsgID = epReviewObj.msg_id;
            let timestamp = epReviewObj.timestamp;
            if (reviewMsgID != false && reviewMsgID != undefined && timestamp == undefined) {
                let channelsearch = await get_review_channel(client, epReviewObj.guild_id, epReviewObj.channel_id, reviewMsgID);
                if (channelsearch != undefined) {
                    await channelsearch.messages.fetch(`${reviewMsgID}`).then(async msg => {
                        epEmbed.setTimestamp(msg.createdTimestamp);
                    });
                }
            } else if (timestamp != undefined) {
                epEmbed.setTimestamp(timestamp);
            }

            if (ep_songs.length != 0) {
                for (let i = 0; i < ep_songs.length; i++) {
                    let songArtist = artistArray[0];
                    if (ep_songs[i].includes(' Remix)')) songArtist = ep_songs[i].split(' Remix)')[0].split('(').splice(1);
                    let songName = ep_songs[i];
                    let setterSongName = convertToSetterName(songName);
                    artistsEmbed = [];
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
                    if (songObj.collab != undefined && !ep_songs[i].includes(' Remix)')) {
                        if (songObj.collab.length != 0) {
                            artistsEmbed = [];
                            artistsEmbed.push(songObj.collab);
                            artistsEmbed = artistsEmbed.flat(1);
                            artistsEmbed = artistsEmbed.join(' & ');
                        }
                    }

                    if (no_songs_review == false) {
                        if (new Embed(epEmbed.toJSON()).length < 5250) {
                            epEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                            `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                            `${rscore !== false ? `(${rscore}/10)` : ``}`, 
                            value: `${rreview == false ? `*No review written*` : `${rreview}`}` }]);
                        } else {
                            epEmbed.addFields([{ name: `${rstarred == true ? `🌟 ${songName} 🌟` : songName }` + 
                            `${artistsEmbed.length != 0 ? ` (with ${artistsEmbed}) ` : ' '}` + 
                            `${rscore !== false ? `(${rscore}/10)` : ``}`, 
                            value: `${rreview == false ? `*No review written*` : `*Review hidden to save space*`}` }]);
                        }
                    }
                }
            }

            if (no_songs_review == true) {
                incomplete_review = false;
                if (epEmbed.data.fields != undefined) {
                    if (epEmbed.data.fields.length > 1) {
                        epEmbedFields.splice(0, 0);
                        epEmbed.setFields(epEmbedFields);
                    }
                } else {
                    epEmbedFields.splice(0, 0);
                    epEmbed.setFields(epEmbedFields);
                }
            }
            
            if (incomplete_review == true) {
                epEmbed.setDescription(`This ${epType} review was manually finished before all songs were reviewed, so there is no review.`);
            }

            if (ep_url) {
                interaction.reply({ content: `[View ${epType} Review Message](${ep_url})`, embeds: [epEmbed] });
            } else {
                interaction.reply({ embeds: [epEmbed] });
            }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }

	},
};