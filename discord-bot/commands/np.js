const Discord = require('discord.js');
const db = require('../db.js');
const { parse_spotify, get_user_reviews, handle_error } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const SpotifyWebApi = require('spotify-web-api-node');
const ms_format = require('format-duration');
const progressbar = require('string-progressbar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('np')
        .setDescription('Display your currently playing song on Spotify!'),
	async execute(interaction) {
        try {

        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        let songArt, spotifyUrl, yourRating, artistArray, songName, displayArtists, sp_data;
        let songLength, songCurMs, musicProgressBar = false; // Spotify API specific variables 
        const access_token = db.user_stats.get(interaction.user.id, 'access_token');

        // If we have an access token for spotify API (therefore can use it)
        if (access_token != undefined && access_token != false) {
            const refresh_token = db.user_stats.get(interaction.user.id, 'refresh_token');
            const spotifyApi = new SpotifyWebApi({
                redirectUri: process.env.SPOTIFY_REDIRECT_URI,
                clientId: process.env.SPOTIFY_API_ID,
                clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            });

            // Refresh access token so we can use API
            await spotifyApi.setRefreshToken(refresh_token);
            await spotifyApi.setAccessToken(access_token);
            await spotifyApi.refreshAccessToken().then(async data => {
                await db.user_stats.set(interaction.user.id, data.body["access_token"], 'access_token');
                await spotifyApi.setAccessToken(data.body["access_token"]);
            }); 

            await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
                artistArray = data.body.item.artists.map(artist => artist.name);
                songName = data.body.item.name;
                spotifyUrl = data.body.item.external_urls.spotify;
                songArt = data.body.item.album.images[0].url;
                songLength = data.body.item.duration_ms;
                songCurMs = data.body.progress_ms;
                musicProgressBar = progressbar.splitBar(songLength / 1000, songCurMs / 1000, 10)[0];
                // Parse spotify to get rid of features and get remixers and stuff
                sp_data = parse_spotify(artistArray, songName);
                artistArray = sp_data[0];
                songName = sp_data[1];
                displayArtists = sp_data[2];
            });
        } else {
            interaction.member.presence.activities.forEach((activity) => {
                if (activity.type == 'LISTENING' && activity.name == 'Spotify' && activity.assets !== null) {
                    artistArray = activity.state;
                    songName = activity.details;
                    if (activity.state.includes('; ')) {
                        artistArray = artistArray.split('; ');
                    } else if (activity.state.includes(', ')) {
                        artistArray = artistArray.split(', '); // This is because of a stupid mobile discord bug
                    } else {
                        artistArray = [artistArray];
                    }
                    sp_data = parse_spotify(artistArray, songName);
                    spotifyUrl = `https://open.spotify.com/track/${activity.syncId}`;
                    yourRating = false;
                    songArt = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    artistArray = sp_data[0];
                    songName = sp_data[1];
                    displayArtists = sp_data[2];
                }
            });
        }

        const npEmbed = new Discord.MessageEmbed()
        .setColor(`${interaction.member.displayHexColor}`);
        npEmbed.setTitle(`${displayArtists.join(' & ')} - ${songName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s current song`, iconURL: `${interaction.user.avatarURL({ format: "png", dynamic: false })}` })
        .setThumbnail(songArt);

        if (db.reviewDB.has(artistArray[0])) {
            let songObj = db.reviewDB.get(artistArray[0], `["${songName}"]`);
            if (songObj != undefined) {
                let userArray = get_user_reviews(songObj);
                const rankNumArray = [];
                let starNum = 0;
                let yourStar = '';

                for (let i = 0; i < userArray.length; i++) {
                    if (userArray[i] == `${interaction.user.id}`) yourRating = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].rating`);
                    if (userArray[i] != 'ep') {
                        let rating;
                        rating = db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].rating`);
                        if (db.reviewDB.get(artistArray[0], `["${songName}"].["${userArray[i]}"].starred`) == true) {
                            starNum++;
                            if (userArray[i] == `${interaction.user.id}`) {
                                yourStar = '⭐'; //Added to the end of your rating tab
                            }
                        }
                        rankNumArray.push(parseFloat(rating));
                        userArray[i] = [rating, `${userArray[i]} \`${rating}\``];
                    }
                }

                if (rankNumArray.length != 0) { 
                    npEmbed.setDescription(`Reviews: \`${userArray.length} reviews\`` + 
                    `\nAverage Rating: \`${Math.round(average(rankNumArray) * 10) / 10}` + 
                    `\`${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}` + 
                    `${yourRating != false ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                    `${musicProgressBar != false ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
                } else {
                    npEmbed.setDescription(`This song has not been reviewed in the database.` + 
                    `${musicProgressBar != false ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
                }

                if (songObj.ep != undefined && songObj.ep != false) {
                    if (db.reviewDB.get(artistArray[0], `["${songObj.ep}"].art`) != false) {
                        npEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: db.reviewDB.get(artistArray[0], `["${db.reviewDB.get(artistArray[0], `["${songName}"].ep`)}"].art`) });
                    } else {
                        npEmbed.setFooter({ text: `from ${songObj.ep}` });
                    }
                }
            } else {
                npEmbed.setDescription(`This song has not been reviewed in the database.` + 
                `${musicProgressBar != false ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
            }
        } else {
            npEmbed.setDescription(`This song has not been reviewed in the database.` + 
            `${musicProgressBar != false ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
            `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
        }
        
        interaction.editReply({ embeds: [npEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
