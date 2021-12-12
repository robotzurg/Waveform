const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../db.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('num_of_reviews')
		.setDescription('Number of Reviews in the Database.'),
	async execute(interaction) {
		let artist;
		let counter = 0;
		const artistArray = db.reviewDB.keyArray();

		for (let a = 0; a < 20; a++) {

			artist = artistArray[a];

			const artistObj = db.reviewDB.get(artist);

			let songObjKeys = Object.keys(artistObj);
			songObjKeys = songObjKeys.filter(x => x != 'Image');
			for (let i = 0; i < songObjKeys.length; i++) {
				let userArray = db.reviewDB.get(artist, songObjKeys[i]);
				userArray = Object.keys(userArray);
				userArray = userArray.filter(x => x != 'vocals');
				userArray = userArray.filter(x => x != 'collab');
				userArray = userArray.filter(x => x != 'ep');
				userArray = userArray.filter(x => x != 'hof_id');
				userArray = userArray.filter(x => x != 'art');
				userArray = userArray.filter(x => x != 'review_num');
				userArray = userArray.filter(x => x != 'remixers');
				userArray = userArray.filter(x => x != 'songs');

				for (let j = 0; j < userArray.length; j++) {
					if (userArray[j] == '205726084291887104') {
						let reviewObj = db.reviewDB.get(artist, `["${songObjKeys[i]}"].["${userArray[j]}"]`);
						db.reviewDB.delete(artist, `["${songObjKeys[i]}"].205726084291887104`);
						db.reviewDB.set(artist, reviewObj, `["${songObjKeys[i]}"].734123244868862052`);
						console.log(`Review of ${artist} - ${songObjKeys[i]} by ${reviewObj.name}: ${reviewObj.rating}/10`);
						counter += 1;
					}
				}
			}
	
		}

		console.log(counter);
	},
};
