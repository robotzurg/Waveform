const db = require("../db.js");
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Canvas, loadImage, FontLibrary } = require('skia-canvas');

const applyText = (canvas, text) => {
	const context = canvas.getContext('2d');

	// Declare a base size of the font
	let fontSize = 50;

	do {
		// Assign the font to the context and decrement it so it can be measured again
		context.font = `${fontSize -= 2}px main_med`;
        console.log(context.measureText(text).width, canvas.width + 300);
		// Compare pixel width of the text to the canvas minus the approximate avatar size
	} while (context.measureText(text).width > canvas.width - 650);

	// Return the result to use in the actual canvas
	return context.font;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
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

        ctx.font = applyText(canvas, taggedMember.displayName);
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
        ctx.fillText(`Psytrance`, canvas.width / 2, 525 - offset);
        ctx.fillText(`Future Bass`, canvas.width / 2, 565 - offset);
        ctx.fillText(`Hardstyle`, canvas.width / 2, 605 - offset);

        ctx.font = `40px main_reg`;
        ctx.fillText('Most Reviewed Artist', canvas.width / 2, 685 - offset);
        ctx.font = `25px main`;
        ctx.fillText(`Virtual Riot`, canvas.width / 2, 725 - offset);

        ctx.font = `40px main_reg`;
        ctx.fillText('Recently Starred', canvas.width / 2, 805 - offset);
        ctx.font = `25px main`;
        ctx.fillText(`Grant & MYRNE - Fault`, canvas.width / 2, 845 - offset);

        // Recent Review / Recent Stars lists

        /*let stats_x = 240;
        let stats_y = 330;*/

        let stats_x = 210;
        let stats_y = 250;

        ctx.font = `40px main_reg`;
        ctx.fillText('General Stats', stats_x, stats_y);
        ctx.font = `30px main`;
        ctx.fillText(`Stars: 50`, stats_x, stats_y + 40);
        ctx.fillText(`Reviews: 50`, stats_x, stats_y + 80);
        ctx.fillText(`EP Reviews: 50`, stats_x, stats_y + 120);
        ctx.fillText(`LP Reviews: 10`, stats_x, stats_y + 160);
        ctx.fillText(`10/10: 25`, stats_x, stats_y + 200);
        ctx.fillText(`0/10: 0`, stats_x, stats_y + 240);

        // Draw Waveform Logo
        const waveformLogo = await loadImage('./images/Waveform_Logo_Transparent.png');
        ctx.scale(0.3, 0.3);
        ctx.drawImage(waveformLogo, 3000, canvas.height / 2 + 1000);
        ctx.scale(3.35, 3.35);

        // Pick up the pen
        ctx.beginPath();

        // Start the arc to form a circle
        ctx.arc(121 + avatar.width / 2, 31 + avatar.height / 2, 65, 0, Math.PI * 2, true);

        // Put the pen down
        ctx.closePath();

        // Clip off the region you drew on
        ctx.clip();
        
        // Draw avatar
        ctx.drawImage(avatar, 121, 31);

        // render to files using a background thread
        async function render() {
            let pngData = await canvas.png;
            interaction.editReply({ files: [pngData] });
        }
        render();
    },
};