/* eslint-disable */
module.exports = {
	name: 'copypasta',
    aliases: ['copypasta', 'pasta'],
	type: 'Fun',
	description: 'Post one of the servers... many... copypastas.\nOptions: bold, egg',
    args: true,
    arg_num: 1,
    usage: '<copypasta>',
	execute(message, args) {
        if (args[0].toLowerCase() === 'bold') {

            message.channel.send(`Gonna drop a bold opinion. A lot of people can't seem to understand what makes Carol of the Cartels so lackluster to me, but it's pretty simple. It's not that the song itself is bad, it's the drops. While I am not normally a fan of Bossfight, this was a bigger disappointment than just being a Bossfight release, compared to other Bossfight it's actually pretty good. The issue with Carol of the Cartels is that it takes the original song, Carol of the Bells, and kind of kills the atmosphere it had. It starts out quite well, very true to the original but with enough difference to be unique, and then the drop hits. That's were it all goes wrong. It would have been so easy to make the drop sound remotely Christmas related, but instead he got lazy and made just kind of a standard banger drop with cut-ins of Carol of the Bells here and there. It just sounded incredibly lazy, almost like Bossfight had been making the drops before he heard about the Christmas album and then he kind of took them, changed them slightly (to add the Carol of the Bells cut ins) and slapped them onto a Carol of the Bells buildup. It just killed the atmosphere that the original carried. I get wanting to do something different but this ain't it, chief.`);

        } else if (args[0].toLowerCase() === 'egg') { 

            message.channel.send(`动态网自由门 天安門 天安门 法輪功 李洪志 Egg whites 六四天安門事件 Egg whites天安門大屠殺Egg whites 反右派鬥爭 Egg whites 大躍進政策 Egg whites 文化大革命 Egg whites 人權 Human Rights 民運 Egg whites 自由 Egg whites 獨立 Egg whites 多黨制 Egg whites 台灣 臺灣 Egg whites 中華民國 Egg whites 西藏 土伯特 唐古特 Egg whites 達賴喇嘛 Egg whites 法輪功 Egg whites 新疆維吾爾自治區 Egg whites 諾貝爾和平獎 Egg whites 劉暁波 Egg whites 民主 言論 思想 反共 反革命 抗議 運動 騷亂 暴亂 騷擾 擾亂 抗暴 平反 維權 示威游行 李洪志 法輪大法 大法弟子 強制斷種 強制堕胎 民族淨化 人體實驗 肅清 胡耀邦 趙紫陽 魏京生 王丹 還政於民 和平演變 激流中國 北京之春 大紀元時報 九評論共産黨 獨裁 專制 壓制 統一 監視 鎮壓 迫害 侵略 掠奪 破壞 拷問 屠殺 活摘器官 誘拐 買賣人口 遊進 走私 毒品 賣淫 春畫 賭博 六合彩 天安門 天安门 法輪功 李洪志 Egg whites 劉曉波动态网自由门`);

        } else {
            message.channel.send('Invalid tag.\nValid tags: `egg` and `bold`');
        }

	},
};