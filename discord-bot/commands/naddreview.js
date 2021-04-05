const Discord = require('discord.js');
const { prefix } = require('../config.json');
const { mailboxes } = require('../arrays.json');
const { msg_delete_timeout } = require('../func');

module.exports = {
    name: 'naddreview',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795728431983624213',
    aliases: ['naddreview', 'nreview', 'nadd'],
    description: 'Create a song rating embed message! THIS DOES NOT ADD TO REVIEW DB.',
    args: true,
    arg_num: 6,
    usage: '<artist> | <song_name> | <rating> | <review> |  [op] <link_to_song_picture> | [op] <user_that_sent_song>',
	execute(message, args) {
        let rating = args[2];
        let review = args[3];

        if (args[2].length > 10) {
            rating = args[3];
            review = args[2];
        }

        if (args[1].includes('EP') || args[1].toLowerCase().includes('LP') || args[1].toLowerCase().includes('Remixes')) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, 'You can only use this command to rank singles/single remixes.\nPlease use `!addReviewEP` for EP Reviews/Rankings!');
        }

        const command = message.client.commands.get('addreview');
        const is_mailbox = mailboxes.includes(message.channel.name);
        
        //Remix preparation
        let songName;
        // let rmxArtist;
        if (args[1].toLowerCase().includes('remix')) {
            songName = args[1].substring(0, args[1].length - 7).split(' (')[0];
            //rmxArtist = args[1].substring(0, args[1].length - 7).split(' (')[1];
        } else if (args[1].toLowerCase().includes('bootleg)')) {
            songName = args[1].substring(0, args[1].length - 9).split(' (')[0];
            //rmxArtist = args[1].substring(0, args[1].length - 9).split(' (')[1];
        } else if (args[1].toLowerCase().includes('flip)') || args[1].toLowerCase().includes('edit)')) {
            songName = args[1].substring(0, args[1].length - 6).split(' (')[0];
            //rmxArtist = args[1].substring(0, args[1].length - 6).split(' (')[1];
        } else {
            songName = args[1];
            //rmxArtist = false;
        }

        if (args[1].includes('(feat') || args[1].includes('(ft')) {
            songName = songName.split(` (f`);
            songName.splice(1);
        } else if (args[1].includes('feat')) {
            songName = songName.split(' feat.');
            songName.splice(1);
        } else if (args[1].includes('ft')) {
            songName = songName.split(' ft.');
            songName.splice(1);
        }

        if (songName.includes('(VIP)')) {
            songName = songName.split(' (');
            songName = `${songName[0]} ${songName[1].slice(0, -1)}`;
        }
        //let artistArray = args[0].split(' & ');
        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = message.author.avatarURL({ format: "png", dynamic: false });

        if (args.length < 4) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, `Missing arguments!\nProper usage is: \`${prefix}${command.name} ${command.usage}\``);
        } else if (args.length === 5 || args.length === 6) {

            if (message.mentions.users.first() === undefined) { // If there isn't a user mentioned, then we know it's 3 arguments with no user mention.
                thumbnailImage = args[4];
            } else if (args.length === 3) { // If there is a user mentioned but only 3 arguments, then we know no image.
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
            } else if (args.length === 4) { // If there is both a user mentioned and 4 arguments, then we know both!
                thumbnailImage = args[4];
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
            }

            if (thumbnailImage.includes('spotify')) {
                message.author.presence.activities.forEach((activity) => {
                    if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets !== null) {
                        thumbnailImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
                    }
                });
            }
        }

        const exampleEmbed = new Discord.MessageEmbed()
        .setColor(`${message.member.displayHexColor}`)
        .setTitle(`${args[0]} - ${args[1]}`)
        .setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox review (Not added to DB)` : `${message.member.displayName}'s review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        exampleEmbed.setDescription(review)
        .setThumbnail(thumbnailImage)
        .addField('Rating: ', `**${rating}**`, true);
        if (taggedUser != false) {
            exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        message.delete(message);

        // Send the embed rate message
        return message.channel.send(exampleEmbed); 
    },
};