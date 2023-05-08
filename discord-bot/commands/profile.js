const db = require("../db.js");
const { SlashCommandBuilder } = require('discord.js');
const { Canvas, loadImage, FontLibrary } = require('skia-canvas');
const { get_user_reviews, handle_error, find_most_duplicate } = require("../func.js");
const _ = require('lodash');

const applyText = (font, fontSize, cutoff, canvas, text) => {
	const context = canvas.getContext('2d');
	do {
		// Assign the font to the context and decrement it so it can be measured again
		context.font = `${fontSize -= 1}px ${font}`;
		// Compare pixel width of the text to the canvas minus the approximate avatar size
	} while (context.measureText(text).width > cutoff);

	// Return the result to use in the actual canvas
	return context.font;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Get a user profile.')
        .setDMPermission(false)
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose profile you\'d like to see.')
                .setRequired(false)),
    help_desc: `TBD`,
	async execute(interaction) {

        await interaction.reply('Loading profile, this may take a bit of time so please be patient!');
        let canvas = new Canvas(1305, 872);

        // render to files using a background thread
        async function render() {
            let pngData = await canvas.png;
            interaction.editReply({ content: null, files: [pngData] });
        }

        try {

            let taggedUser = interaction.options.getUser('user');
            let taggedMember;

            if (taggedUser != null) {
                taggedMember = await interaction.guild.members.fetch(taggedUser.id);
            } else {
                taggedMember = interaction.member;
                taggedUser = interaction.user;
            }

            let starCount = 0;
            let reviewCount = 0;
            let epReviewCount = 0;
            let lpReviewCount = 0;
            let tenCount = 0;
            let zeroCount = 0;
            let mostArtist = 0;
            let starArtistList = [];
            let mostStarred = 0;
            let artistCount = [];
            let songSkip = [];
            let ratingList = [];
            let ratingAvg = 0;

            let artistArray = db.reviewDB.keyArray();

            for (let i = 0; i < artistArray.length; i++) {
                let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
                db.reviewDB.delete(artistArray[i], 'Image');

                for (let j = 0; j < songArray.length; j++) {
                    let songObj = db.reviewDB.get(artistArray[i])[songArray[j]];
                    let userArray;
                    if (songObj != null && songObj != undefined) {
                        userArray = get_user_reviews(songObj);
                        userArray = userArray.filter(v => v == taggedUser.id);
                    } else {
                        userArray = [];
                    }
                    if (userArray.length != 0) {
                        artistCount.push(artistArray[i]);
                        if (songObj[userArray[0]].starred == true) {
                            starArtistList.push(artistArray[i]);
                        } 
                    }
                    if (songSkip.includes(`${artistArray[i]} - ${songArray[j]}`)) continue;

                    let otherArtists = [artistArray[i], songObj.collab].flat(1);

                    let allArtists = otherArtists.map(v => {
                        if (v == undefined) {
                            return [];
                        }
                        return v;
                    });
                    allArtists = allArtists.flat(1);

                    for (let k = 0; k < userArray.length; k++) {
                        let userData = songObj[userArray[k]];
                        reviewCount += 1;
                        ratingList.push(parseFloat(userData.rating));
                        if (songArray[j].includes(' EP')) epReviewCount += 1;
                        if (songArray[j].includes(' LP')) lpReviewCount += 1;
                        if (userData.starred == true) starCount += 1;

                        if (parseFloat(userData.rating) == 10) tenCount += 1;
                        if (parseFloat(userData.rating) == 0) zeroCount += 1;
                    }

                    for (let v = 0; v < allArtists.length; v++) {
                        if (!songSkip.includes(`${allArtists[v]} - ${songArray[j]}`)) {
                            songSkip.push(`${allArtists[v]} - ${songArray[j]}`);
                        }
                    }
                }
            }

            mostArtist = find_most_duplicate(artistCount);
            mostStarred = find_most_duplicate(starArtistList);
            ratingList = ratingList.filter(v => !Number.isNaN(v));
            ratingAvg = _.mean(ratingList);

            // If this is undefined, we have a legacy profile that needs to be setup properly and they need to work with me
            if (mostStarred == undefined) {
                return interaction.editReply('You have a legacy Waveform profile. Please message Jeff to get a proper one setup!');
            }

            FontLibrary.use("main", ["./fonts/LEMONMILK-Light.otf"]);
            FontLibrary.use("main_med", ["./fonts/LEMONMILK-Medium.otf"]);
            FontLibrary.use("main_reg", ["./fonts/LEMONMILK-Regular.otf"]);
            let ctx = canvas.getContext("2d");
            const background = await loadImage('./images/new_wallpaper.png');
            
            // This uses the canvas dimensions to stretch the image onto the entire canvas
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // Set the color of the stroke
            ctx.strokeStyle = '#0099ff';

            // Draw a rectangle with the dimensions of the entire canvas
            ctx.strokeRect(0, 0, canvas.width, canvas.height);
            const avatar = await loadImage(taggedUser.avatarURL({ extension: "png" }));

            ctx.font = applyText('main_med', 50, canvas.width - 650, canvas, taggedMember.displayName);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`${taggedMember.displayName}`, 285, 30 + avatar.height / 2);
            ctx.font = `30px main`;
            ctx.fillText(`Waveform Profile`, 285, 70 + avatar.height / 2);

            let offset = 45;
            ctx.textAlign = 'center';
            
            ctx.font = `40px main_reg`;
            ctx.fillText('Favorite Song', canvas.width / 2, 250 - offset);
            ctx.font = applyText('main', 25, 540, canvas, db.user_stats.get(taggedUser.id, 'fav_song'));
            ctx.fillText(`${db.user_stats.get(taggedUser.id, 'fav_song')}`, canvas.width / 2, 290 - offset);

            ctx.font = `40px main_reg`;
            ctx.fillText('Least Favorite Song', canvas.width / 2, 365 - offset);
            ctx.font = applyText('main', 25, 620, canvas, db.user_stats.get(taggedUser.id, 'least_fav_song'));
            ctx.fillText(`${db.user_stats.get(taggedUser.id, 'least_fav_song')}`, canvas.width / 2, 405 - offset);

            ctx.font = `40px main_reg`;
            ctx.fillText('Favorite Genres', canvas.width / 2, 485 - offset);
            ctx.font = `25px main`;
            let genreList = db.user_stats.get(taggedUser.id, 'fav_genres');
            while (genreList.length < 3) {
                genreList.push('N/A');
            }
            for (let i = 0; i < genreList.length; i++) {
                ctx.fillText(genreList[i], canvas.width / 2, 525 + (i * 40) - offset);
            }

            ctx.font = `40px main_reg`;
            ctx.fillText('Most Reviewed Artist', canvas.width / 2, 685 - offset);
            ctx.font = `25px main`;
            ctx.fillText(`${mostArtist[0][0]} (${mostArtist[0][1]} Reviews)`, canvas.width / 2, 725 - offset);

            ctx.font = `40px main_reg`;
            ctx.fillText('Most Starred Artist', canvas.width / 2, 805 - offset);
            ctx.font = `25px main`;
            ctx.fillText(`${mostStarred[0][0]} (${mostStarred[0][1]} Stars)`, canvas.width / 2, 845 - offset);

            // Recent Review / Recent Stars lists
            let stats_x = 210;
            let stats_y = 250;

            ctx.font = `40px main_reg`;
            ctx.fillText('General Stats', stats_x, stats_y);
            ctx.font = `30px main`;
            ctx.fillText(`Rating Avg: ${ratingAvg.toFixed(2)}`, stats_x, stats_y + 40);
            ctx.fillText(`Stars: ${starCount}`, stats_x, stats_y + 80);
            ctx.fillText(`Reviews: ${reviewCount}`, stats_x, stats_y + 120);
            ctx.fillText(`EP Reviews: ${epReviewCount}`, stats_x, stats_y + 160);
            ctx.fillText(`LP Reviews: ${lpReviewCount}`, stats_x, stats_y + 200);
            ctx.fillText(`10/10: ${tenCount}`, stats_x, stats_y + 240);
            ctx.fillText(`0/10: ${zeroCount}`, stats_x, stats_y + 280);

            // Draw Waveform Logo
            const waveformLogo = await loadImage('./images/Waveform_Logo_Transparent.png');
            ctx.scale(0.3, 0.3);
            ctx.drawImage(waveformLogo, 3000, canvas.height / 2 + 1000);
            ctx.scale(3.35, 3.35);

            // Pick up the pen
            ctx.beginPath();

            // Start the arc to form a circle
            ctx.arc(132 + avatar.width / 2, 31 + avatar.height / 2, 65, 0, Math.PI * 2, true);

            // Put the pen down
            ctx.closePath();

            // Clip off the region you drew on
            ctx.clip();
            
            // Draw avatar
            ctx.drawImage(avatar, 132, 31);

            render();

        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, error);
        }
    },
};
