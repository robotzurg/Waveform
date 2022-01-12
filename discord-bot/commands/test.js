/* eslint-disable */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Canvas, loadImage } = require('skia-canvas');
const db = require('../db.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('test'),
    async execute(interaction) {

        let canvas = new Canvas(640, 360);
        ctx = canvas.getContext("2d");

        const background = await loadImage('./images/wallpaper.jpg');

        // This uses the canvas dimensions to stretch the image onto the entire canvas
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height)

        // Set the color of the stroke
        ctx.strokeStyle = '#0099ff';

        // Draw a rectangle with the dimensions of the entire canvas
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        const avatar = await loadImage(interaction.user.displayAvatarURL({ format: 'png' }));

        ctx.font = `25px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center'
        ctx.fillText(interaction.member.displayName, 100 + avatar.width / 2, canvas.height / 2 - 75);

        ctx.fillText('Favorite Song', 450, canvas.height / 2 - 125);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(interaction.user.id, 'fav_song')}`, 450, canvas.height / 2 - 100);

        ctx.font = `25px sans-serif`;
        ctx.fillText('Least Favorite Song', 450, canvas.height / 2 - 50);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(interaction.user.id, 'least_fav_song')}`, 450, canvas.height / 2 - 25);

        ctx.beginPath();
        ctx.moveTo(350, canvas.height / 2 + 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineTo(550, canvas.height / 2 + 2);
        ctx.stroke();
        ctx.closePath();

        ctx.font = `25px sans-serif`;
        ctx.fillText('Recently Reviewed', 450, canvas.height / 2 + 50);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(interaction.user.id, 'recent_review')}`, 450, canvas.height / 2 + 75);

        ctx.font = `25px sans-serif`;
        ctx.fillText('Stars Given', 450, canvas.height / 2 + 125);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(interaction.user.id, 'star_list').length} ⭐`, 450, canvas.height / 2 + 150);
        //ctx.fillText(interaction.member.displayName, 75 + avatar.width / 2, canvas.height / 2 - 75);
        //ctx.fillText(interaction.member.displayName, 75 + avatar.width / 2, canvas.height / 2 - 75);

        // Pick up the pen
        ctx.beginPath();

        // Start the arc to form a circle
        ctx.arc(100 + avatar.width / 2, canvas.height / 2, 60, 0, Math.PI * 2, true);

        // Put the pen down
        ctx.closePath();

        // Clip off the region you drew on
        ctx.clip();
        
        // Draw a shape onto the main canvas
        ctx.drawImage(avatar, 100, canvas.height / 2 - avatar.height / 2);

        // render to files using a background thread
        async function render() {
            let pngData = await canvas.png
            interaction.editReply({ files: [pngData] });
        }
        render();

	},
};

