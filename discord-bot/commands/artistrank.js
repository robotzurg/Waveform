const Discord = require('discord.js');
const db = require("../db.js");

module.exports = {
    name: 'artistrank',
    type: 'Review DB',
    moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795553872143187968',
    aliases: ['artistrank', 'artistranking'],
    description: 'Look at a ranking of all the artists songs, based on the average ratings in the server!',
    args: true,
    arg_num: 1,
    usage: '<artist>',
	execute(message, args) {

        //Auto-adjustment to caps for each word
        args[0] = args[0].split(' ');
        args[0] = args[0].map(a => a.charAt(0).toUpperCase() + a.slice(1));
        args[0] = args[0].join(' ');

        let ranking = [];
		const artistObj = db.reviewDB.get(args[0]);
        if (artistObj === undefined) return message.channel.send('Artist not found.');
        let songArray = Object.keys(artistObj);
        songArray = songArray.filter(e => e !== 'Image');
        let average = (array) => array.reduce((a, b) => a + b) / array.length;

        for (let i = 0; i < songArray.length; i++) {
            let userRatingArray = [];
            let songObj = db.reviewDB.get(args[0], `["${songArray[i]}"]`);
            let userArray = Object.keys(songObj);
    
            userArray = userArray.filter(e => e !== 'EP');
            userArray = userArray.filter(e => e !== 'Image');
            userArray = userArray.filter(e => e !== 'Remixers');
            userArray = userArray.filter(e => e !== 'Collab');
            userArray = userArray.filter(e => e !== 'Vocals');
            userArray = userArray.filter(e => e !== 'EPpos');
            console.log(userArray);
                    
            for (let ii = 0; ii < userArray.length; ii++) {
                let rating = parseFloat(db.reviewDB.get(args[0], `["${songArray[i]}"].${userArray[ii]}.rate`));
                userRatingArray.push(rating);
            }

            if (userArray.length >= 1 && !songArray[i].includes('Remix') && !songArray[i].includes('EP') && !songArray[i].includes('LP') && !songArray[i].includes('/')) {
                ranking.push({ name: songArray[i], rating: parseFloat(Math.round(average(userRatingArray) * 10) / 10), reviewnum: userArray.length });
            }
            
        }

        ranking = ranking.sort(function(a, b) {
            return b.rating - a.rating;
        });
        
        const rankingEmbed = new Discord.MessageEmbed()
        .setColor(`${message.member.displayHexColor}`)
        .setTitle(`${args[0]}'s tracks, ranked`);

        for (let i = 0; i < ranking.length; i++) {
           rankingEmbed.addField(`${i + 1}. ${ranking[i].name} \`${ranking[i].reviewnum} review${ranking[i].reviewnum > 1 ? 's' : ''}\``, `Average Rating: \`${ranking[i].rating}\``);
        }

        
        message.channel.send(rankingEmbed);
    },
};