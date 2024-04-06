const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { get_user_reviews, handle_error, convertToSetterName, getProperRemixers } = require("../func.js");
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toprated')
        .setDescription('View your top rated songs on Waveform!')
        .setDMPermission(false),
    help_desc: `Test`,
	async execute(interaction, client) {
        try {

        if (interaction.user.id != '122568101995872256') return interaction.reply('Not for you!');

        await interaction.deferReply();

        let globalStarCount = 0;
        let globalReviewCount = 0;
        let eplpGlobalReviewCount = 0;
        let globalTenCount = 0;
        let globalArtistCount = 0;
        let globalSongCount = 0;
        let globalEPLPCount = 0;
        let userStarList = [];
        let artistCount = [];
        let songSkip = [];
        let userRatingObj = [];
        let avgRatingList = [];
        let topSongsList = [];
        let listReviewNum = 1;

        const ARTISTARRAY = db.reviewDB.keyArray();
        let gottenGlobalData = false;

        userRatingObj = {};
        userStarList = [];
        songSkip = [];
        for (let artist of ARTISTARRAY) {
            let songArray = Object.keys(db.reviewDB.get(artist));
            songArray = songArray.map(v => v = v.replace('_((', '[').replace('))_', ']'));
            songArray = songArray.filter(v => v != 'pfp_image');
            if (gottenGlobalData == false) globalArtistCount += 1;

            for (let song of songArray) {
                avgRatingList = [];
                let setterSongName = convertToSetterName(song);
                let songObj = db.reviewDB.get(artist, `${setterSongName}`);
                let userArray = [];
                if (songObj != null && songObj != undefined) {
                    userArray = await get_user_reviews(songObj);
                } else {
                    userArray = [];
                }

                if (userArray.length != 0) {
                    artistCount.push(artist);
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

                if (song.includes(' Remix)')) {
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
                }

                if (gottenGlobalData == false) {
                    if (song.includes(' EP') || song.includes(' LP')) {
                        globalEPLPCount += 1;
                    } else {
                        globalSongCount += 1;
                    }
                }

                for (let k = 0; k < userArray.length; k++) {
                    let userData = songObj[userArray[k]];
                    if (userData.starred !== false && userData.starred !== undefined) {
                        avgRatingList.push(1);
                    }

                    if (userArray[k] == interaction.user.id) {
                        globalReviewCount += 1;
                        userData.rating = parseFloat(userData.rating);
                        if (userRatingObj[`${userData.rating}`] != undefined && !isNaN(userData.rating)) {
                            userRatingObj[`${userData.rating}`] += 1;
                        } else if (!isNaN(userData.rating)) {
                            userRatingObj[`${userData.rating}`] = 1;
                        }
                        
                        if (song.includes(' EP') || song.includes(' LP')) {
                            eplpGlobalReviewCount += 1;
                        }

                        if (userData.starred == true) {
                            globalStarCount += 1;
                            if (songObj.spotify_uri == undefined) songObj.spotify_uri = false; 

                            let starListData = { 
                                db_artists: allArtists,
                                orig_artists: origArtistArray,
                                rmx_artists: rmxArtistArray,
                                db_song_name: song,
                                spotify_uri: songObj.spotify_uri,
                            };

                            userStarList.push(starListData);
                        }

                        if (parseFloat(userData.rating) == 10) {
                            globalTenCount += 1;
                        }
                    }
                }

                if (gottenGlobalData == false) {
                    if (avgRatingList.length >= listReviewNum && !song.includes(' EP') && !song.includes(' LP')) {
                        topSongsList.push([avgRatingList.length, `${origArtistArray.join(' & ')} - ${song} (Favs: ${avgRatingList.length})`]);
                    }
                    avgRatingList = [];
                }

                for (let v = 0; v < allArtists.length; v++) {
                    if (!songSkip.includes(`${allArtists[v]} - ${song}`)) {
                        songSkip.push(`${allArtists[v]} - ${song}`);
                    }
                }
            }
        }
            
        console.log(`Bot Stats:`);
        console.log(`Artist Count: ${globalArtistCount}`);
        console.log(`Song Count: ${globalSongCount}`);
        console.log(`EP/LP Count: ${globalEPLPCount}`);
        console.log(`Review Count: ${globalReviewCount}`);
        console.log(`EP/LP Review Count: ${eplpGlobalReviewCount}`);
        console.log(`Ten Count: ${globalTenCount}`);
        console.log(`Star Count: ${globalStarCount}`);

        await interaction.editReply('This command successfully ran.');

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};