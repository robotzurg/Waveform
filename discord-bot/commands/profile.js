const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Canvas, loadImage, FontLibrary } = require('skia-canvas');
const { get_user_reviews } = require("../func.js");

const applyText = (fontSize, cutoff, canvas, text) => {
	const context = canvas.getContext('2d');

	do {
		// Assign the font to the context and decrement it so it can be measured again
		context.font = `${fontSize -= 2}px main_med`;
		// Compare pixel width of the text to the canvas minus the approximate avatar size
	} while (context.measureText(text).width > cutoff);

	// Return the result to use in the actual canvas
	return context.font;
};

const findMostDuplicate = (array) => {
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
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Display your (or others) user profile!')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user whose profile you\'d like to see.')
                .setRequired(false)),
	admin: false,
	async execute(interaction) {

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
        let recentStar = 0;
        let artistCount = [];
        let songSkip = [];

        let artistArray = db.reviewDB.keyArray();

        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            for (let j = 0; j < songArray.length; j++) {
                let userArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"]`);
                userArray = get_user_reviews(userArray);
                userArray = userArray.filter(v => v == taggedUser.id);
                if (userArray.length != 0) artistCount.push(artistArray[i]);
                if (songSkip.includes(songArray[j])) continue;

                for (let k = 0; k < userArray.length; k++) {
                    let userData = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].["${userArray[k]}"]`);
                    reviewCount += 1;
                    if (songArray[j].includes(' EP')) epReviewCount += 1;
                    if (songArray[j].includes(' LP')) lpReviewCount += 1;
                    if (userData.starred == true) {
                        starCount += 1;
                        recentStar = `${artistArray[i]} - ${songArray[j]}`;
                    }
                    if (parseFloat(userData.rating) == 10) tenCount += 1;
                    if (parseFloat(userData.rating) == 0) zeroCount += 1;
                }
                songSkip.push(songArray[j]);
            }
        }

        mostArtist = findMostDuplicate(artistCount);

        FontLibrary.use("main", [
            "./LEMONMILK-Light.otf",
        ]);

        FontLibrary.use("main_med", [
            "./LEMONMILK-Medium.otf",
        ]);

        FontLibrary.use("main_reg", [
            "./LEMONMILK-Regular.otf",
        ]);

        let canvas = new Canvas(1305, 872);
        let ctx = canvas.getContext("2d");

        const background = await loadImage('./images/new_wallpaper.png');
        
        // This uses the canvas dimensions to stretch the image onto the entire canvas
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Set the color of the stroke
        ctx.strokeStyle = '#0099ff';

        // Draw a rectangle with the dimensions of the entire canvas
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        const avatar = await loadImage(taggedUser.displayAvatarURL({ format: 'png' }));

        ctx.font = applyText(50, canvas.width - 650, canvas, taggedMember.displayName);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(`${taggedMember.displayName}`, 285, 30 + avatar.height / 2);
        ctx.font = `30px main`;
        ctx.fillText(`Waveform Profile`, 285, 70 + avatar.height / 2);

        let offset = 45;

        ctx.textAlign = 'center';
        
        ctx.font = `40px main_reg`;
        ctx.fillText('Favorite Song', canvas.width / 2, 250 - offset);
        ctx.font = `25px main`;
        ctx.fillText(`${db.user_stats.get(taggedUser.id, 'fav_song')}`, canvas.width / 2, 290 - offset);

        ctx.font = `40px main_reg`;
        ctx.fillText('Least Favorite Song', canvas.width / 2, 365 - offset);
        ctx.font = `25px main`;
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
        ctx.fillText('Recently Starred', canvas.width / 2, 805 - offset);
        ctx.font = `25px main`;
        ctx.fillText(`${recentStar}`, canvas.width / 2, 845 - offset);

        // Recent Review / Recent Stars lists

        /*let stats_x = 240;
        let stats_y = 330;*/

        let stats_x = 210;
        let stats_y = 250;

        ctx.font = `40px main_reg`;
        ctx.fillText('General Stats', stats_x, stats_y);
        ctx.font = `30px main`;
        ctx.fillText(`Stars: ${starCount}`, stats_x, stats_y + 40);
        ctx.fillText(`Reviews: ${reviewCount}`, stats_x, stats_y + 80);
        ctx.fillText(`EP Reviews: ${epReviewCount}`, stats_x, stats_y + 120);
        ctx.fillText(`LP Reviews: ${lpReviewCount}`, stats_x, stats_y + 160);
        ctx.fillText(`10/10: ${tenCount}`, stats_x, stats_y + 200);
        ctx.fillText(`0/10: ${zeroCount}`, stats_x, stats_y + 240);

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

        // render to files using a background thread
        async function render() {
            let pngData = await canvas.png;
            interaction.editReply({ files: [pngData] });
        }
        render();
    },
};