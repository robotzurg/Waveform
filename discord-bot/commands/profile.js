const db = require("../db.js");
const { get_args } = require('../func.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { Canvas, loadImage } = require('skia-canvas');
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
        let args = [];
        args = get_args(interaction, args);

        let taggedUser;
        let taggedMember;
        
        if (args.length != 0) {
            taggedMember = await interaction.guild.members.fetch(args[0]);
            taggedUser = taggedMember.user;
        } else {
            taggedMember = interaction.member;
            taggedUser = interaction.user;
        }

        let canvas = new Canvas(640, 360);
        let ctx = canvas.getContext("2d");

        const background = await loadImage('./images/wallpaper.jpg');

        // This uses the canvas dimensions to stretch the image onto the entire canvas
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        // Set the color of the stroke
        ctx.strokeStyle = '#0099ff';

        // Draw a rectangle with the dimensions of the entire canvas
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        const avatar = await loadImage(taggedUser.displayAvatarURL({ format: 'png' }));

        ctx.font = `22px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(taggedMember.displayName, 100 + avatar.width / 2, canvas.height / 2 - 75);

        ctx.fillText('Favorite Song', 450, canvas.height / 2 - 125);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(taggedUser.id, 'fav_song')}`, 450, canvas.height / 2 - 100);

        ctx.font = `25px sans-serif`;
        ctx.fillText('Least Favorite Song', 450, canvas.height / 2 - 50);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(taggedUser.id, 'least_fav_song')}`, 450, canvas.height / 2 - 25);

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
        ctx.fillText(`${db.user_stats.get(taggedUser.id, 'recent_review')}`, 450, canvas.height / 2 + 75);

        ctx.font = `25px sans-serif`;
        ctx.fillText('Stars Given', 450, canvas.height / 2 + 125);
        ctx.font = `15px sans-serif`;
        ctx.fillText(`${db.user_stats.get(taggedUser.id, 'star_list').length} ⭐`, 450, canvas.height / 2 + 150);

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
            let pngData = await canvas.png;
            interaction.editReply({ files: [pngData] });
        }
        render();
    },
};