const db = require("../db.js");
const { capitalize } = require("../func.js");

module.exports = {
	name: 'deleteartist',
    description: 'Deletes an artist from the database.',
	options: [
        {
            name: 'artist',
            type: 'STRING',
            description: 'The name of the artist.',
            required: true,
        },
    ],
    admin: true,
	async execute(interaction) {
		let args = [];

        await interaction.options.forEach(async (value) => {
            args.push(capitalize(value.value));
        });

		db.reviewDB.delete(args[0]);
		interaction.editReply(`${args[0]} deleted from the database.`);
	},
};