/* eslint-disable no-useless-escape */
const { EmbedBuilder } = require('discord.js');
const db = require("./db.js");
const forAsync = require('for-async');

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

    parse_artist_song_data: async function(interaction, artists = null, song = null, remixers = null, vocalists = null) {
        const { spotify_api_setup } = require('./func.js');

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
                    vocal_artists: [],
                    art: 'N/A',
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
        let rmxArtistArray = [];
        let passesChecks = true;
        let trackList = false;
        let songArt = false;
        let localReturnObj = {};
        let songUri = false;
        if (remixers != null) {
            rmxArtistArray = [remixers.split(' & ')];
            rmxArtistArray = rmxArtistArray.flat(1);
        }
        
        let vocalistArray = [];
        if (vocalists != null) {
            vocalistArray = [vocalists.split(' & ')];
            vocalistArray = vocalistArray.flat(1);
        }

        // If we're pulling from Spotify (no arguments given)
        if (origArtistArray == null && songArg == null && remixers == null) {
            const spotifyApi = await spotify_api_setup(interaction.user.id);
            let isPodcast = false;
        
            if (spotifyApi == false) {
                return { error: 'You must use `/login` to use Spotify related features!' };
            }

            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
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
                        vocal_artists: [],
                        art: false,
                        spotify_uri: false,
                    };
                    return; 
                } 
                if (data.body.currently_playing_type == 'episode') { isPodcast = true; return; }
                if (data.body.item == undefined) { passesChecks = 'notplaying'; return; }
                origArtistArray = data.body.item.artists.map(artist => artist.name.replace(' & ', ' \\& '));
                songArg = data.body.item.name;
                songArg = songArg.replace('–', '-'); // STUPID LONGER DASH
                songArt = data.body.item.album.images[0].url;
                songUri = data.body.item.uri;
                await spotifyApi.getAlbum(data.body.item.album.id)
                .then(async album_data => {
                    if ((interaction.commandName.includes('ep') && interaction.commandName != 'pushtoepreview') || (editDataSubCommand == 'ep-lp')) {
                        trackList = album_data.body.tracks.items.map(t => t.name);
                        for (let i = 0; i < trackList.length; i++) {
                            if (songArg.includes('feat.')) {
                                songArg = songArg.split(' (feat. ');
                                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                                trackList[i] = songArg[0];
                            }
                    
                            if (songArg.includes('ft. ')) {
                                songArg = songArg.split(' (ft. ');
                                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                                trackList[i] = songArg[0];
                            }
                    
                            if (songArg.includes('(with ')) {
                                songArg = songArg.split(' (with ');
                                songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
                                trackList[i] = `${songArg[0]}${(rmxArtistArray.length > 0) ? ` (${rmxArtist} Remix)` : ``}`;
                            }
                        }

                        if (songArg.includes('Remix')) {
                            passesChecks = 'ep';
                        } else if (trackList.length <= 1) {
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

                        if (db.user_stats.get(interaction.user.id, 'current_ep_review') == false && interaction.commandName == 'epreview') {
                            db.user_stats.set(interaction.user.id, { msg_id: false, artist_array: origArtistArray, ep_name: songArg, review_type: 'A', track_list: trackList, next: trackList[0] }, 'current_ep_review');  
                        }
                    }
                });
            });

            // Check if a podcast is being played, as we don't support that.
            if (isPodcast == true) {
                return { error: 'Podcasts are not supported with `/np`.' };
            }

            if (passesChecks == 'notplaying') {
                return { error: 'You are not currently playing a song on Spotify.' };
            }

            if (passesChecks == 'local') {
                return localReturnObj;
            }

            if (passesChecks == false) {
                return { error: 'This song cannot be parsed properly in the database, and as such cannot be reviewed or have data pulled up for it.' };
            } else if (passesChecks == 'ep') {
                return { error: 'This track cannot be added to EP/LP reviews, therefore is invalid to be used in relation with EP/LP commands.' };
            } else if (passesChecks == 'length') {
                return { error: 'This is not on an EP/LP, this is a single. As such, you cannot use this with EP/LP reviews.' };
            }

            songArg = songArg.replace('(With', '(with');
            
        } else {
            if (remixers != null) {
                songArg = `${songArg} (${remixers} Remix)`;
            }
        }

        // Fix song formatting
        let rmx_delimiter = ' & ';
        if (!Array.isArray(origArtistArray)) origArtistArray = origArtistArray.split(' & ');

        if (songArg.includes(' Remix)') || songArg.includes(' Remix]')) {
            songArg = songArg.replace('[', '(');
            songArg = songArg.replace(']', ')');

            temp = songArg.split(' Remix)')[0].split('(');
            rmxArtist = temp[temp.length - 1];

            // Input validation
            rmxArtist = rmxArtist.replace(' VIP', '');
            if (rmxArtist.includes(' and ')) rmx_delimiter = ' and ';
            if (rmxArtist.includes(' x ')) rmx_delimiter = ' x ';
            origSongArg = temp[0].trim();
            rmxArtistArray = rmxArtist.split(rmx_delimiter);
            songArg = `${origSongArg} (${rmxArtistArray.join(' & ')} Remix)`;
            origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
            if (rmxArtistArray[0] == '' || rmxArtistArray.length == 0) passesChecks = false;
        }

        if ((songArg.includes('Remix') && songArg.includes(' - ')) && !songArg.includes('Remix)') && !songArg.includes('Remix]')) {
            songArg = songArg.split(' - ');
            if (songArg[1] != 'Remix') {
                rmxArtist = songArg[1].slice(0, -6);
                rmxArtist = rmxArtist.replace(' VIP', '');
                if (rmxArtist.includes(' and ') && !rmxArtist.includes(' & ')) rmx_delimiter = ' and ';
                if (rmxArtist.includes(' x ') && !rmxArtist.includes(' & ')) rmx_delimiter = ' x ';

                // Deal with features being in the song name before the remix lol
                if (songArg[0].includes('feat.') || songArg[0].includes('ft.')) {
                    songArg[0] = songArg[0].replace('feat.', 'ft.');
                    songArg[0] = songArg[0].split(` (ft.`)[0];
                }

                origSongArg = songArg[0];
                rmxArtistArray = rmxArtist.split(rmx_delimiter);
                songArg = `${origSongArg} (${rmxArtistArray.join(' & ')} Remix)`;
                origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
                if (rmxArtistArray[0] == '' || rmxArtistArray.length == 0) passesChecks = false;
            } else {
                songArg = songArg.join(' - ');
            }
        }

        if (songArg.includes('feat.')) {
            songArg = songArg.split(' (feat. ');
            songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
            songArg[1] = songArg[1].split(')')[0];
            if (rmxArtistArray.length == 0) vocalistArray.push(songArg[1]);
            origSongArg = `${songArg[0]}`;
            songArg = `${songArg[0]}`;
        }

        if (songArg.includes('ft. ')) {
            songArg = songArg.split(' (ft. ');
            songArg[0] = `${songArg[0]}${songArg[1].substr(songArg[1].indexOf(')') + 1)}`;
            songArg[1] = songArg[1].split(')')[0];
            if (rmxArtistArray.length == 0) vocalistArray.push(songArg[1]);
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

        if (origArtistArray.length == 0) {
            passesChecks = false;
        }

        let artistArray;
        if (!Array.isArray(origArtistArray)) {
            artistArray = [origArtistArray.split(' & ')];
        } else {
            artistArray = origArtistArray.slice(0);
        }

        artistArray = artistArray.flat(1);
        origArtistArray = artistArray.slice(0);

        if (db.user_stats.get(interaction.user.id, 'current_ep_review') == false && interaction.commandName == 'epreview') {
            if (db.reviewDB.has(artistArray[0]) && db.reviewDB.get(artistArray[0][songArg] != undefined)) trackList = db.reviewDB.get(artistArray[0])[songArg].songs;
            if (!trackList) trackList = false;
            db.user_stats.set(interaction.user.id, { msg_id: false, artist_array: origArtistArray, ep_name: songArg, review_type: 'A', track_list: trackList, next: false }, 'current_ep_review');  
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
     
        if (interaction.commandName != 'nowplaying' && interaction.commandName != 'sendmail') {
            // Check if all the artists exist (don't check this if we're pulling data for /review or /epreview)
            if (interaction.commandName != 'review' && interaction.commandName != 'epreview') {
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
                if (db.reviewDB.get(artistArray[0])[songArg] != undefined) {
                    if (db.reviewDB.get(artistArray[0])[songArg].collab != undefined) {
                        if (db.reviewDB.get(artistArray[0])[songArg].collab.length != 0) {
                            artistArray.push(db.reviewDB.get(artistArray[0])[songArg].collab);
                            origArtistArray.push(db.reviewDB.get(artistArray[0])[songArg].collab);
                            artistArray = artistArray.flat(1);
                            origArtistArray = artistArray.flat(1);
                            artistArray = [...new Set(artistArray)];
                            origArtistArray = [...new Set(origArtistArray)];
                        }
                    }

                
                    if (db.reviewDB.get(artistArray[0])[songArg].vocals != undefined) {
                        if (db.reviewDB.get(artistArray[0])[songArg].vocals.length != 0 && vocalistArray != db.reviewDB.get(artistArray[0])[songArg].vocals) {
                            vocalistArray = db.reviewDB.get(artistArray[0])[songArg].vocals;
                        }
                    }
                }
            }

            if (rmxArtistArray[0] != undefined) {
                if (db.reviewDB.has(rmxArtistArray[0])) {
                    if (db.reviewDB.get(rmxArtistArray[0])[songArg] != undefined) {
                        if (db.reviewDB.get(rmxArtistArray[0])[songArg].rmx_collab != undefined) {
                            if (db.reviewDB.get(rmxArtistArray[0])[songArg].rmx_collab.length != 0) {
                                rmxArtistArray.push(db.reviewDB.get(rmxArtistArray[0])[songArg].rmx_collab);
                                rmxArtistArray = rmxArtistArray.flat(1);
                            }
                        }
                    }
                }
            }
        }

        origArtistArray = origArtistArray.filter(v => !vocalistArray.includes(v));
        origArtistArray = origArtistArray.filter(v => !rmxArtistArray.includes(v));
        let allArtistArray = artistArray;
        if (rmxArtistArray.length != 0) {
            artistArray = rmxArtistArray; // Database artists become the remix artists
            allArtistArray = [origArtistArray, rmxArtistArray].flat(1);
        }

        let displaySongName = (`${songArg}` + 
        `${(vocalistArray.length != 0) ? ` (ft. ${vocalistArray.join(' & ')})` : ``}`);

        return { 
            prod_artists: origArtistArray, 
            song_name: songArg, // Song name with remixers in the name
            main_song_name: origSongArg, // Song Name without remixers in the name
            display_song_name: displaySongName, // Song name with remixers and features in the name
            db_artists: artistArray, 
            all_artists: allArtistArray,
            remix_artists: rmxArtistArray, 
            vocal_artists: vocalistArray,
            art: songArt,
            spotify_uri: songUri,
        };
    },

    // Updates the art for embed messages, NOT in the database. That's done in the /review commands themselves.
    update_art: function(interaction, first_artist, song_name, new_image) {
        const { get_user_reviews, handle_error } = require('./func.js');

        const imageSongObj = db.reviewDB.get(first_artist)[song_name];
            if (imageSongObj != undefined) {
                let msgstoEdit = [];
                let userIDs = [];
                let count = -1;

                let userArray = get_user_reviews(imageSongObj);
                if (userArray.length != 0) {
                    userArray.forEach(user => {
                        msgstoEdit.push(db.reviewDB.get(first_artist)[song_name][user].msg_id);
                        userIDs.push(user);
                    });

                    msgstoEdit = msgstoEdit.filter(item => item !== undefined);
                    msgstoEdit = msgstoEdit.filter(item => item !== false);
                    
                    if (msgstoEdit.length > 0) { 
                        forAsync(msgstoEdit, async function(item) {
                            count += 1;
                            return new Promise(function(resolve) {
                                let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
                                let msgtoEdit = item;
                                let msgEmbed;

                                channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                    msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                                    msgEmbed.setThumbnail(new_image);
                                    msg.edit({ content: null, embeds: [msgEmbed] });
                                    resolve();
                                }).catch(() => {
                                    channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(userIDs[count], 'mailbox'));
                                    if (channelsearch != undefined) {
                                        channelsearch.messages.fetch(`${msgtoEdit}`).then(msg => {
                                            msgEmbed = EmbedBuilder.from(msg.embeds[0]);
                                            msgEmbed.setThumbnail(new_image);
                                            msg.edit({ content: null, embeds: [msgEmbed] });
                                            resolve();
                                        }).catch(() => {
                                            console.log('Message not found');
                                        });
                                    }
                                }).catch((err) => {
                                    handle_error(interaction, err);
                                });
                            });
                        });
                    }
                }
            }
    },

    review_song: function(interaction, artistArray, origArtistArray, song, origSongName, review, rating, starred, rmxArtistArray, vocalistArray, songArt, user_who_sent, spotifyUri, ep_name = false) {

        if (user_who_sent == undefined || user_who_sent == null) {
            user_who_sent = false;
        }

        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterSongName = song.includes('.') ? `["${song}"]` : song;

        for (let i = 0; i < artistArray.length; i++) {

            if (ep_name == undefined) ep_name = false;
            let songName = song;
            
            // Used if both the artist and song object exist
            let review_object = {
                url: false,
                name: interaction.member.displayName, // For debug purposes
                msg_id: false,
                review: review,
                rating: rating,
                starred: starred,
                sentby: user_who_sent,
            };

            // Used if the song object or artist object don't already exist
            let song_object = {
                [songName]: { 
                    [`${interaction.user.id}`]: review_object,
                    remixers: [],
                    remix_collab: (rmxArtistArray.length != 0 ? rmxArtistArray.filter(word => artistArray[i] != word) : []),
                    art: songArt,
                    collab: (rmxArtistArray.length == 0) ? artistArray.filter(word => !rmxArtistArray.includes(word) && artistArray[i] != word) : origArtistArray, 
                    vocals: vocalistArray,
                    ep: ep_name,
                    review_num: 1,
                    spotify_uri: spotifyUri,
                },
            };

            // If the artist db doesn't exist
            if (!db.reviewDB.has(artistArray[i])) {

                db.reviewDB.set(artistArray[i], song_object);

            } else if (db.reviewDB.get(artistArray[i])[songName] == undefined) { //If the artist db exists, check if the song db doesn't exist
                const artistObj = db.reviewDB.get(artistArray[i]);

                //Create the object that will be injected into the Artist object
                const newsongObj = song_object;

                //Inject the newsongobject into the artistobject and then put it in the database
                Object.assign(artistObj, newsongObj);
                db.reviewDB.set(artistArray[i], artistObj);

            } else if (db.reviewDB.get(artistArray[i])[songName][interaction.user.id] && review_object.name != undefined) { // Check if you are already in the system, and replace the review if you are.

                const songObj = db.reviewDB.get(artistArray[i])[songName];
                delete songObj[`${interaction.user.id}`];
    
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                Object.assign(songObj, newuserObj);
                db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
                db.reviewDB.set(artistArray[i], songArt, `${setterSongName}.art`);
                if (spotifyUri != false) db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.art`);
                if (vocalistArray.length != 0 && vocalistArray != songObj.vocals) {
                    db.reviewDB.set(artistArray[i], vocalistArray, `${setterSongName}.vocals`);
                }

            } else if (review_object.name != undefined) { // Otherwise if you have no review but the song and artist objects exist

                const songObj = db.reviewDB.get(artistArray[i])[songName];

                //Create the object that will be injected into the Song object
                const newuserObj = {
                    [`${interaction.user.id}`]: review_object,
                };

                //Inject the newsongobject into the songobject and then put it in the database
                Object.assign(songObj, newuserObj);
                db.reviewDB.set(artistArray[i], songObj, `${setterSongName}`);
                db.reviewDB.set(artistArray[i], songArt, `${setterSongName}.art`);
                if (spotifyUri != false) db.reviewDB.set(artistArray[i], spotifyUri, `${setterSongName}.art`);
                db.reviewDB.math(artistArray[i], '+', 1, `${setterSongName}.review_num`);
                if (vocalistArray.length != 0 && vocalistArray != songObj.vocals) {
                    db.reviewDB.set(artistArray[i], vocalistArray, `${setterSongName}.vocals`);
                }

            }

        }
    
        if (rmxArtistArray.length != 0) {
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterOrigSongName = origSongName.includes('.') ? `["${origSongName}"]` : origSongName;

            // This loop is for the original artists on a remix review
            for (let i = 0; i < origArtistArray.length; i++) {
                let song_object = {
                    [origSongName]: { 
                        remixers: [rmxArtistArray.join(' & ')],
                        remix_collab: [],
                        art: false,
                        collab: origArtistArray.filter(word => origArtistArray[i] != word), // Filter out the specific artist in question
                        vocals: vocalistArray,
                        ep: ep_name,
                        review_num: 0,
                    },
                };

                if (!db.reviewDB.has(origArtistArray[i])) {

                    db.reviewDB.set(origArtistArray[i], song_object);
    
                } else if (db.reviewDB.get(origArtistArray[i])[origSongName] == undefined) { //If the artist db exists, check if the song db doesn't exist
                    const artistObj = db.reviewDB.get(origArtistArray[i]);
    
                    //Create the object that will be injected into the Artist object
                    const newsongObj = song_object;
    
                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(origArtistArray[i], artistObj);
    
                } else {
                    if (!db.reviewDB.get(origArtistArray[i])[origSongName].remixers.includes(rmxArtistArray.join(' & '))) {
                        db.reviewDB.push(origArtistArray[i], rmxArtistArray.join(' & '), `${setterOrigSongName}.remixers`);
                    }
                }
            }

            for (let i = 0; i < vocalistArray.length; i++) {
                let song_object = {
                    [origSongName]: { 
                        remixers: [rmxArtistArray.join(' & ')],
                        remix_collab: [],
                        art: false,
                        collab: origArtistArray, // Filter out the specific artist in question
                        vocals: vocalistArray,
                        ep: ep_name,
                        review_num: 0,
                    },
                };

                if (!db.reviewDB.has(vocalistArray[i])) {

                    db.reviewDB.set(vocalistArray[i], song_object);
    
                } else if(db.reviewDB.get(vocalistArray[i])[origSongName] == undefined) { //If the artist db exists, check if the song db doesn't exist
                    const artistObj = db.reviewDB.get(vocalistArray[i]);
    
                    //Create the object that will be injected into the Artist object
                    const newsongObj = song_object;
    
                    //Inject the newsongobject into the artistobject and then put it in the database
                    Object.assign(artistObj, newsongObj);
                    db.reviewDB.set(vocalistArray[i], artistObj);
    
                } else {
                    if (!db.reviewDB.get(vocalistArray[i])[origSongName].remixers.includes(rmxArtistArray.join(' & '))) {
                        db.reviewDB.push(vocalistArray[i], rmxArtistArray.join(' & '), `${setterOrigSongName}.remixers`);
                    }
                }
            }
        }
    },

    review_ep: function(interaction, artistArray, ep_name, overall_rating, overall_review, taggedUser, art, starred, spotifyUri) {

        // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
        let setterEpName = ep_name.includes('.') ? `["${ep_name}"]` : ep_name;

        // Add in the EP object/review
        for (let i = 0; i < artistArray.length; i++) {

            let epObject = {
                [ep_name]: {
                    [interaction.user.id]: {
                        url: false,
                        msg_id: false,
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
                starred: starred,
                name: interaction.member.displayName,
                rating: overall_rating,
                review: overall_review,
                sentby: taggedUser.id,
                no_songs: false,
            };

            if (!db.reviewDB.has(artistArray[i])) {
                db.reviewDB.set(artistArray[i], epObject);
            } else if (!db.reviewDB.get(artistArray[i])[ep_name]) {
                let db_artist_obj = db.reviewDB.get(artistArray[i]);
                Object.assign(db_artist_obj, epObject);
                db.reviewDB.set(artistArray[i], db_artist_obj);
            } else {
                const db_song_obj = db.reviewDB.get(artistArray[i])[ep_name];
                let new_user_obj = {
                    [`${interaction.user.id}`]: reviewObject,
                };

                Object.assign(db_song_obj, new_user_obj);
                db.reviewDB.set(artistArray[i], db_song_obj, `${setterEpName}`);
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
        const Spotify = require('node-spotify-api');
        const client_id = process.env.SPOTIFY_API_ID; // Your client id
        const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
        let search = name;
        search = name.replace(' EP', '');
        search = search.replace(' LP', '');
        const song = `${artistArray[0]} ${search}`;
        let result = false;
        
        const spotify = new Spotify({
            id: client_id,
            secret: client_secret,
        });

        await spotify.search({ type: "track", query: song }).then(function(data) {  
            let results = data.tracks.items;
            let songData = data.tracks.items[0];
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
        });

        return await result;
    },

    /**
     * Searches the spotify API to grab artist images for each artist in an array, and returns an array of image links in the same order.
     * @param {Array} artistArray The artist array to find images for on Spotify.
     * @return {Array} An array of image links, in the same order as artistArray.
     */
    grab_spotify_artist_art: async function(artistArray) {
        const Spotify = require('node-spotify-api');
        const client_id = process.env.SPOTIFY_API_ID; // Your client id
        const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Your secret
        let imageArray = [];

        // Check if our artistArray is somehow 0, and if so just return an empty list.
        if (artistArray.length == 0) return [];

        const spotify = new Spotify({
            id: client_id,
            secret: client_secret,
        });

        for (let artist of artistArray) {
            await spotify.search({ type: "artist", query: artist }).then(function(data) {  
                let results = data.artists.items[0].images;
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

    create_ep_review: async function(interaction, client, origArtistArray, songArray, ep_name, ep_art) {
        const { get_user_reviews } = require('./func.js');
        let all_reviewed_users = []; // The list of users who have reviewed every song on the EP/LP.

        for (let i = 0; i < songArray.length; i++) {
            let songArtistArray = origArtistArray.slice(0);
            let songCollabArray = [];
            let songVocalistArray = [];
            let userArray;
            let songObj = db.reviewDB.get(origArtistArray[0])[songArray[i]];
            // This is done so that key names with periods and quotation marks can both be supported in object names with enmap string dot notation
            let setterSongName = songArray[i].includes('.') ? `["${songArray[i]}"]` : songArray[i];

            if (all_reviewed_users.length == 0) {
                all_reviewed_users = get_user_reviews(songObj);        
            } else {
                userArray = get_user_reviews(songObj);    
                all_reviewed_users = all_reviewed_users.filter(val => userArray.includes(val));
            }

            // VIP adjustment
            if (songArray[i].includes('- VIP') || songArray[i].includes('(VIP)')) {
                if (songArray[i].includes('- VIP')) {
                    songArray[i] = songArray[i].replace('- VIP', 'VIP');
                } else {
                    songArray[i] = songArray[i].replace('(VIP)', 'VIP');
                }
            }

            if (songObj.collab != undefined) {
                if (songObj.collab.length != 0) {
                    songCollabArray.push(songObj.collab);
                    songCollabArray = songCollabArray.flat(1);
                    songCollabArray = [...new Set(songCollabArray)];
                    songArtistArray.push(songCollabArray);
                    songArtistArray = songArtistArray.flat(1);
                }
            }

            if (songObj.vocals != undefined) {
                if (songObj.vocals.length != 0) {
                    songVocalistArray.push(songObj.vocals);
                    songVocalistArray = songVocalistArray.flat(1);
                    // Add vocalistArray to origArtistArray so it can be used to edit data
                    songArtistArray.push(songVocalistArray);
                    songArtistArray = songArtistArray.flat(1);
                }
            }

            for (let j = 0; j < songArtistArray.length; j++) {
                db.reviewDB.set(songArtistArray[j], ep_name, `${setterSongName}.ep`);
            }

        }

        let ep_object;

        for (let i = 0; i < origArtistArray.length; i++) {

            if (db.reviewDB.get(origArtistArray[0])[ep_name] == undefined) {  
                ep_object = {
                    [ep_name]: {
                        art: ep_art,
                        collab: origArtistArray.filter(word => origArtistArray[i] != word),
                        songs: songArray,
                    },
                };
            } else {
                ep_object = db.reviewDB.get(origArtistArray[i]);
                
                let epUserArray = Object.keys(db.reviewDB.get(origArtistArray[i])[ep_name]);
                epUserArray = epUserArray.filter(e => e !== 'art');
                epUserArray = epUserArray.filter(e => e !== 'songs');
                epUserArray = epUserArray.filter(e => e !== 'collab');
                epUserArray = epUserArray.filter(e => e !== 'review_num');
                epUserArray = epUserArray.filter(e => e !== 'tags');

                all_reviewed_users = all_reviewed_users.filter(val => !epUserArray.includes(val));
            }
                
            if (all_reviewed_users.length != 0) {
                for (let u = 0; u < all_reviewed_users.length; u++) {
                    let user = await client.users.fetch(all_reviewed_users[u]);
                    let member = await interaction.guild.members.fetch(user.id);
                    let user_object = {
                        url: false,
                        msg_id: false,
                        starred: false,
                        name: member.displayName,
                        rating: false,
                        review: false,
                        sentby: false,
                        no_songs: false,
                    };

                    ep_object[ep_name][user.id] = user_object;
                }
            }

            let db_artist_obj = db.reviewDB.get(origArtistArray[i]);
            Object.assign(db_artist_obj, ep_object);
            db.reviewDB.set(origArtistArray[i], db_artist_obj);
        }
    },

    /**
     * Finds and returns the channel object of a review message, for use in messing with it.
     * @param {Object} interaction The interaction of the slash command this function is used in.
     * @param {String} user_id The user ID of the reviewer. 
     * @param {String} msg_id The ID of the review message. 
     */
    find_review_channel: async function(interaction, user_id, msg_id) {
        let channelsearch = interaction.guild.channels.cache.get(db.server_settings.get(interaction.guild.id, 'review_channel').slice(0, -1).slice(2));
        let target = undefined;
        await channelsearch.messages.fetch(msg_id).then(async () => {
            target = channelsearch;
        }).catch(async () => {
            channelsearch = interaction.guild.channels.cache.get(db.user_stats.get(user_id, 'mailbox'));
            if (channelsearch != undefined) {
                await channelsearch.messages.fetch(msg_id).then(async () => {
                    target = channelsearch;
                }).catch(() => {}); // Do nothing if we can't find it.
            }
        });

        return target;
    },

    /**
     * Sets up and returns a spotify web api object for the interaction user.
     * @param {String} user_id The user id to authenticate to the Spotify API.
     */
    spotify_api_setup:  async function(user_id) {
        const SpotifyWebApi = require('spotify-web-api-node');
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
        return string.includes('.') ? `["${string}"]` : string;
    },
};