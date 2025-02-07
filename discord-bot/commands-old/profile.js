const db = require("../db.js");
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Canvas, loadImage, FontLibrary } = require('skia-canvas');
const { handle_error, getEmbedColor } = require("../func.js");

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
                .setRequired(false))
        // .addStringOption(option => 
        //     option.setName('extra_stats')
        //         .setDescription('If you want to see extended statistic info (will make the command take longer to load)')
        //         .setRequired(false)
        //         .addChoices({ name: 'yes', value: 'yes' }))
        .addStringOption(option => 
            option.setName('embed')
                .setDescription('View your profile as an embed, rather than a picture.')
                .setRequired(false)
                .addChoices({ name: 'yes', value: 'yes' })),
    help_desc: `Pulls up your Waveform profile, which displays some basic statistics about your reviewing as well as your specified favorite artist, favorite song, and favorite genres.\n\n` + 
    `You can view other users profiles by specifying them in the user argument, or leave it blank to view your own.\n` +
    `You can also view extra stats with the extra_stats argument, but keep in mind that this will make the command take a lot longer to run!\n` +
    `Finally, if you want to view data in embed form rather than picture, form, use the embed argument!`,
	async execute(interaction, client, serverConfig) {
        await interaction.deferReply();
        let canvas = new Canvas(1305, 872);
        // let extraStats = interaction.options.getString('extra_stats');
        let embedOpt = interaction.options.getString('embed');

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

            let userStatsObj = db.user_stats.get(taggedUser.id, 'stats');
            let starCount = userStatsObj.star_num;
            let reviewCount = userStatsObj.review_num;
            let epReviewCount = userStatsObj.ep_review_num;
            let tenCount = userStatsObj.ten_num;
            
            if (embedOpt != 'yes') {
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
                
                if (db.user_stats.get(taggedUser.id, 'fav_artist') == undefined) db.user_stats.set(taggedUser.id, 'N/A', 'fav_artist');

                ctx.font = `40px main_reg`;
                ctx.fillText('Favorite Artist', canvas.width / 2, 350 - offset);
                ctx.font = applyText('main', 25, 540, canvas, db.user_stats.get(taggedUser.id, 'fav_artist'));
                ctx.fillText(`${db.user_stats.get(taggedUser.id, 'fav_artist')}`, canvas.width / 2, 390 - offset);

                ctx.font = `40px main_reg`;
                ctx.fillText('Favorite Song', canvas.width / 2, 480 - offset);
                ctx.font = applyText('main', 25, 620, canvas, db.user_stats.get(taggedUser.id, 'fav_song'));
                ctx.fillText(`${db.user_stats.get(taggedUser.id, 'fav_song')}`, canvas.width / 2, 520 - offset);

                ctx.font = `40px main_reg`;
                ctx.fillText('Favorite Genres', canvas.width / 2, 615 - offset);
                ctx.font = `25px main`;
                let genreList = db.user_stats.get(taggedUser.id, 'fav_genres');
                while (genreList.length < 3) {
                    genreList.push('N/A');
                }
                for (let i = 0; i < genreList.length; i++) {
                    ctx.fillText(genreList[i], canvas.width / 2, 655 + (i * 40) - offset);
                }

                // Recent Review / Recent Stars lists
                let stats_x = 210;
                let stats_y = 250;

                ctx.font = `40px main_reg`;
                ctx.fillText('General Stats', stats_x, stats_y);
                ctx.font = `30px main`;
                ctx.fillText(`Favorites Given: ${starCount}`, stats_x, stats_y + 40);
                ctx.fillText(`Reviews: ${reviewCount}`, stats_x, stats_y + 80);
                ctx.fillText(`EP/LP Reviews: ${epReviewCount}`, stats_x, stats_y + 120);
                if (!serverConfig.disable_ratings) {
                    ctx.fillText(`10/10: ${tenCount}`, stats_x, stats_y + 160);
                }

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
            } else {
                const profileEmbed = new EmbedBuilder()
                .setColor(`${getEmbedColor(interaction.member)}`)
                .setTitle(`${taggedMember.displayName}'s Waveform Profile`)
                .setThumbnail(taggedUser.avatarURL({ extension: "png" }));

                let profileEmbedFields = [];
                profileEmbedFields.push({ name: 'Favorite Artist', value: db.user_stats.get(taggedUser.id, 'fav_artist') });

                profileEmbedFields.push({ name: 'Favorite Song', value: db.user_stats.get(taggedUser.id, 'fav_song') });

                let genreList = db.user_stats.get(taggedUser.id, 'fav_genres');
                while (genreList.length < 3) {
                    genreList.push('N/A');
                }

                let stats = `Favorites Given: \`${starCount}\`\n` + 
                `Reviews: \`${reviewCount}\`\n` +
                `EP/LP Reviews: \`${epReviewCount}\``;

                if (!serverConfig.disable_ratings) {
                    stats += `\n10/10: \`${tenCount}\``;
                }

                profileEmbedFields.push({ name: 'Favorite Genres', value: genreList.join('\n') });
                profileEmbedFields.push({ name: 'General Stats:', value: 
                stats, inline: true });

                profileEmbed.addFields(profileEmbedFields);
                interaction.editReply({ content: null, embeds: [profileEmbed] });
            }

        } catch (err) {
            console.log(err);
            let error = err;
            handle_error(interaction, client, error);
        }
    },
};
