const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { get_user_reviews, handle_error, spotify_api_setup, parse_artist_song_data, getEmbedColor, convertToSetterName } = require('../func.js');
const ms_format = require('format-duration');
const progressbar = require('string-progressbar');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Display your currently playing song on Spotify.')
        .setDMPermission(false),
    help_desc: `If logged into Waveform with Spotify, this command will display your currently playing song, and some basic data in Waveform about the song, if any exists.\n\n` + 
    `This requires /login to be successfully run before it can be used, and can only be used with Spotify.`,
	async execute(interaction) {
        try {
        await interaction.deferReply();
        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        let songArt, spotifyUrl, yourRating, origArtistArray, artistArray, songName, songDisplayName, isPlaying = true, isPodcast = false, validSong = true;
        let setterSongName, song_info;
        let songLength, songCurMs, musicProgressBar = false; // Song length bar variables
        const spotifyApi = await spotify_api_setup(interaction.user.id);
        
        if (spotifyApi == false) return interaction.editReply(`This command requires you to use \`/login\` `);

        await spotifyApi.getMyCurrentPlayingTrack().then(async data => {
            if (data.body.currently_playing_type == 'episode') { isPodcast = true; return; }
            if (data.body.item.is_local == false) {
                spotifyUrl = data.body.item.external_urls.spotify;
                songArt = data.body.item.album.images[0].url;
            } else {
                spotifyUrl = 'N/A';
                songArt = false;
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

        // Check if a podcast is being played, as we don't support that.
        if (isPodcast == true) {
            return interaction.editReply('Podcasts are not supported with `/np`.');
        } else if (validSong == false) {
            return interaction.editReply(`This song cannot be parsed by Waveform, therefore cannot be pulled up.`);
        }

        if (songArt == false) songArt = interaction.member.avatarURL({ extension: 'png' });

        const npEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${songDisplayName}`)
        .setAuthor({ name: `${interaction.member.displayName}'s ${isPlaying ? `current song` : `last song played`}`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: false })}` })
        .setThumbnail(songArt);

        if (db.reviewDB.has(artistArray[0])) {
            let songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);

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
                        
                        if (rating != false) rankNumArray.push(parseFloat(rating));
                        userArray[i] = [rating, `${userArray[i]} \`${rating}\``];
                    }
                }

                if (rankNumArray.length != 0) { 
                    npEmbed.setDescription(`Reviews: ${userArray.length != 0 ? `\`${userArray.length} reviews\`` : ``}` + 
                    `\nAverage Rating: \`${Math.round(average(rankNumArray) * 10) / 10}` + 
                    `\`${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}` + 
                    `${(yourRating !== false && yourRating != undefined) ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                    `${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
                } else if (userArray.length != 0) {
                    npEmbed.setDescription(`Reviews: ${userArray.length != 0 ? `\`${userArray.length} reviews\`` : ``}` +  
                    `${starNum >= 1 ? `\nStars: \`${starNum} ⭐\`` : ''}` + 
                    `${(yourRating !== false && yourRating != undefined) ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                    `${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
                } else {
                    npEmbed.setDescription(`${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                    `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
                }

                if (songObj.ep != undefined && songObj.ep != false) {
                    if (db.reviewDB.get(db.reviewDB.get(artistArray[0])[songObj.ep]) != undefined) {
                        if (db.reviewDB.get(artistArray[0])[songObj.ep].art != false) {
                            npEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: db.reviewDB.get(artistArray[0])[songObj.ep].art });
                        } else {
                            npEmbed.setFooter({ text: `from ${songObj.ep}` });
                        }
                    } else if (songName.includes(' Remix)')) {
                        let epSongArt = db.reviewDB.get(songObj.collab[0], `${songObj.ep}.art`);
                        if (epSongArt != false) {
                            npEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: epSongArt });
                        } else {
                            npEmbed.setFooter({ text: `from ${songObj.ep}` });
                        }
                    } 
                }
            } else {
                npEmbed.setDescription(`${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
                `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
            }
        } else {
            npEmbed.setDescription(`${musicProgressBar != false && isPlaying == true ? `\n\`${ms_format(songCurMs)}\` ${musicProgressBar} \`${ms_format(songLength)}\`` : ''}` +
            `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
        }
        
        interaction.editReply({ embeds: [npEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};
