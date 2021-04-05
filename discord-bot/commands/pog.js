module.exports = {
    name: 'pog',
    type: 'Fun',
	description: 'Make the bot pog randomly!',
	execute(message) {
        const pogchoices = [
            '<:pogcat:731386480563454002>',
            '<:monkeypog:705919224245387275>',
            '<:GrantPog:681213278487183388>',
            '<:au5pog:746187720363212962>',
            '<:pogclose:796973676934594590>',
            '<:apogg:802041048700157953>',
            '<:MoyaiPog:809278354871681065>',
            '<:Pogchimp:809278346474160150>',
            '<:PogChamp:809279078829522984>',
        ];

        const pick = pogchoices[Math.floor(Math.random() * pogchoices.length)];
        message.delete();
		message.channel.send(pick);
	},
};