const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const db = require('../db.js');
const { handle_error, get_user_reviews } = require('../func.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topstarred')
        .setDescription('See a list of the top starred artists in the server!'),
    admin: false,
	async execute(interaction, client) {
        try {

        await interaction.editReply('Loading top star list, this takes a moment so please be patient!');
        let starList = [];

        let artistArray = db.reviewDB.keyArray();

        for (let i = 0; i < artistArray.length; i++) {
            let songArray = Object.keys(db.reviewDB.get(artistArray[i]));
            let starCount = 0;
            songArray = songArray.filter(v => v != 'Image');

            for (let j = 0; j < songArray.length; j++) {
                let userArray = db.reviewDB.get(artistArray[i], `["${songArray[j]}"]`);
                if (userArray != null && userArray != undefined) {
                    userArray = get_user_reviews(userArray);
                } else {
                    userArray = [];
                }

                for (let k = 0; k < userArray.length; k++) {
                    let userData = db.reviewDB.get(artistArray[i], `["${songArray[j]}"].["${userArray[k]}"]`);
                    if (userData.starred == true) {
                        starCount += 1;
                    }
                }
            }

            if (starCount != 0) starList.push({ name: artistArray[i], stars: starCount });
        }

        starList.sort((a, b) => { return b.stars - a.stars; });
        let inc = 1;
        starList = starList.map(v => {
            v = `${inc}. ${v.name} \`${v.stars} stars\``;
            inc += 1;
            return v;
        });
        starList = starList.slice(0, 10);

        const guild = await client.guilds.fetch(interaction.guild.id);
        const statsEmbed = new EmbedBuilder()
        .setColor(`${interaction.member.displayHexColor}`)
        .setThumbnail(guild.iconURL({ format: 'png' }))
        .setTitle('Top Starred Artists in the Server')
        .setDescription(starList.join('\n'));

        await interaction.editReply({ content: ' ', embeds: [statsEmbed] });

        } catch (err) {
            let error = err;
            handle_error(interaction, error);
        }
	},
};