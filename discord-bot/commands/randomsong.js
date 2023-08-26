const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { get_user_reviews, handle_error, getEmbedColor, convertToSetterName } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('randomsong')
        .setDescription('Get a random song from the bot that has been reviewed at least once.')
        .setDMPermission(false),
    help_desc: `This command will give you a random song from the database, from a random artist, and give you basic information about it, and a spotify link if one exists for it.\n\n` + 
    `Particularly useful if you want to find something random to listen to or review!`,
	async execute(interaction, client) {
        try {
        let average = (array) => array.reduce((a, b) => a + b) / array.length;
        let songArt, spotifyUrl, yourRating, origArtistArray, artistArray;
        let setterSongName;

        if (songArt == false) songArt = interaction.member.avatarURL({ extension: 'png' });

        let randomArtist = db.reviewDB.randomKey();
        let artistObj = db.reviewDB.get(randomArtist);
        let artistSongs = Object.keys(artistObj);
        artistSongs = artistSongs.filter(v => v !== 'pfp_image');
        let endRandomCheck = false;
        let randomSong, songObj;
        while (!endRandomCheck) {
            randomSong = artistSongs[Math.floor(Math.random() * artistSongs.length)];
            setterSongName = convertToSetterName(randomSong);
            songObj = db.reviewDB.get(randomArtist, `${setterSongName}`);
            let userArray = get_user_reviews(songObj);
            if (userArray.length != 0 && !randomSong.includes(' EP') && !randomSong.includes(' LP')) {
                endRandomCheck = true;
            }
        }

        if (randomSong.includes(' Remix)')) {
            artistArray = [randomArtist, songObj.remix_collab].flat(1);
            origArtistArray = songObj.collab;
        } else {
            artistArray = [randomArtist, songObj.collab].flat(1);
            origArtistArray = [randomArtist, songObj.collab].flat(1);
        }

        spotifyUrl = songObj.spotify_uri;
        songArt = songObj.art;
        if (songArt == undefined || songArt == false || songArt == '') songArt = null;
        if (spotifyUrl == undefined || spotifyUrl == false) {
            spotifyUrl = 'N/A';
        } else {
            spotifyUrl = `https://open.spotify.com/track/${spotifyUrl.replace('spotify:track:', '')}`;
        }

        const randomSongEmbed = new EmbedBuilder()
        .setColor(`${getEmbedColor(interaction.member)}`)
        .setTitle(`${origArtistArray.join(' & ')} - ${randomSong}`)
        .setAuthor({ name: `Random Song Choice`, iconURL: `${interaction.user.avatarURL({ extension: "png", dynamic: true })}` })
        .setThumbnail(songArt);

        if (db.reviewDB.has(artistArray[0])) {
            songObj = db.reviewDB.get(artistArray[0], `${setterSongName}`);

            if (songObj != undefined) {
                const guild = client.guilds.cache.get(interaction.guild.id);
                let localUserArray = await get_user_reviews(songObj, guild);
                let globalUserArray = await get_user_reviews(songObj);
                let globalRankNumArray = [];
                let localRankNumArray = [];
                let localStarNum = 0;
                let yourStar = '';

                // Global
                for (let i = 0; i < globalUserArray.length; i++) {
                    if (globalUserArray[i] == `${interaction.user.id}`) yourRating = songObj[globalUserArray[i]].rating;
                    let rating;
                    rating = songObj[globalUserArray[i]].rating;
                    
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

                if (globalRankNumArray.length != 0) { 
                    randomSongEmbed.setDescription(`\nAvg Global Rating: **\`${Math.round(average(globalRankNumArray) * 10) / 10}\`** \`with ${globalUserArray.length} reviews\`` +
                    `\nAvg Local Rating: **\`${localRankNumArray.length > 0 ? Math.round(average(localRankNumArray) * 10) / 10 : `N/A`}\`** \`with ${localUserArray.length} reviews\`` +
                    `${localStarNum >= 1 ? `\`Local Stars: \`${localStarNum} ⭐\`` : ''}` + 

                    `${(yourRating !== false && yourRating != undefined) ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                    `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
                } else if (globalUserArray.length != 0) {
                    randomSongEmbed.setDescription(`Local Reviews: ${localUserArray.length != 0 ? `\`${localUserArray.length} review${localUserArray.length > 1 ? 's' : ''}\`` : ``}` + 
                    `\`${localStarNum >= 1 ? `\nLocal Stars: \`${localStarNum} ⭐\`` : ''}` + 

                    `${(yourRating !== false && yourRating != undefined) ? `\nYour Rating: \`${yourRating}/10${yourStar}\`` : ''}` +
                    `${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
                } else {
                    randomSongEmbed.setDescription(`${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
                }

                if (songObj.ep != undefined && songObj.ep != false) {
                    if (db.reviewDB.get(db.reviewDB.get(artistArray[0])[songObj.ep]) != undefined) {
                        if (db.reviewDB.get(artistArray[0])[songObj.ep].art != false) {
                            randomSongEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: db.reviewDB.get(artistArray[0])[songObj.ep].art });
                        } else {
                            randomSongEmbed.setFooter({ text: `from ${songObj.ep}` });
                        }
                    } else if (randomSong.includes(' Remix)')) {
                        let epSongArt = db.reviewDB.get(songObj.collab[0], `${songObj.ep}.art`);
                        if (epSongArt != false) {
                            randomSongEmbed.setFooter({ text: `from ${songObj.ep}`, iconURL: epSongArt });
                        } else {
                            randomSongEmbed.setFooter({ text: `from ${songObj.ep}` });
                        }
                    } 
                }
            } else {
                randomSongEmbed.setDescription(`${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
            }
        } else {
            randomSongEmbed.setDescription(`${spotifyUrl == 'N/A' ? `` : `\n<:spotify:961509676053323806> [Spotify](${spotifyUrl})`}`);
        }
        
        interaction.reply({ embeds: [randomSongEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, client, error);
        }
	},
};
