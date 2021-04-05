const Discord = require('discord.js');
const { prefix } = require('../config.json');
const { mailboxes } = require('../arrays.json');
const { msg_delete_timeout } = require('../func');

module.exports = {
    name: 'naddranking',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795728431983624213',
    aliases: ['naddranking', 'nrank', `nrankep`, `naddrankingep`],
    description: 'Create a ranking review of an EP/LP/Compilation/Remix Package or really anything. THIS DOES NOT ADD TO THE REVIEW DB.',
    args: true,
    arg_num: 4,
    usage: '<artist> | <ep/lp_name> | [op] <image> | [op] <user_that_sent_ep/lp>',
	execute(message, args) {

        const command = message.client.commands.get('addranking');
        const is_mailbox = mailboxes.includes(message.channel.name);


        let taggedUser = false;
        let taggedMember = false;
        let thumbnailImage = false;
        let msgtoEdit;

        if (args.length < 2) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, `Missing arguments!\nProper usage is: \`${prefix}${command.name} ${command.usage}\``);
        } else if (args.length === 3 || args.length === 4) {

            if (message.mentions.users.first() === undefined) { // If there isn't a user mentioned, then we know it's 3 arguments with no user mention.
                thumbnailImage = args[2];
            } else if (args.length === 3) { // If there is a user mentioned but only 3 arguments, then we know no image.
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
            } else if (args.length === 4) { // If there is both a user mentioned and 4 arguments, then we know both!
                thumbnailImage = args[2];
                taggedUser = message.mentions.users.first(); 
                taggedMember = message.mentions.members.first();
            }
        }

        message.delete(message);

        let exampleEmbed = new Discord.MessageEmbed()
        .setColor(`${message.member.displayHexColor}`)
        .setTitle(`${args[0]} - ${args[1]}`);

        if (args[1].includes('EP') || args[1].includes('The Remixes')) {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox EP ranking (Not added to DB)` : `${message.member.displayName}'s EP ranking (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        } else if (args[1].includes('LP')) {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox LP ranking (Not added to DB)` : `${message.member.displayName}'s LP ranking (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        } else {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox ranking (Not added to DB)` : `${message.member.displayName}'s ranking (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        }

        if (thumbnailImage === false) {
            exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
        } else {
            exampleEmbed.setThumbnail(thumbnailImage);
        }

        exampleEmbed.addField('Ranking:', `\`\`\`\u200B\`\`\``, true);
        if (taggedUser != false) {
            exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        (message.channel.send(exampleEmbed)).then((msg) => {
            msgtoEdit = msg;
            msg.react('👂');
        });

        const filter = m => m.author.id === message.author.id && (m.content.includes('(') || m.content.includes(')') || m.content.toLowerCase().includes('overall') || m.content.includes('!end'));
        const collector = message.channel.createMessageCollector(filter, { idle: 900000 });
        const rankArray = ['\n'];

        let rankPosition = 0;
        let songName;
        let fullSongName;
        let songRating;
        let id_tag;
        let position;
        // let rmxArtist;
        // let artistArray = args[0].split(' & ');
        let splitUpOverall;
        let overallString = -1;
        
        collector.on('collect', m => {
            if (m.content.includes('!end')) {
                collector.stop();
                m.delete();
                msgtoEdit.reactions.removeAll();
                return;
            } else if (m.content.includes(`Overall`)) {
                // const songArray = Object.keys(db.reviewDB.get(args[0]));

                if (overallString === -1) {
                    splitUpOverall = m.content.split('\n');
                    splitUpOverall.shift();
                    overallString = splitUpOverall;
                    m.delete();
                }

                collector.stop();
                msgtoEdit.reactions.removeAll();
            } else {
                rankPosition++; //Start by upping the rank position, so we can go from 1-whatever
                rankArray.push(`${rankPosition}. ${m.content}`);
                songRating = m.content.split(' '),
                    id_tag = '-',
                    position = songRating.indexOf(id_tag);

                if (~position) songRating.splice(position, 1);

                songName = songRating.splice(0, songRating.length - 1).join(" ");
                if (songName.includes('(feat') || songName.includes('(ft')) {
                    songName = songName.split(` (f`);
                    songName.splice(1);
                }

                songRating[0] = songRating[0].slice(1, -1);

                //Remix preparation
                if (songName.toLowerCase().includes('remix')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 7).split(' (')[0];
                    //rmxArtist = fullSongName.substring(0, fullSongName.length - 7).split(' (')[1];
                    //artistArray = songName.split(' & ');
                } else if (args[1].toLowerCase().includes('bootleg')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 9).split(' (')[0];
                   // rmxArtist = fullSongName.substring(0, fullSongName.length - 9).split(' (')[1];
                   // artistArray = songName.split(' & ');
                } else if (args[1].toLowerCase().includes('flip') || args[1].toLowerCase().includes('edit')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 6).split(' (')[0];
                   // rmxArtist = fullSongName.substring(0, fullSongName.length - 6).split(' (')[1];
                   // artistArray = songName.split(' & ');
                } else {
                   // rmxArtist = false;
                    fullSongName = false;
                }

                m.delete();
            }

            exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`${args[0]} - ${args[1]}`);

            if (args[1].includes('EP') || args[1].includes('The Remixes')) {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox EP ranking (Not added to DB)` : `${message.member.displayName}'s EP ranking (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else if (args[1].includes('LP')) {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox LP ranking (Not added to DB)` : `${message.member.displayName}'s LP ranking (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox ranking (Not added to DB)` : `${message.member.displayName}'s ranking (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            }

            if (overallString != -1) {
                exampleEmbed.setDescription(`${overallString}`);
            }

            if (thumbnailImage === false) {
                exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
            } else {
                exampleEmbed.setThumbnail(thumbnailImage);
            }

            exampleEmbed.addField('Ranking:', `\`\`\`${rankArray.join('\n')}\`\`\``, true);
            
            if (taggedUser != false) {
                exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }

            msgtoEdit.edit(exampleEmbed); 
        });
    },
};