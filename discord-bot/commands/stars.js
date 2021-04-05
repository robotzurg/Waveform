const Discord = require('discord.js');
const db = require('../db.js');

module.exports = {
	name: 'stars',
	type: 'Fun',
	description: 'Show a list of all the stars a user has!',
	execute(message) {
        let taggedUser;
        let taggedMember;

        if (message.mentions.users.first() != undefined) {
            taggedUser = message.mentions.users.first();
            taggedMember = message.mentions.members.first();
        } else {
            taggedUser = message.author;
            taggedMember = message.member;
        }

        const starCommandEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setThumbnail(taggedUser.avatarURL({ format: "png" }))
            .setTitle(`🌟 ${taggedMember.displayName}'s Stars 🌟`)
            .setDescription(`${db.user_stats.get(taggedUser.id, `star_list`).join('\n')}`);

        message.channel.send(starCommandEmbed);
	},
};