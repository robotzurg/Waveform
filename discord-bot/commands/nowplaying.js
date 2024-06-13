const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db.js');
const { get_user_reviews, handle_error, spotify_api_setup, parse_artist_song_data, getEmbedColor, convertToSetterName, lfm_api_setup } = require('../func.js');
const ms_format = require('format-duration');
const progressbar = require('string-progressbar');
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Display your currently playing song.')
        .setDMPermission(false),
    help_desc: `If logged into Waveform with Spotify or Last.fm, this command will display your currently playing song, and some basic data in Waveform about the song, if any exists.\n` +
    `You can also use the "Reviews" button to see relevant reviews in the server of the song, if there are any.\n\n` + 
    `This requires /login to be successfully run before it can be used, and can only be used with Spotify or Last.fm.\n` + 
    `You can also view your song play count on Last.fm, if you are logged into Last.fm on Waveform.`,
	async execute(interaction, client, serverConfig) {
        try {
        await interaction.deferReply();
        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        let songArt, spotifyUrl = false, spotifyUri, yourRating, origArtistArray, artistArray, songName, songDisplayName, noSong = false, isPlaying = true, isPodcast = false, validSong = true;
        let songDataExists = false;
        let albumData = false;
        let setterSongName, song_info;
        let songLength, songCurMs, musicProgressBar = false; // Song length bar variables
        let spotifyApi = await spotify_api_setup(interaction.user.id);
        let lfmApi = await lfm_api_setup(interaction.user.id);
        let lfmTrackData = false;
        let lfmUsername = db.user_stats.get(interaction.user.id, 'lfm_username');
        let lfmUrl = false;
        let lfmRecentSongs;

        if (lfmApi != false) {
            lfmRecentSongs = await lfmApi.user_getRecentTracks({ limit: 1 });
            if (lfmRecentSongs.success) {
                if (lfmRecentSongs.track.length != 0) {
                    lfmUrl = lfmRecentSongs.track[0].url;
                    lfmTrackData = await lfmApi.track_getInfo({ artist: lfmRecentSongs.track[0].artist['#text'], track: lfmRecentSongs.track[0].name, username: lfmUsername });
                }
            }
        }

        if (spotifyApi != false) {
            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.item == undefined) { noSong = true; return; }
                if (data.body.currently_playing_type == 'episode') { isPodcast = true; return; }
                albumData = data.body.item.album;  

                if ((albumData.total_tracks <= 1 && !(albumData.total_tracks == 1 && data.body.item.duration_ms >= 1.2e+6)) || albumData.total_tracks > 25) {
                    albumData = false;
                }

                if (data.body.item.is_local == false) {
                    spotifyUri = data.body.item.uri;
                    spotifyUrl = data.body.item.external_urls.spotify;
                    songArt = data.body.item.album.images[0].url;
                } else {
                    spotifyUrl = false;
                    songArt = false;
                    albumData = false;
                    lfmTrackData = false;
                }

                songLength = data.body.item.duration_ms;
                songCurMs = data.body.progress_ms;
                musicProgressBar = progressbar.splitBar(songLength / 1000, songCurMs / 1000, 12)[0];
                isPlaying = data.body.is_playing;
                song_info = await parse_artist_song_data(interaction);
                if (song_info.error != undefined) {
                    validSong = false;
                } else {
                    songName = song_info.song_name;
                    setterSongName = convertToSetterName(songName);
                    artistArray = song_info.db_artists;
                    origArtistArray = song_info.prod_artists;
                    songDisplayName = song_info.display_song_name;
                }
            });
        } else {
            if (lfmApi == false) return interaction.editReply('This command requires you to use `/login`, and log in to either Spotify or Last.fm.');
            lfmUrl = lfmTrackData.url;
            songArt = lfmRecentSongs.track[0].image[3]['#text'];

            song_info = await parse_artist_song_data(interaction, lfmRecentSongs.track[0].artist['#text'], lfmRecentSongs.track[0].name);
            if (song_info.error != undefined) {
                validSong = false;
            } else {
                songName = song_info.song_name;
                setterSongName = convertToSetterName(songName);
                artistArray = song_info.db_artists;
                origArtistArray = song_info.prod_artists;
                songDisplayName = song_info.display_song_name;
            }
        }

        // Check if a podcast is being played, as we don't support that.
        if (isPodcast == true) {
            return interaction.editReply('Podcasts are not supported with `/np`.');
        } else if (validSong == false) {
            return interaction.editReply(`This song cannot be parsed by Waveform, therefore cannot be pulled up.`);
        }

        if (noSong == true) {
            return interaction.editReply(`You are not currently playing a song on Spotify.`);
        }

        if (songArt == false) songArt = interaction.member.avatarURL({ extension: 'png' });

        // Get mailbox info
        let is_mailbox = false;
        let mailbox_list = db.user_stats.get(interaction.user.id, 'mailbox_list');
        let temp_mailbox_list;
        let user_who_sent = false;
        let mailbox_data = false;
        let mailbox_member = null;
        let mailbox_text = ``;
        let mailbox_iconUrl = null;

        if (spotifyUri != false && spotifyUri != undefined) {
            if (mailbox_list.some(v => {
                if (v.track_uris.length == 1) {
                    return v.spotify_id == spotifyUri.replace('spotify:track:', '');
                } else {
                    return v.track_uris.includes(spotifyUri);
                }
            })) {
                is_mailbox = true;
            }
        }
        
        // If we are in the mailbox and don't specify a user who sent, try to pull it from the mailbox list
        if (is_mailbox == true) {
            temp_mailbox_list = mailbox_list.filter(v => {
                if (v.track_uris.length == 1) {
                    return v.spotify_id == spotifyUri.replace('spotify:track:', '');
                } else {
                    return v.track_uris.includes(spotifyUri);
                }
            });

            if (temp_mailbox_list.length != 0) {
                mailbox_data = temp_mailbox_list[0];
                if (mailbox_data.user_who_sent != interaction.user.id) {
                    await interaction.guild.members.fetch(mailbox_data.user_who_sent).then(async user_data => {
                        user_who_sent = user_data.user;
                        mailbox_member = user_data;
                        mailbox_text = `📬 Sent to you by ${mailbox_member.displayName}`;
                        mailbox_iconUrl = user_who_sent.avatarURL({ extension: "png", dynamic: true });
                    }).catch(() => {
                        user_who_sent = false;
                        is_mailbox = true;
                        mailbox_member = null;
                        mailbox_text = `📬 This song is in your mailbox, sent from another server!`;
                    });
                }
            }
        }

        if (lfmTrackData != false && lfmTrackData != undefined) { 
            if (!_.lowerCase(lfmTrackData.name).includes(_.lowerCase(songName)) && !_.lowerCase(lfmTrackData.name).includes(_.lowerCase(songDisplayName))) {
                lfmTrackData = await lfmApi.track_getInfo({ artist: origArtistArray[0].replace('\\&', '&'), track: songName, username: lfmUsername });
                if (lfmTrackData.success == false) {
                    lfmTrackData = false;
                }
            }
        } else {
            lfmTrackData = false;
        }

        //getMusicUrl(origArtistArray, songName);

        const npEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${songDisplayName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s ${isPlaying ? `current song` : `last song played`}`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: true })}` })
        .setThumbnail(songArt);

        let extraEmbedData = `${lfmTrackData != false ? `\nPlays: \`${lfmTrackData.userplaycount}\`` : ``}` +
        `${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
        `${spotifyUrl == false || spotifyUrl == undefined ? `` : `\n<:spotify:899365299814559784> [Spotify](${spotifyUrl})`}` +
        `${lfmUrl == false || lfmUrl == undefined ? `` : `\n<:lastfm:1227869050084921375> [Last.fm](${lfmUrl})`}`;

        if (db.reviewDB.has(artistArray[0])) {
            let songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);

            if (songObj != undefined) {
                const guild = client.guilds.cache.get(interaction.guild.id);
                let localUserArray = await get_user_reviews(songObj, serverConfig.disable_global, guild, guild);
                let globalUserArray = await get_user_reviews(songObj, serverConfig.disable_global, guild);
                let globalRankNumArray = [];
                let localRankNumArray = [];
                let localStarNum = 0;
                let globalStarNum = 0;
                let yourStar = '';

                // Global
                for (let i = 0; i < globalUserArray.length; i++) {
                    if (globalUserArray[i] == `${interaction.user.id}`) yourRating = songObj[globalUserArray[i]].rating;
                    let rating;
                    rating = songObj[globalUserArray[i]].rating;
                    if (songObj[globalUserArray[i]].starred == true) {
                        globalStarNum++;
                    }
                    
                    if (rating !== false) globalRankNumArray.push(parseFloat(rating));
                    globalUserArray[i] = [rating, `${globalUserArray[i]} \`${rating}\``];
                }

                // Local
                for (let i = 0; i < localUserArray.length; i++) {
                    let rating;
                    rating = songObj[localUserArray[i]].rating;
                    if (songObj[localUserArray[i]].starred == true) {
                        localStarNum++;
                        if (localUserArray[i] == `${interaction.user.id}`) {
                            yourStar = '⭐'; //Added to the end of your rating tab
                        }
                    }
                    
                    if (rating !== false) localRankNumArray.push(parseFloat(rating));
                    localUserArray[i] = [rating, `${localUserArray[i]} \`${rating}\``];
                }

                if (serverConfig.disable_ratings === true) {
                    localRankNumArray = [];
                    globalRankNumArray = [];
                    yourRating = false;
                }

                extraEmbedData = `${(yourRating !== false && yourRating != undefined) ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                `${lfmTrackData != false ? `\nPlays: \`${lfmTrackData.userplaycount}\`` : ``}` +
                `${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                `${spotifyUrl == false ? `` : `\n<:spotify:899365299814559784> [Spotify](${spotifyUrl})`}` +
                `${lfmUrl == false ? `` : `\n<:lastfm:1227869050084921375> [Last.fm](${lfmUrl})`}`;

                if (globalRankNumArray.length != 0) { 
                    if (localRankNumArray.length > 0) {
                        songDataExists = true;
                    }
                    npEmbed.setDescription(`\nAvg Global Rating: **\`${Math.round(average(globalRankNumArray) * 10) / 10}\`** \`with ${globalUserArray.length} reviews` +
                    `${globalStarNum >= 1 ? ` and ${globalStarNum} ⭐\`` : '`'}` +
                    `\nAvg Local Rating: **\`${localRankNumArray.length > 0 ? Math.round(average(localRankNumArray) * 10) / 10 : `N/A`}\`** \`with ${localUserArray.length} reviews` +
                    `${localStarNum >= 1 ? ` and ${localStarNum} ⭐\`` : '`'}` + extraEmbedData);
                } else if (globalUserArray.length != 0) {
                    if (localUserArray.length > 0) {
                        songDataExists = true;
                    }
                    
                    npEmbed.setDescription(`Local Reviews: \`${localUserArray.length != 0 ? `${localUserArray.length} review${localUserArray.length > 1 ? 's' : ''}\`` : `No Reviews`}` + 
                    `${localStarNum >= 1 ? ` and ${localStarNum} ⭐\`` : ''}` + extraEmbedData);
                } else {
                    npEmbed.setDescription(extraEmbedData);
                }

                if ((songObj.ep != undefined && songObj.ep != false)) {
                    let epSongArt = false;
                    let setterEpName = convertToSetterName(songObj.ep);
                    if (db.reviewDB.get(artistArray[0], setterEpName) != undefined) {
                        epSongArt = db.reviewDB.get(artistArray[0], `${setterEpName}.art`);
                    } else if (songName.includes(' Remix)')) {
                        epSongArt = db.reviewDB.get(songObj.collab[0], `${setterEpName}.art`);
                    } 

                    npEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: epSongArt != false ? epSongArt : null });
                }
                
            }
        }

        if (npEmbed.data.description == undefined) {
            npEmbed.setDescription(extraEmbedData);
        }

        // Footer stuff
        if (albumData != false && npEmbed.data.footer == undefined) {
            npEmbed.setFooter({ text: `from ${albumData.name} ${albumData.name.includes(' LP') && albumData.name.includes(' EP') ? albumData.album_type == 'album' ? 'LP' : 'EP' : ``}`, iconURL: albumData.images[0].url });
        }

        if (is_mailbox == true) {
            let mailboxFooterObj = { text: mailbox_text, iconURL: mailbox_iconUrl };
            if (npEmbed.data.footer != undefined) mailboxFooterObj.text = `${mailboxFooterObj.text} • ${npEmbed.data.footer.text}`;
            npEmbed.setFooter(mailboxFooterObj);
        }
        
        // Setup button for getsong data
        const getSongButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('getsong')
                .setLabel('See Reviews')
                .setStyle(ButtonStyle.Primary),
        );

        interaction.editReply({ embeds: [npEmbed], components: songDataExists ? [getSongButton] : [] });
        if (songDataExists) {
            let message = await interaction.fetchReply();
            const getSongCollector = message.createMessageComponentCollector({ time: 60000, max: 1 });

            getSongCollector.on('collect', async i => {
                if (i.customId == 'getsong') {
                    await i.update({ content: 'Loading song data...', embeds: [], components: [] });
                    let command = client.commands.get('getsong');
                    await command.execute(interaction, client, serverConfig, artistArray, songName);
                }
            });

            getSongCollector.on('end', collected => {
                if (collected.size == 0) {
                    interaction.editReply({ embeds: [npEmbed], components: [] });
                }
            });
        }

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};
