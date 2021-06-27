const db = require('../db.js');

module.exports = {
	name: 'ping',
	description: 'Ping the bot, mostly for checking if its alive.',
	options: [],
	admin: false,
	execute(interaction, client) {
		interaction.editReply(`Pong. ${client.ws.ping}ms`);

		const artistObj = db.reviewdb_old.get("Remzcore");
		let songObjKeys = Object.keys(artistObj);
		songObjKeys = songObjKeys.filter(x => x != 'Image');
		for (let i = 0; i < songObjKeys.length; i++) {
			if (songObjKeys[i].toLowerCase().includes('remix') || songObjKeys[i].toLowerCase().includes('ep')) return console.log('false');

			let userArray = db.reviewdb_old.get('Remzcore', songObjKeys[i]);
			userArray = Object.keys(userArray);
			userArray = userArray.filter(x => x != 'Collab');
			userArray = userArray.filter(x => x != 'Vocals');
			userArray = userArray.filter(x => x != 'EP');
			userArray = userArray.filter(x => x != 'Image');
			userArray = userArray.filter(x => x != 'Remixers');
			let newSongObj = {};
			let newReviewObj = {};

			for (let j = 0; j < userArray.length; j++) {
				if (userArray[j] === '<@277534255301525504>' || userArray[j] === '<@283068026960609283>') return console.log('false');
				let reviewObj = db.reviewdb_old.get('Remzcore', `["${songObjKeys[i]}"].["${userArray[j]}"]`);
				let songObj = db.reviewdb_old.get('Remzcore', `["${songObjKeys[i]}"]`);

				newReviewObj = {
					"name": reviewObj.name,
					"rating": parseFloat(reviewObj.rate.slice(0, -3)),
					"review": reviewObj.review,
					"sentby": reviewObj.sentby,
					"starred": reviewObj.starred,
				};

				newSongObj = {
					[`${userArray[j]}`]: newReviewObj,
					"art": songObj.Image,
					"collab": songObj.Collab,
					"ep": songObj.EP,
					"hof_id": false,
					"review_num": 1,
					"remixers": [],
					"vocals": songObj.Vocals,
				};

				console.log(newSongObj);

			}

			


			
		}


	},
};