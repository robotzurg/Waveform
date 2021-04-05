const Discord = require('discord.js');
const { prefix } = require('../config.json');
const { mailboxes } = require('../arrays.json');
const { msg_delete_timeout } = require('../func');

module.exports = {
    name: 'naddreviewep',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795728431983624213',
    aliases: ['naddreviewep', 'nreviewep', 'naddep'],
    description: '(Main Method) Create an EP/LP rating embed message! Use !end to end the chain. THIS DOES NOT ADD TO THE REVIEW DB.',
    args: true,
    arg_num: 4,
    usage: '<artist> | <ep/lp_name> | [op] <image> | [op] <user_that_sent_ep/lp>',
	execute(message, args) {

        if (!args[1].toLowerCase().includes('ep') && !args[1].toLowerCase().includes('lp') && !args[1].toLowerCase().includes('remixes')) {
            msg_delete_timeout(message, 15000);
            return msg_delete_timeout(message, 15000, 'You can only use this command to rank EPs/LPs/Remix Packages. Comps are not yet supported.\nPlease use `!addReview` for singles!');
        }

        const command = message.client.commands.get('addreviewep');
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
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox EP review (Not added to DB)` : `${message.member.displayName}'s EP review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        } else if (args[1].includes('LP')) {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox LP review (Not added to DB)` : `${message.member.displayName}'s LP review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        } else {
            exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox review (Not added to DB)` : `${message.member.displayName}'s review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
        }

        if (thumbnailImage === false) {
            exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
        } else {
            exampleEmbed.setThumbnail(thumbnailImage);
        }

        if (taggedUser != false) {
            exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
        }

        (message.channel.send(exampleEmbed)).then((msg) => {
            msgtoEdit = msg;
            msg.react('👂');
        });

        const filter = m => m.author.id === message.author.id && (m.content.includes('(') || m.content.includes('[') || m.content.includes('ft') || m.content.includes('feat') || m.content.includes('Overall') || m.content.includes('!end'));
        const collector = message.channel.createMessageCollector(filter, { idle: 900000 });
        const rankArray = [];
        let splitUpArray;
        let splitUpOverall;
        let songName;
        let fullSongName;
        let songRating;
        let songReview;
        let id_tag;
        let position;
        let rmxArtist;
        let overallString = -1;
        // let artistArray = args[0].split(' & ');
        
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
                splitUpArray = m.content.split('\n'); 
                songReview = splitUpArray[1];
                if (songReview === undefined) {
                    songReview = 'No written review.';
                    splitUpArray[1] = 'No written review.';
                }

                rankArray.push(splitUpArray);
                songRating = splitUpArray[0].split(' '),
                    id_tag = '-',
                    position = songRating.indexOf(id_tag);

                if (~position) songRating.splice(position, 1);
                songName = songRating.splice(0, songRating.length - 1).join(" ");

                //Remix preparation
                if (songName.toString().toLowerCase().includes('remix')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 7).split(' (')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 7).split(' (')[1];
                } else if (songName.toString().toLowerCase().includes('bootleg')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 9).split(' (')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 9).split(' (')[1];
                } else if (songName.toString().toLowerCase().includes('flip') || songName.toString().toLowerCase().includes('edit')) {
                    fullSongName = songName;
                    songName = fullSongName.substring(0, fullSongName.length - 6).split(' (')[0];
                    rmxArtist = fullSongName.substring(0, fullSongName.length - 6).split(' (')[1];
                } else {
                    rmxArtist = false;
                    fullSongName = false;
                }

                if (songName.includes('(feat') || songName.includes('(ft')) {
                    songName = songName.split(` (f`);
                    songName.splice(1);
                } else if (songName.includes('feat')) {
                    songName = songName.split(' feat');
                    songName.splice(1);

                    if (rmxArtist != false) {
                        fullSongName = fullSongName.split(' feat. ');
                        fullSongName = `${fullSongName[0]} (${fullSongName[1].split(' (')[1]}`;
                    }
                } else if (songName.includes('ft')) {
                    songName = songName.split(' ft');
                    songName.splice(1);

                    if (rmxArtist != false) {
                        fullSongName = fullSongName.split(' ft. ');
                        fullSongName = `${fullSongName[0]} (${fullSongName[1].split(' (')[1]}`;
                    }
                }

                m.delete();
            }
            

            exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`${args[0]} - ${args[1]}`);

            if (args[1].includes('EP')) {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox EP review (Not added to DB)` : `${message.member.displayName}'s EP review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else if (args[1].includes('LP')) {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox LP review (Not added to DB)` : `${message.member.displayName}'s LP review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            } else {
                exampleEmbed.setAuthor(is_mailbox ? `${message.member.displayName}'s mailbox review (Not added to DB)` : `${message.member.displayName}'s review (Not added to DB)`, `${message.author.avatarURL({ format: "png", dynamic: false })}`);
            }

            if (thumbnailImage === false) {
                exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
            } else {
                exampleEmbed.setThumbnail(thumbnailImage);
            }
            
            for (let i = 0; i < rankArray.length; i++) {
                exampleEmbed.addField(rankArray[i][0], rankArray[i][1]);
            }

            if (overallString != -1) {
                exampleEmbed.addField('Overall Thoughts:', overallString);
            }

            if (taggedUser != false) {
                exampleEmbed.setFooter(`Sent by ${taggedMember.displayName}`, `${taggedUser.avatarURL({ format: "png", dynamic: false })}`);
            }

            msgtoEdit.edit(exampleEmbed);

        });

    },
};