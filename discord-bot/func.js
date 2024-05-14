/* eslint-disable no-useless-escape */
const { EmbedBuilder } = require('discord.js');
const db = require("./db.js");
const _ = require('lodash');
const SpotifyWebApi = require('spotify-web-api-node');
const lastfm = require("lastfm-njs");
const { DatabaseQuery } = require('./enums.js');
const axios = require('axios');
const cheerio = require('cheerio');

// TODO: ADD FUNCTION HEADERS/DEFS FOR ALL OF THESE!!!

module.exports = {

    removeItemOnce: function(arr, value) {
        let index = arr.indexOf(value);
        if (index > -1) {
          arr.splice(index, 1);
        }
        return arr;
    },

    sort: function(array, lowest_to_highest = false) {
        // This function sorts an array from highest to lowest based on this extension:
        // [ [ num, whatever else ], [ num, whatever else] ]

        if (lowest_to_highest == false) {
            array = array.sort(function(a, b) {
                return b[0] - a[0];
            });
        } else {
            array = array.sort(function(a, b) {
                return a[0] - b[0];
            });
        }

        array = array.flat(1);

        for (let i = 0; i <= array.length; i++) {
            array.splice(i, 1);
        }

        return array;
    },

    // server_filter is an object of the server guild
    get_user_reviews: async function(songObj, guild = false) {
        if (songObj == undefined && songObj == null) return [];
        let userArray = Object.keys(songObj);

        userArray = userArray.filter(e => e !== 'ep');
        userArray = userArray.filter(e => e !== 'art');
        userArray = userArray.filter(e => e !== 'remixers');
        userArray = userArray.filter(e => e !== 'collab');
        userArray = userArray.filter(e => e !== 'vocals');
        userArray = userArray.filter(e => e !== 'hof_id');
        userArray = userArray.filter(e => e !== 'review_num');
        userArray = userArray.filter(e => e !== 'remix_collab');
        userArray = userArray.filter(e => e !== 'tags');
        userArray = userArray.filter(e => e !== 'spotify_uri');
        userArray = userArray.filter(e => e !== 'songs');

        // Filter out the user array to only those in the guild, if this is not false
        if (guild != false) {
            let guildUsers;
            if (!Array.isArray(guild)) {
                let res = await guild.members.fetch();
                guildUsers = [...res.keys()];
            } else {
                guildUsers = guild;
            }
            userArray = userArray.filter(e => {
                return guildUsers.includes(e);
            });
        }

        return userArray;
    },

    parse_artist_song_data: async function(interaction, artists = null, song = null, remixers = null, trackList = false) {
        const { spotify_api_setup, getProperRemixers, convertToSetterName, getTrackList, lfm_api_setup } = require('./func.js');

        // If we are in the /editdata artist command and put in a manual name entry, run this a little differently
        let subcommand;
        try {
            subcommand = interaction.options.getSubcommand();
        } catch {
            subcommand = 'N/A';
        }

        if (interaction.commandName == 'editdata') {
            if (subcommand == 'artist' && artists != null) {
                return { 
                    prod_artists: [artists], 
                    song_name: 'N/A', // Song name with remixers in the name
                    main_song_name: 'N/A', // Song Name without remixers in the name
                    display_song_name: 'N/A', // Song name with remixers and features in the name
                    db_artists: [artists], 
                    all_artists: [artists],
                    remix_artists: [], 
                    art: 'N/A',
                    spotify_uri: false,
                    current_ep_review_data: false,
                };
            }
        }

        if ((artists == null && song != null) || (artists != null && song == null)) {
            return { error: 'If you are searching for a review manually, you must put in both the artists (in the artist argument) and the song name (in the song_name argument).' };
        }

        let rmxArtist = false;
        let temp = '';
        if (artists != null) artists = artists.trim(); // This is because of a discord mobile bug where it adds spaces at the end of an argument
        if (song != null) song = song.trim(); // This is because of a discord mobile bug where it adds spaces at the end of an argument
        let origArtistArray = artists;
        let origSongArg = song; // Used to have the non remix name of a song, for reviews
        let songArg = song;
        let displaySongArg = false;
        let rmxArtistArray = [];
        let passesChecks = true;
        let songArt = false;
        let localReturnObj = {};
        let songUri = false;
        let notPlaying = false;
        let rmx_delimiter = ' & ';
        let current_ep_review_data = false;
        if (remixers != null) {
            rmxArtistArray = [remixers.split(' & ')];
            rmxArtistArray = rmxArtistArray.flat(1);
        }
        
        // If we're pulling from Spotify or Last.fm (no arguments given)
        if (origArtistArray == null && songArg == null && remixers == null) {
            let spotifyApi = await spotify_api_setup(interaction.user.id);
            let isPodcast = false;

            let lfmApi = await lfm_api_setup(interaction.user.id);
            if (interaction.commandName.includes('review') && interaction.commandName != 'getreview' && interaction.commandName != 'getepreview') lfmApi = false;
            let lfmRecentSongs;
            
            if (spotifyApi == false && lfmApi == false) {
                return { error: 'You must use `/login` to use Spotify/Last.fm related features!' };
            } else if (spotifyApi != false) {
                await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                    if (data.body.currently_playing_type == 'episode') { isPodcast = true; return; }
                    if (data.body.item == undefined) { notPlaying = true; return; }
                    
                    if (data.body.item.is_local == true) { 
                        origArtistArray = data.body.item.artists.map(artist => artist.name.replace(' & ', ' \\& '));
                        songArg = data.body.item.name;
                        songArg = songArg.replace('–', '-'); // STUPID LONGER DASH
                        songArg = songArg.replace('remix', 'Remix'); // Just in case there is lower case remix
                        songArt = false;
                        songUri = false;
                        rmxArtistArray = [];
                        return; 
                    } 

                    origArtistArray = data.body.item.artists.map(artist => artist.name.replace(' & ', ' \\& '));
                    songArg = data.body.item.name;
                    songArg = songArg.replace('–', '-'); // STUPID LONGER DASH
                    songArg = songArg.replace('remix', 'Remix'); // Just in case there is lower case remix
                    songArt = data.body.item.album.images[0].url;
                    songUri = data.body.item.uri;
                    await spotifyApi.getAlbum(data.body.item.album.id)
                    .then(async album_data => {
                        if ((interaction.commandName.includes('ep') && interaction.commandName != 'pushtoepreview') || (subcommand.includes('ep'))
                            || interaction.options.getSubcommandGroup() == 'ep') {
                            if (album_data.body.album_type == 'compilation') {
                                passesChecks = 'compilation';
                                return;
                            }

                            if (trackList == false) {
                                trackList = getTrackList(album_data.body, origArtistArray, rmxArtistArray);
                                passesChecks = trackList[1];
                                trackList = trackList[0];
                            }

                            origArtistArray = album_data.body.artists.map(artist => artist.name);
                            songArg = album_data.body.name;
                            songUri = album_data.body.uri;
                            if (album_data.body.album_type == 'single' && !songArg.includes(' EP')) {
                                songArg = `${songArg} EP`;
                            } else if (album_data.body.album_type == 'album' && !songArg.includes(' LP')) {
                                songArg = `${songArg} LP`;
                            }

                            if (songArg.includes(' - EP')) songArg = songArg.replace(' - EP', ' EP');
                            if (songArg.includes(' - LP')) songArg = songArg.replace(' - LP', ' LP');

                            if (interaction.commandName == 'albumreview') {
                                current_ep_review_data = { msg_id: false, channel_id: false, guild_id: interaction.guild.id, artist_array: origArtistArray, ep_name: songArg, review_type: 'A', track_list: trackList, next: trackList[0] };
                            }
                        }
                    });
                }); 
            } else {
                if (lfmApi != false) {
                    lfmRecentSongs = await lfmApi.user_getRecentTracks({ limit: 1 });
                    if (lfmRecentSongs.success) {
                        if (lfmRecentSongs.track.length != 0) {
                            origArtistArray = [lfmRecentSongs.track[0].artist['#text']];
                            origArtistArray = origArtistArray.map(v => v.replace('&', '\\&'));
                            songArg = lfmRecentSongs.track[0].name;
                        }
                    }
                }
            } 

            // Check if a podcast is being played, as we don't support that.
            if (isPodcast == true) {
                return { error: 'Podcasts are not supported with `/np`.' };
            }

            if (notPlaying == true) {
                return { error: 'You cannot use a spotify command without playing something on Spotify. Please double check you are playing a song on Spotify!' };
            }
        } else {
            if (remixers != null) {
                songArg = `${songArg} (${remixers} Remix)`;
            }
        }

        // Fix song formatting
        if (!Array.isArray(origArtistArray) && origArtistArray != null) {
            origArtistArray = origArtistArray.split(' & ');
        } else if (origArtistArray == null) {
            passesChecks = 'notplaying';
            origArtistArray = [];
            songArg = 'N/A';
        }

        // If manually pulling up info, make sure that the remixer is in the orig artist array (it gets removed later, but ensures this is a "valid" remix)
        if (remixers != null) {
            for (let remixer of rmxArtistArray) {
                if (!origArtistArray.includes(remixer)) {
                    origArtistArray.push(remixer);
                }
            }
        }

        if (songArg.includes('(feat.')) {
            songArg = songArg.split(' (feat. ');
            songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
            songArg[1] = songArg[1].split(')')[0];
            origSongArg = `${songArg[0]}`;
            songArg = `${songArg[0]}`;
        }

        if (songArg.includes('(ft. ')) {
            songArg = songArg.split(' (ft. ');
            songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
            songArg[1] = songArg[1].split(')')[0];
            origSongArg = `${songArg[0]}`;
            songArg = `${songArg[0]}`;
        }

        if (songArg.includes('(with ')) {
            songArg = songArg.split(' (with ');
            songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
            songArg[1] = songArg[1].split(')')[0];
            origSongArg = `${songArg[0]}${(rmxArtistArray.length > 0) ? ` (${rmxArtist} Remix)` : ``}`;
            songArg = `${songArg[0]}${(rmxArtistArray.length > 0) ? ` (${rmxArtist} Remix)` : ``}`;
        }

        if (!songArg.includes('VIP Remix')) {
            if (songArg.includes(' Remix)') || songArg.includes(' Remix]')) {
                songArg = songArg.replace('[', '(');
                songArg = songArg.replace(']', ')');

                temp = songArg.split(' Remix)')[0].split('(');
                rmxArtist = temp[temp.length - 1];

                // Input validation
                rmxArtist = rmxArtist.replace(' VIP', '');
                if (rmxArtist.includes(' and ')) rmx_delimiter = ' and ';
                if (rmxArtist.includes(' x ')) rmx_delimiter = ' x ';
                if (rmxArtist.includes(', ') && !origArtistArray.filter(v => v == rmxArtist) == 0) rmx_delimiter = ', ';
                origSongArg = temp[0].trim();
                rmxArtistArray = rmxArtist.split(rmx_delimiter);
                for (let i = 0; i < rmxArtistArray.length; i++) {
                    if (!origArtistArray.includes(rmxArtistArray[i])) {
                        for (let j = 0; j < origArtistArray.length; j++) {
                            if (origArtistArray[j].toUpperCase() === rmxArtistArray[i].toUpperCase()) {
                                rmxArtistArray[i] = origArtistArray[j];
                            }
                        }
                    }
                }
                
                // Check to see if the original artist array has the remixer, if it doesn't, we have an invalid remix
                let invalidRemix = false;
                for (let r of rmxArtistArray) {
                    if (!origArtistArray.includes(r)) {
                        invalidRemix = true;
                    }
                }

                if (invalidRemix == true) {
                    rmxArtistArray = [];
                } else {
                    origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
                    songArg = `${origSongArg} (${rmxArtistArray.join(' & ')} Remix)`;
                    if (rmxArtistArray[0] == '' || rmxArtistArray.length == 0) passesChecks = false;
                }
            }

            if ((songArg.includes('Remix') && songArg.includes(' - ')) && !songArg.includes('Remix)') && !songArg.includes('Remix]')) {
                songArg = songArg.split(' - ');
                if (songArg[1] != 'Remix') {
                    rmxArtist = songArg[1].slice(0, -6);
                    rmxArtist = rmxArtist.replace(' VIP', '');
                    if (rmxArtist.includes(' and ') && !rmxArtist.includes(' & ')) rmx_delimiter = ' and ';
                    if (rmxArtist.includes(' x ') && !rmxArtist.includes(' & ')) rmx_delimiter = ' x ';
                    if (rmxArtist.includes(', ') && !origArtistArray.filter(v => v == rmxArtist) == 0 && !rmxArtist.includes(' & ')) rmx_delimiter = ', ';

                    // Deal with features being in the song name before the remix lol
                    if (songArg[0].includes('feat.') || songArg[0].includes('ft.')) {
                        songArg[0] = songArg[0].replace('feat.', 'ft.');
                        songArg[0] = songArg[0].split(` (ft.`)[0];
                    }

                    origSongArg = songArg[0];
                    rmxArtistArray = rmxArtist.split(rmx_delimiter);
                    for (let i = 0; i < rmxArtistArray.length; i++) {
                        if (!origArtistArray.includes(rmxArtistArray[i])) {
                            for (let j = 0; j < origArtistArray.length; j++) {
                                if (origArtistArray[j].toUpperCase() === rmxArtistArray[i].toUpperCase()) {
                                    rmxArtistArray[i] = origArtistArray[j];
                                }
                            }
                        }
                    }
                    
                    // Check to see if the original artist array has the remixer, if it doesn't, we have an invalid remix
                    let invalidRemix = false;
                    for (let r of rmxArtistArray) {
                        if (!origArtistArray.includes(r)) {
                            invalidRemix = true;
                        }
                    }

                    if (invalidRemix == true) {
                        songArg = songArg.join(' - ');
                        rmxArtistArray = [];
                    } else {
                        origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
                        songArg = `${origSongArg} (${rmxArtistArray.join(' & ')} Remix)`;
                        if (rmxArtistArray[0] == '' || rmxArtistArray.length == 0) passesChecks = false;
                    }
                } else {
                    songArg = songArg.join(' - ');
                }
            }
        }

        if (songArg.includes('\\')) {
            songArg = songArg.replace('\\', '\\\\');
            if (origSongArg != null) origSongArg = origSongArg.replace('\\', '\\\\');
        }

        songArg = songArg.replace('(With', '(with');

        let artistArray;
        if (!Array.isArray(origArtistArray)) {
            artistArray = [origArtistArray.split(' & ')];
        } else {
            artistArray = origArtistArray.slice(0);
        }

        artistArray = artistArray.flat(1);

        // Fix the remix artist array if needed
        if (rmxArtistArray.length != 0) {
            temp = getProperRemixers(origArtistArray, rmxArtistArray);
            if (!_.isEqual(temp, rmxArtistArray)) {
                rmxArtistArray = temp;
                displaySongArg = `${origSongArg} (${rmxArtistArray.join(' x ')} Remix)`;
            } else {
                for (let r of rmxArtistArray) {
                    if (r.includes('\\&')) {
                        displaySongArg = `${origSongArg} (${rmxArtistArray.join(' x ')} Remix)`;
                        break;
                    }
                }
            }
        }

        if (origArtistArray.length == 0) {
            if (rmxArtistArray.length != 0) {
                origArtistArray = rmxArtistArray;
                artistArray = rmxArtistArray;
                rmxArtistArray = [];
                origSongArg = song;
            } else {
                passesChecks = false;
            }
        }

        // Error check
        if (songArg.includes('\\') && songArg.includes('.')) {
            passesChecks = false;
        } else if (origArtistArray.includes('Various Artists')) {
            passesChecks = false;
        } else if (origArtistArray.includes('')) {
            passesChecks = false;
        }

        if (passesChecks == 'local') {
            return localReturnObj;
        }
        
        if (passesChecks == 'notplaying') {
            return { error: 'You are not currently playing a song on Spotify.' };
        }

        if (passesChecks == false) {
            return { error: 'This piece of music cannot be parsed properly in the database, and as such cannot be used within Waveform in any way.' };
        } else if (passesChecks == 'ep') {
            return { error: 'This track cannot be added to EP/LP reviews, therefore is invalid to be used in relation with EP/LP commands.' };
        } else if (passesChecks == 'length') {
            return { error: 'This is not on an EP/LP, this is a single. As such, you cannot use this with EP/LP reviews.' };
        } else if (passesChecks == 'compilation') {
            return { error: `This is a compilation, and compilations cannot be reviewed as EPs/LPs.` };
        }

        let setterSongArg = convertToSetterName(songArg);

        if (current_ep_review_data == false && interaction.commandName == 'albumreview') {
            if (db.reviewDB.has(artistArray[0]) && db.reviewDB.get(artistArray[0], `${setterSongArg}`) != undefined && trackList == false) trackList = db.reviewDB.get(artistArray[0], `${setterSongArg}`).songs;
            if (trackList == undefined || trackList == null) {
                trackList = false;
            }

            current_ep_review_data = { msg_id: false, channel_id: false, guild_id: interaction.guild.id, artist_array: origArtistArray, ep_name: songArg, review_type: 'A', track_list: trackList, next: trackList[0] };
        }
        
        if (db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name') != undefined) {
            if (db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name').includes(' EP') || db.user_stats.get(interaction.user.id, 'current_ep_review.ep_name').includes(' LP')) {
                for (let i = 0; i < origArtistArray.length; i++) {
                    if (origArtistArray[i].toLowerCase() == 'og') {
                        origArtistArray[i] = db.user_stats.get(interaction.user.id, `current_ep_review.artist_array`);
                        origArtistArray = origArtistArray.flat(1);
                        artistArray = origArtistArray.slice(0);
                    }   
                }
            }
        }

        // VIP adjustment
        songArg = songArg.replace('- VIP', 'VIP');
        songArg = songArg.replace('(VIP)', 'VIP');
     
        if (interaction.commandName != 'nowplaying' && !interaction.commandName.includes('mail')) {
            // Check if all the artists exist (don't check this if we're pulling data for /review or /epreview)
            if (interaction.commandName != 'review' && interaction.commandName != 'albumreview' && interaction.commandName != 'pushtoepreview') {
                for (let i = 0; i < artistArray.length; i++) {
                    if (!db.reviewDB.has(artistArray[i])) {
                        return { error: `The artist \`${artistArray[i]}\` is not in the database. This is either due to no reviews being made of this song, or could be due to an artist renaming themselves on Spotify. If you believe the latter is the case, please use \`/reportsongdata\` to submit a song data edit request.` };
                    }
                }

                for (let i = 0; i < rmxArtistArray.length; i++) {
                    if (!db.reviewDB.has(rmxArtistArray[i])) {
                        return { error: `The artist \`${rmxArtistArray[i]}\` is not in the database. This is either due to no reviews being made of this song, or could be due to an artist renaming themselves on Spotify. If you believe the latter is the case, please use \`/reportsongdata\` to submit a song data edit request.` };
                    }
                }
            }

            if (db.reviewDB.has(artistArray[0])) {
                if (db.reviewDB.get(artistArray[0], `${setterSongArg}`) != undefined) {
                    if (db.reviewDB.get(artistArray[0], `${setterSongArg}`).collab != undefined) {
                        if (db.reviewDB.get(artistArray[0], `${setterSongArg}`).collab.length != 0) {
                            artistArray.push(db.reviewDB.get(artistArray[0], `${setterSongArg}`).collab);
                            origArtistArray.push(db.reviewDB.get(artistArray[0], `${setterSongArg}`).collab);
                            artistArray = artistArray.flat(1);
                            origArtistArray = artistArray.flat(1);
                            artistArray = [...new Set(artistArray)];
                            origArtistArray = [...new Set(origArtistArray)];
                        }
                    }

                    if (db.reviewDB.get(artistArray[0], `${setterSongArg}`).spotify_uri && songUri == false && rmxArtistArray.length != 0) {
                        songUri = db.reviewDB.get(artistArray[0], `${setterSongArg}`).spotify_uri;
                    }
                }
            }

            if (rmxArtistArray[0] != undefined) {
                if (db.reviewDB.has(rmxArtistArray[0])) {
                    if (db.reviewDB.get(rmxArtistArray[0], `${setterSongArg}`) != undefined) {
                        if (db.reviewDB.get(rmxArtistArray[0], `${setterSongArg}`).rmx_collab != undefined) {
                            if (db.reviewDB.get(rmxArtistArray[0], `${setterSongArg}`).rmx_collab.length != 0) {
                                rmxArtistArray.push(db.reviewDB.get(rmxArtistArray[0])[songArg].rmx_collab);
                                rmxArtistArray = rmxArtistArray.flat(1);
                            }
                        }

                        if (db.reviewDB.get(rmxArtistArray[0], `${setterSongArg}`).spotify_uri && songUri == false) {
                            songUri = db.reviewDB.get(rmxArtistArray[0], `${setterSongArg}`).spotify_uri;
                        }
                    }
                }
            }
        }

        origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
        let allArtistArray = artistArray;
        if (rmxArtistArray.length != 0) {
            artistArray = rmxArtistArray; // Database artists become the remix artists
            allArtistArray = [origArtistArray, rmxArtistArray].flat(1);
        }

        if (displaySongArg == false) displaySongArg = songArg;
        let displaySongName = (`${displaySongArg}`);

        // Grab a spotify song uri through spotify search if we don't already have one.
        if (songUri == false) {
            // let spotifyApi = new SpotifyWebApi({
            //     redirectUri: process.env.SPOTIFY_REDIRECT_URI,
            //     clientId: process.env.SPOTIFY_API_ID,
            //     clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            // });
            
            // // Retrieve an access token.
            // spotifyApi.clientCredentialsGrant().then(
            //     function(data) {
            //         // Save the access token so that it's used in future calls
            //         spotifyApi.setAccessToken(data.body['access_token']);
            //     },
            //     function(err) {
            //         console.log('Something went wrong when retrieving an access token', err);
            //     },
            // );

            const spotifyApi = await spotify_api_setup('122568101995872256');

            await spotifyApi.searchTracks(`${origArtistArray[0]} ${songArg}`).then(function(song_data) {  
                let results = song_data.body.tracks.items;
                let pushed = false;

                for (let result of results) {
                    if (result.album.artists.map(v => v.name.toLowerCase()).includes(origArtistArray[0].toLowerCase()) && result.name.toLowerCase() == `${songArg.toLowerCase()}`) {
                        songUri = result.uri;
                        pushed = true;
                        break;
                    }
                }

                if (pushed == false) {
                    songUri = results[0].uri;
                }
            });
        }

        return { 
            prod_artists: origArtistArray, 
            song_name: songArg, // Song name with remixers in the name
            main_song_name: origSongArg, // Song Name without remixers in the name
            display_song_name: displaySongName, // Song name with remixers and features in the name
            db_artists: artistArray, 
            all_artists: allArtistArray,
            remix_artists: rmxArtistArray, 
            art: songArt,
            spotify_uri: songUri,
            current_ep_review_data: current_ep_review_data,
            passes_checks: passesChecks,
        };
    },

    // Updates the art for embed messages, NOT in the database. That's done in the /review commands themselves.
    update_art: async function(interaction, client, first_artist, song_name, new_image) {
        const { get_user_reviews, handle_error, get_review_channel, convertToSetterName } = require('./func.js');

        let setterSongName = convertToSetterName(song_name);
        const imageSongObj = db.reviewDB.get(first_artist, `${setterSongName}`);
            if (imageSongObj != undefined) {
                let msgstoEdit = [];

                let userArray = await get_user_reviews(imageSongObj);
                if (userArray.length != 0) {
                    userArray.forEach(user => {
                        let userData = db.reviewDB.get(first_artist, `${setterSongName}.${user}`);
                        if (userData.guild_id == false) userData.guild_id = '680864893552951306';
                        if (userData.msg_id != false && userData.channel_id != false) {
                            msgstoEdit.push([userData.guild_id, userData.channel_id, userData.msg_id]);
                        }
                    });

                    msgstoEdit = msgstoEdit.filter(item => item !== undefined);
                    msgstoEdit = msgstoEdit.filter(item => item !== false);
                    
                    if (msgstoEdit.length > 0) { 
                        for await (const item of msgstoEdit) {
                            let msgtoEdit = item;
                            let channelsearch = await get_review_channel(client, msgtoEdit[0], msgtoEdit[1], msgtoEdit[2]);
                            let msgEmbed;
                            
                            if (channelsearch != undefined) {
                                await channelsearch.messages.fetch(`${msgtoEdit[2]}`).then(msg => {
                                    msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                                    msgEmbed.setThumbnail(new_image);
                                    msg.edit({ content: null, embeds: [msgEmbed] });
                                }).catch((err) => {
                                    handle_error(interaction, client, err);
                                });
                            }
                    }
                }
            }
        }
    },

    review_song: async function(interaction, artistArray, origArtistArray, song, origSongName, review, rating, starred, rmxArtistArray, songArt, user_who_sent, spotifyUri, ep_name = false) {

        const { convertToSetterName, updateStats } = require('./func.js');

        if (user_who_sent == undefined || user_who_sent == null) {
            user_who_sent = false;
        }
        
        // To make sure we only add to the song count once
        let addedToSongCount = false;

        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = convertToSetterName(song);

        for (let i = 0; i < artistArray.length; i++) {

            if (ep_name == undefined) ep_name = false;
            let songName = song;
            let objSongName = songName.replace('[', '_((').replace(']', '))_');

            // Used if both the artist and song object exist
            let review_object = {
                url: false,
                timestamp: false, 
                name: interaction.member.displayName, // For debug purposes
                msg_id: false,
                channel_id: false,
                guild_id: interaction.guild.id,
                review: review,
                rating: rating,
                starred: starred,
                sentby: user_who_sent,
            };

            // Used if the song object or artist object don't already exist
            let song_object = {
                [objSongName]: { 
                    [`${interaction.user.id}`]: review_object,
                    remixers: [],
                    remix_collab: (rmxArtistArray.length != 0 ? rmxArtistArray.filter(word => artistArray[i] != word) : []),
                    art: songArt,
                    collab: (rmxArtistArray.length == 0) ? artistArray.filter(word => !rmxArtistArray.includes(word) && artistArray[i] != word) : origArtistArray, 
                    ep: ep_name,
                    review_num: 1,
                    spotify_uri: spotifyUri,
                },
            };

            // If the artist db doesn't exist
            if (!db.reviewDB.has(artistArray[i])) {

                db.reviewDB.set(artistArray[i], song_object);
                db.global_bot.math('stats', `+`, 1, `artist_num`);
                if (addedToSongCount == false) {
                    db.global_bot.math('stats', `+`, 1, `song_num`);
                    addedToSongCount = true;
                }

            } else if (db.reviewDB.get(artistArray[i], `${setterSongName}`) == undefined) { //If the artist db exists, check if the song db doesn't exist
                const artistObj = db.reviewDB.get(artistArray[i]);

                //Create the object that will be injected into the Artist object
                const newsongObj = song_object;

                //Inject the newsongobject into the artistobject and then put it in the database
                Object.assign(artistObj, newsongObj);
                db.reviewDB.set(artistArray[i], artistObj);
                if (addedToSongCount == false) {
                    db.global_bot.math('stats', `+`, 1, `song_num`);
                    addedToSongCount = true;
                }

            } else if (db.reviewDB.get(artistArray[i], `${setterSongName}`)[interaction.user.id] && review_object.name != undefined) { // Check if you are already in the system, and replace the review if you are.

                const songObj = db.reviewDB.get(artistArray[i], `${setterSongName}`);
                let songReviewObj = songObj[interaction.user.id];

                // Quickly update stats
                await updateStats(interaction, songReviewObj.guild_id, origArtistArray, artistArray, rmxArtistArray, songName, songName, songObj, false, true);

                delete songObj[interaction.user.id];
    
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                Object.assign(songObj, newuserObj);
                db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
                db.reviewDB.set(artistArray[i], songArt, `${setterSongName}.art`);
                if (spotifyUri != false) db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.spotify_uri`);

            } else if (review_object.name != undefined) { // Otherwise if you have no review but the song and artist objects exist

                const songObj = db.reviewDB.get(artistArray[i], `${setterSongName}`);

                //Create the object that will be injected into the Song object
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                //Inject the newsongobject into the songobject and then put it in the database
                Object.assign(songObj, newuserObj);
                db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
                db.reviewDB.set(artistArray[i], songArt, `${setterSongName}.art`);
                if (spotifyUri != false) db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.spotify_uri`);
                db.reviewDB.math(artistArray[i], '+', 1, `${setterSongName}.review_num`);

            }

        }
    
        if (rmxArtistArray.length != 0) {
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterOrigSongName = convertToSetterName(origSongName);
            let objOrigSongName = origSongName.replace('[', '_((').replace(']', '))_');

            // This loop is for the original artists on a remix review
            for (let i = 0; i < origArtistArray.length; i++) {
                let song_object = {
                    [objOrigSongName]: { 
                        remixers: [rmxArtistArray.join(' & ')],
                        remix_collab: [],
                        art: false,
                        collab: origArtistArray.filter(word => origArtistArray[i] != word), // Filter out the specific artist in question
                        ep: ep_name,
                        review_num: 0,
                    },
                };

                if (!db.reviewDB.has(origArtistArray[i])) { // If the artist DB doesn't exist

                    db.reviewDB.set(origArtistArray[i], song_object);
                    db.global_bot.math('stats', `+`, 1, `artist_num`);
                    if (addedToSongCount == false) {
                        db.global_bot.math('stats', `+`, 1, `song_num`);
                        addedToSongCount = true;
                    }
    
                } else if (db.reviewDB.get(origArtistArray[i], `${setterOrigSongName}`) == undefined) { //If the artist db exists, check if the song db doesn't exist
                    const artistObj = db.reviewDB.get(origArtistArray[i]);
    
                    //Create the object that will be injected into the Artist object
                    const newsongObj = song_object;
    
                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(origArtistArray[i], artistObj);
                    if (addedToSongCount == false) {
                        db.global_bot.math('stats', `+`, 1, `song_num`);
                        addedToSongCount = true;
                    }
    
                } else {
                    if (!db.reviewDB.get(origArtistArray[i], `${setterOrigSongName}`).remixers.includes(rmxArtistArray.join(' & '))) {
                        db.reviewDB.push(origArtistArray[i], rmxArtistArray.join(' & '), `${setterOrigSongName}.remixers`);
                    }
                }
            }
        }
    },

    review_ep: async function(interaction, artistArray, ep_name, overall_rating, overall_review, taggedUser, art, starred, spotifyUri) {
        let { convertToSetterName, updateStats } = require('./func.js');

        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterEpName = convertToSetterName(ep_name);
        let objEpName = ep_name.replace('[', '_((').replace(']', '))_');
        let addedToEPCount = false;

        // Add in the EP object/review
        for (let i = 0; i < artistArray.length; i++) {

            let epObject = {
                [objEpName]: {
                    [interaction.user.id]: {
                        url: false,
                        timestamp: false, 
                        msg_id: false,
                        channel_id: false,
                        guild_id: interaction.guild.id,
                        starred: starred,
                        name: interaction.member.displayName,
                        rating: overall_rating,
                        review: overall_review,
                        sentby: taggedUser.id,
                        no_songs: true,
                    },
                    art: art,
                    collab: artistArray.filter(word => artistArray[i] != word),
                    songs: [],
                    spotify_uri: spotifyUri,
                },
            }; 

            let reviewObject = {
                url: false,
                msg_id: false,
                channel_id: false,
                guild_id: interaction.guild.id,
                starred: starred,
                name: interaction.member.displayName,
                rating: overall_rating,
                review: overall_review,
                sentby: taggedUser.id,
                no_songs: true,
            };

            if (!db.reviewDB.has(artistArray[i])) { // If the artist DB doesn't exist
                db.reviewDB.set(artistArray[i], epObject);
                db.global_bot.math('stats', `+`, 1, `artist_num`);
                if (addedToEPCount == false) {
                    db.global_bot.math('stats', `+`, 1, `ep_num`);
                    addedToEPCount = true;
                }

            } else if (!db.reviewDB.get(artistArray[i], `${setterEpName}`)) { // If the EP DB doesn't exist but the artist DB does
                let db_artist_obj = db.reviewDB.get(artistArray[i]);
                Object.assign(db_artist_obj, epObject);
                db.reviewDB.set(artistArray[i], db_artist_obj);

                if (addedToEPCount == false) {
                    db.global_bot.math('stats', `+`, 1, `ep_num`);
                    addedToEPCount = true;
                }
            } else { // If both exist
                const db_ep_obj = db.reviewDB.get(artistArray[i], `${setterEpName}`);

                if (db_ep_obj[interaction.user.id] != undefined) {
                    let epReviewObj = db_ep_obj[interaction.user.id];

                    // Quickly update stats
                    await updateStats(interaction, epReviewObj.guild_id, artistArray, artistArray, [], ep_name, ep_name, db_ep_obj, true, true);

                    delete db_ep_obj[interaction.user.id];
                }

                let new_user_obj = {
                    [`${interaction.user.id}`]: reviewObject,
                };

                Object.assign(db_ep_obj, new_user_obj);
                db.reviewDB.set(artistArray[i], db_ep_obj, `${setterEpName}`);
                if (art != undefined && art != false && art != null && !art.includes('avatar')) {
                    db.reviewDB.set(artistArray[i], art, `${setterEpName}.art`);
                }
                if (spotifyUri != false) db.reviewDB.set(artistArray[i], spotifyUri, `${setterEpName}.spotify_uri`);
            }
        }
    },

    average: function(array) {
        return array.reduce((a, b) => a + b) / array.length;
    },

    /**
     * Searches the spotify API to grab a song or EP/LP art and returns an image link to the song art, or false if it can't find one.
     * @param {Array} artistArray The artist array of the song or EP/LP to search on Spotify.
     * @param {String} name The name of the song or EP/LP to search on Spotify.
     */
    grab_spotify_art: async function(artistArray, name) {
        const { spotify_api_setup } = require('./func.js');
        // let spotifyApi = new SpotifyWebApi({
        //     redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        //     clientId: process.env.SPOTIFY_API_ID,
        //     clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        // });
        
        // // Retrieve an access token.
        // spotifyApi.clientCredentialsGrant().then(
        //     function(data) {
        //         // Save the access token so that it's used in future calls
        //         spotifyApi.setAccessToken(data.body['access_token']);
        //     },
        //     function(err) {
        //         console.log('Something went wrong when retrieving an access token', err);
        //     },
        // );

        const spotifyApi = await spotify_api_setup('122568101995872256');

        let search = name;
        search = name.replace(' EP', '');
        search = search.replace(' LP', '');
        const song = `${artistArray[0]} ${search}`;
        let result = false;

        await spotifyApi.searchTracks(song).then(function(data) {  
            let results = data.body.tracks.items;
            let songData = data.body.tracks.items[0];
            for (let i = 0; i < results.length; i++) {
                if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${song.toLowerCase()}`) {
                    songData = results[i];
                    break;
                } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${song.toLowerCase()}`) {
                    songData = results[i];
                }
            }

            if (results.length != 0) {
                result = songData.album.images[0].url;
            }
        }).catch((err) => {
            console.log(err);
        });

        return await result;
    },

    /**
     * Searches the spotify API to grab artist images for each artist in an array, and returns an array of image links in the same order.
     * @param {Array} artistArray The artist array to find images for on Spotify.
     * @return {Array} An array of image links, in the same order as artistArray.
     */
    grab_spotify_artist_art: async function(artistArray) {
        const { spotify_api_setup } = require('./func.js');
        // let spotifyApi = new SpotifyWebApi({
        //     redirectUri: process.env.SPOTIFY_REDIRECT_URI,
        //     clientId: process.env.SPOTIFY_API_ID,
        //     clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        // });
        
        // // Retrieve an access token.
        // spotifyApi.clientCredentialsGrant().then(
        //     function(data) {
        //         // Save the access token so that it's used in future calls
        //         spotifyApi.setAccessToken(data.body['access_token']);
        //     },
        //     function(err) {
        //         console.log('Something went wrong when retrieving an access token', err);
        //     },
        // );

        const spotifyApi = await spotify_api_setup('122568101995872256');
        let imageArray = [];

        // Check if our artistArray is somehow 0, and if so just return an empty list.
        if (artistArray.length == 0) return [];

        for (let artist of artistArray) {
            await spotifyApi.searchArtists(artist).then(function(data) {  
                let results = data.body.artists.items[0].images;
                if (results.length == 0) imageArray.push(false);
                else imageArray.push(results[0].url);
            });
        }

        return imageArray;
    },

    handle_error: function(interaction, client, err) {
        let strErr = `${err}`;
        if (strErr.toLowerCase().includes('webapiregularerror') || strErr.toLowerCase().includes('webapierror')) {
            interaction.editReply({ content: `The Spotify Web API is currently down or having issues, which means that Spotify functions are temporarily unavailable. This usually only lasts a couple minutes, so try again in just a bit!`, 
            embeds: [], components: [] }).catch(() => {
                interaction.reply({ content: `The Spotify Web API is currently down or having issues, which means that Spotify functions are temporarily unavailable. This usually only lasts a couple minutes, so try again in just a bit!`, 
                embeds: [], components: [] });
            }); 
        } else {
            interaction.editReply({ content: `Waveform ran into an error. Don't worry, the bot is still online!\nError: \`${err}\``, 
            embeds: [], components: [] }).catch(() => {
                interaction.reply({ content: `Waveform ran into an error. Don't worry, the bot is still online!\nError: \`${err}\``, 
                embeds: [], components: [] });
            });
        }

        const guild = client.guilds.cache.get('680864893552951306');
        console.log(err.stack);
        if (guild == undefined || guild == null || guild == false) return;
        let error_channel = guild.channels.cache.get('933610135719395329');
        let error = String(err.stack);
        interaction.fetchReply().then(msg => {
            error_channel.send(`Waveform Error!\n**${error}**\nMessage Link with Error: <${msg.url}>`);
            console.log(err);
        }).catch(() => {
            console.log(err);
        });
    },

    find_most_duplicate: function(array) {
        let valObj = {}, max_length = 0, rep_arr = [];
    
        array.forEach(function(el) {
        if (Object.prototype.hasOwnProperty.call(valObj, el)) {
            valObj[el] += 1;
            max_length = (valObj[el] > max_length) ? valObj[el] : max_length;
        }
        else{
            valObj[el] = 1;
        }
        });
    
        Object.keys(valObj).forEach(function(val) {
            (valObj[val] >= max_length) && (rep_arr.push([val, valObj[val]]));
        });
        return rep_arr;
    },

    /**
     * Gets the channel object of a review message, for use in messing with it.
     * @param {Object} interaction The interaction of the slash command this function is used in.
     * @param {String} user_id The user ID of the reviewer. 
     * @param {String} msg_id The ID of the review message. 
     */
    get_review_channel: async function(client, guild_id, channel_id, msg_id) {
        let guild = await client.guilds.cache.get(guild_id);
        if (guild == undefined) return undefined;
        let channelsearch = await guild.channels.cache.get(channel_id);
        if (channelsearch == undefined) return undefined;

        let target = undefined;
        await channelsearch.messages.fetch(msg_id).then(async () => {
            target = channelsearch;
        }).catch(() => {
            target = undefined;
        });

        return target;
    },

    /**
     * Sets up and returns a spotify web api object for the interaction user.
     * @param {String} user_id The user id to authenticate to the Spotify API.
     */
    spotify_api_setup:  async function(user_id, first_time = false) {
        if (!db.user_stats.has(user_id)) return false;
        const access_token = db.user_stats.get(user_id, 'access_token');
        const refresh_token = db.user_stats.get(user_id, 'refresh_token');

        if (first_time) {
            const spotifyApi = new SpotifyWebApi({
                redirectUri: process.env.SPOTIFY_REDIRECT_URI,
                clientId: process.env.SPOTIFY_API_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            });

            // Refresh access token so we can use API
            await spotifyApi.setRefreshToken(refresh_token);
            await spotifyApi.setAccessToken(access_token);
            await spotifyApi.refreshAccessToken().then(async data => {
                console.log(data.body["access_token"]);
                await db.user_stats.set(user_id, data.body["access_token"], 'access_token');
                await spotifyApi.setAccessToken(data.body["access_token"]);
            }); 
            return spotifyApi;
        }

        // If we have an access token for spotify API (therefore can use it)
        if (access_token != undefined && access_token != false && access_token != 'na') {
            const spotifyApi = new SpotifyWebApi({
                redirectUri: process.env.SPOTIFY_REDIRECT_URI,
                clientId: process.env.SPOTIFY_API_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            });

            // Refresh access token so we can use API
            await spotifyApi.setRefreshToken(refresh_token);
            await spotifyApi.setAccessToken(access_token);
            await spotifyApi.refreshAccessToken().then(async data => {
                await db.user_stats.set(user_id, data.body["access_token"], 'access_token');
                await spotifyApi.setAccessToken(data.body["access_token"]);
            }); 

            return spotifyApi;
        } else {
            return false;
        }
    },
    
    isValidURL: function(string) {
        let res = string.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
        return (res !== null);
    },

    convertToSetterName: function(string) {
        if (string.includes('[') || string.includes(']')) {
            string = string.replace('[', '_((');
            string = string.replace(']', '))_');
        }
        return string.includes('.') ? `["${string}"]` : string;
    },

    /**
     * Takes a full artist array and remix artist array and fixes the remix artist array
     * Used in situations where you have something like [Camo, Krooked, Mefjus] instead of [Camo \& Krooked, Mefjus].
     * @param {Array} artistArray The full original artist array with all artists (including remixers) in it
     * @param {Array} rmxArtistArray The array of remixers that needs to be fixed
     */
    getProperRemixers: function(artistArray, rmxArtistArray) {
        let newRmxArtistArray = [];
        for (let i = 0; i < rmxArtistArray.length; i++) {
            if (i != rmxArtistArray.length - 1) {
                if (artistArray.includes(`${rmxArtistArray[i]} \\& ${rmxArtistArray[i + 1]}`)) {
                    newRmxArtistArray.push(`${rmxArtistArray[i]} \\& ${rmxArtistArray[i + 1]}`);
                    i++;
                } else {
                    newRmxArtistArray.push(rmxArtistArray[i]);
                }
            } else {
                if (artistArray.includes(`${rmxArtistArray[i]} \\& ${rmxArtistArray[0]}`)) {
                    newRmxArtistArray.push(`${rmxArtistArray[i]} \\& ${rmxArtistArray[0]}`);
                    i++;
                } else {
                    newRmxArtistArray.push(rmxArtistArray[i]);
                }
            }
        }

        return newRmxArtistArray;
    },

    /**
     * Updates the statistics across the bot, for the user, server, and the bot globally
     * This function is designed to be used after a review is made with the bot using the review commands.
     * @param {Object} interaction The interaction the command was run from
     * @param {String} guildId The guild this review is involved in
     * @param {Array} origArtistArray The non-remix artists involved with the song
     * @param {Array} artistArray The artists (including remixers) involved with the song
     * @param {Array} rmxArtistArray Specifically the remixers of the song
     * @param {String} songName The name of the song
     * @param {String} displaySongName The display name of the song
     * @param {Object} songObj The song data object
     * @param {Boolean} ep If this is an EP/LP or a song
     * @param {Boolean} delete_mode [Optional] Set if we want are taking away stats instead of adding to stats (for use in /deletereview)
     */
    updateStats: async function(interaction, guildId, origArtistArray, artistArray, rmxArtistArray, songName, displaySongName, songObj, ep, delete_mode = false) {

        const { arrayEqual } = require('./func.js');
        let userId = interaction.user.id;
        let reviewObj = songObj[userId];
        let starred = reviewObj.starred;
        let rating = reviewObj.rating;

        // The only way it could possibly be false is if it's from old reviews in Hotdog Water server.
        if (guildId == false) guildId = '680864893552951306';

        let userStatsObj = db.user_stats.get(userId, 'stats');
        let guildStatsObj = db.server_settings.get(guildId, 'stats');
        let botStatsObj = db.global_bot.get('stats');

        let change_num = 1 * (delete_mode == false ? 1 : -1);

        /// Update the easy number stats
        if (userStatsObj.ratings_list[rating] != undefined && userStatsObj.ratings_list[rating] != null) {
            userStatsObj.ratings_list[rating] = userStatsObj.ratings_list[rating] + change_num;
        } else {
            userStatsObj.ratings_list[rating] = _.clamp(change_num, 0, 1);
        }

        // Add this user to the list of users who have used Waveform at least once
        if (!botStatsObj.waveform_users.includes(userId)) {
            botStatsObj.waveform_users.push(userId);
        }

        for (let statObj of [userStatsObj, guildStatsObj, botStatsObj]) {
            
            // Add to number of reviews (ep or not)
            if (ep == true) {
                statObj.ep_review_num = statObj.ep_review_num + change_num;
            } else {
                statObj.review_num = statObj.review_num + change_num;
            }

            // Add to number of stars
            if (starred == true && delete_mode == false) {
                statObj.star_num += 1;

                if (!userStatsObj.star_list.some(v => arrayEqual(v.db_artists, artistArray) && v.db_song_name == songName)) {
                    userStatsObj.star_list.push({ 
                        db_artists: artistArray,
                        orig_artists: origArtistArray,
                        rmx_artists: rmxArtistArray,
                        db_song_name: songName,
                        display_name: displaySongName,
                        spotify_uri: songObj.spotify_uri,
                    });
                }
            } else if (delete_mode == true && starred == true) {
                statObj.star_num -= 1;

                if (userStatsObj.star_list.some(v => arrayEqual(v.db_artists, artistArray) && v.db_song_name == songName)) {
                    userStatsObj.star_list = userStatsObj.star_list.filter(v => v.db_song_name != songName && !arrayEqual(v.db_artists, artistArray));
                }
            }

            // Add to number of 10s
            if (rating == 10) {
                statObj.ten_num = statObj.ten_num + change_num;
            }
        }

        db.user_stats.set(userId, userStatsObj, 'stats');
        db.server_settings.set(guildId, guildStatsObj, 'stats');
        db.global_bot.set('stats', botStatsObj);
    },

    getEmbedColor: function(member) {
        let embedColor = db.user_stats.get(member.user.id, 'config.embed_color');
        if (embedColor == false || embedColor == undefined) {
            embedColor = member.displayHexColor;
        } else {
            embedColor = embedColor.replace('#', '');
        }

        return embedColor;
    },

    arrayEqual: function(array1, array2) {
        if (array1.length === array2.length) {
            return array1.every(element => {
            if (array2.includes(element)) {
                return true;
            }

            return false;
            });
        }

        return false;
    },

    getTrackList: function(data, origArtistArray, rmxArtistArray) {
        let trackList = data.tracks.items.map(t => [t.name, t.artists]);
        let rmx_delimiter = ' & ';
        let passesChecks = true;
        for (let i = 0; i < trackList.length; i++) {
            let songArg = trackList[i][0];
            songArg = songArg.replace('remix', 'Remix'); // Just in case there is lower case remix
            trackList[i][1] = trackList[i][1].map(v => v.name);
            let rmxArtist = false;
            if (songArg.includes('(feat.')) {
                songArg = songArg.split(' (feat. ');
                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                trackList[i][0] = songArg[0];
            }
    
            if (songArg.includes('(ft. ')) {
                songArg = songArg.split(' (ft. ');
                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                trackList[i][0] = songArg[0];
            }
    
            if (songArg.includes('(with ')) {
                songArg = songArg.split(' (with ');
                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                trackList[i][0] = `${songArg[0]}${(rmxArtistArray.length > 0) ? ` (${rmxArtist} Remix)` : ``}`;
            }

            if (!songArg.includes('VIP Remix')) {
                if (songArg.includes(' Remix)') || songArg.includes(' Remix]')) {
                    rmxArtist = [];
                    songArg = songArg.replace('[', '(');
                    songArg = songArg.replace(']', ')');
                    let temp = songArg.split(' Remix)')[0].split('(');
                    rmxArtist = temp[temp.length - 1];

                    rmx_delimiter = ' & ';
                    // Input validation
                    rmxArtist = rmxArtist.replace(' VIP', '');
                    if (rmxArtist.includes(' and ')) rmx_delimiter = ' and ';
                    if (rmxArtist.includes(' x ')) rmx_delimiter = ' x ';
                    if (rmxArtist.includes(', ') && !origArtistArray.filter(v => v == rmxArtist) == 0) rmx_delimiter = ', ';

                    let tempRmxArtistArray = rmxArtist.split(rmx_delimiter);
                    for (let j = 0; j < tempRmxArtistArray.length; j++) {
                        if (!trackList[i][1].includes(tempRmxArtistArray[j])) {
                            for (let k = 0; k < trackList[i][1].length; k++) {
                                if (trackList[i][1][k].toUpperCase() === tempRmxArtistArray[j].toUpperCase()) {
                                    tempRmxArtistArray[j] = trackList[i][1][k];
                                }
                            }
                        }
                    }

                    songArg = `${temp[0].trim()} (${tempRmxArtistArray.join(' & ')} Remix)`;
                    trackList[i][0] = songArg;
                }
        
                if ((songArg.includes('Remix') && songArg.includes(' - ')) && !songArg.includes('Remix)') && !songArg.includes('Remix]')) {
                    rmxArtist = [];
                    songArg = songArg.split(' - ');
                    
                    if (songArg[1] != 'Remix') {
                        rmxArtist = songArg[1].slice(0, -6);
                        rmxArtist = rmxArtist.replace(' VIP', '');
                        if (rmxArtist.includes(' and ') && !rmxArtist.includes(' & ')) rmx_delimiter = ' and ';
                        if (rmxArtist.includes(' x ') && !rmxArtist.includes(' & ')) rmx_delimiter = ' x ';
                        if (rmxArtist.includes(', ') && !origArtistArray.filter(v => v == rmxArtist) == 0 && !rmxArtist.includes(' & ')) rmx_delimiter = ', ';
        
                        // Deal with features being in the song name before the remix lol
                        if (songArg[0].includes('feat.') || songArg[0].includes('ft.')) {
                            songArg[0] = songArg[0].replace('feat.', 'ft.');
                            songArg[0] = songArg[0].split(` (ft.`)[0];
                        }
        
                        let tempRmxArtistArray = rmxArtist.split(rmx_delimiter);
                        for (let j = 0; j < tempRmxArtistArray.length; j++) {
                            if (!trackList[i][1].includes(tempRmxArtistArray[j])) {
                                for (let k = 0; k < trackList[i][1].length; k++) {
                                    if (trackList[i][1][k].toUpperCase() === tempRmxArtistArray[j].toUpperCase()) {
                                        tempRmxArtistArray[j] = trackList[i][1][k];
                                    }
                                }
                            }
                        }
                
                        songArg = `${songArg[0]} (${tempRmxArtistArray.join(' & ')} Remix)`;
                        trackList[i][0] = songArg;
                    } else {
                        songArg = songArg.join(' - ');
                    }
                }
            }

            trackList[i] = trackList[i][0];
        }

        if (trackList.length <= 1 && !(trackList.length == 1 && data.tracks.items[0].duration_ms >= 1.2e+6)) {
            passesChecks = 'length';
        } else if (trackList.length > 25) {
            passesChecks = 'too_long';
        }

        return [trackList, passesChecks];
    },

    lfm_api_setup: async function(userId, lfmUser = false) {
        if (lfmUser == false) lfmUser = db.user_stats.get(userId, 'lfm_username');
        if (db.user_stats.get(userId, 'config.display_scrobbles') == false) lfmUser = false;
        if (lfmUser == false || lfmUser == undefined) return false;

        let lfm = new lastfm.default({
            apiKey: process.env.LAST_FM_API_KEY,
            apiSecret: process.env.LAST_FM_API_SECRET,
            username: lfmUser,
        });

        return lfm;
    },

    getLfmUsers: function() {
        let userArray = db.user_stats.keyArray();
        let output = [];
        for (let user of userArray) {
            let userData = db.user_stats.get(user);
            if (userData.lfm_username != false && userData.lfm_username != undefined) {
                output.push({ user_id: user, lfm_username: userData.lfm_username });
            }
        }

        return output;
    },
    
    /**
     * Loop through the database, using specific queries to get specific return data. 
     * By default this does the "GlobalAllAlbums" query with an ascending sort, if no options or query are passed in.
     * @param {String} queryType Query type, see DatabaseQuery for an enum of the query types
     * @param {Object} options Default: {sort = 'asc', rating = false, user = false, guild = false} should be adjusted based on queryType necessities.
     * @returns A list of the query result 
     */
    queryReviewDatabase: async function(queryType = DatabaseQuery.GlobalAllAlbums, options = { sort: 'asc', rating: false, user_id: false, guild_id: false, no_remix: false }) {
        const { convertToSetterName, get_user_reviews, getProperRemixers } = require('./func.js');

        const ARTISTARRAY = db.reviewDB.keyArray();
        let songSkip = [];
        let resultList = [];
        let optionsUser = options.user_id || false;
        let optionsSort = options.sort || 'asc';
        let optionsNoRemix = options.no_remix || false;

        //let optionsGuild = options.guild_id || false;
        let optionsRating = options.rating || false;
        let allSongQueries = [DatabaseQuery.GlobalAllSongs, DatabaseQuery.ServerAllSongs, DatabaseQuery.UserAllSongs];
        let allSpecSongQueries = [DatabaseQuery.GlobalSpecRatingAlbums, DatabaseQuery.ServerSpecRatingSongs, DatabaseQuery.UserSpecRatingSongs];
        let allRemixQueries = [DatabaseQuery.GlobalAllRemixes, DatabaseQuery.ServerAllRemixes, DatabaseQuery.UserAllRemixes];
        let allSpecRemixQueries = [DatabaseQuery.GlobalSpecRatingRemixes, DatabaseQuery.ServerSpecRatingRemixes, DatabaseQuery.UserSpecRatingRemixes];
        let allAlbumQueries = [DatabaseQuery.GlobalAllAlbums, DatabaseQuery.ServerAllAlbums, DatabaseQuery.UserAllAlbums];
        let allSpecAlbumQueries = [DatabaseQuery.GlobalSpecRatingAlbums, DatabaseQuery.ServerSpecRatingAlbums, DatabaseQuery.UserSpecRatingAlbums];
        let allEPQueries = [DatabaseQuery.GlobalAllEPs, DatabaseQuery.ServerAllEPs, DatabaseQuery.UserAllEPs];
        let allSpecEPQueries = [DatabaseQuery.GlobalSpecRatingEPs, DatabaseQuery.ServerSpecRatingEPs, DatabaseQuery.UserSpecRatingEPs];

        for (let artist of ARTISTARRAY) {
            let songArray = Object.keys(db.reviewDB.get(artist));
            songArray = songArray.map(v => v = v.replace('_((', '[').replace('))_', ']'));
            songArray = songArray.filter(v => v != 'pfp_image');

            for (let song of songArray) {
                let setterSongName = convertToSetterName(song);
                let songObj = db.reviewDB.get(artist, `${setterSongName}`);
                let userArray = [];
                let isRemix = false;
                if (songObj != null && songObj != undefined) {
                    userArray = await get_user_reviews(songObj);
                } else {
                    userArray = [];
                }

                if (optionsUser != false && queryType.includes('user')) {
                    userArray = userArray.filter(v => v == optionsUser);
                }

                if (songSkip.includes(`${artist} - ${song}`)) continue;

                let otherArtists = [artist, songObj.collab].flat(1);
                let allArtists = otherArtists.map(v => {
                    if (v == undefined) {
                        return [];
                    }
                    return v;
                });
                allArtists = allArtists.flat(1);

                let origArtistArray = allArtists;
                let rmxArtistArray = [];

                // Handle remixes we encounter
                if (song.includes(' Remix)') && optionsNoRemix == false) {
                    let temp = song.split(' Remix)')[0].split('(');
                    let rmxArtist = temp[temp.length - 1];
        
                    // Input validation
                    rmxArtist = rmxArtist.replace(' VIP', '');
                    rmxArtistArray = rmxArtist.split(' & ');

                    // Fix the remix artist array if needed
                    if (rmxArtistArray.length != 0) {
                        temp = getProperRemixers(origArtistArray, rmxArtistArray);
                        if (!_.isEqual(temp, rmxArtistArray)) {
                            rmxArtistArray = temp;
                        }
                    }

                    for (rmxArtist of rmxArtistArray) {
                        origArtistArray = origArtistArray.filter(v => !v.includes(rmxArtist));
                    }
                    allArtists = rmxArtistArray;
                    isRemix = true;
                } else if (song.includes(' Remix)') && optionsNoRemix == true) {
                    continue;
                }

                let resultDataObj = { origArtistArray: origArtistArray, allArtists, name: song, dataObj: songObj };
                for (let k = 0; k < userArray.length; k++) {
                    let userData = songObj[userArray[k]];

                    if (song.includes(' LP') && allAlbumQueries.includes(queryType)) {
                        resultList.push(resultDataObj); break;
                    } else if (song.includes(' EP') && allEPQueries.includes(queryType)) {
                        resultList.push(resultDataObj); break;
                    } else if (isRemix == true && allRemixQueries.includes(queryType)) {
                        resultList.push(resultDataObj); break;
                    } else if (allSongQueries.includes(queryType) && !song.includes(' EP') && !song.includes(' LP')) {
                        resultList.push(resultDataObj); break;

                    // Specific rating   
                    } else if (song.includes(' LP') && allSpecAlbumQueries.includes(queryType)) {
                        if (parseFloat(userData.rating) === parseFloat(optionsRating)) resultList.push(resultDataObj); break;
                    } else if (song.includes(' EP') && allSpecEPQueries.includes(queryType)) {
                        if (parseFloat(userData.rating) === parseFloat(optionsRating)) resultList.push(resultDataObj); break;
                    } else if (isRemix == true && allSpecRemixQueries.includes(queryType) && !song.includes(' EP') && !song.includes(' LP')) {
                        if (parseFloat(userData.rating) === parseFloat(optionsRating)) resultList.push(resultDataObj); break;
                    } else if (allSpecSongQueries.includes(queryType) && !song.includes(' EP') && !song.includes(' LP')) {
                        if (parseFloat(userData.rating) === parseFloat(optionsRating)) resultList.push(resultDataObj); break;
                    }
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${song}`)) {
                        songSkip.push(`${allArtists[v]} - ${song}`);
                    }
                }
            }
        }

        if (queryType.includes('user')) {
            if (optionsSort == 'asc') {
                resultList.sort((a, b) => {
                    let a_userData = a.dataObj[optionsUser];
                    let b_userData = b.dataObj[optionsUser];
                    return (parseFloat(b_userData.rating !== false ? b_userData.rating : -1) * (b_userData.starred == true ? 100 : 1)) - (parseFloat(a_userData.rating !== false ? a_userData.rating : -1) * (a_userData.starred == true ? 100 : 1));
                });
            } else if (optionsSort == 'dsc') {
                resultList.sort((a, b) => {
                    let a_userData = a.dataObj[optionsUser];
                    let b_userData = b.dataObj[optionsUser];
                    return parseFloat(a_userData.rating !== false ? a_userData.rating : -1) - parseFloat(b_userData.rating !== false ? b_userData.rating : -1);
                });
            } else if (optionsSort == 'recent') {
                resultList.sort((a, b) => {
                    let a_timestamp = a.dataObj[optionsUser].timestamp;
                    let b_timestamp = b.dataObj[optionsUser].timestamp;

                    if (a_timestamp === undefined && b_timestamp === undefined) return 0;
                    if (a_timestamp === undefined) return 1;
                    if (b_timestamp === undefined) return -1;

                    return b_timestamp - a_timestamp;
                });
            }
        }

        return resultList;
    },

    /**
     * Attempts to retrieve the Spotify and Last.fm URL of a song based off of purely name.
     * May not always result in the correct URL, but it'll usually be close.
     * Gives a basic google link if it can't find anything
     * @param {Array} artistArray The array of artists involved in the song
     * @param {String} musicName The name of the piece of music
     * @param {Object} spotifyApi Spotify API object to use for query
     * @returns An object structured like this: {lastfm_url: lfm_url, spotify_url: sp_url}
     */
    getMusicUrl: async function(artistArray, musicName, spotifyApi = false) {
        const { spotify_api_setup } = require('./func.js');

        if (spotifyApi == false) {
            spotifyApi = await spotify_api_setup('122568101995872256');
        }

        let search = musicName;
        let songData;
        search = musicName.replace(' EP', '');
        search = search.replace(' LP', '');
        let song = `${artistArray[0]} ${search}`;

        await spotifyApi.searchTracks(song).then(function(data) {  
            let results = data.body.tracks.items;
            songData = data.body.tracks.items[0];
            for (let i = 0; i < results.length; i++) {
                if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].album.name.toLowerCase()}` == `${song.toLowerCase()}`) {
                    songData = results[i];
                    break;
                } else if (`${results[i].album.artists.map(v => v.name)[0].toLowerCase()} ${results[i].name.toLowerCase()}` == `${song.toLowerCase()}`) {
                    songData = results[i];
                }
            }
        });

        if (songData === false) {
            return { lastfm_url: 'https://www.google.com', spotify_url: 'https://www.google.com', spotify_uri: false };
        } else {
            return { lastfm_url: 'https://www.google.com', spotify_url: songData.external_urls.spotify, spotify_uri: songData.uri };
        }
    },

    spotifyUritoURL: async function(spotifyUri, origArtistArray = false, musicName = false) {
        const { getMusicUrl } = require('./func.js');
        if (spotifyUri == undefined || spotifyUri == false || spotifyUri == null) {
            if (origArtistArray === false || musicName === false) {
                return 'https://www.google.com';
            } else {
                let musicUrl = await getMusicUrl(origArtistArray, musicName);
                console.log(musicUrl);
                return musicUrl.spotify_url;
            }
        } else if (spotifyUri.includes('track')) {
            return `https://open.spotify.com/track/${spotifyUri.replace('spotify:track:', '')}`;
        } else if (spotifyUri.includes('album')) {
            return `https://open.spotify.com/album/${spotifyUri.replace('spotify:album:', '')}`;
        } else {
            return 'https://www.google.com';
        }
    },

    getUserDataAoty: async function(user, route) {
        const { fetchAotyPage } = require('./func.js');
        const userUrl = `https://www.albumoftheyear.org/user/${user}${route}`;

        try {
            const $ = await fetchAotyPage(userUrl);

            const perfectScores = $('.albumBlock');
            if (!perfectScores.length) return [];

            const scores = perfectScores.map((index, element) => {
                const artistName = $(element).find('.artistTitle').text().trim();
                const albumName = $(element).find('.albumTitle').text().trim();
                const albumType = $(element).find('.type').text().trim();
                const albumRating = $(element).find('.rating').text().trim();
                const albumDate = $(element).find('.ratingText').text().trim();

                return {
                    'artist_name': artistName,
                    'album_name': albumName,
                    'album_type': albumType,
                    'album_rating': parseInt(albumRating),
                    'album_date': albumDate,
                };
            }).get();

            return scores;
        } catch (error) {
            console.error('Error fetching user perfect scores:', error);
            return [];
        }
    },

    getDataAoty: async function(route) {
        const { fetchAotyPage } = require('./func.js');
        const url = `https://www.albumoftheyear.org${route}`;
        console.log(url);

        try {
            const $ = await fetchAotyPage(url);

            const perfectScores = $('.albumBlock');
            if (!perfectScores.length) return [];

            const scores = perfectScores.map((index, element) => {
                const parentAnchorTag = $(element).find('.albumTitle').parent('a').attr('href').replace('/album/', '').replace('.php', '');
                const artistName = $(element).find('.artistTitle').text().trim();
                const albumName = $(element).find('.albumTitle').text().trim();
                const albumType = $(element).find('.type').text().trim();
                const albumRating = $(element).find('.rating').text().trim();
                const albumDate = $(element).find('.ratingText').text().trim();

                return {
                    'artist_name': artistName,
                    'album_name': albumName,
                    'album_type': albumType,
                    'album_rating': parseInt(albumRating),
                    'album_date': albumDate,
                    'aoty_id': parentAnchorTag,
                };
            }).get();

            console.log(scores);

            return scores;
        } catch (error) {
            console.log(url);
            return [];
        }
    },

    fetchAotyPage: async function(url) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/6.0',
                },
            });

            const html = response.data;
            const $ = cheerio.load(html);

            return $;
        } catch (error) {
            console.error('Error fetching page:', error);
            return null;
        }
    },
};