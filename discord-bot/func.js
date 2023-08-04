/* eslint-disable no-useless-escape */
const { EmbedBuilder } = require('discord.js');
const db = require("./db.js");
const _ = require('lodash');
const SpotifyWebApi = require('spotify-web-api-node');

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

    get_user_reviews: function(songObj) {
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
        return userArray;
    },

    /**
     * Takes in a song object and gives back the number of starred reviews the song has.
     * @param {Object} songObj The song object from the database.
     * @returns An integer of the number of stars on this song.
     */
    get_star_num: function(songObj) {
        const { get_user_reviews } = require('./func.js');
        if (songObj == undefined && songObj == null) return [];
        let userArray = get_user_reviews(songObj);
        let starCount = 0;
        for (let user of userArray) {
            if (songObj[user].starred) starCount += 1;
        }
        return starCount;
    },

    parse_artist_song_data: async function(interaction, artists = null, song = null, remixers = null) {
        const { spotify_api_setup, getProperRemixers, convertToSetterName } = require('./func.js');

        // If we are in the /editdata artist command and put in a manual name entry, run this a little differently
        let editDataSubCommand = 'N/A';

        if (interaction.commandName == 'editdata') {
            editDataSubCommand = interaction.options.getSubcommand();
            if (editDataSubCommand == 'artist' && artists != null) {
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
        let tempRmxArtistArray = [];
        let passesChecks = true;
        let trackList = false;
        let songArt = false;
        let localReturnObj = {};
        let songUri = false;
        let rmx_delimiter = ' & ';
        if (remixers != null) {
            rmxArtistArray = [remixers.split(' & ')];
            rmxArtistArray = rmxArtistArray.flat(1);
        }
        
        // If we're pulling from Spotify (no arguments given)
        if (origArtistArray == null && songArg == null && remixers == null) {
            const spotifyApi = await spotify_api_setup(interaction.user.id);
            let isPodcast = false;
        
            if (spotifyApi == false) {
                return { error: 'You must use `/login` to use Spotify related features!' };
            }

            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                if (data.body.currently_playing_type == 'episode') { isPodcast = true; return; }
                if (data.body.item == undefined) { passesChecks = 'notplaying'; return; }
                
                if (data.body.item.is_local == true) { 
                    passesChecks = 'local'; 
                    localReturnObj = {
                        prod_artists: data.body.item.artists[0].name.split(' & '), 
                        song_name: data.body.item.name, // Song name with remixers in the name
                        main_song_name: data.body.item.name, // Song Name without remixers in the name
                        display_song_name: data.body.item.name, // Song name with remixers and features in the name
                        db_artists: data.body.item.artists[0].name.split(' & '), 
                        all_artists: data.body.item.artists[0].name.split(' & '),
                        remix_artists: [], 
                        art: false,
                        spotify_uri: false,
                    };
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
                    if ((interaction.commandName.includes('ep') && interaction.commandName != 'pushtoepreview') || (editDataSubCommand == 'ep-lp')) {
                        if (album_data.body.album_type == 'compilation') {
                            passesChecks = false;
                            return;
                        }

                        trackList = album_data.body.tracks.items.map(t => [t.name, t.artists]);
                        for (let i = 0; i < trackList.length; i++) {
                            songArg = trackList[i][0];
                            songArg = songArg.replace('remix', 'Remix'); // Just in case there is lower case remix
                            trackList[i][1] = trackList[i][1].map(v => v.name);
                            rmxArtist = false;
                            if (songArg.includes('feat.')) {
                                songArg = songArg.split(' (feat. ');
                                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                                trackList[i][0] = songArg[0];
                            }
                    
                            if (songArg.includes('ft. ')) {
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
                                    temp = songArg.split(' Remix)')[0].split('(');
                                    rmxArtist = temp[temp.length - 1];

                                    origSongArg = temp[0].trim();
                                    // Input validation
                                    rmxArtist = rmxArtist.replace(' VIP', '');
                                    if (rmxArtist.includes(' and ')) rmx_delimiter = ' and ';
                                    if (rmxArtist.includes(' x ')) rmx_delimiter = ' x ';
                                    if (rmxArtist.includes(', ') && !origArtistArray.filter(v => v == rmxArtist) == 0) rmx_delimiter = ', ';

                                    tempRmxArtistArray = rmxArtist.split(rmx_delimiter);
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
                        
                                        tempRmxArtistArray = rmxArtist.split(rmx_delimiter);
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

                        if (trackList.length <= 1) {
                            passesChecks = 'length';
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

                        if (interaction.commandName == 'epreview') {
                            db.user_stats.set(interaction.user.id, { msg_id: false, channel_id: false, guild_id: interaction.guild.id, artist_array: origArtistArray, ep_name: songArg, review_type: 'A', track_list: trackList, next: trackList[0] }, 'current_ep_review');  
                        }
                    }
                });
            });  

            // Check if a podcast is being played, as we don't support that.
            if (isPodcast == true) {
                return { error: 'Podcasts are not supported with `/np`.' };
            }
        } else {
            if (remixers != null) {
                songArg = `${songArg} (${remixers} Remix)`;
            }
        }

        // Fix song formatting
        // TODO: MAKE ALL OF THIS INTO A FUNCTION THAT CAN BE CALLED TO CHECK IF A SONG IS VALID
        if (!Array.isArray(origArtistArray)) origArtistArray = origArtistArray.split(' & ');

        if (songArg.includes('feat.')) {
            songArg = songArg.split(' (feat. ');
            songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
            songArg[1] = songArg[1].split(')')[0];
            origSongArg = `${songArg[0]}`;
            songArg = `${songArg[0]}`;
        }

        if (songArg.includes('ft. ')) {
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
                for (let r of rmxArtistArray) {
                    if (!origArtistArray.includes(r) && interaction.commandName == 'sendmail') {
                        passesChecks = false;
                    }
                }

                origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
                songArg = `${origSongArg} (${rmxArtistArray.join(' & ')} Remix)`;
                if (rmxArtistArray[0] == '' || rmxArtistArray.length == 0) passesChecks = false;
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
                    for (let r of rmxArtistArray) {
                        if (!origArtistArray.includes(r) && interaction.commandName == 'sendmail') {
                            passesChecks = false;
                        }
                    }

                    origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
                    songArg = `${origSongArg} (${rmxArtistArray.join(' & ')} Remix)`;
                    if (rmxArtistArray[0] == '' || rmxArtistArray.length == 0) passesChecks = false;
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
        origArtistArray = artistArray.slice(0);

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

        if (origArtistArray.length == 0) passesChecks = false;

        // Error check
        if (songArg.includes('\\') && songArg.includes('.')) {
            passesChecks = false;
        } else if (origArtistArray.includes('Various Artists')) {
            passesChecks = false;
        } else if (origArtistArray.includes('')) {
            passesChecks = false;
        }

        if (passesChecks == 'notplaying') {
            return { error: 'You are not currently playing a song on Spotify.' };
        }

        if (passesChecks == 'local') {
            return localReturnObj;
        }

        if (passesChecks == false) {
            return { error: 'This piece of music cannot be parsed properly in the database, and as such cannot be used within Waveform in any way.' };
        } else if (passesChecks == 'ep') {
            return { error: 'This track cannot be added to EP/LP reviews, therefore is invalid to be used in relation with EP/LP commands.' };
        } else if (passesChecks == 'length') {
            return { error: 'This is not on an EP/LP, this is a single. As such, you cannot use this with EP/LP reviews.' };
        }

        let setterSongArg = convertToSetterName(songArg);

        if (db.user_stats.get(interaction.user.id, 'current_ep_review') == false && interaction.commandName == 'epreview') {
            if (db.reviewDB.has(artistArray[0]) && db.reviewDB.get(artistArray[0], `${setterSongArg}`) != undefined) trackList = db.reviewDB.get(artistArray[0], `${setterSongArg}`).songs;
            if (!trackList) trackList = false;
            db.user_stats.set(interaction.user.id, { msg_id: false, channel_id: false, guild_id: interaction.guild.id, artist_array: origArtistArray, ep_name: songArg, review_type: 'A', track_list: trackList, next: false }, 'current_ep_review');  
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
            if (interaction.commandName != 'review' && interaction.commandName != 'epreview' && interaction.commandName != 'pushtoepreview') {
                for (let i = 0; i < artistArray.length; i++) {
                    if (!db.reviewDB.has(artistArray[i])) {
                        return { error: `The artist \`${artistArray[i]}\` is not in the database, therefore this song isn't either.` };
                    }
                }

                for (let i = 0; i < rmxArtistArray.length; i++) {
                    if (!db.reviewDB.has(rmxArtistArray[i])) {
                        return { error: `The artist \`${rmxArtistArray[i]}\` is not in the database, therefore this song isn't either.` };
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
        };
    },

    // Updates the art for embed messages, NOT in the database. That's done in the /review commands themselves.
    update_art: async function(interaction, client, first_artist, song_name, new_image) {
        const { get_user_reviews, handle_error, get_review_channel, convertToSetterName } = require('./func.js');

        let setterSongName = convertToSetterName(song_name);
        const imageSongObj = db.reviewDB.get(first_artist, `${setterSongName}`);
            if (imageSongObj != undefined) {
                let msgstoEdit = [];

                let userArray = get_user_reviews(imageSongObj);
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
                        for (const item of msgstoEdit) {
                            let msgtoEdit = item;
                            let channelsearch = await get_review_channel(client, msgtoEdit[0], msgtoEdit[1], msgtoEdit[2]);
                            let msgEmbed;
                            
                            if (channelsearch != undefined) {
                                await channelsearch.messages.fetch(`${msgtoEdit[2]}`).then(msg => {
                                    msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                                    msgEmbed.setThumbnail(new_image);
                                    msg.edit({ content: null, embeds: [msgEmbed] });
                                }).catch((err) => {
                                    handle_error(interaction, err);
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
                        msg_id: false,
                        channel_id: false,
                        guild_id: interaction.guild.id,
                        starred: starred,
                        name: interaction.member.displayName,
                        rating: overall_rating,
                        review: overall_review,
                        sentby: taggedUser.id,
                        no_songs: false,
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
                no_songs: false,
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

    handle_error: function(interaction, err) {
        interaction.editReply({ content: `Waveform ran into an error. Don't worry, the bot is still online!\nError: \`${err}\``, 
        embeds: [], components: [] }).catch(() => {
            interaction.reply({ content: `Waveform ran into an error. Don't worry, the bot is still online!\nError: \`${err}\``, 
            embeds: [], components: [] });
        });

        let error_channel = interaction.guild.channels.cache.get('933610135719395329');
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
    spotify_api_setup:  async function(user_id) {
        const access_token = db.user_stats.get(user_id, 'access_token');

        // If we have an access token for spotify API (therefore can use it)
        if (access_token != undefined && access_token != false) {
            const refresh_token = db.user_stats.get(user_id, 'refresh_token');
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

        let userStatsObj = db.user_stats.get(userId, 'stats');
        let guildStatsObj = db.server_settings.get(guildId, 'stats');
        let botStatsObj = db.global_bot.get('stats');

        let change_num = 1 * (delete_mode == false ? 1 : -1);

        /// Update the easy number stats
        userStatsObj.ratings_list[rating] = userStatsObj.ratings_list[rating] + change_num;

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

    hallOfFameCheck: async function(interaction, guild_id, dbArtistArray, origArtistArray, rmxArtistArray, songName) {
        const { get_user_reviews, convertToSetterName } = require('./func.js');
        // Check if the song was added to hall of fame
        let setterSongName = convertToSetterName(songName);
        let songObj = db.reviewDB.get(dbArtistArray[0], `${setterSongName}`);
        if (songObj == undefined) {
            return [false, {}];
        }

        let userReviews = get_user_reviews(songObj);
        let songUrl = songObj.spotify_uri;
        if (songUrl == undefined || songUrl == false) {
            songUrl = 'https://www.google.com';
        } else {
            songUrl = `https://open.spotify.com/track/${songUrl.replace('spotify:track:', '')}`;
        }

        let starCount = 0;
        let ratingAvg = [];
        let userStarList = [];
        let userRevObj;
        for (let userRev of userReviews) {
            userRevObj = songObj[userRev];

            //if (userRevObj.guild_id != guild_id) continue;
            if (userRevObj.rating != false) ratingAvg.push(parseInt(userRevObj.rating));
            if (userRevObj.starred == true) {
                starCount += 1;
                userStarList.push({ id: userRev, rating: parseInt(userRevObj.rating) });
            }
        }

        // Check to see if its already in hall of fame
        let hallOfFameServerList = db.server_settings.get(guild_id, 'hall_of_fame');
        let inHof = false;
        for (let hofData of hallOfFameServerList) {
            if (`${hofData.orig_artists.join(' & ')} - ${hofData.db_song_name}` == `${origArtistArray.join(' & ')} - ${songName}`) {
                inHof = true;
                break;
            }
        }

        let hallOfFameData = { 
            db_artists: dbArtistArray,
            orig_artists: origArtistArray,
            rmx_artists: rmxArtistArray,
            db_song_name: songName,
            art: songObj.art,
            rating_avg: _.mean(ratingAvg), 
            star_count: starCount,
            user_stars: userStarList,
            song_url: songUrl,
        };

        if (starCount >= 3 && inHof == false) {
            // Needs to be added
            if (interaction.guild.id == guild_id) {
                await interaction.channel.send({ content: `🏆 **${origArtistArray.join(' & ')} - ${songName}** has been added to the Hall of Fame for this server!` });
            }
            
            db.server_settings.push(guild_id, hallOfFameData, 'hall_of_fame');
        } else if (starCount < 3 && inHof == true) {
            // Needs to be removed
            for (let hofData of hallOfFameServerList) {
                if (hofData.db_song_name == hallOfFameData.db_song_name) {
                    hallOfFameServerList = hallOfFameServerList.filter(v => {
                        v.db_song_name == hallOfFameData.db_song_name;
                    });
                    break;
                }
            }
            
            db.server_settings.set(guild_id, hallOfFameServerList, 'hall_of_fame');
        } else if (starCount >= 3 && inHof == true) { 
            // Need to update the user list
            for (let i = 0; i < hallOfFameServerList.length; i++) {
                if (hallOfFameServerList[i].db_song_name == hallOfFameData.db_song_name) {
                    hallOfFameServerList[i] = hallOfFameData;
                }
            }

            db.server_settings.set(guild_id, hallOfFameServerList, 'hall_of_fame');
        }
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
};