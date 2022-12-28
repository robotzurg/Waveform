const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { get_user_reviews, handle_error, spotify_api_setup, parse_artist_song_data } = require('../func.js');
const ms_format = require('format-duration');
const progressbar = require('string-progressbar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Display your currently playing song on Spotify.')
        .setDMPermission(false),
    help_desc: `TBD`,
	async execute(interaction) {
        try {

        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        let songArt, spotifyUrl, yourRating, origArtistArray, artistArray, songName, songDisplayName, isPlaying = true, isPodcast = false;
        let songLength, songCurMs, musicProgressBar = false; // Spotify API specific variables 
        const spotifyApi = await spotify_api_setup(interaction.user.id);
        
        if (spotifyApi == false) return interaction.reply(`This command requires you to use \`/login\` `);

        await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
            if (data.body.currently_playing_type == 'episode') { isPodcast = true; return; }
            spotifyUrl = data.body.item.external_urls.spotify;
            songArt = data.body.item.album.images[0].url;
            songLength = data.body.item.duration_ms;
            songCurMs = data.body.progress_ms;
            musicProgressBar = progressbar.splitBar(songLength / 1000, songCurMs / 1000, 12)[0];
            isPlaying = data.body.is_playing;
            let song_info = await parse_artist_song_data(interaction);
            if (song_info == -1) return;

            origArtistArray = song_info.prod_artists;
            songName = song_info.song_name;
            artistArray = song_info.all_artists;
            songDisplayName = song_info.display_song_name;
        });

        // Check if a podcast is being played, as we don't support that.
        if (isPodcast == true) {
            return interaction.reply('Podcasts are not supported with `/np`.');
        }

        const npEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${songDisplayName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s ${isPlaying ? `current song` : `last song played`}`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: false })}` })
        .setThumbnail(songArt);

        if (db.reviewDB.has(artistArray[0])) {
            let songObj = db.reviewDB.get(artistArray[0])[songName];
            if (songObj != undefined) {
                let userArray = get_user_reviews(songObj);
                const rankNumArray = [];
                let starNum = 0;
                let yourStar = '';

                for (let i = 0; i < userArray.length; i++) {
                    if (userArray[i] == `${interaction.user.id}`) yourRating = songObj[userArray[i]].rating;
                    if (userArray[i] != 'ep') {
                        let rating;
                        rating = songObj[userArray[i]].rating;
                        if (songObj[userArray[i]].starred == true) {
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
                    `${(yourRating !== false && yourRating != undefined) ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                    `${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
                } else {
                    npEmbed.setDescription(`${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
                }

                if (songObj.ep != undefined && songObj.ep != false) {
                    if (db.reviewDB.get(db.reviewDB.get(artistArray[0])[songObj.ep]) != undefined) {
                        if (db.reviewDB.get(artistArray[0])[songObj.ep].art != false) {
                            npEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: db.reviewDB.get(artistArray[0])[songObj.ep].art });
                        } else {
                            npEmbed.setFooter({ text: `from ${songObj.ep}` });
                        }
                    }
                }
            } else {
                npEmbed.setDescription(`${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
            }
        } else {
            npEmbed.setDescription(`${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
            `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`);
        }
        
        interaction.reply({ embeds: [npEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
