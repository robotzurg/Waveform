const Discord = require('discord.js');
const db = require("../db.js");

module.exports = {
    name: 'getep',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795553162773266463',
    aliases: ['getep', 'getlp', 'gete'],
    description: 'Get all the songs from a specific EP and display them in an embed message.',
    args: true,
    arg_num: 2,
    usage: '<artist> | <ep>',
	execute(message, args) {

        let argArtistName;
        let argEPName;

        if (args.length === 2) {
            argArtistName = args[0];
            argEPName = args[1];
        } else if (args.length === 1) {
            argArtistName = false;
            argEPName = args[0];
        }

        // Function to grab average of all ratings later
        let average = (array) => array.reduce((a, b) => a + b) / array.length;

        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

        if (argArtistName === false) {
            const dbKeyArray = db.reviewDB.keyArray();
            let options = [];
            
            for (let i = 0; i < dbKeyArray.length; i++) {
                let aI = dbKeyArray.length - 1 - i;
                let AsongArray = Object.keys(db.reviewDB.get(dbKeyArray[aI]));
                AsongArray = AsongArray.filter(item => item !== 'Image');

                for (let ii = 0; ii < AsongArray.length; ii++) {
                    let vocalCheck = [db.reviewDB.get(dbKeyArray[aI], `["${AsongArray[ii]}"].Vocals`)].flat(1);
                    let collabCheck = db.reviewDB.get(dbKeyArray[aI], `["${AsongArray[ii]}"].Collab`);

                    if (Array.isArray(collabCheck)) {
                        collabCheck = collabCheck.toString();
                    }

                    if (AsongArray[ii] === args[0] && !vocalCheck.includes(dbKeyArray[aI]) && !options.includes(`${collabCheck} | ${AsongArray[ii]}`)) {
                        argArtistName = dbKeyArray[aI];
                        argEPName = AsongArray[ii];
                        options.push([argArtistName, argEPName]);
                        options[options.length - 1] = options[options.length - 1].join(' | ');
                    } 
                }
                
                if (options.length > 0) break;
            }
            
            if (options.length === 0) {
                return message.channel.send('There is no EP/LP in the database that exists with this name.');
            }
        }

        let artistName;

        if (!args[0].includes(',')) {
            artistName = argArtistName.split(' & ');
        } else {
            artistName = argArtistName.split(', ');
            if (artistName[artistName.length - 1].includes('&')) {
                let iter2 = artistName.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => artistName.push(a));
                console.log(iter2);
            }
        }

        const artistObj = db.reviewDB.get(artistName[0]);
        if (artistObj === undefined) {
            return message.channel.send('No artist found.');
        }

        const songArray = db.reviewDB.get(artistName[0], `["${argEPName}"].Songs`);
        if (songArray === undefined) {
            return message.channel.send('No EP found.');
        }
        let epThumbnail = db.reviewDB.get(artistName[0], `["${argEPName}"].Image`);

        let rankNumArray = [];
        let EPrankArray = [];
        let songRankArray = [];
        let rating;

		const exampleEmbed = new Discord.MessageEmbed()
            .setColor(`${message.member.displayHexColor}`)
            .setTitle(`${argArtistName} - ${argEPName} tracks`);

            let reviewNum = Object.keys(db.reviewDB.get(artistName[0], `["${argEPName}"]`));
            reviewNum = reviewNum.filter(e => e !== 'Image');
            reviewNum = reviewNum.filter(e => e !== 'Songs');
            reviewNum = reviewNum.filter(e => e !== 'Collab');

            for (let i = 0; i < reviewNum.length; i++) {
                console.log(argEPName);
                console.log(reviewNum[i]);
                rating = db.reviewDB.get(artistName[0], `["${argEPName}"].["${reviewNum[i]}"].EPRating`);
                console.log(rating);
                if (rating != false) {
                   EPrankArray.push(parseFloat(rating.slice(0, -3)));
                }
            }
            
            let epnum = 0;
            for (let i = 0; i < songArray.length; i++) {

                let songName = songArray[i];
                let rmxArtist = false;

                if (songArray[i].toLowerCase().includes('remix')) {
                    songName = songArray[i].substring(0, songArray[i].length - 7).split(' [')[0];
                    rmxArtist = songArray[i].substring(0, songArray[i].length - 7).split(' [')[1];
                }

                let songObj;

                if (rmxArtist === false) {
                    console.log(songArray[i]);
                    songObj = db.reviewDB.get(artistName[0], `["${songArray[i]}"]`);

                } else {
                    songObj = db.reviewDB.get(artistName[0], `["${songName}"].Remixers.["${rmxArtist}"]`);
                }

                if (epThumbnail != false && epThumbnail != undefined) {
                    exampleEmbed.setThumbnail(epThumbnail);
                } else {
                    exampleEmbed.setThumbnail(message.author.avatarURL({ format: "png", dynamic: false }));
                }

                epnum++;

                reviewNum = Object.keys(songObj);
                rankNumArray = [];
                let star_num = 0;

                reviewNum = reviewNum.filter(e => e !== 'Remixers');
                reviewNum = reviewNum.filter(e => e !== 'EP');
                reviewNum = reviewNum.filter(e => e !== 'Collab');
                reviewNum = reviewNum.filter(e => e !== 'Image');
                reviewNum = reviewNum.filter(e => e !== 'Vocals');
                reviewNum = reviewNum.filter(e => e !== 'Songs');
                reviewNum = reviewNum.filter(e => e !== 'EPpos');

                for (let ii = 0; ii < reviewNum.length; ii++) {
                    if (rmxArtist === false) {
                        rating = db.reviewDB.get(artistName[0], `["${songArray[i]}"].["${reviewNum[ii]}"].rate`);
                        if (db.reviewDB.get(artistName[0], `["${songArray[i]}"].["${reviewNum[ii]}"].starred`) === true) {
                            star_num++;
                        }
                    } else {
                        console.log(songArray[i]);
                        rating = db.reviewDB.get(rmxArtist, `["${songArray[i]}"].["${reviewNum[ii]}"].rate`);
                        if (db.reviewDB.get(rmxArtist, `["${songArray[i]}"].["${reviewNum[ii]}"].starred`) === true) {
                            star_num++;
                        }
                    }
                    rankNumArray.push(parseFloat(rating.slice(0, -3)));
                }

                reviewNum = reviewNum.length;

                exampleEmbed.addField(`${epnum}. ${songArray[i]} (Avg: ${Math.round(average(rankNumArray) * 10) / 10})`, `\`${reviewNum} review${reviewNum > 1 ? 's' : ''}\` ${star_num > 0 ? `\`${star_num} 🌟\`` : ''}`);
                songRankArray.push(Math.round(average(rankNumArray) * 10) / 10);
            }

        
            if (EPrankArray.length != 0) {
                exampleEmbed.setDescription(`*The average overall user rating of this EP is* ***${Math.round(average(EPrankArray) * 10) / 10}!***\n*The total average rating of all songs on this EP is* ***${Math.round(average(songRankArray) * 10) / 10}!***`);
            } else {
                exampleEmbed.setDescription(`*This EP has no overall user ratings.*\n*The total average rating of all songs on this EP is* ***${Math.round(average(songRankArray) * 10) / 10}!***`);
            }
        message.channel.send(exampleEmbed);
	},
};