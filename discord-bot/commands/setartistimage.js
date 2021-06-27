const db = require("../db.js");
const { capitalize } = require("../func.js");

module.exports = {
	name: 'setartistimage',
	type: 'Review DB',
	moreinfo: 'https://discord.com/channels/680864893552951306/794751896823922708/795553872143187968',
	aliases: ['setartistimage', 'setai'],
	description: 'Set an image for an artist, for the database.',
	args: true,
	arg_num: 2,
	usage: '<artist> | [op] <url>',
	async execute(message, args) {

		//Auto-adjustment to caps for each word
        args[0] = capitalize(args[0]);

		let thumbnailImage;
		if (args.length < 1) {
			return message.channel.send('Image missing!');
		} else if (args.length === 1 && message.attachments.first() != undefined) {
			thumbnailImage = message.attachments.first().attachment;
		} else if (args.length === 2) {
			thumbnailImage = args[1];
		}

		console.log(thumbnailImage);

		if (args.length === 3 && message.attachments.first() != undefined) {
			return message.channel.send('Please only use a direct image link, or an attachment, not both.');
		}
		
		let artistArray = args[0].split(' & ');

        if (!args[0].includes(',')) {
            artistArray = args[0].split(' & ');
        } else {
            artistArray = args[0].split(', ');
            if (artistArray[artistArray.length - 1].includes('&')) {
                let iter2 = artistArray.pop();
                iter2 = iter2.split(' & ');
                iter2 = iter2.map(a => artistArray.push(a));
                console.log(iter2);
            }
        }

        for (let i = 0; i < artistArray.length; i++) {
			if (db.reviewDB.has(artistArray[i])) {
				if (db.reviewDB.get(artistArray[i], 'Image') != undefined) {
					db.reviewDB.set(artistArray[i], thumbnailImage, `Image`);
				} else {
					let artistObj = db.reviewDB.get(artistArray[i]);
					artistObj.Image = thumbnailImage;
					db.reviewDB.set(artistArray[i], artistObj);
				}
			} else {
				db.reviewDB.set(artistArray[i], {
					Image: thumbnailImage,
				});
			}
            
        }

		return message.channel.send(`Image for ${args[0]} changed.`);
	},
};