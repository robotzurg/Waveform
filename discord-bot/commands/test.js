const db = require('../db.js');

module.exports = {
	name: 'test',
	description: 'Ping the bot, mostly for checking if its alive.',
	options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The user whos profile you\'d like to see.',
            required: true,
        },
    ],
	admin: false,
	execute(interaction) {
		let artist;

		/*interaction.options.forEach((value) => {
			//artist = value.value;
        });*/

		const artistArray = db.reviewdb_old.keyArray();

		for (let a = 0; a < artistArray.length; a++) {

			artist = artistArray[a];

			const artistObj = db.reviewdb_old.get(artist);
			if (artist.includes('&')) { console.log(`Failed: (Artist name includes &) ${artist}`); continue; }
			if (artist.includes('.')) { console.log(`Failed: (Artist name includes .) ${artist}`); continue; }
			if (artistObj === undefined) { interaction.editReply(`Failed: (Artist Not Found) ${artist}`); continue; }

			let newArtistObj = {
				Image: false,
			};

			let songObjKeys = Object.keys(artistObj);
			songObjKeys = songObjKeys.filter(x => x != 'Image');
			for (let i = 0; i < songObjKeys.length; i++) {
				if (songObjKeys[i].toLowerCase().split(" ").includes('remix') || songObjKeys[i].toLowerCase().split(" ").includes('ep') || songObjKeys[i].toLowerCase().split(" ").includes('lp')) {
					console.log(`Failed:  (EP/LP/Remix review) ${songObjKeys[i]}`);
					continue;
				}

				let userArray = db.reviewdb_old.get(artist, songObjKeys[i]);
				userArray = Object.keys(userArray);
				userArray = userArray.filter(x => x != 'Collab');
				userArray = userArray.filter(x => x != 'Vocals');
				userArray = userArray.filter(x => x != 'EP');
				userArray = userArray.filter(x => x != 'Image');
				userArray = userArray.filter(x => x != 'Remixers');
				userArray = userArray.filter(x => x != 'EPpos');
				userArray = userArray.filter(x => x != '<@277534255301525504>');
				userArray = userArray.filter(x => x != '<@283068026960609283>');
				let newSongObj = {};
				let newReviewObj = {};
				let review_number = 0;
				let songObj = db.reviewdb_old.get(artist, `["${songObjKeys[i]}"]`);

				newSongObj = {
					"art": songObj.Image,
					"collab": songObj.Collab,
					"ep": false,
					"hof_id": false,
					"review_num": 0,
					"remixers": [],
					"vocals": songObj.Vocals,
				};

				if (userArray.length === 0) {
					console.log(`Failed: (song only remixers, no actual reviews.) ${artist} - ${songObjKeys[i]}`);
					continue;
				}

				for (let j = 0; j < userArray.length; j++) {
					let reviewObj = db.reviewdb_old.get(artist, `["${songObjKeys[i]}"].["${userArray[j]}"]`);
					
					review_number += 1;
					if (reviewObj.starred === undefined) reviewObj.starred = false;

					if (!reviewObj.rate.includes('/10') || reviewObj.rate === undefined) console.log(`Failed: (rating improperly formatted.) ${artist} - ${songObjKeys[i]}`);

					newReviewObj = {
						"name": reviewObj.name,
						"rating": parseFloat(reviewObj.rate.slice(0, -3)),
						"review": reviewObj.review,
						"sentby": reviewObj.sentby,
						"starred": reviewObj.starred,
					};

					let star_list = db.user_stats.get(userArray[j].slice(0, -1).slice(2), 'star_list');
					let rev_list = db.user_stats.get(userArray[j].slice(0, -1).slice(2), 'review_list');

					if (reviewObj.starred === true) {
						for (let s = 0; s < star_list.length; s++) {
							if (star_list[s].split(" ").includes(songObjKeys[i])) break;
							db.user_stats.push(userArray[j].slice(0, -1).slice(2), `${artist} - ${songObjKeys[i]}`, 'star_list');
							db.user_stats.math(userArray[j].slice(0, -1).slice(2), '+', 1, 'star_num');
						} 
					}

					for (let r = 0; r < rev_list.length; r++) {
						if (rev_list[r].split(" ").includes(songObjKeys[i])) break;
						db.user_stats.push(userArray[j].slice(0, -1).slice(2), `${artist} - ${songObjKeys[i]}`, 'review_list');
					}

					newSongObj[`${userArray[j]}`.slice(0, -1).slice(2)] = newReviewObj;
				}

				newSongObj.review_num = review_number;

				newArtistObj[`${songObjKeys[i]}`] = newSongObj;

				db.reviewDB.set(artist, newArtistObj);
				console.log(`Passed: ${artist}`);

			
			}

		}

	},
};