const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { get_user_reviews, handle_error, hallOfFameCheck, convertToSetterName, getProperRemixers } = require("../func.js");
const _ = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admintestcommand')
        .setDescription('Test command for admins. Not for you, most likely!')
        .setDMPermission(false),
    help_desc: `This is an admin command designed for development purposes, and as a result is not a command you can use.`,
	async execute(interaction, client) {
        try {

        if (interaction.user.id != '122568101995872256') return interaction.reply('Not for you!');

        await interaction.deferReply();

        let userStarCount = 0;
        let globalStarCount = 0;
        let userReviewCount = 0;
        let globalReviewCount = 0;
        let eplpUserReviewCount = 0;
        let eplpGlobalReviewCount = 0;
        let userTenCount = 0;
        let globalTenCount = 0;
        let globalArtistCount = 0;
        let globalSongCount = 0;
        let globalEPLPCount = 0;
        let serverWaveformCount = 1;
        let usersUsingWaveform = [];
        let userStarList = [];
        let artistCount = [];
        let songSkip = [];
        let userRatingObj = [];
        let avgRatingList = [];
        let topSongsList = [];
        let listReviewNum = 1;

        db.server_settings.set('680864893552951306', [], 'hall_of_fame');

        const ARTISTARRAY = db.reviewDB.keyArray();
        const WAVEFORMUSERARRAY = db.user_stats.keyArray();
        let gottenGlobalData = false;

        for (let user of WAVEFORMUSERARRAY) {
            userStarCount = 0;
            userTenCount = 0;
            userReviewCount = 0;
            eplpUserReviewCount = 0;
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

                    if (gottenGlobalData == false) {
                        await hallOfFameCheck(interaction, client, '680864893552951306', allArtists, origArtistArray, rmxArtistArray, song);
                    }

                    for (let k = 0; k < userArray.length; k++) {
                        let userData = songObj[userArray[k]];
                        if (userData.starred !== false && userData.starred !== undefined) {
                            avgRatingList.push(1);
                        }

                        if (userArray[k] == user) {
                            userReviewCount += 1;
                            globalReviewCount += 1;
                            userData.rating = parseFloat(userData.rating);
                            if (userRatingObj[`${userData.rating}`] != undefined && !isNaN(userData.rating)) {
                                userRatingObj[`${userData.rating}`] += 1;
                            } else if (!isNaN(userData.rating)) {
                                userRatingObj[`${userData.rating}`] = 1;
                            }
                            
                            if (song.includes(' EP') || song.includes(' LP')) {
                                eplpUserReviewCount += 1;
                                eplpGlobalReviewCount += 1;
                            }

                            if (userData.starred == true) {
                                globalStarCount += 1;
                                userStarCount += 1;
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
                                userTenCount += 1;
                                globalTenCount += 1;
                            }
                        }
                    }

                    if (gottenGlobalData == false) {
                        if (avgRatingList.length >= listReviewNum && !song.includes(' EP') && !song.includes(' LP')) {
                            topSongsList.push([avgRatingList.length, `${origArtistArray.join(' & ')} - ${song} (Stars: ${avgRatingList.length})`]);
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

            if (userReviewCount != 0) {
                usersUsingWaveform.push(user);
            }

            console.log(`User Data for ${db.user_stats.get(user, 'name')} (${user}):`);
            console.log(`Review Count: ${userReviewCount}`);
            console.log(`EP/LP Review Count: ${eplpUserReviewCount}`);
            console.log(`Ten Count: ${userTenCount}`);
            console.log(`Star Count: ${userStarCount}`);
            console.log(`User Rating List`);
            console.log(userRatingObj);

            db.user_stats.set(user, {
                star_num: userStarCount, // Number of stars given from reviews done by the user
                ten_num: userTenCount, // Number of 10s given from reviews done by the user
                review_num: userReviewCount, // Number of reviews done by the user
                ep_review_num: eplpUserReviewCount, // Number of EP/LP reviews done by the user
                star_list: userStarList,
                ratings_list: userRatingObj,
            }, 'stats');

            gottenGlobalData = true;

            // console.log(`Songs with Stars:`);
            // topSongsList.sort((a, b) => {
            //     return b[0] - a[0];
            // });
    
            // let count = 0;
            // topSongsList = topSongsList.map(v => {
            //     count += 1;
            //     v = `${count}. ${v[1]}`;
            //     return v;
            // });
    
            // const fs = require('fs');
    
            // await fs.writeFile(`../starsongs.txt`, topSongsList.join('\n'), err => {
            // if (err) {
            //     console.error(err);
            // }
            // // file written successfully
            // });

            // return interaction.editReply('Done.');
        }

        console.log(`Bot Stats:`);
        console.log(`Artist Count: ${globalArtistCount}`);
        console.log(`Song Count: ${globalSongCount}`);
        console.log(`EP/LP Count: ${globalEPLPCount}`);
        console.log(`Review Count: ${globalReviewCount}`);
        console.log(`EP/LP Review Count: ${eplpGlobalReviewCount}`);
        console.log(`Ten Count: ${globalTenCount}`);
        console.log(`Star Count: ${globalStarCount}`);
        console.log(`Number of Waveform Servers: ${serverWaveformCount}`);
        console.log(`Number of Waveform Users: ${usersUsingWaveform}\n`);

        db.global_bot.set('stats', {
            artist_num: globalArtistCount,
            song_num: globalSongCount,
            ep_num: globalEPLPCount,
            star_num: globalStarCount,
            ten_num: globalTenCount,
            review_num: globalReviewCount,
            ep_review_num: eplpGlobalReviewCount,
            waveform_users: usersUsingWaveform,
        });

        db.server_settings.set('680864893552951306', {
            star_num: globalStarCount,
            ten_num: globalTenCount,
            review_num: globalReviewCount,
            ep_review_num: eplpGlobalReviewCount,
        }, 'stats');

        await interaction.editReply('This command successfully ran.');
        console.log('Done!');

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};